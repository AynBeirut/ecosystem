export type ReviewTransition = 'approve' | 'remove' | 'noop';

export function applyReviewAggregateTransition(input: {
  previousAverage: number;
  previousCount: number;
  rating: number;
  transition: ReviewTransition;
}): { rating: number; ratingCount: number } {
  const previousAverage = Number.isFinite(input.previousAverage) ? input.previousAverage : 0;
  const previousCount = Number.isFinite(input.previousCount) ? Math.max(0, input.previousCount) : 0;
  const rating = Number.isFinite(input.rating) ? Math.max(0, input.rating) : 0;

  if (input.transition === 'noop') {
    return { rating: Number(previousAverage.toFixed(2)), ratingCount: previousCount };
  }

  if (input.transition === 'approve') {
    const nextCount = previousCount + 1;
    const nextAvg = ((previousAverage * previousCount) + rating) / nextCount;
    return { rating: Number(nextAvg.toFixed(2)), ratingCount: nextCount };
  }

  const nextCount = Math.max(0, previousCount - 1);
  if (nextCount === 0) {
    return { rating: 0, ratingCount: 0 };
  }

  const nextAvg = ((previousAverage * previousCount) - rating) / nextCount;
  return { rating: Number(nextAvg.toFixed(2)), ratingCount: nextCount };
}
