import { motion } from 'motion/react';
import { Calendar } from 'lucide-react';
import { GameState } from '../types';
import { VENUES } from '../constants';
import { cn, formatCurrency, formatNumber } from '../lib/utils';
import { averageCardExcitement, effectiveTicketUnitPrice } from '../lib/showEconomy';

interface DashboardProps {
  state: GameState;
  onPlanShow: () => void;
  onRunPlannedShow: () => void;
  plannedShowRunBlockedReason: string | null;
}

export default function Dashboard({
  state,
  onPlanShow,
  onRunPlannedShow,
  plannedShowRunBlockedReason,
}: DashboardProps) {
  const plan = state.upcomingShow;
  const venue = plan ? VENUES.find((v) => v.id === plan.venueId) ?? VENUES[0] : null;
  const daysUntilShow = plan ? Math.max(0, plan.showDay - state.currentDay) : null;
  const showIsDue = Boolean(plan && state.currentDay >= plan.showDay);

  const excitement = plan ? averageCardExcitement(plan.matches, state.roster, state.history) : 0;
  const unitTicketPrice =
    plan && venue ? effectiveTicketUnitPrice(venue, excitement) : 0;
  const ticketIncomeSoFar = plan ? (plan.advanceTicketRevenueTotal ?? 0) : 0;
  const ticketsSoFar = plan ? (plan.ticketsSoldTotal ?? 0) : 0;
  const audienceCap = venue?.maxAudience ?? 0;
  const audienceCount = ticketsSoFar;
  const audienceFillPct = audienceCap > 0 ? Math.min(100, (audienceCount / audienceCap) * 100) : 0;
  const fullyBooked = audienceCap > 0 && audienceCount >= audienceCap;

  return (
    <div className="p-8 space-y-10">
      {/* Upcoming show */}
      <section className="space-y-4">
        <h2 className="text-14 font-display uppercase tracking-[2px] text-zinc-500 flex items-center gap-3 after:h-px after:bg-border after:flex-1">
          Upcoming Show
        </h2>
        {!plan ? (
          <div className="border border-dashed border-border bg-card/40 p-8 flex flex-col items-center justify-center gap-4 text-center">
            <Calendar className="text-zinc-600" size={28} strokeWidth={1.25} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 max-w-[14rem] leading-relaxed">
              No card on the books. Book a venue and card; bigger shows need more lead time.
            </p>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onPlanShow}
              className="w-full max-w-xs bg-white px-6 py-4 font-display text-sm uppercase tracking-tighter text-black transition-all hover:bg-accent hover:text-white"
            >
              PLAN SHOW
            </motion.button>
          </div>
        ) : (
          <div className="border border-border bg-card p-6 space-y-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-gold">Booked</p>
                <p className="mt-1 font-display text-xl uppercase text-white leading-tight">{venue?.name}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">
                  {plan.matches.length} match{plan.matches.length === 1 ? '' : 'es'} · {plan.prepDays} prep day
                  {plan.prepDays === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right shrink-0">
                {showIsDue ? (
                  <span className="text-[10px] font-display uppercase tracking-widest text-accent">Show night</span>
                ) : (
                  <span className="text-[10px] font-display uppercase tracking-widest text-zinc-400">
                    In {daysUntilShow} day{daysUntilShow === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-[10px] font-display uppercase tracking-widest text-zinc-500">
                Total buzz {Math.round(excitement)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg/80 border border-border p-4 space-y-3">
                  <p className="text-[10px] font-display uppercase tracking-widest text-zinc-500">Ticket sales</p>
                  <p className="text-3xl font-display text-white tabular-nums leading-none tracking-tight">
                    {formatCurrency(ticketIncomeSoFar)}
                  </p>
                  <p className="text-[10px] font-medium tracking-wide text-zinc-600 normal-case">
                    Price per ticket{' '}
                    <span className="tabular-nums text-zinc-500">{formatCurrency(unitTicketPrice)}</span>
                  </p>
                </div>
                <div className="bg-bg/80 border border-border p-4 space-y-3">
                  <p className="text-[10px] font-display tracking-widest text-zinc-500">Audience</p>
                  <p className="text-xl font-display text-white tabular-nums leading-none">
                    {formatNumber(audienceCount)} / {formatNumber(audienceCap)}
                  </p>
                  <div className="h-2 w-full bg-zinc-800 border border-border overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-[width] duration-300',
                        fullyBooked ? 'bg-gold' : 'bg-accent',
                      )}
                      style={{ width: `${audienceFillPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {showIsDue && (
              <div className="space-y-2 pt-2 border-t border-border">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={plannedShowRunBlockedReason !== null}
                  onClick={onRunPlannedShow}
                  className="w-full bg-white py-4 font-display text-lg uppercase tracking-tighter text-black transition-all hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  RUN SHOW
                </motion.button>
                {plannedShowRunBlockedReason && (
                  <p className="text-center text-[10px] font-bold uppercase tracking-wide text-accent leading-snug">
                    {plannedShowRunBlockedReason}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
