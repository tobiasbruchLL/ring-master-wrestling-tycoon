import type { GameState } from '../types';

/** Starting max roster before any HQ roster expansion purchases. */
export const BASE_ROSTER_SIZE = 4;

/** Extra roster slots gained for each Locker Room Expansion purchase (always 1). */
export const ROSTER_SLOTS_PER_EXPANSION_PURCHASE = 1;

/** Each league tier unlocks this many additional roster expansion purchases (cumulative with promotion). */
export const ROSTER_CAPACITY_UPGRADES_PER_LEAGUE = 2;

const UPGRADE_BASE_COST = 4_800;
const UPGRADE_COST_MULT = 2.2;

/** Max roster expansion purchases allowed at this league index (0 = first league). */
export function maxRosterCapacityUpgradesAllowed(leagueIndex: number): number {
  return ROSTER_CAPACITY_UPGRADES_PER_LEAGUE * (leagueIndex + 1);
}

export function getMaxRosterSize(state: Pick<GameState, 'leagueIndex' | 'rosterCapacityUpgrades'>): number {
  const allowed = maxRosterCapacityUpgradesAllowed(state.leagueIndex);
  const purchased = Math.max(0, state.rosterCapacityUpgrades);
  const effectivePurchases = Math.min(purchased, allowed);
  return BASE_ROSTER_SIZE + effectivePurchases * ROSTER_SLOTS_PER_EXPANSION_PURCHASE;
}

/** Cost for the next roster expansion (current count = upgrades already purchased). */
export function getRosterCapacityUpgradeCost(currentUpgradesPurchased: number): number {
  const u = Math.max(0, Math.floor(currentUpgradesPurchased));
  if (u === 0) return UPGRADE_BASE_COST;
  return Math.floor(UPGRADE_BASE_COST * Math.pow(UPGRADE_COST_MULT, u - 1));
}

export function hasAffordableRosterCapacityUpgrade(state: {
  money: number;
  leagueIndex: number;
  rosterCapacityUpgrades: number;
}): boolean {
  const maxU = maxRosterCapacityUpgradesAllowed(state.leagueIndex);
  if (state.rosterCapacityUpgrades >= maxU) return false;
  return state.money >= getRosterCapacityUpgradeCost(state.rosterCapacityUpgrades);
}
