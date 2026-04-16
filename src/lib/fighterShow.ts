/** Inclusive random integer in [min, max]. */
export function randomIntInclusive(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Energy lost after a match: win 20–30, loss 25–40. */
export function rollShowFightEnergyCost(won: boolean): number {
  return won ? randomIntInclusive(20, 30) : randomIntInclusive(25, 40);
}

/**
 * Chance (0–1) of a match injury from ring wear, rising as pre-match energy drops.
 * At 100 energy: 0%; approaches ~40% near 0.
 */
export function showFightInjuryChance(energyBeforeMatch: number): number {
  const e = Math.max(0, Math.min(100, energyBeforeMatch));
  return ((100 - e) / 100) * 0.4;
}
