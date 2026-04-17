/** Backyard gate before buzz; upgrades stack +$1 per purchase on top of venue + buzz. */
export const HQ_TICKET_PRICE_START = 10;

/** Each league tier allows this many ticket-price purchases (cumulative with promotion). */
export const TICKET_PRICE_UPGRADES_PER_LEAGUE = 2;

const UPGRADE_BASE_COST = 2_400;
const UPGRADE_COST_MULT = 2.15;

export function maxTicketPriceUpgradesAllowed(leagueIndex: number): number {
  return TICKET_PRICE_UPGRADES_PER_LEAGUE * (leagueIndex + 1);
}

export function getTicketPriceUpgradeCost(currentUpgradesPurchased: number): number {
  const u = Math.max(0, Math.floor(currentUpgradesPurchased));
  if (u === 0) return UPGRADE_BASE_COST;
  return Math.floor(UPGRADE_BASE_COST * Math.pow(UPGRADE_COST_MULT, u - 1));
}

export function hasAffordableTicketPriceUpgrade(state: {
  money: number;
  leagueIndex: number;
  ticketPriceUpgrades: number;
}): boolean {
  const maxU = maxTicketPriceUpgradesAllowed(state.leagueIndex);
  if (state.ticketPriceUpgrades >= maxU) return false;
  return state.money >= getTicketPriceUpgradeCost(state.ticketPriceUpgrades);
}
