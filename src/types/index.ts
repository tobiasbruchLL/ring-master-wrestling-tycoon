export type FighterAlignment = 'Face' | 'Heel';
export type FighterTrait = 'Technician' | 'Brawler' | 'High Flyer' | 'Powerhouse';

export type FighterStats = {
  strength: number;
  charisma: number;
  stamina: number;
  skill: number;
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
  /** When true, cannot be booked; gains +10 energy per day until energy reaches 100. */
  recoveringFromInjury: boolean;
  image: string;
};

export type Facility = {
  id: string;
  name: string;
  level: number;
  baseCost: number;
  description: string;
  effect: string;
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
  rating?: number; // 1-5 stars
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
  /** Tickets sold during prep for this show (same basis as expected audience). */
  ticketsSoldTotal?: number;
  attendance: number;
  rating: number; // Average of matches
  /** Change applied to `GameState.popularity` for this show (fractional = bar fill toward next tier). */
  popularityGain: number;
  /** Target show rating (1–5) for promotion popularity when the show ran; absent on older saves. */
  expectedShowRating?: number;
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
  /** Advance tickets sold toward this show (also the expected audience count). */
  ticketsSoldTotal?: number;
  /** Sum of cash earned from advance ticket nights for this card. */
  advanceTicketRevenueTotal?: number;
};

export type GameState = {
  money: number;
  /** Promotion tier + fractional progress toward the next tier (e.g. 5.3 ≈ tier 5, bar ~30% full). Minimum 1. */
  popularity: number;
  roster: Fighter[];
  /** False only on a brand-new save before the opening draft (five picks) finishes. */
  hasCompletedOpeningDraft: boolean;
  facilities: Facility[];
  activeMarketing: MarketingCampaign[];
  history: Show[];
  currentShowNumber: number;
  /** Calendar day for daily training / scheduling (1-based). */
  currentDay: number;
  /** Null when no card is booked. */
  upcomingShow: PlannedShow | null;
  lastShowResult?: Show;
  recruitProspects: RecruitProspect[];
  activeRecruits: ActiveRecruit[];
};

/** Deltas applied to a fighter after a booked show (same rules as simulation commit). */
export type FighterBookingDelta = {
  energy: number;
  popularity: number;
  /** Set when a random injury from low energy / match wear triggered recovery. */
  injurySustained?: boolean;
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
    | 'activeRecruits'
    | 'upcomingShow'
  >;
};

export function getRecruitSlotCap(state: GameState): number {
  const pc = state.facilities.find((f) => f.id === 'performance_center');
  return pc?.level ?? 0;
}

export function hasPendingRecruitTraining(state: GameState): boolean {
  return state.activeRecruits.some((r) => r.needsTrainingChoice);
}
