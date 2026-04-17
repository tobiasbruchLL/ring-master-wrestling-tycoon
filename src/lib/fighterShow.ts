/** Inclusive random integer in [min, max]. */
export function randomIntInclusive(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Energy lost after a match (base win 20–30, loss 25–40).
 * Higher END reduces drain (represents conditioning).
 */
export function rollShowFightEnergyCost(won: boolean, endurance: number): number {
  const base = won ? randomIntInclusive(20, 30) : randomIntInclusive(25, 40);
  const end = Math.max(5, Math.min(100, endurance));
  const factor = 1.35 - (end / 100) * 0.65;
  return Math.max(12, Math.round(base * factor));
}

/**
 * Chance (0–1) of a match injury: worse when tired; mitigated by the workers'
 * average technique in that match (safer, tighter work).
 */
export function showFightInjuryChance(energyBeforeMatch: number, avgMatchTechnique: number): number {
  const e = Math.max(0, Math.min(100, energyBeforeMatch));
  const energyRisk = ((100 - e) / 100) * 0.4;
  const t = Math.max(0, Math.min(100, avgMatchTechnique));
  const techniqueFactor = 1.12 - (t / 100) * 0.72;
  return Math.min(0.48, Math.max(0, energyRisk * techniqueFactor));
}
