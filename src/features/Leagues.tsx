import { Check, Lock } from 'lucide-react';
import { GameState } from '../types';
import { AVAILABLE_FACILITIES } from '../constants';
import { LEAGUE_TIERS, getLeagueTier, getNextLeagueTier, getPromoteLeagueBlockReason } from '../lib/leagues';
import { promotionTier } from '../lib/promotionPopularity';
import { cn, formatCurrency } from '../lib/utils';

type LeaguesProps = {
  state: GameState;
  onPromote: () => void;
};

export default function Leagues({ state, onPromote }: LeaguesProps) {
  const current = getLeagueTier(state.leagueIndex);
  const next = getNextLeagueTier(state.leagueIndex);
  const blockReason = getPromoteLeagueBlockReason(state);
  const popTier = promotionTier(state.popularity);

  const unlocksOnNextPromote = next
    ? AVAILABLE_FACILITIES.filter((f) => f.requiredLeagueIndex === state.leagueIndex + 1)
    : [];

  return (
    <div className="space-y-8 p-8 pb-24">
      <section>
        <h3 className="font-display text-4xl uppercase leading-none text-white">
          <span className="text-accent">Leagues</span>
        </h3>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-500">
          Buy in, grow the brand, unlock HQ upgrades
        </p>
      </section>

      <div className="border border-border bg-card/40 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Current circuit</p>
        <h4 className="mt-1 font-display text-2xl uppercase text-white">{current.name}</h4>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{current.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <span>
            Popularity: <span className="text-gold tabular-nums">{popTier}</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span>
            Bankroll: <span className="text-white tabular-nums">{formatCurrency(state.money)}</span>
          </span>
        </div>
      </div>

      {next && (
        <div className="space-y-3 border border-border bg-zinc-950/80 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Next promotion</p>
          <div className="flex flex-col gap-2">
            <h4 className="font-display text-xl uppercase text-white">{next.name}</h4>
            <p className="text-xs text-zinc-400">{next.tagline}</p>
          </div>
          <ul className="space-y-2 border-t border-border pt-3 text-xs text-zinc-400">
            <li className="flex justify-between gap-2">
              <span>Minimum popularity</span>
              <span className={cn('shrink-0 font-bold tabular-nums', popTier >= next.minPopularityToEnter ? 'text-gold' : 'text-accent')}>
                {next.minPopularityToEnter}
                {popTier >= next.minPopularityToEnter ? ' ✓' : ''}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Promotion fee</span>
              <span className={cn('shrink-0 font-bold tabular-nums', state.money >= next.promotionFee ? 'text-gold' : 'text-accent')}>
                {formatCurrency(next.promotionFee)}
                {state.money >= next.promotionFee ? ' ✓' : ''}
              </span>
            </li>
          </ul>
          {unlocksOnNextPromote.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Unlocks in Upgrades</p>
              <ul className="mt-2 space-y-1.5 text-xs text-zinc-300">
                {unlocksOnNextPromote.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <Lock size={12} className="shrink-0 text-zinc-600" aria-hidden />
                    <span>{f.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            disabled={blockReason !== null}
            title={blockReason ?? 'Promote to the next league'}
            onClick={onPromote}
            className={cn(
              'mt-2 w-full border py-3 font-display text-sm uppercase tracking-tighter transition-colors',
              blockReason
                ? 'cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-600'
                : 'border-border bg-white text-black hover:border-accent hover:bg-accent hover:text-white',
            )}
          >
            Promote — {formatCurrency(next.promotionFee)}
          </button>
          {blockReason && (
            <p className="text-center text-[10px] font-bold uppercase leading-snug tracking-wide text-accent">{blockReason}</p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Circuit ladder</p>
        <ol className="space-y-0 border-t border-border">
          {LEAGUE_TIERS.map((tier, idx) => {
            const reached = state.leagueIndex >= idx;
            const isCurrent = state.leagueIndex === idx;
            return (
              <li
                key={tier.id}
                className={cn(
                  'flex items-start gap-3 border-b border-border py-3',
                  isCurrent && 'bg-yellow-500/5',
                )}
              >
                <span className="mt-0.5 text-gold" aria-hidden>
                  {reached ? <Check size={16} strokeWidth={2.5} /> : <span className="inline-block size-4 rounded-full border border-zinc-700" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-sm uppercase text-white">{tier.name}</span>
                    {idx > 0 && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                        In: {tier.minPopularityToEnter} pop · {formatCurrency(tier.promotionFee)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{tier.tagline}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
