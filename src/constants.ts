import { Fighter, Facility, MarketingCampaign, Venue } from './types';

export const INITIAL_MONEY = 0;
export const INITIAL_POPULARITY = 1;

export const VENUES: Venue[] = [
  {
    id: 'backyard',
    name: 'Backyard',
    cost: 0,
    multiplier: 1,
    minPopularity: 0,
    maxAudience: 75,
    baseTicketPrice: 10,
  },
  {
    id: 'gym',
    name: 'High School Gym',
    cost: 500,
    multiplier: 1.5,
    minPopularity: 5,
    maxAudience: 420,
    baseTicketPrice: 16,
  },
  {
    id: 'club',
    name: 'Nightclub',
    cost: 1500,
    multiplier: 2.5,
    minPopularity: 15,
    maxAudience: 1100,
    baseTicketPrice: 26,
  },
  {
    id: 'arena',
    name: 'City Arena',
    cost: 5000,
    multiplier: 5,
    minPopularity: 40,
    maxAudience: 5200,
    baseTicketPrice: 42,
  },
];

export const STARTING_FIGHTERS: Fighter[] = [
  {
    id: 'f1',
    name: 'The Iron Giant',
    stats: { strength: 28, charisma: 14, stamina: 20, skill: 16 },
    salary: 0,
    signingBonus: 0,
    popularity: 6,
    energy: 100,
    alignment: 'Heel',
    trait: 'Powerhouse',
    injuryDays: 0,
    recoveringFromInjury: false,
    image: '/wrestler.png',
  },
  {
    id: 'f2',
    name: 'Neon Ninja',
    stats: { strength: 14, charisma: 22, stamina: 22, skill: 26 },
    salary: 0,
    signingBonus: 0,
    popularity: 8,
    energy: 100,
    alignment: 'Face',
    trait: 'High Flyer',
    injuryDays: 0,
    recoveringFromInjury: false,
    image: '/wrestler.png',
  },
  {
    id: 'f3',
    name: 'Bulk Hogan',
    stats: { strength: 26, charisma: 20, stamina: 16, skill: 14 },
    salary: 0,
    signingBonus: 0,
    popularity: 10,
    energy: 100,
    alignment: 'Face',
    trait: 'Brawler',
    injuryDays: 0,
    recoveringFromInjury: false,
    image: '/wrestler.png',
  },
];

export const AVAILABLE_FACILITIES: Facility[] = [
  {
    id: 'performance_center',
    name: 'Performance Center',
    level: 0,
    baseCost: 4200,
    description: 'Unlocks recruiting and adds one concurrent rookie training slot per level.',
    effect: '+1 recruit slot per level',
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
