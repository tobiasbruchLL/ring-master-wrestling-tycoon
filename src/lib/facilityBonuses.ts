import type { Facility } from '../types';

/** Merch booth: small multiplier on ticket gate (advance nights + show night advance pool). */
export function merchGateMultiplier(facilities: Facility[]): number {
  const row = facilities.find((f) => f.id === 'merch_booth');
  if (!row || row.level <= 0) return 1;
  return 1 + 0.02 * row.level;
}

/** Flat bonus cash when a show completes (sponsor / travel packages). */
export function sponsorShowCompletionBonus(facilities: Facility[]): number {
  const travel = facilities.find((f) => f.id === 'travel_package');
  const lounge = facilities.find((f) => f.id === 'sponsor_lounge');
  return (travel?.level ?? 0) * 750 + (lounge?.level ?? 0) * 2_500;
}

/** Extra energy each fighter gains when the calendar advances (on top of the +5 / +10 recovery baseline). */
export function dailyEnergyRecoveryBonus(facilities: Facility[]): number {
  const row = facilities.find((f) => f.id === 'wellness_center');
  const level = row?.level ?? 0;
  return Math.max(0, level);
}
