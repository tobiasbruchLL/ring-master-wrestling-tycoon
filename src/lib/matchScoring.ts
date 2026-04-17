import { Fighter, Match, Show } from '../types';
import { DEBUT_MATCH_MULTIPLIER } from '../constants';
import { fighterOverallRating } from './utils';
import { randomIntInclusive } from './fighterShow';

export type MatchScoreAdditive = { label: string; amount: number };

export type MatchScoreBasis = 'ticket_sales' | 'in_ring_quality';

/**
 * Line-item breakdown for either:
 * - **Ticket matchup** (`ticket_sales`): popularity draw + all booking buzz (incl. heel/face, evenly matched).
 * - **Match score base** (`in_ring_quality`): combined OVR + in-ring style multipliers only — heel/face and evenly matched do **not** apply here (those affect ticket sales only).
 */
export type MatchScoreBreakdown = {
  /** Which stat drives `matchupBaseBeforeMultipliers` (combined pop draw for tickets, combined OVR for match score base). */
  basis: MatchScoreBasis;
  overallRatingA: number;
  overallRatingB: number;
  fighterPopularityA: number;
  fighterPopularityB: number;
  /** Raw combined OVR (in-ring) or raw combined fighter popularity (ticket draw) before booking multipliers. */
  matchupBaseBeforeMultipliers: number;
  additiveBonuses: MatchScoreAdditive[];
  multipliers: { label: string; value: number }[];
  /** Full pre-finish score after the multipliers that apply to this basis (before the bell / finish scaling for match score). */
  totalScore: number;
};

/** How the simulated finish (winner remaining HP) scales the final match score. */
export type MatchFinishBreakdown = {
  winnerHpPercent: number;
  finishMultipliers: { label: string; value: number }[];
  finishMultiplier: number;
};

const CLOSE_HP_MAX = 25;
const ONE_SIDED_HP_MIN = 85;

const EVENLY_MATCHED_OVR_DIFF_MAX = 11;
/** Popularity values are small integers; closeness uses a tighter band than OVR. */
const EVENLY_MATCHED_POP_DIFF_MAX = 2;

/**
 * Roll winner ending HP (1–100). Biased toward decisive finishes so finish multipliers matter.
 */
export function rollWinnerEndingHpPercent(): number {
  const r = Math.random();
  if (r < 0.08) return 100;
  if (r < 0.32) return randomIntInclusive(1, CLOSE_HP_MAX);
  if (r < 0.55) return randomIntInclusive(ONE_SIDED_HP_MIN, 99);
  return randomIntInclusive(CLOSE_HP_MAX + 1, ONE_SIDED_HP_MIN - 1);
}

export function computeWinnerFinishMultiplier(winnerHpPercent: number): MatchFinishBreakdown {
  const hp = Math.max(1, Math.min(100, Math.round(winnerHpPercent)));
  const finishMultipliers: { label: string; value: number }[] = [];

  if (hp >= 100) {
    finishMultipliers.push({ label: 'Perfect win', value: 2 });
    return { winnerHpPercent: hp, finishMultipliers, finishMultiplier: 2 };
  }
  if (hp <= CLOSE_HP_MAX) {
    finishMultipliers.push({ label: 'Close match', value: 1.5 });
    return { winnerHpPercent: hp, finishMultipliers, finishMultiplier: 1.5 };
  }
  if (hp >= ONE_SIDED_HP_MIN) {
    finishMultipliers.push({ label: 'One-sided', value: 0.5 });
    return { winnerHpPercent: hp, finishMultipliers, finishMultiplier: 0.5 };
  }

  finishMultipliers.push({ label: 'Competitive', value: 1 });
  return { winnerHpPercent: hp, finishMultipliers, finishMultiplier: 1 };
}

/**
 * Final match score after the bell: **in-ring pre-finish total** × finish multiplier (not ticket hype).
 */
export function resolveMatchScore(matchupTotal: number, winnerHpPercent: number): number {
  const { finishMultiplier } = computeWinnerFinishMultiplier(winnerHpPercent);
  const raw = matchupTotal * finishMultiplier;
  return Math.max(1, Math.floor(raw));
}

/**
 * Wrestler popularity bump from this match's final score (winner gets a modest edge).
 */
export function popularityGainFromMatchScore(
  matchScore: number,
  fighter: Fighter,
  won: boolean,
): number {
  const micScale = 0.45 + (fighter.stats.mic / 100) * 0.8;
  const base = Math.max(1, Math.round((matchScore / 52) * micScale));
  const factor = won ? 1.18 : 0.75;
  return Math.max(1, Math.round(base * factor));
}

function bookingMultipliersForPair(
  fighterA: Fighter,
  fighterB: Fighter,
  overallRatingA: number,
  overallRatingB: number,
  matchupBaseBeforeMultipliers: number,
  basis: MatchScoreBasis,
  evennessDiff: number,
  evennessMax: number,
  history: Show[],
  /** When false (in-ring match score path), heel/face and evenly-matched bonuses are skipped — they only affect ticket matchup score. */
  applyTicketBuzzBonuses: boolean,
): MatchScoreBreakdown {
  let totalScore = matchupBaseBeforeMultipliers;
  const additiveBonuses: MatchScoreAdditive[] = [];
  const multipliers: { label: string; value: number }[] = [];

  const hasDebutMatchup =
    fighterA.debutMatchPending === true || fighterB.debutMatchPending === true;
  if (hasDebutMatchup) {
    totalScore *= DEBUT_MATCH_MULTIPLIER;
    multipliers.push({ label: 'Debut matchup bonus', value: DEBUT_MATCH_MULTIPLIER });
  }

  if (applyTicketBuzzBonuses) {
    if (fighterA.alignment !== fighterB.alignment) {
      totalScore *= 1.2;
      multipliers.push({ label: 'Heel vs Face bonus', value: 1.2 });
    }

    if (evennessDiff <= evennessMax) {
      totalScore *= 1.5;
      multipliers.push({ label: 'Evenly matched bonus', value: 1.5 });
    }
  }

  const traits = [fighterA.trait, fighterB.trait];
  if (traits.includes('Technician') && traits.includes('High Flyer')) {
    totalScore *= 1.2;
    multipliers.push({ label: 'Technical Masterpiece', value: 1.2 });
  } else if (traits.includes('Brawler') && traits.includes('Powerhouse')) {
    totalScore *= 1.2;
    multipliers.push({ label: 'Clash of Titans', value: 1.2 });
  }

  const lastShow = history[0];
  if (lastShow) {
    const wasInLastShow = lastShow.matches.some(
      (m) =>
        (m.fighterAId === fighterA.id && m.fighterBId === fighterB.id) ||
        (m.fighterAId === fighterB.id && m.fighterBId === fighterA.id),
    );
    if (wasInLastShow) {
      totalScore *= 0.5;
      multipliers.push({ label: 'Repeat Matchup Penalty', value: 0.5 });
    }
  }

  return {
    basis,
    overallRatingA,
    overallRatingB,
    fighterPopularityA: Math.max(0, fighterA.popularity),
    fighterPopularityB: Math.max(0, fighterB.popularity),
    matchupBaseBeforeMultipliers,
    additiveBonuses,
    multipliers,
    totalScore: Math.floor(totalScore),
  };
}

/**
 * Matchup score driving advance ticket demand, per-ticket price buzz, and expected gate — from combined popularity draw.
 *
 * When `promotionPopularity` is passed, your promotion's draw (`floor(popularity)`, minimum 0) is added to the wrestlers'
 * combined popularity for the base, and line items list **Popularity** and **Combined wrestler popularity** separately.
 * When omitted, the base is wrestler popularity only (legacy / tests).
 */
export function computeTicketSalesMatchupBreakdown(
  match: Match,
  roster: Fighter[],
  history: Show[],
  promotionPopularity?: number,
): MatchScoreBreakdown | null {
  const fighterA = roster.find((f) => f.id === match.fighterAId);
  const fighterB = roster.find((f) => f.id === match.fighterBId);
  if (!fighterA || !fighterB) return null;

  const overallRatingA = fighterOverallRating(fighterA.stats);
  const overallRatingB = fighterOverallRating(fighterB.stats);
  const pa = Math.max(0, fighterA.popularity);
  const pb = Math.max(0, fighterB.popularity);
  const combinedWrestlerPopularity = pa + pb;
  const applyPromotionToTicketBase =
    typeof promotionPopularity === 'number' && Number.isFinite(promotionPopularity);
  const promotionDraw = applyPromotionToTicketBase ? Math.max(0, Math.floor(promotionPopularity)) : 0;
  const matchupBaseBeforeMultipliers = combinedWrestlerPopularity + promotionDraw;
  const evennessDiff = Math.abs(pa - pb);

  const core = bookingMultipliersForPair(
    fighterA,
    fighterB,
    overallRatingA,
    overallRatingB,
    matchupBaseBeforeMultipliers,
    'ticket_sales',
    evennessDiff,
    EVENLY_MATCHED_POP_DIFF_MAX,
    history,
    true,
  );

  if (!applyPromotionToTicketBase) {
    return core;
  }

  return {
    ...core,
    matchupBaseBeforeMultipliers,
    additiveBonuses: [
      { label: 'Popularity', amount: promotionDraw },
      { label: 'Combined wrestler popularity', amount: combinedWrestlerPopularity },
    ],
  };
}

/** Everything needed to explain the final match score in the outcome UI. */
export type MatchScoreCalculationSheet = {
  /** Pre-finish in-ring total (`matchupTotalScore`) multiplied by finish rules to get match score. */
  matchupTotalUsed: number;
  /** Combined OVR + in-ring-only multipliers; null when roster/history were not supplied. */
  preFinishBreakdown: MatchScoreBreakdown | null;
  /** Popularity-draw matchup including heel/face and evenly matched — **ticket sales only**; null when roster/history omitted. */
  ticketSalesBreakdown: MatchScoreBreakdown | null;
  finish: MatchFinishBreakdown;
  /** `matchupTotalUsed * finish.finishMultiplier` before flooring. */
  rawProduct: number;
  /** `max(1, floor(rawProduct))` — same rule as `resolveMatchScore`. */
  finalScore: number;
};

/**
 * Assembles pre-finish breakdown (when roster + history are available) and finish math for tooltips/modals.
 */
export function buildMatchScoreCalculationSheet(params: {
  match: Match;
  matchupTotal: number;
  winnerHpPercent: number;
  roster?: Fighter[] | null;
  history?: Show[] | null;
  /** When set, ticket-sales breakdown includes promotion draw (same as planner). */
  promotionPopularity?: number;
}): MatchScoreCalculationSheet | null {
  const { match, matchupTotal, winnerHpPercent, roster, history, promotionPopularity } = params;
  if (!Number.isFinite(matchupTotal)) return null;
  const hp = Math.max(1, Math.min(100, Math.round(winnerHpPercent)));
  const finish = computeWinnerFinishMultiplier(hp);
  const rawProduct = matchupTotal * finish.finishMultiplier;
  const finalScore = Math.max(1, Math.floor(rawProduct));
  const preFinishBreakdown =
    roster?.length && history
      ? computeMatchScoreBreakdown(match, roster, history)
      : null;
  const ticketSalesBreakdown =
    roster?.length && history
      ? computeTicketSalesMatchupBreakdown(match, roster, history, promotionPopularity)
      : null;
  return {
    matchupTotalUsed: matchupTotal,
    preFinishBreakdown,
    ticketSalesBreakdown,
    finish,
    rawProduct,
    finalScore,
  };
}

/**
 * Pre-finish total that feeds **match score** (popularity): combined OVR plus in-ring style multipliers only.
 * Heel vs Face and Evenly matched bonuses apply only to {@link computeTicketSalesMatchupBreakdown}, not here.
 */
export function computeMatchScoreBreakdown(
  match: Match,
  roster: Fighter[],
  history: Show[],
): MatchScoreBreakdown | null {
  const fighterA = roster.find((f) => f.id === match.fighterAId);
  const fighterB = roster.find((f) => f.id === match.fighterBId);
  if (!fighterA || !fighterB) return null;

  const overallRatingA = fighterOverallRating(fighterA.stats);
  const overallRatingB = fighterOverallRating(fighterB.stats);
  const matchupBaseBeforeMultipliers = overallRatingA + overallRatingB;
  const evennessDiff = Math.abs(overallRatingA - overallRatingB);

  return bookingMultipliersForPair(
    fighterA,
    fighterB,
    overallRatingA,
    overallRatingB,
    matchupBaseBeforeMultipliers,
    'in_ring_quality',
    evennessDiff,
    EVENLY_MATCHED_OVR_DIFF_MAX,
    history,
    false,
  );
}
