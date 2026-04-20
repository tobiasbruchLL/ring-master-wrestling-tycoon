import { ArrowUpCircle } from 'lucide-react';
import type { Facility, GameState } from '../types';
import { facilityMaxLevel, isFacilityAtLeagueLevelCap } from '../lib/facilityCaps';
import { merchGateMultiplier } from '../lib/facilityBonuses';
import { maxLeagueIndex } from '../lib/leagues';
import {
  getMaxRosterSize,
  getRosterCapacityUpgradeCost,
  maxRosterCapacityUpgradesAllowed,
  ROSTER_SLOTS_PER_EXPANSION_PURCHASE,
} from '../lib/rosterCapacity';
import {
  getTicketPriceUpgradeCost,
  HQ_TICKET_PRICE_START,
  maxTicketPriceUpgradesAllowed,
} from '../lib/ticketPriceUpgrade';
import { cn, formatCurrency, getFacilityUpgradeCost } from '../lib/utils';

interface FacilitiesProps {
  state: GameState;
  onUpgrade: (id: string) => void;
  onUpgradeRosterCapacity: () => void;
  onUpgradeTicketPrice: () => void;
}

function facilityUpgradeValueLine(facility: Facility, allFacilities: Facility[]): string {
  switch (facility.id) {
    case 'performance_center': {
      const cur = facility.level;
      const next = cur + 1;
      return `${cur} rookie camp slot${cur === 1 ? '' : 's'} -> ${next} rookie camp slot${next === 1 ? '' : 's'}`;
    }
    case 'wellness_center': {
      const cur = 5 + facility.level;
      const next = 5 + facility.level + 1;
      return `${cur} Daily Energy Recovery -> ${next} Daily Energy Recovery`;
    }
    case 'merch_booth': {
      const curPct = Math.round((merchGateMultiplier(allFacilities) - 1) * 100);
      const bumped = allFacilities.map((f) => (f.id === 'merch_booth' ? { ...f, level: f.level + 1 } : f));
      const nextPct = Math.round((merchGateMultiplier(bumped) - 1) * 100);
      return `${curPct}% Ticket Gate -> ${nextPct}% Ticket Gate`;
    }
    case 'travel_package': {
      const cur = facility.level * 750;
      const next = (facility.level + 1) * 750;
      return `${formatCurrency(cur)} Show Bonus -> ${formatCurrency(next)} Show Bonus`;
    }
    case 'sponsor_lounge': {
      const cur = facility.level * 2_500;
      const next = (facility.level + 1) * 2_500;
      return `${formatCurrency(cur)} Show Bonus -> ${formatCurrency(next)} Show Bonus`;
    }
    default:
      return facility.effect;
  }
}

type UpgradeRow =
  | { kind: 'roster'; sortCost: number }
  | { kind: 'ticket'; sortCost: number }
  | { kind: 'facility'; facility: Facility; sortCost: number };

function rowTier(kind: UpgradeRow['kind']): number {
  return kind === 'roster' ? 0 : kind === 'ticket' ? 1 : 2;
}

export default function Facilities({
  state,
  onUpgrade,
  onUpgradeRosterCapacity,
  onUpgradeTicketPrice,
}: FacilitiesProps) {
  const rosterUpgradeMax = maxRosterCapacityUpgradesAllowed(state.leagueIndex);
  const atRosterUpgradeLeagueCap = state.rosterCapacityUpgrades >= rosterUpgradeMax;
  const rosterUpgradeCost = getRosterCapacityUpgradeCost(state.rosterCapacityUpgrades);
  const canAffordRosterUpgrade = state.money >= rosterUpgradeCost;
  const canRosterUpgrade = canAffordRosterUpgrade && !atRosterUpgradeLeagueCap;
  const nextLeagueRosterCap =
    state.leagueIndex < maxLeagueIndex() ? maxRosterCapacityUpgradesAllowed(state.leagueIndex + 1) : null;
  const maxRoster = getMaxRosterSize(state);

  const ticketUpgradeMax = maxTicketPriceUpgradesAllowed(state.leagueIndex);
  const atTicketUpgradeLeagueCap = state.ticketPriceUpgrades >= ticketUpgradeMax;
  const ticketUpgradeCost = getTicketPriceUpgradeCost(state.ticketPriceUpgrades);
  const canAffordTicketUpgrade = state.money >= ticketUpgradeCost;
  const canTicketUpgrade = canAffordTicketUpgrade && !atTicketUpgradeLeagueCap;
  const nextLeagueTicketCap =
    state.leagueIndex < maxLeagueIndex() ? maxTicketPriceUpgradesAllowed(state.leagueIndex + 1) : null;
  const curTicketBonus = state.ticketPriceUpgrades;
  const nextTicketBonus = state.ticketPriceUpgrades + 1;

  const facilityRows: UpgradeRow[] = state.facilities.map((facility) => {
    const cost = getFacilityUpgradeCost(facility);
    const atLeagueCap = isFacilityAtLeagueLevelCap(facility, state.leagueIndex);
    const row: UpgradeRow = {
      kind: 'facility',
      facility,
      sortCost: atLeagueCap ? Number.POSITIVE_INFINITY : cost,
    };
    return row;
  });

  const rosterRow: UpgradeRow = {
    kind: 'roster',
    sortCost: atRosterUpgradeLeagueCap ? Number.POSITIVE_INFINITY : rosterUpgradeCost,
  };
  const ticketRow: UpgradeRow = {
    kind: 'ticket',
    sortCost: atTicketUpgradeLeagueCap ? Number.POSITIVE_INFINITY : ticketUpgradeCost,
  };

  const upgradeRows = [rosterRow, ticketRow, ...facilityRows].sort((a, b) => {
    if (a.sortCost !== b.sortCost) return a.sortCost - b.sortCost;
    const d = rowTier(a.kind) - rowTier(b.kind);
    if (d !== 0) return d;
    if (a.kind === 'facility' && b.kind === 'facility') {
      return a.facility.id.localeCompare(b.facility.id);
    }
    return 0;
  });

  return (
    <div className="p-8 space-y-10">
      <section>
        <h3 className="text-4xl font-display uppercase leading-none">
          HQ <span className="text-accent">Upgrades</span>
        </h3>
        <p className="text-zinc-500 text-xs font-bold uppercase mt-1 tracking-widest">Invest in your promotion</p>
      </section>

      <div className="space-y-0 border-t border-border">
        {upgradeRows.map((row) => {
          if (row.kind === 'roster') {
            return (
              <div key="roster" className="py-6 border-b border-border space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-display text-white uppercase leading-tight">Locker Room Expansion</h4>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-[10px] font-display text-gold uppercase tracking-widest">
                      Max {maxRoster} fighters
                    </span>
                    {atRosterUpgradeLeagueCap && nextLeagueRosterCap != null && nextLeagueRosterCap > rosterUpgradeMax && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                        Upgrade league to level up further
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest">
                      <ArrowUpCircle size={12} className="shrink-0" />
                      <span>
                        {atRosterUpgradeLeagueCap
                          ? `Cap ${maxRoster} until next league`
                          : `+${ROSTER_SLOTS_PER_EXPANSION_PURCHASE} slot · ${maxRoster} → ${
                              maxRoster + ROSTER_SLOTS_PER_EXPANSION_PURCHASE
                            } max roster`}
                      </span>
                    </div>
                    {atRosterUpgradeLeagueCap && nextLeagueRosterCap != null && nextLeagueRosterCap > rosterUpgradeMax && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 pl-[20px]">
                        Promote leagues for cap {rosterUpgradeMax} → {nextLeagueRosterCap} purchases
                      </p>
                    )}
                    {atRosterUpgradeLeagueCap && (nextLeagueRosterCap == null || nextLeagueRosterCap <= rosterUpgradeMax) && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 pl-[20px]">
                        All roster expansions purchased
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpgradeRosterCapacity()}
                    disabled={!canRosterUpgrade}
                    className={cn(
                      'shrink-0 px-6 py-2 font-display uppercase text-[10px] tracking-widest transition-all',
                      canRosterUpgrade
                        ? 'bg-white text-black hover:bg-accent hover:text-white'
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                    )}
                  >
                    {atRosterUpgradeLeagueCap ? 'League cap' : formatCurrency(rosterUpgradeCost)}
                  </button>
                </div>
              </div>
            );
          }

          if (row.kind === 'ticket') {
            return (
              <div key="ticket" className="py-6 border-b border-border space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-display text-white uppercase leading-tight">Ticket Pricing</h4>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-[10px] font-display text-gold uppercase tracking-widest">
                      {`+$${curTicketBonus} / ticket`}
                    </span>
                    {atTicketUpgradeLeagueCap && nextLeagueTicketCap != null && nextLeagueTicketCap > ticketUpgradeMax && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                        Upgrade league to level up further
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest">
                      <ArrowUpCircle size={12} className="shrink-0" />
                      <span>
                        {`Revenue per Ticket ${formatCurrency(HQ_TICKET_PRICE_START + curTicketBonus)} -> ${formatCurrency(HQ_TICKET_PRICE_START + nextTicketBonus)}`}
                      </span>
                    </div>
                    {atTicketUpgradeLeagueCap && nextLeagueTicketCap != null && nextLeagueTicketCap > ticketUpgradeMax && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 pl-[20px]">
                        Promote leagues for cap {ticketUpgradeMax} → {nextLeagueTicketCap} purchases
                      </p>
                    )}
                    {atTicketUpgradeLeagueCap && (nextLeagueTicketCap == null || nextLeagueTicketCap <= ticketUpgradeMax) && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 pl-[20px]">
                        All ticket pricing upgrades purchased
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpgradeTicketPrice()}
                    disabled={!canTicketUpgrade}
                    className={cn(
                      'shrink-0 px-6 py-2 font-display uppercase text-[10px] tracking-widest transition-all',
                      canTicketUpgrade
                        ? 'bg-white text-black hover:bg-accent hover:text-white'
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                    )}
                  >
                    {atTicketUpgradeLeagueCap ? 'League cap' : formatCurrency(ticketUpgradeCost)}
                  </button>
                </div>
              </div>
            );
          }

          const { facility } = row;
          const cost = getFacilityUpgradeCost(facility);
          const canAfford = state.money >= cost;
          const leagueCap = facilityMaxLevel(facility, state.leagueIndex);
          const atLeagueCap = isFacilityAtLeagueLevelCap(facility, state.leagueIndex);
          const nextLeagueCap =
            state.leagueIndex < maxLeagueIndex() ? facilityMaxLevel(facility, state.leagueIndex + 1) : null;
          const canUpgrade = canAfford && !atLeagueCap;

          return (
            <div key={facility.id} className="py-6 border-b border-border space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-display text-white uppercase leading-tight">{facility.name}</h4>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="text-[10px] font-display text-gold uppercase tracking-widest">Level {facility.level}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest">
                    <ArrowUpCircle size={12} className="shrink-0" />
                    <span>{facilityUpgradeValueLine(facility, state.facilities)}</span>
                  </div>
                  {atLeagueCap && nextLeagueCap != null && nextLeagueCap > leagueCap && (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 pl-[20px]">
                      Promote leagues for cap {leagueCap} → {nextLeagueCap}
                    </p>
                  )}
                  {atLeagueCap && (nextLeagueCap == null || nextLeagueCap <= leagueCap) && (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 pl-[20px]">
                      Maximum upgrade level
                    </p>
                  )}
                </div>

                <button
                  onClick={() => onUpgrade(facility.id)}
                  disabled={!canUpgrade}
                  className={cn(
                    'shrink-0 px-6 py-2 font-display uppercase text-[10px] tracking-widest transition-all',
                    canUpgrade
                      ? 'bg-white text-black hover:bg-accent hover:text-white'
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                  )}
                >
                  {atLeagueCap ? 'League cap' : formatCurrency(cost)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[10px] font-bold uppercase leading-relaxed tracking-wide text-zinc-600">
        More HQ rows unlock when you promote in the Leagues tab. Upgrade level caps rise with each league.
      </p>
    </div>
  );
}
