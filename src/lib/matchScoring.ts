import { Fighter, Match, Show } from '../types';

export type MatchScoreBreakdown = {
  popularityA: number;
  popularityB: number;
  multipliers: { label: string; value: number }[];
  totalScore: number;
  projectedStars: number;
};

export function computeMatchScoreBreakdown(
  match: Match,
  roster: Fighter[],
  history: Show[],
): MatchScoreBreakdown | null {
  const fighterA = roster.find((f) => f.id === match.fighterAId);
  const fighterB = roster.find((f) => f.id === match.fighterBId);
  if (!fighterA || !fighterB) return null;

  const popularityA = Math.round(fighterA.popularity);
  const popularityB = Math.round(fighterB.popularity);

  let totalScore = popularityA + popularityB;
  const multipliers: { label: string; value: number }[] = [];

  if (fighterA.alignment !== fighterB.alignment) {
    totalScore *= 1.5;
    multipliers.push({ label: 'Heel vs Face bonus', value: 1.5 });
  }

  const popDiff = Math.abs(popularityA - popularityB);
  if (popDiff < 15) {
    totalScore *= 1.5;
    multipliers.push({ label: 'Evenly matched bonus', value: 1.5 });
  }

  const traits = [fighterA.trait, fighterB.trait];
  if (traits.includes('Technician') && traits.includes('High Flyer')) {
    totalScore *= 1.2;
    multipliers.push({ label: 'Technical Masterpiece', value: 1.2 });
  } else if (traits.includes('Brawler') && traits.includes('Powerhouse')) {
    totalScore *= 1.2;
    multipliers.push({ label: 'Clash of Titans', value: 1.2 });
  }

  const lastShow = history[0];
  if (lastShow) {
    const wasInLastShow = lastShow.matches.some(
      (m) =>
        (m.fighterAId === fighterA.id && m.fighterBId === fighterB.id) ||
        (m.fighterAId === fighterB.id && m.fighterBId === fighterA.id),
    );
    if (wasInLastShow) {
      totalScore *= 0.5;
      multipliers.push({ label: 'Repeat Matchup Penalty', value: 0.5 });
    }
  }

  const projectedStars = Math.min(5, Math.max(1, totalScore / 80));

  return {
    popularityA,
    popularityB,
    multipliers,
    totalScore: Math.floor(totalScore),
    projectedStars,
  };
}
