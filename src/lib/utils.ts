import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UPGRADE_PURCHASE_COST_MULTIPLIER } from '../constants';
import { facilityMaxLevel } from './facilityCaps';
import type { Facility, FighterStats } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

/** Overall workrate headline: average of PWR, TEC, and END (mic excluded). */
export function fighterOverallRating(stats: FighterStats): number {
  return Math.round((stats.power + stats.technique + stats.endurance) / 3);
}

/**
 * Up-front cost to put a prospect in rookie camp; scales with raw stat total so early
 * low-rep prospects land around a few hundred dollars and stronger rookies cost more.
 */
export function getRecruitSigningFee(stats: FighterStats): number {
  const sum = stats.power + stats.technique + stats.endurance + stats.mic;
  return Math.round(105 + sum * 2.85);
}

const DEFAULT_FACILITY_UPGRADE_MULT = 2.2;

export function getFacilityUpgradeCost(facility: {
  level: number;
  baseCost: number;
  upgradeCostMultiplier?: number;
  firstUpgradeDiscount?: number;
}) {
  const mult = facility.upgradeCostMultiplier ?? DEFAULT_FACILITY_UPGRADE_MULT;
  const firstDiscount = facility.firstUpgradeDiscount ?? 0;
  if (facility.level === 0) {
    return Math.max(
      1,
      Math.floor((facility.baseCost - firstDiscount) * UPGRADE_PURCHASE_COST_MULTIPLIER),
    );
  }
  return Math.max(
    1,
    Math.floor(
      facility.baseCost * Math.pow(mult, facility.level - 1) * UPGRADE_PURCHASE_COST_MULTIPLIER,
    ),
  );
}

export function hasAffordableFacilityUpgrade(state: {
  money: number;
  leagueIndex: number;
  facilities: Facility[];
}) {
  return state.facilities.some((f) => {
    if ((f.requiredLeagueIndex ?? 0) > state.leagueIndex) return false;
    if (f.level >= facilityMaxLevel(f, state.leagueIndex)) return false;
    return state.money >= getFacilityUpgradeCost(f);
  });
}
