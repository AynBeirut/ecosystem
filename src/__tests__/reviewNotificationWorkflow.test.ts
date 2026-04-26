import { describe, expect, it } from 'vitest';
import { applyReviewAggregateTransition } from '@/lib/productReviews';
import { canRetryNotification, normalizeNotificationStatus } from '@/lib/orderNotificationUtils';

describe('review + notification workflow', () => {
  it('keeps aggregate unchanged while review is pending, then updates after moderation', () => {
    const before = { rating: 4.2, ratingCount: 5 };

    const pendingState = applyReviewAggregateTransition({
      previousAverage: before.rating,
      previousCount: before.ratingCount,
      rating: 5,
      transition: 'noop',
    });

    expect(pendingState).toEqual(before);

    const approvedState = applyReviewAggregateTransition({
      previousAverage: pendingState.rating,
      previousCount: pendingState.ratingCount,
      rating: 5,
      transition: 'approve',
    });

    expect(approvedState.ratingCount).toBe(6);
    expect(approvedState.rating).toBe(4.33);

    const rejectedLaterState = applyReviewAggregateTransition({
      previousAverage: approvedState.rating,
      previousCount: approvedState.ratingCount,
      rating: 5,
      transition: 'remove',
    });

    expect(rejectedLaterState).toEqual(before);
  });

  it('retries notification only when delivery failed', () => {
    expect(canRetryNotification(normalizeNotificationStatus('failed'))).toBe(true);
    expect(canRetryNotification(normalizeNotificationStatus('sent'))).toBe(false);
    expect(canRetryNotification(normalizeNotificationStatus('pending'))).toBe(false);
    expect(canRetryNotification(normalizeNotificationStatus('skipped'))).toBe(false);
  });
});
