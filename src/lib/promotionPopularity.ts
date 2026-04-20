import { expectedAverageMatchScoreForPopularityTier } from '../constants';

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
 * Map mean match score (uncapped) onto the internal 1–5 show-quality band (e.g. blended `Show.rating`).
 */
export function showQualityRatingFromAverageMatchScore(avg: number): number {
  if (!Number.isFinite(avg) || avg <= 0) return 1;
  return Math.min(5, Math.max(1, Math.round((1.4 + avg / 120) * 20) / 20));
}

/** Inverse of `showQualityRatingFromAverageMatchScore` for a legacy stored 1–5 expectation (save migration). */
export function averageMatchScoreFromExpectedQualityRating(rating: number): number {
  return Math.max(0, Math.round((rating - 1.4) * 120));
}

/** Mean match score fans expect for this promotion popularity (`EXPECTED_AVERAGE_MATCH_SCORE_BY_POPULARITY_TIER`). */
export function getExpectedAverageMatchScore(promotionPopularity: number): number {
  return expectedAverageMatchScoreForPopularityTier(promotionTier(promotionPopularity));
}

/** ~0.30 toward the next tier when you beat expectations by ~1 star (tunable). */
const GAIN_BASE = 0.12;
const GAIN_PER_RATING_POINT = 0.18;
const GAIN_CAP = 0.55;
const LOSS_BASE = 0.03;
const LOSS_PER_RATING_POINT = 0.045;
const LOSS_FLOOR = 0.22;

/**
 * Maps raw score surplus into the same "diff" scale the gain/loss curve was tuned for when it compared
 * 1–5 quality bands (~1 unit ≈ one major step in fan perception).
 */
const COMBINED_SCORE_SURPLUS_PER_QUALITY_UNIT = 100;

/**
 * Promotion pop gain/loss from **combined show score** (sum of final match scores) vs **expected mean
 * match score** for your popularity tier (`getExpectedAverageMatchScore`). The expectation does not scale
 * with card length; longer cards raise the combined total directly.
 */
export function computePromotionPopularityDelta(
  combinedMatchScoreTotal: number,
  promotionPopularityBeforeShow: number,
): { delta: number; expectedAverageMatchScore: number } {
  const expectedAverageMatchScore = getExpectedAverageMatchScore(promotionPopularityBeforeShow);
  const surplus =
    (Number.isFinite(combinedMatchScoreTotal) ? combinedMatchScoreTotal : 0) - expectedAverageMatchScore;
  const diff = surplus / COMBINED_SCORE_SURPLUS_PER_QUALITY_UNIT;
  const eps = 0.004;

  if (diff > eps) {
    const raw = GAIN_BASE + diff * GAIN_PER_RATING_POINT;
    const delta = Math.min(GAIN_CAP, Math.max(0.06, raw));
    return { delta: Math.round(delta * 1000) / 1000, expectedAverageMatchScore };
  }
  if (diff < -eps) {
    const raw = -(LOSS_BASE + Math.abs(diff) * LOSS_PER_RATING_POINT);
    const delta = Math.max(-LOSS_FLOOR, raw);
    return { delta: Math.round(delta * 1000) / 1000, expectedAverageMatchScore };
  }

  return { delta: 0, expectedAverageMatchScore };
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
