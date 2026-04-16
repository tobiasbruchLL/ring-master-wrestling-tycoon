import { Fighter, Facility, MarketingCampaign, Venue } from './types';

export const INITIAL_MONEY = 0;
export const INITIAL_POPULARITY = 2;

export const VENUES: Venue[] = [
  { id: 'backyard', name: 'Backyard', cost: 0, multiplier: 1, minPopularity: 0 },
  { id: 'gym', name: 'High School Gym', cost: 500, multiplier: 1.5, minPopularity: 5 },
  { id: 'club', name: 'Nightclub', cost: 1500, multiplier: 2.5, minPopularity: 15 },
  { id: 'arena', name: 'City Arena', cost: 5000, multiplier: 5, minPopularity: 40 },
];

export const STARTING_FIGHTERS: Fighter[] = [
  {
    id: 'f1',
    name: 'The Iron Giant',
    stats: { strength: 80, charisma: 40, stamina: 60, skill: 50 },
    salary: 0,
    signingBonus: 0,
    popularity: 20,
    energy: 100,
    alignment: 'Heel',
    trait: 'Powerhouse',
    injuryDays: 0,
    image: '/wrestler.png',
  },
  {
    id: 'f2',
    name: 'Neon Ninja',
    stats: { strength: 40, charisma: 70, stamina: 80, skill: 90 },
    salary: 0,
    signingBonus: 0,
    popularity: 35,
    energy: 100,
    alignment: 'Face',
    trait: 'High Flyer',
    injuryDays: 0,
    image: '/wrestler.png',
  },
  {
    id: 'f3',
    name: 'Bulk Hogan',
    stats: { strength: 90, charisma: 95, stamina: 50, skill: 40 },
    salary: 0,
    signingBonus: 0,
    popularity: 60,
    energy: 100,
    alignment: 'Face',
    trait: 'Brawler',
    injuryDays: 0,
    image: '/wrestler.png',
  },
];

export const AVAILABLE_FACILITIES: Facility[] = [
  {
    id: 'gym',
    name: 'Training Gym',
    level: 1,
    baseCost: 3000,
    description: 'Improves fighter strength and stamina training.',
    effect: '+5% Training Efficiency',
  },
  {
    id: 'arena',
    name: 'Local Arena',
    level: 1,
    baseCost: 8000,
    description: 'Increases maximum attendance for shows.',
    effect: '+300 Max Attendance',
  },
  {
    id: 'medical',
    name: 'Medical Wing',
    level: 1,
    baseCost: 5000,
    description: 'Reduces injury recovery time.',
    effect: '-1 Day Recovery Time',
  },
];

export const MARKETING_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: 'social',
    name: 'Social Media Blitz',
    cost: 1000,
    duration: 1,
    popularityBoost: 1,
  },
  {
    id: 'tv',
    name: 'Local TV Ad',
    cost: 4000,
    duration: 3,
    popularityBoost: 3,
  },
  {
    id: 'billboard',
    name: 'Highway Billboard',
    cost: 10000,
    duration: 5,
    popularityBoost: 8,
  },
];

export const FIGHTER_NAMES = [
  'The Crusher', 'El Diablo', 'Thunder Bolt', 'Silver Shadow', 'The Beast',
  'Golden Boy', 'Iron Fist', 'The Ghost', 'Raging Bull', 'Snake Eyes',
  'The Professor', 'Wild Card', 'Big Bad Wolf', 'The King', 'Ace of Spades'
];

export const ALIGNMENTS = ['Face', 'Heel'] as const;
export const TRAITS = ['Technician', 'Brawler', 'High Flyer', 'Powerhouse'] as const;
