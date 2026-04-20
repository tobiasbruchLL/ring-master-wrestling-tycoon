import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
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
  hasPendingRecruitGraduation,
  hasPendingRecruitTraining,
  PendingRecruitGraduation,
  ShowSimulationResult,
  SimulatedMatchOutcomeDetail,
  FighterBookingDelta,
  InjuryRecoveryNotice,
} from '../types';
import {
  INITIAL_MONEY,
  INITIAL_POPULARITY,
  NO_SHOW_DAY_POPULARITY_FACTOR,
  AVAILABLE_FACILITIES,
  FIGHTER_NAMES,
  ALIGNMENTS,
  TRAITS,
  VENUES,
} from '../constants';
import { facilityMaxLevel } from '../lib/facilityCaps';
import { getFacilityUpgradeCost, getRecruitSigningFee } from '../lib/utils';
import {
  getRecruitTrainingInjuryChancePercent,
  RECRUIT_TRAINING_INJURY_ROLL,
  RECRUIT_TRAINING_LOW_ENERGY_THRESHOLD,
  RECRUIT_TRAINING_DAYS_TOTAL,
  statsAfterInstantSignPenalty,
} from '../lib/recruitTraining';
import {
  getMaxRosterSize,
  getRosterCapacityUpgradeCost,
  maxRosterCapacityUpgradesAllowed,
  BASE_ROSTER_SIZE,
  ROSTER_SLOTS_PER_EXPANSION_PURCHASE,
} from '../lib/rosterCapacity';
import {
  getTicketPriceUpgradeCost,
  maxTicketPriceUpgradesAllowed,
} from '../lib/ticketPriceUpgrade';
import {
  averageMatchScoreFromExpectedQualityRating,
  clampPromotionPopularity,
  computePromotionPopularityDelta,
  promotionTier,
  showQualityRatingFromAverageMatchScore,
} from '../lib/promotionPopularity';
import { computeShowPrepDays } from '../lib/showScheduling';
import {
  computeMatchScoreBreakdown,
  popularityGainFromMatchScore,
  resolveMatchScore,
  type MatchScoreBreakdown,
} from '../lib/matchScoring';
import { simulateMatchFightStats } from '../lib/statMatchFight';
import {
  computeExpectedTicketSalesTotal,
  computeNightTicketSale,
  matchSetupCostAtIndex,
} from '../lib/showEconomy';
import { OPENING_DRAFT_PICKS } from '../lib/draftRoster';
import { dailyEnergyRecoveryBonus, sponsorShowCompletionBonus } from '../lib/facilityBonuses';
import { getNextLeagueTier, maxLeagueIndex } from '../lib/leagues';
import { rollShowFightEnergyCost, showFightInjuryChance } from '../lib/fighterShow';

const STORAGE_KEY = 'ring_master_save';

/** Fixed HQ baseline (previously level-1 Local Arena / Training Gym upgrades). */
const BASE_PRODUCTION_RATING = 1;

function buildFacilitiesFromTemplates(saved: Facility[] | undefined, leagueIndex: number): Facility[] {
  return AVAILABLE_FACILITIES.filter((t) => (t.requiredLeagueIndex ?? 0) <= leagueIndex).map((template) => {
    const savedRow = saved?.find((f) => f.id === template.id);
    const level =
      typeof savedRow?.level === 'number' ? Math.max(0, savedRow.level) : template.level;
    const cap = facilityMaxLevel(template, leagueIndex);
    return { ...template, level: Math.min(level, cap) };
  });
}

function createFreshGameState(): GameState {
  return {
    money: INITIAL_MONEY,
    popularity: INITIAL_POPULARITY,
    leagueIndex: 0,
    rosterCapacityUpgrades: 0,
    ticketPriceUpgrades: 0,
    roster: [],
    hasCompletedOpeningDraft: false,
    facilities: buildFacilitiesFromTemplates(undefined, 0),
    activeMarketing: [],
    history: [],
    currentShowNumber: 1,
    currentDay: 1,
    upcomingShow: null,
    skipEndDayNoShowWarning: false,
    recruitProspects: [],
    recruitProspectsUnread: false,
    activeRecruits: [],
    pendingRecruitGraduations: [],
  };
}

/** Maps legacy keys (`strength`/`skill`/`charisma`/`stamina`) into current stats. */
function normalizeFighterStats(stats: unknown): FighterStats {
  const s = stats as Record<string, unknown> & { stamina?: number };
  const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);
  const endurance =
    typeof s.endurance === 'number'
      ? s.endurance
      : typeof s.stamina === 'number'
        ? s.stamina
        : 20;
  return {
    power: num(s.power, num(s.strength, 20)),
    technique: num(s.technique, num(s.skill, 20)),
    endurance,
    mic: num(s.mic, num(s.charisma, 20)),
  };
}

function normalizeFighter(f: Fighter): Fighter {
  const legacy = f as Fighter & { recoveringFromInjury?: boolean };
  const recovering =
    typeof legacy.recoveringFromInjury === 'boolean'
      ? legacy.recoveringFromInjury
      : typeof legacy.injuryDays === 'number' && legacy.injuryDays > 0;
  return {
    ...f,
    stats: normalizeFighterStats(f.stats),
    recoveringFromInjury: recovering,
    injuryDays: 0,
  };
}

function findClearedInjuryRecoveries(beforeRoster: Fighter[], afterRoster: Fighter[]): InjuryRecoveryNotice[] {
  const afterById = new Map(afterRoster.map((f) => [f.id, f]));
  const out: InjuryRecoveryNotice[] = [];
  for (const before of beforeRoster) {
    const after = afterById.get(before.id);
    if (after && before.recoveringFromInjury && !after.recoveringFromInjury) {
      out.push({ fighterId: after.id, name: after.name });
    }
  }
  return out;
}

/** Baseline +5 energy per day (+10 while recovering), plus HQ Wellness Center bonus; clears recovery at 100 energy. */
function applyDayStartEnergyToRoster(roster: Fighter[], facilities: Facility[]): Fighter[] {
  const bonus = dailyEnergyRecoveryBonus(facilities);
  return roster.map((f) => {
    const gain = (f.recoveringFromInjury ? 10 : 5) + bonus;
    const nextEnergy = Math.min(100, f.energy + gain);
    const clearedRecovery = f.recoveringFromInjury && nextEnergy >= 100;
    return {
      ...f,
      energy: clearedRecovery ? 100 : nextEnergy,
      recoveringFromInjury: clearedRecovery ? false : f.recoveringFromInjury,
    };
  });
}

function normalizeRecruitTrainingSummary(raw: unknown): RecruitTrainingSessionSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<RecruitTrainingSessionSummary>;
  if (
    typeof s.recruitId !== 'string' ||
    typeof s.recruitName !== 'string' ||
    typeof s.injured !== 'boolean' ||
    typeof s.injuryRiskPercent !== 'number' ||
    typeof s.graduated !== 'boolean' ||
    !s.statsAfter ||
    !s.statDeltas ||
    typeof s.energyDelta !== 'number' ||
    typeof s.energyAfter !== 'number'
  ) {
    return null;
  }
  return {
    recruitId: s.recruitId,
    recruitName: s.recruitName,
    choice: (s.choice as RecruitTrainingChoice) ?? 'rest',
    injured: s.injured,
    injuryRiskPercent: s.injuryRiskPercent,
    graduated: s.graduated,
    statsAfter: normalizeFighterStats(s.statsAfter),
    statDeltas: normalizeFighterStats(s.statDeltas),
    energyDelta: s.energyDelta,
    energyAfter: s.energyAfter,
    blockedBecauseRosterFull: s.blockedBecauseRosterFull,
  };
}

function normalizePendingRecruitGraduations(raw: unknown): PendingRecruitGraduation[] {
  if (!Array.isArray(raw)) return [];
  const out: PendingRecruitGraduation[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as { fighter?: unknown; trainingSummary?: unknown };
    if (!o.fighter || typeof o.fighter !== 'object') continue;
    const summary = normalizeRecruitTrainingSummary(o.trainingSummary);
    if (!summary) continue;
    const f = o.fighter as Fighter;
    if (typeof f.id !== 'string' || typeof f.name !== 'string') continue;
    const signedWithoutCamp =
      typeof (o as { signedWithoutCamp?: unknown }).signedWithoutCamp === 'boolean'
        ? (o as { signedWithoutCamp: boolean }).signedWithoutCamp
        : undefined;
    out.push({
      fighter: normalizeFighter(f),
      trainingSummary: summary,
      ...(signedWithoutCamp ? { signedWithoutCamp: true } : {}),
    });
  }
  return out;
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
    return {
      ...legacy,
      enlistedOnDay,
      name: typeof legacy.name === 'string' ? stripRecruitJrNameSuffix(legacy.name) : legacy.name,
      stats: normalizeFighterStats(legacy.stats),
    };
  });
}

/** Legacy recruits used a " Jr" name suffix; strip it for display and new saves. */
function stripRecruitJrNameSuffix(name: string): string {
  return name.replace(/\s+Jr$/i, '') || name;
}

/** Map legacy `expectedShowRating` (1–5 band) onto `expectedAverageMatchScore` when loading saves. */
function normalizePersistedShow(show: Show): Show {
  const s = show as Show & { expectedShowRating?: number };
  let expectedAverageMatchScore: number | undefined = s.expectedAverageMatchScore;
  if (typeof expectedAverageMatchScore !== 'number' || !Number.isFinite(expectedAverageMatchScore)) {
    const legacy = s.expectedShowRating;
    if (typeof legacy === 'number' && Number.isFinite(legacy) && legacy > 0 && legacy < 20) {
      expectedAverageMatchScore = averageMatchScoreFromExpectedQualityRating(legacy);
    } else {
      expectedAverageMatchScore = undefined;
    }
  }
  const { expectedShowRating: _legacy, ...rest } = s;
  return {
    ...rest,
    ...(typeof expectedAverageMatchScore === 'number' ? { expectedAverageMatchScore } : {}),
  };
}

function normalizeLoadedState(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') {
    return createFreshGameState();
  }
  const r = raw as Partial<GameState>;
  const leagueIndexRaw = (r as Partial<GameState>).leagueIndex;
  const leagueIndex =
    typeof leagueIndexRaw === 'number'
      ? Math.max(0, Math.min(maxLeagueIndex(), Math.floor(leagueIndexRaw)))
      : 0;
  const facilities = buildFacilitiesFromTemplates(
    Array.isArray(r.facilities) ? (r.facilities as Facility[]) : undefined,
    leagueIndex,
  );

  const currentShowNumber = typeof r.currentShowNumber === 'number' ? r.currentShowNumber : 1;
  const currentDay =
    typeof r.currentDay === 'number' ? r.currentDay : currentShowNumber;
  const roster = Array.isArray(r.roster) ? (r.roster as Fighter[]).map(normalizeFighter) : [];
  const history = Array.isArray(r.history)
    ? (r.history as Show[]).map(normalizePersistedShow)
    : [];

  const loadedPopularity =
    typeof r.popularity === 'number' && Number.isFinite(r.popularity) ? r.popularity : INITIAL_POPULARITY;

  const maxRosterUpgrades = maxRosterCapacityUpgradesAllowed(leagueIndex);
  let rosterCapacityUpgrades =
    typeof (r as Partial<GameState>).rosterCapacityUpgrades === 'number' &&
    Number.isFinite((r as Partial<GameState>).rosterCapacityUpgrades!)
      ? Math.floor((r as Partial<GameState>).rosterCapacityUpgrades as number)
      : 0;
  rosterCapacityUpgrades = Math.max(0, Math.min(rosterCapacityUpgrades, maxRosterUpgrades));
  const slotsAboveBase = Math.max(0, roster.length - BASE_ROSTER_SIZE);
  const impliedPurchases = Math.ceil(slotsAboveBase / ROSTER_SLOTS_PER_EXPANSION_PURCHASE);
  rosterCapacityUpgrades = Math.min(
    maxRosterUpgrades,
    Math.max(rosterCapacityUpgrades, Math.min(impliedPurchases, maxRosterUpgrades)),
  );

  const maxTicketUpgrades = maxTicketPriceUpgradesAllowed(leagueIndex);
  let ticketPriceUpgrades =
    typeof (r as Partial<GameState>).ticketPriceUpgrades === 'number' &&
    Number.isFinite((r as Partial<GameState>).ticketPriceUpgrades!)
      ? Math.floor((r as Partial<GameState>).ticketPriceUpgrades as number)
      : 0;
  ticketPriceUpgrades = Math.max(0, Math.min(ticketPriceUpgrades, maxTicketUpgrades));

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
        expectedTicketSalesTotal: computeExpectedTicketSalesTotal(
          u.matches as Match[],
          roster,
          history,
          loadedPopularity,
        ),
        ticketsSoldTotal: typeof u.ticketsSoldTotal === 'number' ? u.ticketsSoldTotal : 0,
        advanceTicketRevenueTotal:
          typeof u.advanceTicketRevenueTotal === 'number' ? u.advanceTicketRevenueTotal : 0,
      };
    }
  }
  const hasCompletedOpeningDraft =
    typeof (r as Partial<GameState>).hasCompletedOpeningDraft === 'boolean'
      ? (r as Partial<GameState>).hasCompletedOpeningDraft!
      : true;

  return {
    money: typeof r.money === 'number' ? r.money : INITIAL_MONEY,
    popularity: loadedPopularity,
    leagueIndex,
    rosterCapacityUpgrades,
    ticketPriceUpgrades,
    roster,
    hasCompletedOpeningDraft,
    facilities,
    activeMarketing: Array.isArray(r.activeMarketing) ? (r.activeMarketing as MarketingCampaign[]) : [],
    history,
    currentShowNumber,
    currentDay,
    upcomingShow,
    lastShowResult:
      r.lastShowResult && typeof r.lastShowResult === 'object'
        ? normalizePersistedShow(r.lastShowResult as Show)
        : undefined,
    recruitProspects: Array.isArray(r.recruitProspects)
      ? (r.recruitProspects as RecruitProspect[]).map((p) => ({
          ...p,
          name: typeof p.name === 'string' ? stripRecruitJrNameSuffix(p.name) : p.name,
          stats: normalizeFighterStats(p.stats),
        }))
      : [],
    activeRecruits: normalizeActiveRecruits(r.activeRecruits),
    pendingRecruitGraduations: normalizePendingRecruitGraduations(
      (r as Partial<GameState>).pendingRecruitGraduations,
    ),
    recruitProspectsUnread:
      typeof (r as Partial<GameState>).recruitProspectsUnread === 'boolean'
        ? (r as Partial<GameState>).recruitProspectsUnread!
        : false,
    skipEndDayNoShowWarning:
      typeof (r as Partial<GameState>).skipEndDayNoShowWarning === 'boolean'
        ? (r as Partial<GameState>).skipEndDayNoShowWarning!
        : false,
  };
}

function fighterBookingDelta(before: Fighter, after: Fighter): FighterBookingDelta {
  return {
    energy: after.energy - before.energy,
    popularity: after.popularity - before.popularity,
    injurySustained: !before.recoveringFromInjury && after.recoveringFromInjury ? true : undefined,
    popularityBefore: before.popularity,
    popularityAfter: after.popularity,
    energyBefore: before.energy,
    energyAfter: after.energy,
  };
}

/**
 * After the fight UI resolves, re-score each match from stored `matchupTotalScore` and actual
 * winner HP so finish multipliers (e.g. Perfect win) match what the player saw.
 */
export function applyWinnerHpOverridesToShowSimulation(
  prevBeforeShow: GameState,
  result: ShowSimulationResult,
  overrides: number[],
): ShowSimulationResult {
  const origPatch = result.patch;
  const origShow = origPatch.history[0];
  if (!origShow) return result;

  const updatedMatches: Match[] = origShow.matches.map((m, i) => {
    const total = m.matchupTotalScore;
    const raw = overrides[i];
    if (typeof total !== 'number' || !Number.isFinite(total) || typeof raw !== 'number' || !Number.isFinite(raw)) {
      const { matchupTotalScore: _omit, ...rest } = m;
      void _omit;
      return rest;
    }
    const hp = Math.max(1, Math.min(100, Math.round(raw)));
    const matchScore = resolveMatchScore(total, hp);
    const { matchupTotalScore: _omit, ...base } = m;
    void _omit;
    return { ...base, winnerHpPercent: hp, matchScore };
  });

  const combinedMatchScore = updatedMatches.reduce((acc, m) => acc + (m.matchScore ?? 0), 0);
  const avgMatchScore =
    updatedMatches.length > 0 ? combinedMatchScore / updatedMatches.length : 0;
  const productionRating = BASE_PRODUCTION_RATING;
  const innerQuality = showQualityRatingFromAverageMatchScore(avgMatchScore);
  const showRating = Math.min(5, Math.max(1, (innerQuality + productionRating) / 2));
  const { delta: popularityGain, expectedAverageMatchScore } = computePromotionPopularityDelta(
    combinedMatchScore,
    prevBeforeShow.popularity,
  );
  const nextPromotionPopularity = clampPromotionPopularity(prevBeforeShow.popularity + popularityGain);

  const updatedRoster = prevBeforeShow.roster.map((f) => {
    const patchF = origPatch.roster.find((x) => x.id === f.id);
    if (!patchF) return f;
    const match = updatedMatches.find((m) => m.fighterAId === f.id || m.fighterBId === f.id);
    if (!match) return patchF;
    const wId = match.winnerId;
    const won = typeof wId === 'string' && wId === f.id;
    const popGain = popularityGainFromMatchScore(match.matchScore ?? 0, f, won);
    return {
      ...patchF,
      popularity: f.popularity + popGain,
    };
  });

  const perMatchOutcomes: SimulatedMatchOutcomeDetail[] = updatedMatches.map((m) => {
    const fa = prevBeforeShow.roster.find((x) => x.id === m.fighterAId)!;
    const fb = prevBeforeShow.roster.find((x) => x.id === m.fighterBId)!;
    const na = updatedRoster.find((x) => x.id === m.fighterAId)!;
    const nb = updatedRoster.find((x) => x.id === m.fighterBId)!;
    return {
      match: m,
      fighterA: { id: fa.id, name: fa.name, image: fa.image },
      fighterB: { id: fb.id, name: fb.name, image: fb.image },
      deltaA: fighterBookingDelta(fa, na),
      deltaB: fighterBookingDelta(fb, nb),
    };
  });

  const newShow: Show = {
    ...origShow,
    matches: updatedMatches,
    rating: showRating,
    averageMatchScore: avgMatchScore,
    popularityGain,
    expectedAverageMatchScore,
  };

  const showPatch: typeof origPatch = {
    ...origPatch,
    history: [newShow, ...origPatch.history.slice(1)],
    lastShowResult: newShow,
    roster: updatedRoster,
    popularity: nextPromotionPopularity,
  };

  const mergedAfterShow: GameState = { ...prevBeforeShow, ...showPatch };
  const turnover = computeDayTurnover(mergedAfterShow);
  const injuryRecoveries = findClearedInjuryRecoveries(mergedAfterShow.roster, turnover.roster);

  return {
    perMatchOutcomes,
    injuryRecoveries,
    patch: {
      ...showPatch,
      roster: turnover.roster,
      currentDay: turnover.currentDay,
      activeRecruits: turnover.activeRecruits,
      recruitProspects: turnover.recruitProspects,
      upcomingShow: turnover.upcomingShow,
      money: showPatch.money + turnover.moneyDelta,
    },
  };
}

function computeShowSimulation(
  prev: GameState,
  matches: Match[],
  venueId: string,
  calculateMatchScore: (match: Match, roster: Fighter[], history: Show[]) => MatchScoreBreakdown | null,
): ShowSimulationResult {
  const venue = VENUES.find((v) => v.id === venueId) || VENUES[0];
  const roster = prev.roster;
  const history = prev.history;

  const simulatedMatches = matches.map((match) => {
    const breakdown = calculateMatchScore(match, roster, history);
    const fighterA = roster.find((f) => f.id === match.fighterAId)!;
    const fighterB = roster.find((f) => f.id === match.fighterBId)!;
    const { winnerId, winnerHpPercent } = simulateMatchFightStats(fighterA, fighterB);
    if (!breakdown) {
      return { ...match, matchScore: 0, winnerId, winnerHpPercent };
    }
    const matchupTotalScore = Math.floor(breakdown.totalScore);
    const matchScore = resolveMatchScore(matchupTotalScore, winnerHpPercent);

    return { ...match, winnerId, matchScore, winnerHpPercent, matchupTotalScore };
  });

  const combinedMatchScore = simulatedMatches.reduce((acc, m) => acc + (m.matchScore ?? 0), 0);
  const avgMatchScore =
    simulatedMatches.length > 0 ? combinedMatchScore / simulatedMatches.length : 0;

  const productionRating = BASE_PRODUCTION_RATING;
  const innerQuality = showQualityRatingFromAverageMatchScore(avgMatchScore);
  const showRating = Math.min(5, Math.max(1, (innerQuality + productionRating) / 2));

  const planMatchesUpcoming =
    prev.upcomingShow &&
    prev.upcomingShow.venueId === venueId &&
    plannedShowMatchesSame(prev.upcomingShow.matches, matches);

  const ticketRevenue = planMatchesUpcoming ? (prev.upcomingShow!.advanceTicketRevenueTotal ?? 0) : 0;
  const computedExpectedTicketSales = computeExpectedTicketSalesTotal(matches, roster, history, prev.popularity);
  const totalExpectedTicketSales = planMatchesUpcoming
    ? (prev.upcomingShow!.expectedTicketSalesTotal ?? computedExpectedTicketSales)
    : computedExpectedTicketSales;

  const cap = venue.maxAudience;
  const raw =
    totalExpectedTicketSales <= 0
      ? 0
      : Math.floor(totalExpectedTicketSales * (0.9 + Math.random() * 0.3));
  const attendance = Math.min(cap, raw);

  /** Gate / advance ticket total (accrued during prep; paid into cash when the show completes). */
  const revenue = ticketRevenue;

  const setupCost = matches.reduce((acc, _, idx) => acc + matchSetupCostAtIndex(venueId, idx), 0);
  const totalCost = venue.cost + setupCost;

  /** Promotion pop: combined match scores vs tier expected mean (same bar any card length). */
  const { delta: popularityGain, expectedAverageMatchScore } = computePromotionPopularityDelta(
    combinedMatchScore,
    prev.popularity,
  );
  const nextPromotionPopularity = clampPromotionPopularity(prev.popularity + popularityGain);

  const newShow: Show = {
    id: Math.random().toString(36).substr(2, 9),
    name: `Show #${prev.currentShowNumber}`,
    matches: simulatedMatches,
    revenue,
    ticketsSoldTotal: attendance,
    attendance,
    rating: showRating,
    averageMatchScore: avgMatchScore,
    popularityGain,
    expectedAverageMatchScore,
    date: prev.currentShowNumber,
    venueCost: venue.cost,
    setupCost: setupCost,
  };

  const newShowNumber = prev.currentShowNumber + 1;

  let recruitProspects = prev.recruitProspects;
  let recruitProspectsUnread = prev.recruitProspectsUnread ?? false;
  if (newShowNumber >= 2) {
    const repAfterShow = nextPromotionPopularity;
    recruitProspects = [rollRecruitProspect(repAfterShow), rollRecruitProspect(repAfterShow)];
    recruitProspectsUnread = true;
  }

  const activeRecruits = prev.activeRecruits.filter((r) => r.daysTrained < RECRUIT_TRAINING_DAYS_TOTAL);

  type FightAftermath = { energyCost: number; injurySustained: boolean };
  const aftermathById = new Map<string, FightAftermath>();

  for (const m of simulatedMatches) {
    const fa = roster.find((x) => x.id === m.fighterAId)!;
    const fb = roster.find((x) => x.id === m.fighterBId)!;
    const wId = m.winnerId!;
    const avgMatchTechnique = (fa.stats.technique + fb.stats.technique) / 2;
    for (const fighter of [fa, fb]) {
      const won = wId === fighter.id;
      const energyCost = rollShowFightEnergyCost(won, fighter.stats.endurance);
      const injurySustained =
        Math.random() < showFightInjuryChance(fighter.energy, avgMatchTechnique);
      aftermathById.set(fighter.id, { energyCost, injurySustained });
    }
  }

  const updatedRoster = prev.roster.map((f) => {
    const aftermath = aftermathById.get(f.id);
    if (aftermath) {
      const match = simulatedMatches.find((m) => m.fighterAId === f.id || m.fighterBId === f.id);
      const wId = match?.winnerId;
      const won = typeof wId === 'string' && wId === f.id;
      const popGain = popularityGainFromMatchScore(match?.matchScore ?? 0, f, won);
      return {
        ...f,
        energy: Math.max(0, f.energy - aftermath.energyCost),
        recoveringFromInjury: f.recoveringFromInjury || aftermath.injurySustained,
        popularity: f.popularity + popGain,
        debutMatchPending: false,
      };
    }
    return { ...f };
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
      deltaA: fighterBookingDelta(fa, na),
      deltaB: fighterBookingDelta(fb, nb),
    };
  });

  const showBonus = sponsorShowCompletionBonus(prev.facilities);
  const showPatch = {
    money: prev.money - totalCost + ticketRevenue + showBonus,
    popularity: nextPromotionPopularity,
    roster: updatedRoster,
    history: [newShow, ...prev.history],
    currentShowNumber: newShowNumber,
    lastShowResult: newShow,
    recruitProspects,
    recruitProspectsUnread,
    activeRecruits,
    upcomingShow: null as GameState['upcomingShow'],
  };

  const mergedAfterShow: GameState = { ...prev, ...showPatch };
  const turnover = computeDayTurnover(mergedAfterShow);
  const injuryRecoveries = findClearedInjuryRecoveries(mergedAfterShow.roster, turnover.roster);

  return {
    perMatchOutcomes,
    injuryRecoveries,
    patch: {
      ...showPatch,
      roster: turnover.roster,
      currentDay: turnover.currentDay,
      activeRecruits: turnover.activeRecruits,
      recruitProspects: turnover.recruitProspects,
      upcomingShow: turnover.upcomingShow,
      money: showPatch.money + turnover.moneyDelta,
    },
  };
}

function plannedShowMatchesSame(a: Match[], b: Match[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].fighterAId !== b[i].fighterAId || a[i].fighterBId !== b[i].fighterBId) return false;
  }
  return true;
}

function rollRecruitProspect(popularity: number): RecruitProspect {
  const name = FIGHTER_NAMES[Math.floor(Math.random() * FIGHTER_NAMES.length)];
  const rep = promotionTier(popularity);
  const repFactor = Math.min(1.35, 0.38 + rep * 0.022);
  const rollStat = () => {
    const base = 16 + Math.random() * 34;
    return Math.min(88, Math.max(8, Math.floor(base * repFactor + (Math.random() * 10 - 3))));
  };
  const stats: FighterStats = {
    power: rollStat(),
    mic: rollStat(),
    endurance: rollStat(),
    technique: rollStat(),
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
          power: hurt(next.stats.power),
          mic: hurt(next.stats.mic),
          endurance: hurt(next.stats.endurance),
          technique: hurt(next.stats.technique),
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

  if (next.daysTrained >= RECRUIT_TRAINING_DAYS_TOTAL) {
    graduated = {
      id: Math.random().toString(36).slice(2, 11),
      name: stripRecruitJrNameSuffix(next.name),
      stats: { ...next.stats },
      salary: 0,
      signingBonus: 0,
      popularity: 0,
      energy: Math.min(100, Math.max(55, next.energy)),
      alignment: next.alignment,
      trait: next.trait,
      injuryDays: 0,
      recoveringFromInjury: false,
      image: next.image,
      debutMatchPending: true,
    };
  }

  const statDeltas: FighterStats = {
    power: next.stats.power - beforeStats.power,
    mic: next.stats.mic - beforeStats.mic,
    endurance: next.stats.endurance - beforeStats.endurance,
    technique: next.stats.technique - beforeStats.technique,
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
  newPendingGraduations: PendingRecruitGraduation[];
} {
  const choiceById = new Map(choices.map((c) => [c.recruitId, c.choice]));
  const roster = prev.roster;
  const summaries: RecruitTrainingSessionSummary[] = [];
  const newPendingGraduations: PendingRecruitGraduation[] = [];
  const updatedActive: ActiveRecruit[] = [];
  const maxRoster = getMaxRosterSize(prev);
  const alreadyPendingGradSlots = prev.pendingRecruitGraduations?.length ?? 0;

  for (const r of prev.activeRecruits) {
    const ch = choiceById.get(r.id);
    if (!r.needsTrainingChoice || ch === undefined) {
      updatedActive.push(r);
      continue;
    }
    const rosterCountIfGraduate =
      prev.roster.length + alreadyPendingGradSlots + newPendingGraduations.length;
    if (r.daysTrained === RECRUIT_TRAINING_DAYS_TOTAL - 1 && rosterCountIfGraduate >= maxRoster) {
      summaries.push({
        recruitId: r.id,
        recruitName: r.name,
        choice: ch,
        injured: false,
        injuryRiskPercent: 0,
        graduated: false,
        statsAfter: { ...r.stats },
        statDeltas: { power: 0, mic: 0, endurance: 0, technique: 0 },
        energyDelta: 0,
        energyAfter: r.energy,
        blockedBecauseRosterFull: true,
      });
      updatedActive.push(r);
      continue;
    }
    const { recruit, graduated, summary } = applyTrainingSession(r, ch, roster);
    summaries.push(summary);
    if (graduated) {
      newPendingGraduations.push({ fighter: graduated, trainingSummary: summary });
    } else {
      updatedActive.push(recruit);
    }
  }

  return {
    summaries,
    roster: prev.roster,
    activeRecruits: updatedActive,
    newPendingGraduations,
  };
}

function setupCostForMatches(matches: Match[], venueId: string): number {
  return matches.reduce((acc, _, idx) => acc + matchSetupCostAtIndex(venueId, idx), 0);
}

/** If non-null, the booked show cannot be run yet (or the card is invalid). */
export function getPlannedShowRunBlockReason(state: GameState): string | null {
  const plan = state.upcomingShow;
  if (!plan) return null;
  if (hasPendingRecruitGraduation(state)) {
    return 'Choose Face or Heel for your graduate before running the show.';
  }
  if (hasPendingRecruitTraining(state)) {
    return 'Finish rookie training before running the show.';
  }
  if (state.currentDay < plan.showDay) return 'Show is not booked for today yet.';

  const venue = VENUES.find((v) => v.id === plan.venueId) || VENUES[0];
  if (promotionTier(state.popularity) < venue.minPopularity) {
    return `Need ${venue.minPopularity} popularity for ${venue.name}.`;
  }

  const rosterIds = new Set(state.roster.map((f) => f.id));
  for (const m of plan.matches) {
    if (!m.fighterAId || !m.fighterBId) return 'Card is incomplete.';
    if (!rosterIds.has(m.fighterAId) || !rosterIds.has(m.fighterBId)) return 'A wrestler on the card is no longer on the roster.';
    const a = state.roster.find((f) => f.id === m.fighterAId);
    const b = state.roster.find((f) => f.id === m.fighterBId);
    if (a?.recoveringFromInjury || b?.recoveringFromInjury) {
      return 'A wrestler on the card is recovering from an injury and cannot compete yet.';
    }
  }

  const setup = setupCostForMatches(plan.matches, plan.venueId);
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
): Pick<GameState, 'currentDay' | 'activeRecruits' | 'recruitProspects' | 'upcomingShow' | 'roster'> & {
  moneyDelta: number;
} {
  let moneyDelta = 0;
  let nextUpcoming = prev.upcomingShow;
  const plan = prev.upcomingShow;
  if (plan && prev.currentDay < plan.showDay) {
    const sale = computeNightTicketSale(
      plan,
      prev.roster,
      prev.history,
      prev.popularity,
      prev.facilities,
      prev.ticketPriceUpgrades,
    );
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
    if (r.daysTrained >= RECRUIT_TRAINING_DAYS_TOTAL) return r;
    return { ...r, needsTrainingChoice: true };
  });

  const recruitProspects = prev.recruitProspects;

  return {
    currentDay: nextDay,
    activeRecruits,
    recruitProspects,
    moneyDelta,
    upcomingShow: nextUpcoming,
    roster: applyDayStartEnergyToRoster(prev.roster, prev.facilities),
  };
}

function computeEndDayWithoutBookedShowTransition(
  prev: GameState,
  opts?: { persistDontShowAgain?: boolean },
):
  | { ok: false; reason: string }
  | {
      ok: true;
      next: GameState;
      injuryRecoveries: InjuryRecoveryNotice[];
      needsRecruitTrainingChoice: boolean;
    } {
  if (hasPendingRecruitTraining(prev)) {
    return { ok: false, reason: 'Finish rookie training before ending the day.' };
  }
  if (hasPendingRecruitGraduation(prev)) {
    return { ok: false, reason: 'Choose Face or Heel for your graduate before ending the day.' };
  }
  if (prev.upcomingShow) {
    return { ok: false, reason: 'You already have a show booked.' };
  }
  const t = computeDayTurnover(prev);
  const injuryRecoveries = findClearedInjuryRecoveries(prev.roster, t.roster);
  const needsRecruitTrainingChoice = t.activeRecruits.some((r) => r.needsTrainingChoice);
  const nextPopularity = clampPromotionPopularity(prev.popularity * NO_SHOW_DAY_POPULARITY_FACTOR);
  const persist = Boolean(opts?.persistDontShowAgain);
  const next: GameState = {
    ...prev,
    currentDay: t.currentDay,
    activeRecruits: t.activeRecruits,
    recruitProspects: t.recruitProspects,
    upcomingShow: t.upcomingShow,
    money: prev.money + t.moneyDelta,
    roster: t.roster,
    popularity: nextPopularity,
    skipEndDayNoShowWarning: persist ? true : (prev.skipEndDayNoShowWarning ?? false),
  };
  return { ok: true, next, injuryRecoveries, needsRecruitTrainingChoice };
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

  const fireFighter = (id: string) => {
    setState((prev) => ({
      ...prev,
      roster: prev.roster.filter((f) => f.id !== id),
    }));
  };

  const upgradeRosterCapacity = () => {
    setState((prev) => {
      const maxU = maxRosterCapacityUpgradesAllowed(prev.leagueIndex);
      if (prev.rosterCapacityUpgrades >= maxU) return prev;
      const cost = getRosterCapacityUpgradeCost(prev.rosterCapacityUpgrades);
      if (prev.money < cost) return prev;
      return {
        ...prev,
        money: prev.money - cost,
        rosterCapacityUpgrades: prev.rosterCapacityUpgrades + 1,
      };
    });
  };

  const upgradeTicketPrice = () => {
    setState((prev) => {
      const maxU = maxTicketPriceUpgradesAllowed(prev.leagueIndex);
      if (prev.ticketPriceUpgrades >= maxU) return prev;
      const cost = getTicketPriceUpgradeCost(prev.ticketPriceUpgrades);
      if (prev.money < cost) return prev;
      return {
        ...prev,
        money: prev.money - cost,
        ticketPriceUpgrades: prev.ticketPriceUpgrades + 1,
      };
    });
  };

  const upgradeFacility = (facilityId: string) => {
    setState((prev) => {
      const facility = prev.facilities.find((f) => f.id === facilityId);
      if (!facility) return prev;
      if ((facility.requiredLeagueIndex ?? 0) > prev.leagueIndex) return prev;
      if (facility.level >= facilityMaxLevel(facility, prev.leagueIndex)) return prev;

      const cost = getFacilityUpgradeCost(facility);
      if (prev.money < cost) return prev;

      const nextFacilities = prev.facilities.map((f) =>
        f.id === facilityId ? { ...f, level: f.level + 1 } : f,
      );
      const next: GameState = {
        ...prev,
        money: prev.money - cost,
        facilities: nextFacilities,
      };

      return next;
    });
  };

  const promoteLeague = useCallback(() => {
    setState((prev) => {
      const nextIdx = prev.leagueIndex + 1;
      if (nextIdx > maxLeagueIndex()) return prev;
      const tier = getNextLeagueTier(prev.leagueIndex);
      if (!tier) return prev;
      if (promotionTier(prev.popularity) < tier.minPopularityToEnter) return prev;
      if (prev.money < tier.promotionFee) return prev;

      return {
        ...prev,
        money: prev.money - tier.promotionFee,
        leagueIndex: nextIdx,
        facilities: buildFacilitiesFromTemplates(prev.facilities, nextIdx),
      };
    });
  }, []);

  const markRecruitProspectsSeen = useCallback(() => {
    setState((prev) => (prev.recruitProspectsUnread ? { ...prev, recruitProspectsUnread: false } : prev));
  }, []);

  const enlistRecruit = (prospectId: string, mentorAId: string, mentorBId: string) => {
    if (mentorAId === mentorBId) return;

    setState((prev) => {
      if (prev.roster.length >= getMaxRosterSize(prev)) return prev;
      const cap = getRecruitSlotCap(prev);
      if (cap <= 0) return prev;
      if (prev.activeRecruits.length >= cap) return prev;
      const prospect = prev.recruitProspects.find((p) => p.id === prospectId);
      if (!prospect) return prev;
      if (!prev.roster.some((f) => f.id === mentorAId) || !prev.roster.some((f) => f.id === mentorBId)) {
        return prev;
      }

      const signingFee = getRecruitSigningFee(prospect.stats);
      if (prev.money < signingFee) return prev;

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
        money: prev.money - signingFee,
        recruitProspects: prev.recruitProspects.filter((p) => p.id !== prospectId),
        activeRecruits: [...prev.activeRecruits, active],
      };
    });
  };

  const enlistRecruitSkipCamp = (prospectId: string) => {
    setState((prev) => {
      if (prev.roster.length >= getMaxRosterSize(prev)) return prev;
      const prospect = prev.recruitProspects.find((p) => p.id === prospectId);
      if (!prospect) return prev;

      const signingFee = getRecruitSigningFee(prospect.stats);
      if (prev.money < signingFee) return prev;

      const beforeStats = { ...prospect.stats };
      const stats = statsAfterInstantSignPenalty(prospect.stats);
      const energy = Math.min(100, Math.max(55, prospect.energy));
      const fighter: Fighter = {
        id: Math.random().toString(36).slice(2, 11),
        name: stripRecruitJrNameSuffix(prospect.name),
        stats: { ...stats },
        salary: 0,
        signingBonus: 0,
        popularity: 0,
        energy,
        alignment: prospect.alignment,
        trait: prospect.trait,
        injuryDays: 0,
        recoveringFromInjury: false,
        image: prospect.image,
        debutMatchPending: true,
      };

      const statDeltas: FighterStats = {
        power: stats.power - beforeStats.power,
        mic: stats.mic - beforeStats.mic,
        endurance: stats.endurance - beforeStats.endurance,
        technique: stats.technique - beforeStats.technique,
      };

      const trainingSummary: RecruitTrainingSessionSummary = {
        recruitId: prospect.id,
        recruitName: prospect.name,
        choice: 'rest',
        injured: false,
        injuryRiskPercent: 0,
        graduated: true,
        statsAfter: { ...stats },
        statDeltas,
        energyDelta: energy - prospect.energy,
        energyAfter: energy,
      };

      const pending: PendingRecruitGraduation = {
        fighter,
        trainingSummary,
        signedWithoutCamp: true,
      };

      return {
        ...prev,
        money: prev.money - signingFee,
        recruitProspects: prev.recruitProspects.filter((p) => p.id !== prospectId),
        pendingRecruitGraduations: [...(prev.pendingRecruitGraduations ?? []), pending],
      };
    });
  };

  const submitRecruitTrainingChoices = (
    choices: { recruitId: string; choice: RecruitTrainingChoice }[],
  ): RecruitTrainingSessionSummary[] => {
    setState((prev) => {
      const resolved = computeRecruitTrainingResolution(prev, choices);
      trainingSubmitSummariesRef.current = resolved.summaries;
      const pending = [...(prev.pendingRecruitGraduations ?? []), ...resolved.newPendingGraduations];
      return {
        ...prev,
        roster: resolved.roster,
        activeRecruits: resolved.activeRecruits,
        pendingRecruitGraduations: pending,
      };
    });
    return trainingSubmitSummariesRef.current;
  };

  const completePendingRecruitGraduation = useCallback((fighterId: string, alignment: FighterAlignment) => {
    setState((prev) => {
      const queue = prev.pendingRecruitGraduations ?? [];
      const idx = queue.findIndex((p) => p.fighter.id === fighterId);
      if (idx === -1) return prev;
      const row = queue[idx];
      const nextQueue = queue.filter((_, i) => i !== idx);
      const fighter: Fighter = { ...row.fighter, alignment };
      return {
        ...prev,
        roster: [...prev.roster, fighter],
        pendingRecruitGraduations: nextQueue,
      };
    });
  }, []);

  const simulateShow = useCallback(
    (matches: Match[], venueId: string) => computeShowSimulation(state, matches, venueId, computeMatchScoreBreakdown),
    [state],
  );

  const commitSimulatedShow = useCallback((result: ShowSimulationResult) => {
    setState((prev) => ({ ...prev, ...result.patch }));
  }, []);

  const runShow = (matches: Match[], venueId: string) => {
    setState((prev) => {
      const result = computeShowSimulation(prev, matches, venueId, computeMatchScoreBreakdown);
      return { ...prev, ...result.patch };
    });
  };

  const scheduleUpcomingShow = (matches: Match[], venueId: string) => {
    setState((prev) => {
      if (prev.upcomingShow) return prev;
      for (const m of matches) {
        const a = prev.roster.find((f) => f.id === m.fighterAId);
        const b = prev.roster.find((f) => f.id === m.fighterBId);
        if (a?.recoveringFromInjury || b?.recoveringFromInjury) return prev;
      }
      const prepDays = computeShowPrepDays(matches.length, venueId);
      const expectedTicketSalesTotal = computeExpectedTicketSalesTotal(
        matches,
        prev.roster,
        prev.history,
        prev.popularity,
      );
      const planned: GameState['upcomingShow'] = {
        matches: matches.map((m) => ({ ...m })),
        venueId,
        prepDays,
        showDay: prev.currentDay + prepDays,
        bookedOnDay: prev.currentDay,
        expectedTicketSalesTotal,
        ticketsSoldTotal: 0,
        advanceTicketRevenueTotal: 0,
      };
      return { ...prev, upcomingShow: planned };
    });
  };

  const endDay = ():
    | { ok: true; injuryRecoveries: InjuryRecoveryNotice[]; needsRecruitTrainingChoice: boolean }
    | { ok: false; reason: string } => {
    if (hasPendingRecruitTraining(state)) {
      return { ok: false, reason: 'Finish rookie training before ending the day.' };
    }
    if (hasPendingRecruitGraduation(state)) {
      return { ok: false, reason: 'Choose Face or Heel for your graduate before ending the day.' };
    }
    if (!state.upcomingShow) {
      return { ok: false, reason: 'Book a show before ending the day.' };
    }
    if (isPlannedShowRunnableNow(state)) {
      return { ok: false, reason: 'Run the booked show before ending the day.' };
    }
    let injuryRecoveries: InjuryRecoveryNotice[] = [];
    let needsRecruitTrainingChoice = false;
    setState((prev) => {
      const t = computeDayTurnover(prev);
      injuryRecoveries = findClearedInjuryRecoveries(prev.roster, t.roster);
      needsRecruitTrainingChoice = t.activeRecruits.some((r) => r.needsTrainingChoice);
      return {
        ...prev,
        currentDay: t.currentDay,
        activeRecruits: t.activeRecruits,
        recruitProspects: t.recruitProspects,
        upcomingShow: t.upcomingShow,
        money: prev.money + t.moneyDelta,
        roster: t.roster,
      };
    });
    return { ok: true, injuryRecoveries, needsRecruitTrainingChoice };
  };

  const endDayWithoutBookedShow = useCallback(
    (
      opts?: { persistDontShowAgain?: boolean },
    ):
      | {
          ok: true;
          injuryRecoveries: InjuryRecoveryNotice[];
          needsRecruitTrainingChoice: boolean;
        }
      | { ok: false; reason: string } => {
      let outcome:
        | {
            ok: true;
            injuryRecoveries: InjuryRecoveryNotice[];
            needsRecruitTrainingChoice: boolean;
          }
        | { ok: false; reason: string }
        | undefined;

      flushSync(() => {
        setState((prev) => {
          const computed = computeEndDayWithoutBookedShowTransition(prev, opts);
          if (!computed.ok) {
            outcome = computed;
            return prev;
          }
          outcome = {
            ok: true,
            injuryRecoveries: computed.injuryRecoveries,
            needsRecruitTrainingChoice: computed.needsRecruitTrainingChoice,
          };
          return computed.next;
        });
      });

      return outcome ?? { ok: false, reason: 'Could not end the day.' };
    },
    [],
  );

  const resetGame = () => {
    if (confirm('Are you sure you want to reset your progress?')) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const completeOpeningDraft = useCallback((nextRoster: Fighter[]) => {
    setState((prev) => ({
      ...prev,
      roster: nextRoster.slice(0, OPENING_DRAFT_PICKS),
      hasCompletedOpeningDraft: true,
    }));
  }, []);

  const addMoney = (amount: number) => {
    setState((prev) => ({ ...prev, money: prev.money + amount }));
  };

  return {
    state,
    fireFighter,
    upgradeFacility,
    upgradeRosterCapacity,
    upgradeTicketPrice,
    promoteLeague,
    runShow,
    simulateShow,
    commitSimulatedShow,
    resetGame,
    addMoney,
    markRecruitProspectsSeen,
    enlistRecruit,
    enlistRecruitSkipCamp,
    submitRecruitTrainingChoices,
    completePendingRecruitGraduation,
    scheduleUpcomingShow,
    endDay,
    endDayWithoutBookedShow,
    completeOpeningDraft,
  };
}
