import { Fighter, FighterAlignment, FighterTrait } from '../types';
import { FIGHTER_NAMES, TRAITS } from '../constants';

/** Roster size after the opening onboarding draft. */
export const OPENING_DRAFT_PICKS = 5;

const LOW_STAT_MIN = 8;
const LOW_STAT_MAX = 22;

function rollLowStatValue(): number {
  return LOW_STAT_MIN + Math.floor(Math.random() * (LOW_STAT_MAX - LOW_STAT_MIN + 1));
}

function rollName(): string {
  const base = FIGHTER_NAMES[Math.floor(Math.random() * FIGHTER_NAMES.length)];
  return `${base} ${Math.floor(Math.random() * 900 + 100)}`;
}

function rollTrait(): FighterTrait {
  return TRAITS[Math.floor(Math.random() * TRAITS.length)] as FighterTrait;
}

/** Unsigned rookie-style fighter for the opening draft (low numbers, no contract cost). */
export function rollLowStatFighter(alignment: FighterAlignment | 'either'): Fighter {
  const resolved: FighterAlignment =
    alignment === 'either' ? (Math.random() < 0.5 ? 'Face' : 'Heel') : alignment;

  const stats = {
    strength: rollLowStatValue(),
    charisma: rollLowStatValue(),
    stamina: rollLowStatValue(),
    skill: rollLowStatValue(),
  };
  const avg = (stats.strength + stats.charisma + stats.stamina + stats.skill) / 4;

  return {
    id: Math.random().toString(36).slice(2, 12),
    name: rollName(),
    stats,
    salary: 0,
    signingBonus: 0,
    popularity: Math.min(12, Math.max(3, Math.floor(4 + avg * 0.25 + Math.random() * 3))),
    energy: 100,
    alignment: resolved,
    trait: rollTrait(),
    injuryDays: 0,
    recoveringFromInjury: false,
    image: '/wrestler.png',
  };
}

export function rollDistinctLowStatPair(alignment: FighterAlignment | 'either'): [Fighter, Fighter] {
  const a = rollLowStatFighter(alignment);
  let b = rollLowStatFighter(alignment);
  let guard = 0;
  while ((b.name === a.name || b.id === a.id) && guard++ < 24) {
    b = rollLowStatFighter(alignment);
  }
  return [a, b];
}
