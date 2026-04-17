import type { ActiveRecruit, Fighter, FighterStats, RecruitTrainingChoice } from '../types';

/** Training days required before a rookie can debut to the roster. */
export const RECRUIT_TRAINING_DAYS_TOTAL = 10;

/** Subtracted from each stat when a prospect skips camp (per stat floor). */
export const INSTANT_RECRUIT_SIGN_STAT_PENALTY = 10;
export const INSTANT_RECRUIT_SIGN_STAT_FLOOR = 8;

export function statsAfterInstantSignPenalty(stats: FighterStats): FighterStats {
  const clip = (v: number) => Math.max(INSTANT_RECRUIT_SIGN_STAT_FLOOR, v - INSTANT_RECRUIT_SIGN_STAT_PENALTY);
  return {
    power: clip(stats.power),
    technique: clip(stats.technique),
    endurance: clip(stats.endurance),
    mic: clip(stats.mic),
  };
}

export const RECRUIT_TRAINING_LOW_ENERGY_THRESHOLD = 40;
export const RECRUIT_TRAINING_INJURY_ROLL = 0.42;
export const RECRUIT_TRAINING_INJURY_CHANCE_PERCENT = Math.round(RECRUIT_TRAINING_INJURY_ROLL * 100);

/** Show extra risk copy when mishap chance for a stat day exceeds this (percent points). */
export const RECRUIT_TRAINING_HIGH_MISHAP_WARNING_OVER_PERCENT = 30;

const STAT_KEYS: (keyof FighterStats)[] = ['power', 'technique', 'endurance', 'mic'];

function mentorStatFor(mentor: Fighter | undefined, key: keyof FighterStats): number {
  return mentor?.stats[key] ?? 42;
}

/** Mishap chance (percent) for the next training session if this choice is taken. */
export function getRecruitTrainingInjuryChancePercent(energy: number, choice: RecruitTrainingChoice): number {
  if (choice === 'rest') return 0;
  return energy < RECRUIT_TRAINING_LOW_ENERGY_THRESHOLD ? RECRUIT_TRAINING_INJURY_CHANCE_PERCENT : 0;
}

/** Expected stat gain range on a successful training day (matches session RNG in useGameState). */
export function getRecruitStatGainRangePreview(
  recruit: ActiveRecruit,
  choice: RecruitTrainingChoice,
  roster: Fighter[],
): { min: number; max: number; statKey: keyof FighterStats } | null {
  if (choice === 'rest') return null;
  const statKey = choice as keyof FighterStats;
  const [aId, bId] = recruit.mentorIds;
  const mA = roster.find((f) => f.id === aId);
  const mB = roster.find((f) => f.id === bId);
  const avgMentor = (mentorStatFor(mA, statKey) + mentorStatFor(mB, statKey)) / 2;
  const bonus = Math.floor(avgMentor / 28);
  return { min: 2 + bonus, max: 4 + bonus, statKey };
}

function effectiveSuccessfulGainRange(
  recruit: ActiveRecruit,
  statKey: keyof FighterStats,
  roster: Fighter[],
): { effectiveMin: number; effectiveMax: number } | null {
  const raw = getRecruitStatGainRangePreview(recruit, statKey, roster);
  if (!raw) return null;
  const room = Math.max(0, 100 - recruit.stats[statKey]);
  if (room <= 0) return { effectiveMin: 0, effectiveMax: 0 };
  return {
    effectiveMin: Math.min(raw.min, room),
    effectiveMax: Math.min(raw.max, room),
  };
}

/** Stat focus(es) with the highest possible gain on a successful training day (after 100 cap). Ties all returned. */
export function getRecruitBestYieldStatKeys(recruit: ActiveRecruit, roster: Fighter[]): (keyof FighterStats)[] {
  let best = 0;
  const byKey: { key: keyof FighterStats; effectiveMax: number }[] = [];
  for (const k of STAT_KEYS) {
    const eff = effectiveSuccessfulGainRange(recruit, k, roster);
    const effectiveMax = eff?.effectiveMax ?? 0;
    byKey.push({ key: k, effectiveMax });
    if (effectiveMax > best) best = effectiveMax;
  }
  if (best <= 0) return [];
  return byKey.filter((row) => row.effectiveMax === best).map((row) => row.key);
}
