/** Same 0–400-ish scale used in the UI (`Math.round(rating * 80)`). */
export function showScoreFromRating(rating: number): number {
  return Math.round(rating * 80);
}

/**
 * Expected show quality (1–5 rating scale) for your current promotion popularity.
 * Fans expect more as the brand grows.
 */
export function getExpectedShowRating(promotionPopularity: number): number {
  const p = Math.max(0, promotionPopularity);
  const raw = 2.2 + Math.min(1.85, p * 0.044);
  return Math.round(raw * 20) / 20;
}

const GAIN_PER_RATING_POINT = 2.75;
const LOSS_PER_RATING_POINT = 0.42;

/**
 * Compare final show rating to the expectation for popularity going into the show.
 * Gains use a higher multiplier than losses (easier to climb than to fall).
 */
export function computePromotionPopularityDelta(
  showRating: number,
  promotionPopularityBeforeShow: number,
): { delta: number; expectedRating: number } {
  const expectedRating = getExpectedShowRating(promotionPopularityBeforeShow);
  const diff = showRating - expectedRating;
  const eps = 0.004;

  if (diff > eps) {
    const delta = Math.max(1, Math.round(diff * GAIN_PER_RATING_POINT));
    return { delta, expectedRating };
  }
  if (diff < -eps) {
    const delta = -Math.max(1, Math.round(Math.abs(diff) * LOSS_PER_RATING_POINT));
    return { delta, expectedRating };
  }

  return { delta: 0, expectedRating };
}

/** Fill % toward the next whole popularity (e.g. at 1 the bar is empty until progress toward 2). */
export function getPromotionPopularityBar(popularity: number): {
  fillPercent: number;
  segmentLow: number;
  segmentHigh: number;
} {
  const p = Math.max(0, popularity);
  const segmentLow = Math.floor(p);
  const segmentHigh = segmentLow + 1;
  const span = segmentHigh - segmentLow;
  const fillPercent = span <= 0 ? 0 : Math.min(100, Math.max(0, ((p - segmentLow) / span) * 100));
  return { fillPercent, segmentLow, segmentHigh };
}
