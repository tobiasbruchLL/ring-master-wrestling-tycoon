import type { Fighter, FighterStats } from '../types';
import { randomIntInclusive } from './fighterShow';

const MAX_EXCHANGES = 900;

/** How much current energy scales ring performance (tired workers fade). */
function energyFactor(energy: number): number {
  const e = Math.max(0, Math.min(100, energy));
  return 0.62 + (e / 100) * 0.38;
}

function strikeDamage(
  attacker: FighterStats,
  defender: FighterStats,
  attackerEnergy: number,
): number {
  const eMul = energyFactor(attackerEnergy);
  const base = randomIntInclusive(3, 11) + Math.round(attacker.power * 0.1);
  const mitigation = 1 - Math.min(0.48, defender.endurance * 0.0034);
  return Math.max(1, Math.round(base * eMul * mitigation));
}

function initiativeRoll(stats: FighterStats, energy: number): number {
  const eMul = energyFactor(energy);
  return (stats.technique * 0.52 + stats.power * 0.32 + stats.endurance * 0.16) * eMul + Math.random() * 44;
}

/**
 * Turn-based fight: initiative from technique/power/endurance (× energy), damage from power
 * vs endurance. Returns the winner and their remaining HP (1–100) for finish / UI scaling.
 */
export function simulateMatchFightStats(fighterA: Fighter, fighterB: Fighter): {
  winnerId: string;
  winnerHpPercent: number;
} {
  let hpA = 100;
  let hpB = 100;
  let exchanges = 0;

  while (hpA > 0 && hpB > 0 && exchanges < MAX_EXCHANGES) {
    exchanges++;
    const rollA = initiativeRoll(fighterA.stats, fighterA.energy);
    const rollB = initiativeRoll(fighterB.stats, fighterB.energy);
    if (rollA >= rollB) {
      hpB -= strikeDamage(fighterA.stats, fighterB.stats, fighterA.energy);
    } else {
      hpA -= strikeDamage(fighterB.stats, fighterA.stats, fighterB.energy);
    }
  }

  if (hpA > 0 && hpB > 0) {
    const oa =
      (fighterA.stats.power + fighterA.stats.technique + fighterA.stats.endurance) / 3;
    const ob =
      (fighterB.stats.power + fighterB.stats.technique + fighterB.stats.endurance) / 3;
    if (oa + Math.random() * 10 > ob + Math.random() * 10) {
      hpB = 0;
    } else {
      hpA = 0;
    }
  }

  const aWins = hpB <= 0;
  const winnerId = aWins ? fighterA.id : fighterB.id;
  const winnerHp = Math.max(1, Math.min(100, Math.round(aWins ? hpA : hpB)));
  return { winnerId, winnerHpPercent: winnerHp };
}
