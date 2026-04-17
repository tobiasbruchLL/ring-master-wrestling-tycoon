/** Integer tier (1+) for unlocks and expectations; `popularity` may include fractional progress toward the next tier. */
export function promotionTier(popularity: number): number {
  return Math.max(1, Math.floor(popularity));
}

/** Stored promotion value cannot drop below tier 1. */
export function clampPromotionPopularity(value: number): number {
  return Math.max(1, value);
}

/** Same 0–400-ish scale used in the UI (`Math.round(rating * 80)`). */
export function showScoreFromRating(rating: number): number {
  return Math.round(rating * 80);
}

/**
 * Expected show quality (1–5 rating scale) for your current promotion popularity.
 * Fans expect more as the brand grows.
 */
export function getExpectedShowRating(promotionPopularity: number): number {
  const tier = promotionTier(promotionPopularity);
  const raw = 2.2 + Math.min(1.85, tier * 0.044);
  return Math.round(raw * 20) / 20;
}

/** ~0.30 toward the next tier when you beat expectations by ~1 star (tunable). */
const GAIN_BASE = 0.12;
const GAIN_PER_RATING_POINT = 0.18;
const GAIN_CAP = 0.55;
const LOSS_BASE = 0.03;
const LOSS_PER_RATING_POINT = 0.045;
const LOSS_FLOOR = 0.22;

/**
 * Compare final show rating to the expectation for popularity going into the show.
 * Returns fractional progress toward the next tier (1.0 = one full level); losses are smaller than gains.
 */
export function computePromotionPopularityDelta(
  showRating: number,
  promotionPopularityBeforeShow: number,
): { delta: number; expectedRating: number } {
  const expectedRating = getExpectedShowRating(promotionPopularityBeforeShow);
  const diff = showRating - expectedRating;
  const eps = 0.004;

  if (diff > eps) {
    const raw = GAIN_BASE + diff * GAIN_PER_RATING_POINT;
    const delta = Math.min(GAIN_CAP, Math.max(0.06, raw));
    return { delta: Math.round(delta * 1000) / 1000, expectedRating };
  }
  if (diff < -eps) {
    const raw = -(LOSS_BASE + Math.abs(diff) * LOSS_PER_RATING_POINT);
    const delta = Math.max(-LOSS_FLOOR, raw);
    return { delta: Math.round(delta * 1000) / 1000, expectedRating };
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
