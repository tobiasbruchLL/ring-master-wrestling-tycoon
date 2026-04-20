export type FighterAlignment = 'Face' | 'Heel';
export type FighterTrait = 'Technician' | 'Brawler' | 'High Flyer' | 'Powerhouse';

/** In-ring and entertainment attributes (roughly 5–100 in play). */
export type FighterStats = {
  /** PWR — striking impact. */
  power: number;
  /** TEC — pace and control; safer workers reduce injury risk alongside energy. */
  technique: number;
  /** END — staying power; higher END means less energy lost after matches. */
  endurance: number;
  /** MIC — crowd connection; scales popularity gained from match performance (not the booking matchup score). */
  mic: number;
};

export type Fighter = {
  id: string;
  name: string;
  stats: FighterStats;
  salary: number;
  signingBonus: number;
  popularity: number;
  energy: number; // 0-100
  alignment: FighterAlignment;
  trait: FighterTrait;
  /** Legacy saves only; recovery is energy-based via `recoveringFromInjury`. */
  injuryDays: number;
  /** When true, cannot be booked; gains higher daily energy until energy reaches 100. */
  recoveringFromInjury: boolean;
  image: string;
  /** True for roster adds straight from rookie camp; first completed match clears this and applies buzz bonus. */
  debutMatchPending?: boolean;
};

export type Facility = {
  id: string;
  name: string;
  level: number;
  baseCost: number;
  description: string;
  effect: string;
  /** This row only appears in HQ after the player reaches this league index (0 = from the start). */
  requiredLeagueIndex?: number;
  /**
   * Geometric growth for upgrade price at level ≥ 1: next cost = floor(baseCost × multiplier^(level − 1)).
   * Default 2.2 when omitted (older saves).
   */
  upgradeCostMultiplier?: number;
  /** Subtracted from `baseCost` for the level 0 → 1 purchase only. Default 0. */
  firstUpgradeDiscount?: number;
  /**
   * Max facility `level` allowed at each `GameState.leagueIndex` (same length as league tiers).
   * Example: `[3, 5, 7, 9]` — in the first league, level cannot exceed 3; after promoting once, 5; etc.
   * If omitted, no cap beyond practical limits.
   */
  maxLevelByLeagueIndex?: number[];
};

export type MarketingCampaign = {
  id: string;
  name: string;
  cost: number;
  duration: number; // in shows
  popularityBoost: number;
};

export type Match = {
  id: string;
  fighterAId: string;
  fighterBId: string;
  winnerId?: string;
  /** Legacy completed matches only (1–5). New sims use `matchScore`. */
  rating?: number;
  /** Uncapped quality score after the match resolves (matchup × finish). */
  matchScore?: number;
  /** Winner's remaining HP at the finish (1–100); set when simulated. */
  winnerHpPercent?: number;
  /**
   * Pre-finish **in-ring** total (floored) used with winner HP to get `matchScore` / popularity.
   * Excludes heel/face and evenly-matched bonuses — those only affect ticket-sales matchup.
   * Omitted on legacy saves and fallback sim rows.
   */
  matchupTotalScore?: number;
};

export type Venue = {
  id: string;
  name: string;
  cost: number;
  multiplier: number;
  minPopularity: number;
  /** Fire code / building capacity (advance sales cap). */
  maxAudience: number;
  /** Base ticket price before buzz surcharge. */
  baseTicketPrice: number;
};

export type Show = {
  id: string;
  name: string;
  matches: Match[];
  /** Gate / advance ticket income for this card (counted toward net profit). */
  revenue: number;
  /** Show-night tickets sold after expected-sales variance is applied. */
  ticketsSoldTotal?: number;
  attendance: number;
  /** Blended 1–5 show quality for promotion expectation math (derived from match scores). */
  rating: number;
  /** Mean `matchScore` across the card (popularity / quality math); show result UI uses sum of match scores. */
  averageMatchScore?: number;
  /** Change applied to `GameState.popularity` for this show (fractional = bar fill toward next tier). */
  popularityGain: number;
  /** Mean match score fans expected when the show ran (from popularity tier table); absent on older saves. */
  expectedAverageMatchScore?: number;
  date: number; // Timestamp or show number
  venueCost: number;
  setupCost: number;
};

export type RecruitTrainingChoice = keyof FighterStats | 'rest';

/** One rookie's resolved day after confirming training choices. */
export type RecruitTrainingSessionSummary = {
  recruitId: string;
  recruitName: string;
  choice: RecruitTrainingChoice;
  /** True when the low-energy mishap roll fired. */
  injured: boolean;
  /** Mishap chance (0–100) that applied before the roll. */
  injuryRiskPercent: number;
  graduated: boolean;
  /** Stats at end of this training day (camp numbers before roster promotion if graduated). */
  statsAfter: FighterStats;
  statDeltas: FighterStats;
  energyDelta: number;
  energyAfter: number;
  /** True when the final camp day could not debut because the roster was at capacity. */
  blockedBecauseRosterFull?: boolean;
};

/** Graduate not yet on the roster until the player picks Face or Heel. */
export type PendingRecruitGraduation = {
  fighter: Fighter;
  trainingSummary: RecruitTrainingSessionSummary;
  /** Signed straight to debut queue with no camp (weaker stats; does not use a training slot). */
  signedWithoutCamp?: boolean;
};

export type RecruitProspect = {
  id: string;
  name: string;
  stats: FighterStats;
  energy: number;
  alignment: FighterAlignment;
  trait: FighterTrait;
  image: string;
};

export type ActiveRecruit = {
  id: string;
  name: string;
  stats: FighterStats;
  energy: number;
  alignment: FighterAlignment;
  trait: FighterTrait;
  image: string;
  mentorIds: [string, string];
  daysTrained: number;
  /** Calendar day this rookie was enlisted (legacy saves may only have enlistedAtShow). */
  enlistedOnDay: number;
  needsTrainingChoice: boolean;
};

/** Booked card waiting for show day (see currentDay / showDay). */
export type PlannedShow = {
  matches: Match[];
  venueId: string;
  prepDays: number;
  /** Game day the show is booked for (inclusive). */
  showDay: number;
  /** Calendar day the card was booked (for advance ticket pacing). */
  bookedOnDay?: number;
  /** Snapshot of card-level expected sales at booking time (sum of match expected sales). */
  expectedTicketSalesTotal?: number;
  /** Advance tickets sold toward this show (also the expected audience count). */
  ticketsSoldTotal?: number;
  /** Accrued gate from advance ticket nights; paid into cash when the show runs. */
  advanceTicketRevenueTotal?: number;
};

export type GameState = {
  money: number;
  /** Promotion tier + fractional progress toward the next tier (e.g. 5.3 ≈ tier 5, bar ~30% full). Minimum 1. */
  popularity: number;
  /** Current league tier (0 = starting circuit). Higher leagues unlock HQ upgrades and cost scaling fees to enter. */
  leagueIndex: number;
  /**
   * Count of Locker Room Expansion purchases; each adds one max roster slot (see `getMaxRosterSize`).
   * League caps how many may be owned: `2 × (leagueIndex + 1)` purchases; base roster is 4.
   */
  rosterCapacityUpgrades: number;
  /**
   * HQ ticket pricing upgrades: each purchase adds $1 to every ticket (on top of venue base + card buzz).
   * Backyard gate is $10 before buzz with zero purchases.
   */
  ticketPriceUpgrades: number;
  roster: Fighter[];
  /** False only on a brand-new save before the opening draft (two picks) finishes. */
  hasCompletedOpeningDraft: boolean;
  facilities: Facility[];
  activeMarketing: MarketingCampaign[];
  history: Show[];
  currentShowNumber: number;
  /** Calendar day for daily training / scheduling (1-based). */
  currentDay: number;
  /** Null when no card is booked. */
  upcomingShow: PlannedShow | null;
  /** When true, skip the confirmation modal for ending a day without a booked show. */
  skipEndDayNoShowWarning?: boolean;
  lastShowResult?: Show;
  recruitProspects: RecruitProspect[];
  /** True after a post-show prospect refresh until the player opens the Recruit tab. */
  recruitProspectsUnread: boolean;
  activeRecruits: ActiveRecruit[];
  /** Rookies who finished camp; added to `roster` after alignment is chosen in the UI. */
  pendingRecruitGraduations?: PendingRecruitGraduation[];
};

/** Deltas applied to a fighter after a booked show (same rules as simulation commit). */
export type FighterBookingDelta = {
  energy: number;
  popularity: number;
  /** Set when a random injury from low energy / match wear triggered recovery. */
  injurySustained?: boolean;
  /** Snapshots for match outcome UI (typically show-start vs show-end for that fighter). */
  popularityBefore: number;
  popularityAfter: number;
  energyBefore: number;
  energyAfter: number;
};

export type SimulatedMatchOutcomeDetail = {
  match: Match;
  fighterA: Pick<Fighter, 'id' | 'name' | 'image'>;
  fighterB: Pick<Fighter, 'id' | 'name' | 'image'>;
  deltaA: FighterBookingDelta;
  deltaB: FighterBookingDelta;
};

/** Wrestlers who cleared injury recovery when day turnover ran after this update. */
export type InjuryRecoveryNotice = {
  fighterId: string;
  name: string;
};

/** Precomputed show: UI per-match breakdown plus state patch for commit after simulation. */
export type ShowSimulationResult = {
  perMatchOutcomes: SimulatedMatchOutcomeDetail[];
  /** Fighters who finished injury recovery when the post-show day tick applied. */
  injuryRecoveries: InjuryRecoveryNotice[];
  patch: Pick<
    GameState,
    | 'money'
    | 'popularity'
    | 'roster'
    | 'history'
    | 'currentShowNumber'
    | 'currentDay'
    | 'lastShowResult'
    | 'recruitProspects'
    | 'recruitProspectsUnread'
    | 'activeRecruits'
    | 'upcomingShow'
  >;
};

/** Concurrent rookie camp slots (= Performance Center level; 0 means no camp training). */
export function getRecruitSlotCap(state: GameState): number {
  const pc = state.facilities.find((f) => f.id === 'performance_center');
  return pc?.level ?? 0;
}

export function hasPendingRecruitTraining(state: GameState): boolean {
  return state.activeRecruits.some((r) => r.needsTrainingChoice);
}

export function hasPendingRecruitGraduation(state: GameState): boolean {
  return (state.pendingRecruitGraduations?.length ?? 0) > 0;
}
