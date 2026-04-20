import { GameState, Match, PlannedShow, Show, Venue } from '../types';
import { VENUES } from '../constants';
import { computeTicketSalesMatchupBreakdown } from './matchScoring';
import { merchGateMultiplier } from './facilityBonuses';
import { HQ_TICKET_PRICE_START } from './ticketPriceUpgrade';

function venueById(venueId: string): Venue {
  return VENUES.find((v) => v.id === venueId) ?? VENUES[0];
}

/**
 * Base fees at Backyard (index 0 = first match). Extra slots ramp for bigger cards;
 * `matchSetupCostAtIndex` applies a venue multiplier on top.
 */
const BASE_MATCH_SETUP_COST_BY_INDEX: readonly number[] = [0, 250, 400, 600, 800, 1050, 1350];

/** Sharp step-up by venue booking cost (bigger buildings = much pricier extra matches). */
function additionalMatchCostMultiplier(venue: Venue): number {
  if (venue.cost >= 5000) return 4.5;
  if (venue.cost >= 1500) return 2.75;
  if (venue.cost >= 500) return 1.7;
  return 1;
}

/** Max matches on the card: each venue tier above Backyard adds one slot (4 … 7 for the default roster of venues). */
export function maxMatchesForVenue(venueId: string): number {
  const idx = VENUES.findIndex((v) => v.id === venueId);
  const rank = idx >= 0 ? idx : 0;
  return 3 + (rank + 1);
}

/**
 * Per-match setup/production charge when booking or running a show.
 * First match is free; additional matches scale sharply with venue tier.
 */
export function matchSetupCostAtIndex(venueId: string, matchIndex: number): number {
  const venue = venueById(venueId);
  const mult = additionalMatchCostMultiplier(venue);
  const base = BASE_MATCH_SETUP_COST_BY_INDEX[matchIndex] ?? 0;
  return Math.round(base * mult);
}

export function venueAudienceCap(venueId: string): number {
  return venueById(venueId).maxAudience;
}

/**
 * Gate price per ticket (whole dollars): flat {@link HQ_TICKET_PRICE_START} plus +$1 per HQ ticket upgrade.
 * Card hype and venue `baseTicketPrice` do not change gate math (venue scale is demand/capacity elsewhere).
 */
export function effectiveTicketUnitPrice(
  _venue: Venue,
  _excitement: number,
  ticketPriceUpgrades = 0,
): number {
  const hq = Math.max(0, Math.floor(ticketPriceUpgrades));
  return HQ_TICKET_PRICE_START + hq;
}

/**
 * Expected ticket demand for one match from ticket-sales hype (`totalScore` on the ticket breakdown).
 * Matches planner UI: `floor(hype / 10)`.
 */
export function expectedTicketDemandFromHype(totalScore: number): number {
  return Math.max(0, Math.floor(totalScore / 10));
}

/** Sum of per-match {@link expectedTicketDemandFromHype} — stored on `upcomingShow.expectedTicketSalesTotal`. */
export function computeExpectedTicketSalesTotal(
  matches: Match[],
  roster: GameState['roster'],
  history: Show[],
  promotionPopularity: number,
): number {
  let sum = 0;
  for (const m of matches) {
    const b = computeTicketSalesMatchupBreakdown(m, roster, history, promotionPopularity);
    if (b) sum += expectedTicketDemandFromHype(b.totalScore);
  }
  return sum;
}

/** Average ticket-sales hype (`totalScore`) per match — used when inferring demand if `expectedTicketSalesTotal` is missing. */
export function averageCardExcitement(
  matches: Match[],
  roster: GameState['roster'],
  history: Show[],
  promotionPopularity?: number,
): number {
  let sum = 0;
  let n = 0;
  for (const m of matches) {
    const b = computeTicketSalesMatchupBreakdown(m, roster, history, promotionPopularity);
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

/** Completed prep nights that accrued advance ticket sales (still before show day). */
export function advanceTicketNightsSold(plan: PlannedShow, currentDay: number): number {
  const start = bookedShowFirstDay(plan);
  if (currentDay <= start) return 0;
  return Math.max(0, Math.min(plan.prepDays, currentDay - start));
}

export function advanceTicketNightsRemaining(plan: PlannedShow, currentDay: number): number {
  return Math.max(0, plan.prepDays - advanceTicketNightsSold(plan, currentDay));
}

/**
 * One advance-sales night: tickets capped by remaining seats; `income` is gate accrued (paid after the show).
 */
export function computeNightTicketSale(
  plan: PlannedShow,
  roster: GameState['roster'],
  history: Show[],
  popularity: number,
  facilities: GameState['facilities'],
  ticketPriceUpgrades = 0,
): { tickets: number; income: number; pricePerTicket: number } {
  const venue = venueById(plan.venueId);
  const cap = venue.maxAudience;
  const sold = plan.ticketsSoldTotal ?? 0;
  const remaining = Math.max(0, cap - sold);
  const pricePerTicket = effectiveTicketUnitPrice(venue, 0, ticketPriceUpgrades);

  if (remaining === 0) {
    return { tickets: 0, income: 0, pricePerTicket };
  }

  const prepDays = Math.max(1, plan.prepDays);
  const expectedTotal =
    typeof plan.expectedTicketSalesTotal === 'number'
      ? Math.max(0, plan.expectedTicketSalesTotal)
      : Math.max(
          0,
          Math.floor(
            (18 +
              popularity * 4.5 +
              averageCardExcitement(plan.matches, roster, history, popularity) * 0.38) *
              venue.multiplier,
          ),
        );
  const perDayExpectedSales = expectedTotal / prepDays;
  const demand = Math.floor(perDayExpectedSales * (0.9 + Math.random() * 0.3));
  const tickets = Math.min(remaining, Math.max(0, demand));
  const income = Math.floor(tickets * pricePerTicket * merchGateMultiplier(facilities));
  return { tickets, income, pricePerTicket };
}
