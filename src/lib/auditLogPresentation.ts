type AuditLogLike = {
  action?: string;
  entityType?: string;
  entityId?: string;
  userName?: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export type AuditLogPresentation = {
  headline: string;
  details: string[];
};

const ACTION_VERBS: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  approve: 'approved',
  reject: 'rejected',
};

const ENTITY_LABELS: Record<string, string> = {
  order: 'order',
  product: 'product',
  customer: 'customer',
  supplier: 'supplier',
  rawMaterial: 'raw material',
  raw_material: 'raw material',
  recipe: 'recipe',
  supplier_return: 'supplier return',
  sales_return: 'sales return',
  productionBatch: 'production batch',
  finished_goods: 'finished goods item',
  purchase: 'purchase',
  return: 'return',
  staff: 'staff member',
  salary: 'salary record',
  sub_account: 'team account',
};

const SKIP_DETAIL_KEYS = new Set([
  'id',
  'storeId',
  'createdAt',
  'updatedAt',
  'userId',
  'ownerId',
  '_stockDeliveryCount',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickLabel(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const keys = [
    'invoiceNumber',
    'orderNumber',
    'name',
    'customerName',
    'title',
    'label',
    'sku',
    'productName',
    'businessName',
    'email',
  ];
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function formatMoney(value: unknown): string | null {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function humanizeField(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    return value.length > 80 ? `${value.slice(0, 77)}…` : value;
  }
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (typeof value === 'object') return 'updated record';
  return String(value);
}

function formatEntityReference(
  entityType: string,
  entityId: string,
  data: Record<string, unknown> | null,
): string {
  const label = pickLabel(data);
  const typeLabel = ENTITY_LABELS[entityType] || entityType.replace(/_/g, ' ');
  if (label) return `${typeLabel} ${label}`;
  if (entityId) return `${typeLabel} #${entityId.slice(0, 8)}`;
  return typeLabel;
}

function formatFieldChange(key: string, oldVal: unknown, newVal: unknown): string {
  const label = humanizeField(key);
  if (oldVal === undefined) return `${label} set to ${formatScalar(newVal)}`;
  if (newVal === undefined) return `${label} removed (was ${formatScalar(oldVal)})`;
  return `${label} changed from ${formatScalar(oldVal)} to ${formatScalar(newVal)}`;
}

function appendCreateDetails(entityType: string, newData: Record<string, unknown>, details: string[]) {
  if (entityType === 'order') {
    const customer = newData.customerName;
    const total = formatMoney(newData.subtotal ?? newData.total ?? newData.totalAmount);
    if (typeof customer === 'string' && customer.trim()) {
      details.push(`Customer: ${customer.trim()}`);
    }
    if (total !== null) details.push(`Amount: ${total}`);
    const itemCount = Array.isArray(newData.items) ? newData.items.length : 0;
    if (itemCount > 0) details.push(`${itemCount} line item(s)`);
    return;
  }

  const label = pickLabel(newData);
  if (label) details.push(`Name: ${label}`);

  const amount = formatMoney(newData.amount ?? newData.total ?? newData.totalAmount ?? newData.price);
  if (amount !== null) details.push(`Amount: ${amount}`);

  const status = newData.status;
  if (typeof status === 'string' && status.trim()) {
    details.push(`Status: ${status}`);
  }
}

function appendUpdateDetails(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  details: string[],
) {
  if (!oldData && !newData) return;

  const keys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {}),
  ]);

  for (const key of keys) {
    if (SKIP_DETAIL_KEYS.has(key)) continue;
    const oldVal = oldData?.[key];
    const newVal = newData?.[key];
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;
    details.push(formatFieldChange(key, oldVal, newVal));
    if (details.length >= 6) break;
  }
}

export function presentAuditLog(entry: AuditLogLike): AuditLogPresentation {
  const action = String(entry.action || 'unknown').toLowerCase();
  const verb = ACTION_VERBS[action] || action;
  const userName = String(entry.userName || 'System');
  const entityType = String(entry.entityType || 'record');
  const entityId = String(entry.entityId || '');

  const oldData = asRecord(entry.oldValue);
  const newData = asRecord(entry.newValue);
  const ref = formatEntityReference(entityType, entityId, newData || oldData);

  const headline = `${userName} ${verb} ${ref}`;
  const details: string[] = [];

  if (action === 'create' && newData) {
    appendCreateDetails(entityType, newData, details);
  } else if (action === 'update') {
    appendUpdateDetails(oldData, newData, details);
  } else if (action === 'delete' && oldData) {
    const label = pickLabel(oldData);
    if (label) details.push(`Removed: ${label}`);
  } else if (action === 'approve' || action === 'reject') {
    const label = pickLabel(newData || oldData);
    if (label) details.push(`Record: ${label}`);
  }

  if (details.length === 0 && newData) {
    for (const [key, value] of Object.entries(newData)) {
      if (SKIP_DETAIL_KEYS.has(key)) continue;
      if (value === '' || value === null || value === undefined) continue;
      if (typeof value === 'object') continue;
      details.push(`${humanizeField(key)}: ${formatScalar(value)}`);
      if (details.length >= 4) break;
    }
  }

  return { headline, details };
}

export function auditLogSearchText(entry: AuditLogLike): string {
  const { headline, details } = presentAuditLog(entry);
  return [headline, ...details].join(' ').toLowerCase();
}
