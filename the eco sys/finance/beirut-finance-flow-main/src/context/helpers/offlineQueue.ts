// Lightweight offline operation queue

export interface PendingOperation {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data?: any;
  filters?: Record<string, any>;
  timestamp: number;
}

const STORAGE_KEY = 'pendingOperations';

export const loadPendingOps = (): PendingOperation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const savePendingOps = (ops: PendingOperation[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
};

export const addPendingOp = (op: Omit<PendingOperation, 'id' | 'timestamp'>): PendingOperation => {
  const newOp: PendingOperation = {
    ...op,
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  const ops = loadPendingOps();
  ops.push(newOp);
  savePendingOps(ops);
  return newOp;
};

export const removePendingOp = (opId: string) => {
  const ops = loadPendingOps().filter(o => o.id !== opId);
  savePendingOps(ops);
};

export const clearPendingOps = () => {
  localStorage.removeItem(STORAGE_KEY);
};
