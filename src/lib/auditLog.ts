// Audit logging utility
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuditLog } from '@/types/financial';

/**
 * Log an action to the audit trail
 */
export async function logAction(
  userId: string,
  userName: string,
  userRole: string,
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject',
  entityType: string,
  entityId: string,
  changes?: {
    oldValue?: any;
    newValue?: any;
  },
  storeId?: string
): Promise<void> {
  try {
    const db = getFirestore();
    
    // Prepare audit log data, filtering out undefined values
    const auditLogData: any = {
      timestamp: new Date().toISOString(),
      userId,
      userName,
      userRole,
      action,
      entityType,
      entityId,
      ipAddress: await getClientIP(),
      userAgent: navigator.userAgent,
      storeId: storeId || '',
      createdAt: serverTimestamp(),
    };

    // Only add oldValue and newValue if they are defined
    if (changes?.oldValue !== undefined) {
      auditLogData.oldValue = changes.oldValue;
    }
    if (changes?.newValue !== undefined) {
      auditLogData.newValue = changes.newValue;
    }

    await addDoc(collection(db, 'auditLogs'), auditLogData);
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Get client IP address (best effort)
 */
async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Create a snapshot of an object for audit comparison
 */
export function createSnapshot(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Compare two objects and return changes
 */
export function getChanges(oldObj: any, newObj: any): {
  oldValue: any;
  newValue: any;
} {
  const changes: any = {};
  const oldChanges: any = {};
  const newChanges: any = {};

  // Find changed, added, and removed properties
  const allKeys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {})
  ]);

  allKeys.forEach(key => {
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      oldChanges[key] = oldVal;
      newChanges[key] = newVal;
    }
  });

  return {
    oldValue: oldChanges,
    newValue: newChanges
  };
}
