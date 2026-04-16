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
  injuryDays: number;
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
};

export type Show = {
  id: string;
  name: string;
  matches: Match[];
  revenue: number;
  attendance: number;
  rating: number; // Average of matches
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
  enlistedAtShow: number;
  needsTrainingChoice: boolean;
};

export type GameState = {
  money: number;
  popularity: number;
  roster: Fighter[];
  facilities: Facility[];
  activeMarketing: MarketingCampaign[];
  history: Show[];
  currentShowNumber: number;
  lastShowResult?: Show;
  recruitProspects: RecruitProspect[];
  activeRecruits: ActiveRecruit[];
};

/** Deltas applied to a fighter after a booked show (same rules as simulation commit). */
export type FighterBookingDelta = {
  energy: number;
  popularity: number;
};

export type SimulatedMatchOutcomeDetail = {
  match: Match;
  fighterA: Pick<Fighter, 'id' | 'name' | 'image'>;
  fighterB: Pick<Fighter, 'id' | 'name' | 'image'>;
  deltaA: FighterBookingDelta;
  deltaB: FighterBookingDelta;
};

/** Precomputed show: UI per-match breakdown plus state patch for commit after simulation. */
export type ShowSimulationResult = {
  perMatchOutcomes: SimulatedMatchOutcomeDetail[];
  patch: Pick<
    GameState,
    | 'money'
    | 'popularity'
    | 'roster'
    | 'history'
    | 'currentShowNumber'
    | 'lastShowResult'
    | 'recruitProspects'
    | 'activeRecruits'
  >;
};

export function getRecruitSlotCap(state: GameState): number {
  const pc = state.facilities.find((f) => f.id === 'performance_center');
  return pc?.level ?? 0;
}

export function hasPendingRecruitTraining(state: GameState): boolean {
  return state.activeRecruits.some((r) => r.needsTrainingChoice);
}
