import { GameState, Match, PlannedShow, Show, Venue } from '../types';
import { VENUES } from '../constants';
import { computeMatchScoreBreakdown } from './matchScoring';

function venueById(venueId: string): Venue {
  return VENUES.find((v) => v.id === venueId) ?? VENUES[0];
}

export function venueAudienceCap(venueId: string): number {
  return venueById(venueId).maxAudience;
}

/** Per-ticket price for this venue and card buzz (whole dollars). */
export function effectiveTicketUnitPrice(venue: Venue, excitement: number): number {
  const buzzAddon = Math.min(24, Math.floor(excitement / 52));
  return Math.max(4, venue.baseTicketPrice + buzzAddon);
}

/** Average matchup `totalScore` across booked matches that have both wrestlers. */
export function averageCardExcitement(matches: Match[], roster: GameState['roster'], history: Show[]): number {
  let sum = 0;
  let n = 0;
  for (const m of matches) {
    const b = computeMatchScoreBreakdown(m, roster, history);
    if (b) {
      sum += b.totalScore;
      n++;
    }
  }
  if (n === 0) return 120;
  return sum / n;
}

export function bookedShowFirstDay(plan: PlannedShow): number {
  if (typeof plan.bookedOnDay === 'number') return plan.bookedOnDay;
  return plan.showDay - plan.prepDays;
}

/** Completed prep nights that earned advance ticket money (still before show day). */
export function advanceTicketNightsSold(plan: PlannedShow, currentDay: number): number {
  const start = bookedShowFirstDay(plan);
  if (currentDay <= start) return 0;
  return Math.max(0, Math.min(plan.prepDays, currentDay - start));
}

export function advanceTicketNightsRemaining(plan: PlannedShow, currentDay: number): number {
  return Math.max(0, plan.prepDays - advanceTicketNightsSold(plan, currentDay));
}

/**
 * One advance-sales night: tickets capped by remaining seats, income = tickets × unit price.
 */
export function computeNightTicketSale(
  plan: PlannedShow,
  roster: GameState['roster'],
  history: Show[],
  popularity: number,
): { tickets: number; income: number; pricePerTicket: number } {
  const venue = venueById(plan.venueId);
  const excitement = averageCardExcitement(plan.matches, roster, history);
  const cap = venue.maxAudience;
  const sold = plan.ticketsSoldTotal ?? 0;
  const remaining = Math.max(0, cap - sold);
  const pricePerTicket = effectiveTicketUnitPrice(venue, excitement);

  if (remaining === 0) {
    return { tickets: 0, income: 0, pricePerTicket };
  }

  const hype = 0.65 + Math.min(0.55, excitement / 520);
  const demand = Math.floor((18 + popularity * 4.5 + excitement * 0.38) * venue.multiplier * hype);
  const tickets = Math.min(remaining, Math.max(0, demand));
  const income = tickets * pricePerTicket;
  return { tickets, income, pricePerTicket };
}
