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
  date: number; // Timestamp or show number
  venueCost: number;
  setupCost: number;
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
};
