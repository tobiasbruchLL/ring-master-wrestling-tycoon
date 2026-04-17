import type { Facility } from '../types';

const DEFAULT_FACILITY_LEVEL_CAP = 999;

/** Highest `level` this facility may reach at the given `leagueIndex`. */
export function facilityMaxLevel(facility: Facility, leagueIndex: number): number {
  const caps = facility.maxLevelByLeagueIndex;
  if (!caps?.length) return DEFAULT_FACILITY_LEVEL_CAP;
  const i = Math.max(0, Math.min(leagueIndex, caps.length - 1));
  return caps[i]!;
}

export function isFacilityAtLeagueLevelCap(facility: Facility, leagueIndex: number): boolean {
  return facility.level >= facilityMaxLevel(facility, leagueIndex);
}
