import { describe, expect, it } from 'vitest';
import { canRetryNotification, normalizeNotificationStatus } from '@/lib/orderNotificationUtils';

describe('order notification helpers', () => {
  it('allows retry only for failed notifications', () => {
    expect(canRetryNotification('failed')).toBe(true);
    expect(canRetryNotification('pending')).toBe(false);
    expect(canRetryNotification('sent')).toBe(false);
    expect(canRetryNotification('skipped')).toBe(false);
  });

  it('normalizes unknown statuses to pending', () => {
    expect(normalizeNotificationStatus('sent')).toBe('sent');
    expect(normalizeNotificationStatus('failed')).toBe('failed');
    expect(normalizeNotificationStatus('other')).toBe('pending');
  });
});
