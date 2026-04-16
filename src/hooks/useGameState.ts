import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  Fighter,
  Show,
  Match,
  Facility,
  MarketingCampaign,
  FighterAlignment,
  FighterTrait,
  FighterStats,
  RecruitProspect,
  ActiveRecruit,
  RecruitTrainingChoice,
  RecruitTrainingSessionSummary,
  getRecruitSlotCap,
  ShowSimulationResult,
  SimulatedMatchOutcomeDetail,
  FighterBookingDelta,
} from '../types';
import {
  INITIAL_MONEY,
  INITIAL_POPULARITY,
  STARTING_FIGHTERS,
  AVAILABLE_FACILITIES,
  FIGHTER_NAMES,
  ALIGNMENTS,
  TRAITS,
  VENUES,
} from '../constants';
import { getFacilityUpgradeCost } from '../lib/utils';
import {
  getRecruitTrainingInjuryChancePercent,
  RECRUIT_TRAINING_INJURY_ROLL,
  RECRUIT_TRAINING_LOW_ENERGY_THRESHOLD,
} from '../lib/recruitTraining';
import { computePromotionPopularityDelta } from '../lib/promotionPopularity';

const STORAGE_KEY = 'ring_master_save';

/** Fixed HQ baseline (previously level-1 Local Arena / Training Gym upgrades). */
const BASE_PRODUCTION_RATING = 1;
const BASE_MAX_ATTENDANCE = 200 + 300 * BASE_PRODUCTION_RATING;

const TRAINING_DAYS_TOTAL = 10;

function createFreshGameState(): GameState {
  return {
    money: INITIAL_MONEY,
    popularity: INITIAL_POPULARITY,
    roster: STARTING_FIGHTERS,
    facilities: AVAILABLE_FACILITIES,
    activeMarketing: [],
    history: [],
    currentShowNumber: 1,
    recruitProspects: [],
    activeRecruits: [],
  };
}

function normalizeFacilities(raw: Facility[] | undefined): Facility[] {
  const template = AVAILABLE_FACILITIES.find((f) => f.id === 'performance_center')!;
  const existing = raw?.find((f) => f.id === 'performance_center');
  const level = typeof existing?.level === 'number' ? Math.max(0, existing.level) : template.level;
  return [{ ...template, level }];
}

function normalizeLoadedState(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') {
    return createFreshGameState();
  }
  const r = raw as Partial<GameState>;
  const facilities = normalizeFacilities(Array.isArray(r.facilities) ? (r.facilities as Facility[]) : undefined);

  return {
    money: typeof r.money === 'number' ? r.money : INITIAL_MONEY,
    popularity: typeof r.popularity === 'number' ? r.popularity : INITIAL_POPULARITY,
    roster: Array.isArray(r.roster) ? (r.roster as Fighter[]) : STARTING_FIGHTERS,
    facilities,
    activeMarketing: Array.isArray(r.activeMarketing) ? (r.activeMarketing as MarketingCampaign[]) : [],
    history: Array.isArray(r.history) ? (r.history as Show[]) : [],
    currentShowNumber: typeof r.currentShowNumber === 'number' ? r.currentShowNumber : 1,
    lastShowResult: r.lastShowResult,
    recruitProspects: Array.isArray(r.recruitProspects) ? (r.recruitProspects as RecruitProspect[]) : [],
    activeRecruits: Array.isArray(r.activeRecruits) ? (r.activeRecruits as ActiveRecruit[]) : [],
  };
}

function computeShowSimulation(
  prev: GameState,
  matches: Match[],
  venueId: string,
  calculateMatchScore: (match: Match, roster: Fighter[], history: Show[]) => {
    powerA: number;
    powerB: number;
    multipliers: { label: string; value: number }[];
    totalScore: number;
    projectedStars: number;
  } | null,
): ShowSimulationResult {
  const venue = VENUES.find((v) => v.id === venueId) || VENUES[0];
  const roster = prev.roster;
  const history = prev.history;

  const simulatedMatches = matches.map((match) => {
    const breakdown = calculateMatchScore(match, roster, history);
    if (!breakdown) return { ...match, rating: 0 };

    const fighterA = roster.find((f) => f.id === match.fighterAId)!;
    const fighterB = roster.find((f) => f.id === match.fighterBId)!;
    const winnerId = Math.random() > 0.5 ? fighterA.id : fighterB.id;

    const finalRating = Math.min(5, Math.max(1, breakdown.projectedStars + (Math.random() * 0.4 - 0.2)));

    return { ...match, rating: finalRating, winnerId };
  });

  const avgRating =
    simulatedMatches.reduce((acc, m) => acc + (m.rating || 0), 0) / simulatedMatches.length;

  const productionRating = BASE_PRODUCTION_RATING;
  const showRating = Math.min(5, (avgRating + productionRating) / 2);

  const maxAttendance = BASE_MAX_ATTENDANCE;
  const attendance = Math.floor(
    Math.min(maxAttendance, prev.popularity * 150 * (0.8 + Math.random() * 0.4)),
  );

  const baseTicketPrice = 8;
  const qualityBonus = showRating * 3;
  const revenue = Math.floor(attendance * (baseTicketPrice + qualityBonus) * venue.multiplier);

  const setupCostSteps = [0, 1500, 0];
  const setupCost = matches.reduce((acc, _, idx) => acc + (setupCostSteps[idx] || 0), 0);
  const totalCost = venue.cost + setupCost;

  const { delta: popularityGain, expectedRating: expectedShowRating } = computePromotionPopularityDelta(
    showRating,
    prev.popularity,
  );
  const nextPromotionPopularity = Math.max(0, prev.popularity + popularityGain);

  const newShow: Show = {
    id: Math.random().toString(36).substr(2, 9),
    name: `Show #${prev.currentShowNumber}`,
    matches: simulatedMatches,
    revenue,
    attendance,
    rating: showRating,
    popularityGain,
    expectedShowRating,
    date: prev.currentShowNumber,
    venueCost: venue.cost,
    setupCost: setupCost,
  };

  const newShowNumber = prev.currentShowNumber + 1;
  const slotCap = getRecruitSlotCap(prev);

  let recruitProspects = prev.recruitProspects;
  if (slotCap > 0 && recruitProspects.length < 6) {
    const repAfterShow = nextPromotionPopularity;
    const room = 6 - recruitProspects.length;
    const arrivals = Math.min(room, samplePoisson(2));
    if (arrivals > 0) {
      const fresh: RecruitProspect[] = [];
      for (let i = 0; i < arrivals; i++) fresh.push(rollRecruitProspect(repAfterShow));
      recruitProspects = [...recruitProspects, ...fresh];
    }
  }

  const activeRecruits = prev.activeRecruits
    .filter((r) => r.daysTrained < TRAINING_DAYS_TOTAL)
    .map((r) => {
      if (r.enlistedAtShow < newShowNumber) {
        return { ...r, needsTrainingChoice: true };
      }
      return r;
    });

  const updatedRoster = prev.roster.map((f) => {
    const wasInShow = matches.some((m) => m.fighterAId === f.id || m.fighterBId === f.id);
    if (wasInShow) {
      return {
        ...f,
        energy: Math.max(0, f.energy - 20),
        popularity: f.popularity + (showRating > 3 ? 2 : 1),
      };
    }
    return { ...f, energy: Math.min(100, f.energy + 10) };
  });

  const fighterDelta = (before: Fighter, after: Fighter): FighterBookingDelta => ({
    energy: after.energy - before.energy,
    popularity: after.popularity - before.popularity,
  });

  const perMatchOutcomes: SimulatedMatchOutcomeDetail[] = simulatedMatches.map((m) => {
    const fa = roster.find((f) => f.id === m.fighterAId)!;
    const fb = roster.find((f) => f.id === m.fighterBId)!;
    const na = updatedRoster.find((f) => f.id === m.fighterAId)!;
    const nb = updatedRoster.find((f) => f.id === m.fighterBId)!;
    return {
      match: m,
      fighterA: { id: fa.id, name: fa.name, image: fa.image },
      fighterB: { id: fb.id, name: fb.name, image: fb.image },
      deltaA: fighterDelta(fa, na),
      deltaB: fighterDelta(fb, nb),
    };
  });

  return {
    perMatchOutcomes,
    patch: {
      money: prev.money + revenue - totalCost,
      popularity: nextPromotionPopularity,
      roster: updatedRoster,
      history: [newShow, ...prev.history],
      currentShowNumber: newShowNumber,
      lastShowResult: newShow,
      recruitProspects,
      activeRecruits,
    },
  };
}

/** Knuth algorithm; mean λ (used so ~2 prospects arrive per show on average when there is room). */
function samplePoisson(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  while (p > L) {
    k += 1;
    p *= Math.random();
  }
  return k - 1;
}

function rollRecruitProspect(popularity: number): RecruitProspect {
  const name = `${FIGHTER_NAMES[Math.floor(Math.random() * FIGHTER_NAMES.length)]} Jr`;
  const rep = Math.max(0, popularity);
  const repFactor = Math.min(1.35, 0.38 + rep * 0.022);
  const rollStat = () => {
    const base = 16 + Math.random() * 34;
    return Math.min(88, Math.max(8, Math.floor(base * repFactor + (Math.random() * 10 - 3))));
  };
  const stats: FighterStats = {
    strength: rollStat(),
    charisma: rollStat(),
    stamina: rollStat(),
    skill: rollStat(),
  };
  return {
    id: Math.random().toString(36).slice(2, 11),
    name,
    stats,
    energy: 82 + Math.floor(Math.random() * 18),
    alignment: ALIGNMENTS[Math.floor(Math.random() * ALIGNMENTS.length)] as FighterAlignment,
    trait: TRAITS[Math.floor(Math.random() * TRAITS.length)] as FighterTrait,
    image: '/wrestler.png',
  };
}

function mentorStatFor(mentor: Fighter | undefined, key: keyof FighterStats): number {
  return mentor?.stats[key] ?? 42;
}

function applyTrainingSession(
  recruit: ActiveRecruit,
  choice: RecruitTrainingChoice,
  roster: Fighter[],
): { recruit: ActiveRecruit; graduated: Fighter | null; summary: RecruitTrainingSessionSummary } {
  const [aId, bId] = recruit.mentorIds;
  const mA = roster.find((f) => f.id === aId);
  const mB = roster.find((f) => f.id === bId);

  const beforeStats: FighterStats = { ...recruit.stats };
  const beforeEnergy = recruit.energy;
  const injuryRiskPercent = getRecruitTrainingInjuryChancePercent(beforeEnergy, choice);

  let next: ActiveRecruit = { ...recruit, stats: { ...recruit.stats } };
  let graduated: Fighter | null = null;
  let injured = false;

  if (choice === 'rest') {
    next = {
      ...next,
      energy: Math.min(100, next.energy + 36),
      daysTrained: next.daysTrained + 1,
      needsTrainingChoice: false,
    };
  } else {
    const statKey = choice as keyof FighterStats;
    const lowEnergy = next.energy < RECRUIT_TRAINING_LOW_ENERGY_THRESHOLD;
    const injuryRoll = lowEnergy ? RECRUIT_TRAINING_INJURY_ROLL : 0;

    if (injuryRoll > 0 && Math.random() < injuryRoll) {
      injured = true;
      const hurt = (v: number) => Math.max(5, v - 4);
      next = {
        ...next,
        stats: {
          strength: hurt(next.stats.strength),
          charisma: hurt(next.stats.charisma),
          stamina: hurt(next.stats.stamina),
          skill: hurt(next.stats.skill),
        },
        energy: Math.max(0, next.energy - 24),
        daysTrained: next.daysTrained + 1,
        needsTrainingChoice: false,
      };
    } else {
      const avgMentor =
        (mentorStatFor(mA, statKey) + mentorStatFor(mB, statKey)) / 2;
      const bonus = Math.floor(avgMentor / 28);
      const gain = 2 + bonus + Math.floor(Math.random() * 3);
      next = {
        ...next,
        stats: {
          ...next.stats,
          [statKey]: Math.min(100, next.stats[statKey] + gain),
        },
        energy: Math.max(0, next.energy - 22),
        daysTrained: next.daysTrained + 1,
        needsTrainingChoice: false,
      };
    }
  }

  if (next.daysTrained >= TRAINING_DAYS_TOTAL) {
    const avg =
      (next.stats.strength +
        next.stats.charisma +
        next.stats.stamina +
        next.stats.skill) /
      4;
    graduated = {
      id: Math.random().toString(36).slice(2, 11),
      name: next.name.replace(/\s+Jr$/i, '') || next.name,
      stats: { ...next.stats },
      salary: 0,
      signingBonus: 0,
      popularity: Math.min(95, Math.max(6, Math.round(8 + avg * 0.35 + Math.random() * 6))),
      energy: Math.min(100, Math.max(55, next.energy)),
      alignment: next.alignment,
      trait: next.trait,
      injuryDays: 0,
      image: next.image,
    };
  }

  const statDeltas: FighterStats = {
    strength: next.stats.strength - beforeStats.strength,
    charisma: next.stats.charisma - beforeStats.charisma,
    stamina: next.stats.stamina - beforeStats.stamina,
    skill: next.stats.skill - beforeStats.skill,
  };

  const summary: RecruitTrainingSessionSummary = {
    recruitId: recruit.id,
    recruitName: recruit.name,
    choice,
    injured,
    injuryRiskPercent,
    graduated: graduated !== null,
    statsAfter: { ...next.stats },
    statDeltas,
    energyDelta: next.energy - beforeEnergy,
    energyAfter: next.energy,
  };

  return { recruit: next, graduated, summary };
}

function computeRecruitTrainingResolution(
  prev: GameState,
  choices: { recruitId: string; choice: RecruitTrainingChoice }[],
): {
  summaries: RecruitTrainingSessionSummary[];
  roster: Fighter[];
  activeRecruits: ActiveRecruit[];
} {
  const choiceById = new Map(choices.map((c) => [c.recruitId, c.choice]));
  const roster = prev.roster;
  const summaries: RecruitTrainingSessionSummary[] = [];
  let additions: Fighter[] = [];
  const updatedActive: ActiveRecruit[] = [];

  for (const r of prev.activeRecruits) {
    const ch = choiceById.get(r.id);
    if (!r.needsTrainingChoice || ch === undefined) {
      updatedActive.push(r);
      continue;
    }
    const { recruit, graduated, summary } = applyTrainingSession(r, ch, roster);
    summaries.push(summary);
    if (graduated) {
      additions.push(graduated);
    } else {
      updatedActive.push(recruit);
    }
  }

  return {
    summaries,
    roster: additions.length ? [...prev.roster, ...additions] : prev.roster,
    activeRecruits: updatedActive,
  };
}

export function useGameState() {
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return normalizeLoadedState(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load save', e);
      }
    }
    return createFreshGameState();
  });

  const trainingSubmitSummariesRef = useRef<RecruitTrainingSessionSummary[]>([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const generateRandomFighter = useCallback((): Fighter => {
    const name = FIGHTER_NAMES[Math.floor(Math.random() * FIGHTER_NAMES.length)] + ' ' + Math.floor(Math.random() * 100);
    const stats = {
      strength: Math.floor(Math.random() * 60) + 20,
      charisma: Math.floor(Math.random() * 60) + 20,
      stamina: Math.floor(Math.random() * 60) + 20,
      skill: Math.floor(Math.random() * 60) + 20,
    };
    const avgStat = (stats.strength + stats.charisma + stats.stamina + stats.skill) / 4;
    const salary = 0;
    const signingBonus = Math.floor(avgStat * 150);
    const popularity = Math.floor(Math.random() * 30);

    return {
      id: Math.random().toString(36).substr(2, 9),
      name,
      stats,
      salary,
      signingBonus,
      popularity,
      energy: 100,
      alignment: ALIGNMENTS[Math.floor(Math.random() * ALIGNMENTS.length)] as FighterAlignment,
      trait: TRAITS[Math.floor(Math.random() * TRAITS.length)] as FighterTrait,
      injuryDays: 0,
      image: '/wrestler.png',
    };
  }, []);

  const hireFighter = (fighter: Fighter) => {
    if (state.money >= fighter.signingBonus) {
      setState((prev) => ({
        ...prev,
        money: prev.money - fighter.signingBonus,
        roster: [...prev.roster, fighter],
      }));
    }
  };

  const fireFighter = (id: string) => {
    setState((prev) => ({
      ...prev,
      roster: prev.roster.filter((f) => f.id !== id),
    }));
  };

  const upgradeFacility = (facilityId: string) => {
    const facility = state.facilities.find((f) => f.id === facilityId);
    if (!facility) return;

    const cost = getFacilityUpgradeCost(facility);
    if (state.money >= cost) {
      setState((prev) => ({
        ...prev,
        money: prev.money - cost,
        facilities: prev.facilities.map((f) =>
          f.id === facilityId ? { ...f, level: f.level + 1 } : f,
        ),
      }));
    }
  };

  const dismissRecruitProspect = (prospectId: string) => {
    setState((prev) => ({
      ...prev,
      recruitProspects: prev.recruitProspects.filter((p) => p.id !== prospectId),
    }));
  };

  const enlistRecruit = (prospectId: string, mentorAId: string, mentorBId: string) => {
    if (mentorAId === mentorBId) return;

    setState((prev) => {
      const cap = getRecruitSlotCap(prev);
      if (cap <= 0) return prev;
      if (prev.activeRecruits.length >= cap) return prev;
      const prospect = prev.recruitProspects.find((p) => p.id === prospectId);
      if (!prospect) return prev;
      if (!prev.roster.some((f) => f.id === mentorAId) || !prev.roster.some((f) => f.id === mentorBId)) {
        return prev;
      }

      const active: ActiveRecruit = {
        id: prospect.id,
        name: prospect.name,
        stats: { ...prospect.stats },
        energy: prospect.energy,
        alignment: prospect.alignment,
        trait: prospect.trait,
        image: prospect.image,
        mentorIds: [mentorAId, mentorBId],
        daysTrained: 0,
        enlistedAtShow: prev.currentShowNumber,
        needsTrainingChoice: false,
      };

      return {
        ...prev,
        recruitProspects: prev.recruitProspects.filter((p) => p.id !== prospectId),
        activeRecruits: [...prev.activeRecruits, active],
      };
    });
  };

  const submitRecruitTrainingChoices = (
    choices: { recruitId: string; choice: RecruitTrainingChoice }[],
  ): RecruitTrainingSessionSummary[] => {
    setState((prev) => {
      const resolved = computeRecruitTrainingResolution(prev, choices);
      trainingSubmitSummariesRef.current = resolved.summaries;
      return {
        ...prev,
        roster: resolved.roster,
        activeRecruits: resolved.activeRecruits,
      };
    });
    return trainingSubmitSummariesRef.current;
  };

  const calculateMatchScore = useCallback((match: Match, roster: Fighter[], history: Show[]) => {
    const fighterA = roster.find((f) => f.id === match.fighterAId);
    const fighterB = roster.find((f) => f.id === match.fighterBId);
    if (!fighterA || !fighterB) return null;

    const powerA = Math.round(
      (fighterA.stats.strength + fighterA.stats.charisma + fighterA.stats.stamina + fighterA.stats.skill) / 4,
    );
    const powerB = Math.round(
      (fighterB.stats.strength + fighterB.stats.charisma + fighterB.stats.stamina + fighterB.stats.skill) / 4,
    );

    let totalScore = powerA + powerB;
    const multipliers: { label: string; value: number }[] = [];

    if (fighterA.alignment !== fighterB.alignment) {
      totalScore *= 1.5;
      multipliers.push({ label: 'Heel vs Face bonus', value: 1.5 });
    }

    const statDiff = Math.abs(powerA - powerB);
    if (statDiff < 15) {
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
      powerA,
      powerB,
      multipliers,
      totalScore: Math.floor(totalScore),
      projectedStars,
    };
  }, []);

  const simulateShow = useCallback(
    (matches: Match[], venueId: string) => computeShowSimulation(state, matches, venueId, calculateMatchScore),
    [state, calculateMatchScore],
  );

  const commitSimulatedShow = useCallback((result: ShowSimulationResult) => {
    setState((prev) => ({ ...prev, ...result.patch }));
  }, []);

  const runShow = (matches: Match[], venueId: string) => {
    setState((prev) => {
      const result = computeShowSimulation(prev, matches, venueId, calculateMatchScore);
      return { ...prev, ...result.patch };
    });
  };

  const resetGame = () => {
    if (confirm('Are you sure you want to reset your progress?')) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const addMoney = (amount: number) => {
    setState((prev) => ({ ...prev, money: prev.money + amount }));
  };

  return {
    state,
    hireFighter,
    fireFighter,
    upgradeFacility,
    runShow,
    simulateShow,
    commitSimulatedShow,
    generateRandomFighter,
    resetGame,
    addMoney,
    calculateMatchScore,
    dismissRecruitProspect,
    enlistRecruit,
    submitRecruitTrainingChoices,
  };
}
