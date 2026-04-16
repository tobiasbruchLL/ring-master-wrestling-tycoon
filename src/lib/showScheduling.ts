import { VENUES } from '../constants';

/** Prep days before a booked show runs; minimum 2; scales with card size and venue tier. */
export function computeShowPrepDays(matchCount: number, venueId: string): number {
  const venue = VENUES.find((v) => v.id === venueId) ?? VENUES[0];
  const extraMatches = Math.max(0, matchCount - 1);
  const venueTier = venue.cost >= 5000 ? 2 : venue.cost >= 1500 ? 1 : 0;
  return Math.max(2, 2 + extraMatches + venueTier);
}
