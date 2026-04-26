import { describe, expect, it } from 'vitest';
import { applyReviewAggregateTransition } from '@/lib/productReviews';

describe('product review aggregate math', () => {
  it('adds approved review into aggregate', () => {
    const result = applyReviewAggregateTransition({
      previousAverage: 4,
      previousCount: 2,
      rating: 5,
      transition: 'approve',
    });

    expect(result.ratingCount).toBe(3);
    expect(result.rating).toBe(4.33);
  });

  it('removes approved review from aggregate', () => {
    const result = applyReviewAggregateTransition({
      previousAverage: 4.5,
      previousCount: 2,
      rating: 4,
      transition: 'remove',
    });

    expect(result.ratingCount).toBe(1);
    expect(result.rating).toBe(5);
  });

  it('resets aggregate when last review is removed', () => {
    const result = applyReviewAggregateTransition({
      previousAverage: 5,
      previousCount: 1,
      rating: 5,
      transition: 'remove',
    });

    expect(result.ratingCount).toBe(0);
    expect(result.rating).toBe(0);
  });
});
