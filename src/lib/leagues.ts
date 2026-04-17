import type { GameState } from '../types';
import { promotionTier } from './promotionPopularity';

export type LeagueTier = {
  id: string;
  name: string;
  tagline: string;
  /** Minimum promotion popularity (whole tier) required to promote from the previous league into this one. */
  minPopularityToEnter: number;
  /** One-time fee to enter this league from the previous tier (0 for the starting league). */
  promotionFee: number;
};

/** Index 0 is the starting league; higher indices are promotions. */
export const LEAGUE_TIERS: LeagueTier[] = [
  {
    id: 'territory',
    name: 'Territory Circuit',
    tagline: 'VFW halls and parking-lot brawls',
    minPopularityToEnter: 1,
    promotionFee: 0,
  },
  {
    id: 'regional',
    name: 'Regional TV',
    tagline: 'Syndicated Saturday nights',
    minPopularityToEnter: 8,
    promotionFee: 5_000,
  },
  {
    id: 'national',
    name: 'National Syndication',
    tagline: 'Touring crews and real gates',
    minPopularityToEnter: 18,
    promotionFee: 25_000,
  },
  {
    id: 'prime_time',
    name: 'Prime-Time Warfare',
    tagline: 'Arena tours and sponsor money',
    minPopularityToEnter: 32,
    promotionFee: 85_000,
  },
];

export function maxLeagueIndex(): number {
  return LEAGUE_TIERS.length - 1;
}

export function getLeagueTier(index: number): LeagueTier {
  const i = Math.max(0, Math.min(maxLeagueIndex(), index));
  return LEAGUE_TIERS[i]!;
}

export function getNextLeagueTier(currentLeagueIndex: number): LeagueTier | null {
  const next = currentLeagueIndex + 1;
  if (next > maxLeagueIndex()) return null;
  return LEAGUE_TIERS[next]!;
}

export function getPromoteLeagueBlockReason(state: GameState): string | null {
  const next = getNextLeagueTier(state.leagueIndex);
  if (!next) return 'You are already at the top league.';
  if (promotionTier(state.popularity) < next.minPopularityToEnter) {
    return `Need at least ${next.minPopularityToEnter} popularity to join ${next.name}.`;
  }
  if (state.money < next.promotionFee) {
    return `Need ${next.promotionFee.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} to buy in.`;
  }
  return null;
}
