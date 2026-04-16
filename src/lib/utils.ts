import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FighterStats } from '../types';

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

/** In-ring power: average of strength, stamina, and skill (charisma excluded). */
export function fighterPower(stats: FighterStats): number {
  return Math.round((stats.strength + stats.stamina + stats.skill) / 3);
}

export function getFacilityUpgradeCost(facility: { level: number; baseCost: number }) {
  if (facility.level === 0) return facility.baseCost;
  return Math.floor(facility.baseCost * Math.pow(2.2, facility.level - 1));
}
