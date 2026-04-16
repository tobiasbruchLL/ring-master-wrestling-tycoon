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
  hasPendingRecruitTraining,
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
import { computeShowPrepDays } from '../lib/showScheduling';
import { computeMatchScoreBreakdown } from '../lib/matchScoring';
import { computeNightTicketSale } from '../lib/showEconomy';

const STORAGE_KEY = 'ring_master_save';

/** Fixed HQ baseline (previously level-1 Local Arena / Training Gym upgrades). */
const BASE_PRODUCTION_RATING = 1;

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
    currentDay: 1,
    upcomingShow: null,
    recruitProspects: [],
    activeRecruits: [],
  };
}

function normalizeActiveRecruits(raw: unknown): ActiveRecruit[] {
  if (!Array.isArray(raw)) return [];
  return (raw as ActiveRecruit[]).map((r) => {
    const legacy = r as ActiveRecruit & { enlistedAtShow?: number };
    const enlistedOnDay =
      typeof legacy.enlistedOnDay === 'number'
        ? legacy.enlistedOnDay
        : typeof legacy.enlistedAtShow === 'number'
          ? legacy.enlistedAtShow
          : 1;
    return { ...legacy, enlistedOnDay };
  });
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

  const currentShowNumber = typeof r.currentShowNumber === 'number' ? r.currentShowNumber : 1;
  const currentDay =
    typeof r.currentDay === 'number' ? r.currentDay : currentShowNumber;

  let upcomingShow: GameState['upcomingShow'] = null;
  if (r.upcomingShow && typeof r.upcomingShow === 'object') {
    const u = r.upcomingShow as Partial<GameState['upcomingShow']>;
    if (
      Array.isArray(u.matches) &&
      typeof u.venueId === 'string' &&
      typeof u.showDay === 'number' &&
      typeof u.prepDays === 'number'
    ) {
      const bookedOnDay =
        typeof u.bookedOnDay === 'number' ? u.bookedOnDay : u.showDay - u.prepDays;
      upcomingShow = {
        matches: u.matches as Match[],
        venueId: u.venueId,
        prepDays: u.prepDays,
        showDay: u.showDay,
        bookedOnDay,
        ticketsSoldTotal: typeof u.ticketsSoldTotal === 'number' ? u.ticketsSoldTotal : 0,
        advanceTicketRevenueTotal:
          typeof u.advanceTicketRevenueTotal === 'number' ? u.advanceTicketRevenueTotal : 0,
      };
    }
  }

  return {
    money: typeof r.money === 'number' ? r.money : INITIAL_MONEY,
    popularity: typeof r.popularity === 'number' ? r.popularity : INITIAL_POPULARITY,
    roster: Array.isArray(r.roster) ? (r.roster as Fighter[]) : STARTING_FIGHTERS,
    facilities,
    activeMarketing: Array.isArray(r.activeMarketing) ? (r.activeMarketing as MarketingCampaign[]) : [],
    history: Array.isArray(r.history) ? (r.history as Show[]) : [],
    currentShowNumber,
    currentDay,
    upcomingShow,
    lastShowResult: r.lastShowResult,
    recruitProspects: Array.isArray(r.recruitProspects) ? (r.recruitProspects as RecruitProspect[]) : [],
    activeRecruits: normalizeActiveRecruits(r.activeRecruits),
  };
}

function computeShowSimulation(
  prev: GameState,
  matches: Match[],
  venueId: string,
  calculateMatchScore: (match: Match, roster: Fighter[], history: Show[]) => {
    popularityA: number;
    popularityB: number;
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

  const planMatchesUpcoming =
    prev.upcomingShow &&
    prev.upcomingShow.venueId === venueId &&
    plannedShowMatchesSame(prev.upcomingShow.matches, matches);

  const soldBaseline = planMatchesUpcoming ? (prev.upcomingShow!.ticketsSoldTotal ?? 0) : 0;
  const ticketRevenue = planMatchesUpcoming ? (prev.upcomingShow!.advanceTicketRevenueTotal ?? 0) : 0;

  const cap = venue.maxAudience;
  const raw =
    soldBaseline <= 0 ? 0 : Math.floor(soldBaseline * (0.9 + Math.random() * 0.19));
  const attendance = Math.min(cap, raw);

  /** Advance ticket income (already added to cash on prep nights); included here for results UI and net profit. */
  const revenue = ticketRevenue;

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
    ticketsSoldTotal: soldBaseline,
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

  const activeRecruits = prev.activeRecruits.filter((r) => r.daysTrained < TRAINING_DAYS_TOTAL);

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

  const showPatch = {
    money: prev.money - totalCost,
    popularity: nextPromotionPopularity,
    roster: updatedRoster,
    history: [newShow, ...prev.history],
    currentShowNumber: newShowNumber,
    lastShowResult: newShow,
    recruitProspects,
    activeRecruits,
    upcomingShow: null as GameState['upcomingShow'],
  };

  const mergedAfterShow: GameState = { ...prev, ...showPatch };
  const turnover = computeDayTurnover(mergedAfterShow);

  return {
    perMatchOutcomes,
    patch: {
      ...showPatch,
      currentDay: turnover.currentDay,
      activeRecruits: turnover.activeRecruits,
      recruitProspects: turnover.recruitProspects,
      upcomingShow: turnover.upcomingShow,
      money: showPatch.money + turnover.moneyDelta,
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

function plannedShowMatchesSame(a: Match[], b: Match[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].fighterAId !== b[i].fighterAId || a[i].fighterBId !== b[i].fighterBId) return false;
  }
  return true;
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

function setupCostForMatches(matches: Match[]): number {
  const setupCostSteps = [0, 1500, 0];
  return matches.reduce((acc, _, idx) => acc + (setupCostSteps[idx] || 0), 0);
}

/** If non-null, the booked show cannot be run yet (or the card is invalid). */
export function getPlannedShowRunBlockReason(state: GameState): string | null {
  const plan = state.upcomingShow;
  if (!plan) return null;
  if (state.currentDay < plan.showDay) return 'Show is not booked for today yet.';

  const venue = VENUES.find((v) => v.id === plan.venueId) || VENUES[0];
  if (state.popularity < venue.minPopularity) {
    return `Need ${venue.minPopularity} popularity for ${venue.name}.`;
  }

  const rosterIds = new Set(state.roster.map((f) => f.id));
  for (const m of plan.matches) {
    if (!m.fighterAId || !m.fighterBId) return 'Card is incomplete.';
    if (!rosterIds.has(m.fighterAId) || !rosterIds.has(m.fighterBId)) return 'A wrestler on the card is no longer on the roster.';
  }

  const setup = setupCostForMatches(plan.matches);
  const total = venue.cost + setup;
  if (state.money < total) return 'Not enough cash to run this card.';

  return null;
}

/** Booked show is tonight and the card can legally be run (money, roster, venue requirements). */
export function isPlannedShowRunnableNow(state: GameState): boolean {
  const plan = state.upcomingShow;
  if (!plan || state.currentDay < plan.showDay) return false;
  return getPlannedShowRunBlockReason(state) === null;
}

function computeDayTurnover(
  prev: GameState,
): Pick<GameState, 'currentDay' | 'activeRecruits' | 'recruitProspects' | 'upcomingShow'> & {
  moneyDelta: number;
} {
  let moneyDelta = 0;
  let nextUpcoming = prev.upcomingShow;
  const plan = prev.upcomingShow;
  if (plan && prev.currentDay < plan.showDay) {
    const sale = computeNightTicketSale(plan, prev.roster, prev.history, prev.popularity);
    moneyDelta = sale.income;
    if (sale.tickets > 0) {
      nextUpcoming = {
        ...plan,
        ticketsSoldTotal: (plan.ticketsSoldTotal ?? 0) + sale.tickets,
        advanceTicketRevenueTotal: (plan.advanceTicketRevenueTotal ?? 0) + sale.income,
      };
    }
  }

  const nextDay = prev.currentDay + 1;
  const activeRecruits = prev.activeRecruits.map((r) => {
    if (r.daysTrained >= TRAINING_DAYS_TOTAL) return r;
    return { ...r, needsTrainingChoice: true };
  });

  let recruitProspects = prev.recruitProspects;
  const slotCap = getRecruitSlotCap(prev);
  if (slotCap > 0 && recruitProspects.length < 6) {
    const rep = prev.popularity;
    const room = 6 - recruitProspects.length;
    const arrivals = Math.min(room, samplePoisson(0.35));
    if (arrivals > 0) {
      const fresh: RecruitProspect[] = [];
      for (let i = 0; i < arrivals; i++) fresh.push(rollRecruitProspect(rep));
      recruitProspects = [...recruitProspects, ...fresh];
    }
  }

  return {
    currentDay: nextDay,
    activeRecruits,
    recruitProspects,
    moneyDelta,
    upcomingShow: nextUpcoming,
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
        enlistedOnDay: prev.currentDay,
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
    return computeMatchScoreBreakdown(match, roster, history);
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

  const scheduleUpcomingShow = (matches: Match[], venueId: string) => {
    setState((prev) => {
      if (prev.upcomingShow) return prev;
      const prepDays = computeShowPrepDays(matches.length, venueId);
      const planned: GameState['upcomingShow'] = {
        matches: matches.map((m) => ({ ...m })),
        venueId,
        prepDays,
        showDay: prev.currentDay + prepDays,
        bookedOnDay: prev.currentDay,
        ticketsSoldTotal: 0,
        advanceTicketRevenueTotal: 0,
      };
      return { ...prev, upcomingShow: planned };
    });
  };

  const endDay = (): { ok: true } | { ok: false; reason: string } => {
    if (hasPendingRecruitTraining(state)) {
      return { ok: false, reason: 'Finish rookie training before ending the day.' };
    }
    if (isPlannedShowRunnableNow(state)) {
      return { ok: false, reason: 'Run the booked show before ending the day.' };
    }
    setState((prev) => {
      const t = computeDayTurnover(prev);
      return {
        ...prev,
        currentDay: t.currentDay,
        activeRecruits: t.activeRecruits,
        recruitProspects: t.recruitProspects,
        upcomingShow: t.upcomingShow,
        money: prev.money + t.moneyDelta,
      };
    });
    return { ok: true };
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
    scheduleUpcomingShow,
    endDay,
  };
}
