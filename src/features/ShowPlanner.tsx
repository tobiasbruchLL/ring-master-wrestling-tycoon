import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, AlertCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { GameState, Match, Fighter, Show } from '../types';
import { cn, formatCurrency, formatNumber, fighterOverallRating } from '../lib/utils';
import {
  averageCardExcitement,
  computeExpectedTicketSalesTotal,
  effectiveTicketUnitPrice,
  expectedTicketDemandFromHype,
  matchSetupCostAtIndex,
  maxMatchesForVenue,
} from '../lib/showEconomy';
import { VENUES } from '../constants';
import { promotionTier } from '../lib/promotionPopularity';
import {
  computeTicketSalesMatchupBreakdown,
  type MatchScoreBreakdown,
} from '../lib/matchScoring';

interface ShowPlannerProps {
  state: GameState;
  onScheduleShow: (matches: Match[], venueId: string) => void;
  onCancel: () => void;
  onToast: (message: string) => void;
}

function createEmptyMatch(): Match {
  return { id: Math.random().toString(), fighterAId: '', fighterBId: '' };
}

/** Ticket draw line items — keep in the expected-sales details modal, not as picker chips. */
const PAIRING_LIST_HIDDEN_ADDITIVE_LABELS = new Set(['Popularity', 'Combined wrestler popularity']);

/** Short uppercase text for buzz modifier badges (matches `matchScoring` labels). */
function pairingMultiplierBadgeLabel(label: string): string {
  return label
    .replace(/\s+bonus$/i, '')
    .replace(/\s+penalty$/i, '')
    .trim()
    .toUpperCase();
}

/** Full-width pick row; layout mirrors onboarding draft halves (see `OnboardingDraftOverlay`). */
function PlannerMatchFighterRow({
  fighter,
  placement,
  onClick,
  active,
}: {
  fighter?: Fighter;
  placement: 'first' | 'second';
  onClick: () => void;
  active: boolean;
}) {
  const imageOnLeft = placement === 'first';
  const ovr = fighter ? fighterOverallRating(fighter.stats) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex min-h-[8.25rem] w-full overflow-hidden text-left transition-colors',
        active ? 'ring-1 ring-accent ring-inset' : '',
        fighter ? 'border border-border bg-card hover:brightness-[1.02]' : 'border border-dashed border-border bg-card/40 hover:border-accent',
      )}
    >
      {imageOnLeft ? (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[48%] bg-gradient-to-br from-zinc-900 via-zinc-950 to-black/55"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-[48%] right-0 bg-gradient-to-tr from-zinc-950/95 via-zinc-900/40 to-zinc-950/80"
            aria-hidden
          />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-[48%] bg-gradient-to-bl from-zinc-950 via-zinc-900 to-black/55"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 right-[48%] bg-gradient-to-tl from-zinc-900/95 via-zinc-950/50 to-zinc-900/80"
            aria-hidden
          />
        </>
      )}
      <div
        className={cn(
          'relative z-10 flex min-h-[8.25rem] w-full flex-row items-stretch',
          !imageOnLeft && 'flex-row-reverse',
        )}
      >
        <div
          className={cn(
            'relative flex min-h-0 w-[min(48%,12rem)] shrink-0 items-end bg-transparent',
            imageOnLeft ? 'justify-start pl-1 pr-0.5' : 'justify-end pl-0.5 pr-1',
          )}
        >
          {fighter ? (
            <img
              src={fighter.image}
              alt=""
              className={cn(
                'max-h-[9.5rem] min-h-[6rem] w-full max-w-none object-contain',
                imageOnLeft
                  ? 'object-left object-bottom'
                  : 'object-right object-bottom -scale-x-100',
              )}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className={cn(
                'flex min-h-[6.5rem] w-full items-center justify-center pb-2',
                imageOnLeft ? 'pl-1' : 'pr-1',
              )}
            >
              <Plus size={28} className="text-zinc-600" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 bg-transparent px-3 py-3">
          {fighter ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-balance font-display text-base uppercase leading-tight tracking-tight text-white">
                  {fighter.name}
                </h3>
                <span
                  className={cn(
                    'shrink-0 border px-1.5 py-0.5 text-[8px] font-display uppercase tracking-widest',
                    fighter.alignment === 'Face'
                      ? 'border-blue-400/40 text-blue-400'
                      : 'border-accent/40 text-accent',
                  )}
                >
                  {fighter.alignment}
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{fighter.trait}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-bold uppercase tracking-tight text-zinc-400">
                <span>💥 PWR {fighter.stats.power}</span>
                <span>⚡ TEC {fighter.stats.technique}</span>
                <span>🛡️ END {fighter.stats.endurance}</span>
                <span>🎤 MIC {fighter.stats.mic}</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                OVR {ovr} · Pop {fighter.popularity}
              </p>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-14 bg-zinc-800">
                  <div className="h-full bg-accent" style={{ width: `${fighter.energy}%` }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Energy {fighter.energy}%
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col justify-center gap-1">
              <span className="font-display text-xs uppercase tracking-wide text-zinc-500">Open slot</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Tap to select</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

type PlannerStep = 'venue' | 'matches';

function PlannerTicketSalesBreakdownModal({
  breakdown,
  matchNumber,
  onClose,
}: {
  breakdown: MatchScoreBreakdown;
  matchNumber: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-labelledby="planner-ticket-sales-info-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[48] flex flex-col justify-end bg-black/65 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="mx-auto w-full max-w-sm rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <h3
            id="planner-ticket-sales-info-title"
            className="text-left font-display text-sm uppercase leading-tight tracking-wide text-white"
          >
            Hype · Match {matchNumber}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded border border-border p-1.5 text-zinc-400 transition-colors hover:border-accent hover:text-white"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="max-h-[min(52vh,22rem)] space-y-2 overflow-y-auto px-4 py-3 text-left">
          {breakdown.additiveBonuses.length > 0 ? (
            breakdown.additiveBonuses.map((a, aIdx) => (
              <div
                key={`${a.label}-${aIdx}`}
                className="flex justify-between gap-3 text-[10px] font-display uppercase tracking-widest text-emerald-400"
              >
                <span>{a.label}</span>
                <span className="shrink-0 tabular-nums">+{a.amount}</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between gap-3 text-[10px] font-display uppercase tracking-widest text-zinc-500">
              <span>Popularity draw (base)</span>
              <span className="shrink-0 tabular-nums text-white">
                {breakdown.fighterPopularityA + breakdown.fighterPopularityB}
              </span>
            </div>
          )}
          {breakdown.multipliers.map((m, mIdx) => (
            <div
              key={`${m.label}-${mIdx}`}
              className={cn(
                'flex justify-between gap-3 text-[10px] font-display uppercase tracking-widest',
                m.value > 1 && 'text-emerald-400',
                m.value < 1 && 'text-red-400',
                m.value === 1 && 'text-gold',
              )}
            >
              <span>{m.label}</span>
              <span className="shrink-0 tabular-nums">×{m.value}</span>
            </div>
          ))}
          <div className="space-y-2 border-t border-border pt-2">
            <div className="flex justify-between gap-3 text-xs font-display uppercase tracking-[2px] text-accent">
              <span>Hype</span>
              <span className="font-bold tabular-nums">{formatNumber(breakdown.totalScore)}</span>
            </div>
            <div className="flex justify-between gap-3 text-[11px] font-display uppercase tracking-[2px] text-gold">
              <span>Expected ticket sales</span>
              <span className="font-bold tabular-nums">
                {formatNumber(expectedTicketDemandFromHype(breakdown.totalScore))}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ShowPlanner({ state, onScheduleShow, onCancel, onToast }: ShowPlannerProps) {
  const [plannerStep, setPlannerStep] = useState<PlannerStep>('venue');
  const [matches, setMatches] = useState<Match[]>(() => [createEmptyMatch()]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(VENUES[0].id);
  const [selectingFor, setSelectingFor] = useState<{ matchIndex: number, side: 'A' | 'B' } | null>(null);
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false);
  const [ticketSalesInfoIdx, setTicketSalesInfoIdx] = useState<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const prevMatchCount = useRef(matches.length);

  const slideCount = matches.length;

  const scrollToSlide = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const el = carouselRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (!w) return;
    const clamped = Math.max(0, Math.min(index, slideCount - 1));
    el.scrollTo({ left: clamped * w, behavior });
    setActiveSlide(clamped);
  }, [slideCount]);

  const handleCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (!w) return;
    const idx = Math.round(el.scrollLeft / w);
    const clamped = Math.max(0, Math.min(idx, slideCount - 1));
    setActiveSlide((s) => (s === clamped ? s : clamped));
  }, [slideCount]);

  useEffect(() => {
    setActiveSlide((prev) => {
      const maxIdx = Math.max(0, slideCount - 1);
      if (prev > maxIdx) {
        requestAnimationFrame(() => {
          const el = carouselRef.current;
          if (el?.clientWidth) {
            el.scrollTo({ left: maxIdx * el.clientWidth, behavior: 'auto' });
          }
        });
        return maxIdx;
      }
      return prev;
    });
  }, [slideCount]);

  useLayoutEffect(() => {
    if (matches.length > prevMatchCount.current) {
      const newIdx = matches.length - 1;
      scrollToSlide(newIdx, 'smooth');
    }
    prevMatchCount.current = matches.length;
  }, [matches.length, scrollToSlide]);

  const matchCap = maxMatchesForVenue(selectedVenueId);

  useEffect(() => {
    setMatches((m) => (m.length > matchCap ? m.slice(0, matchCap) : m));
  }, [matchCap]);

  useEffect(() => {
    if (plannerStep === 'venue' || selectingFor) setTicketSalesInfoIdx(null);
  }, [plannerStep, selectingFor]);

  useEffect(() => {
    if (ticketSalesInfoIdx !== null && ticketSalesInfoIdx >= matches.length) {
      setTicketSalesInfoIdx(null);
    }
  }, [matches.length, ticketSalesInfoIdx]);

  const addMatch = () => {
    if (matches.length >= matchCap) return;
    const bookableCount = state.roster.filter((f) => !f.recoveringFromInjury).length;
    const neededForCard = 2 * (matches.length + 1);
    if (bookableCount < neededForCard) {
      onToast('Not enough fighters.');
      return;
    }
    setMatches([...matches, createEmptyMatch()]);
  };

  const removeMatch = (index: number) => {
    if (index === 0) return;
    setMatches(matches.filter((_, i) => i !== index));
  };

  const setFighter = (matchIndex: number, side: 'A' | 'B', fighterId: string) => {
    setMatches(matches.map((m, i) => {
      if (i === matchIndex) {
        return side === 'A' ? { ...m, fighterAId: fighterId } : { ...m, fighterBId: fighterId };
      }
      return m;
    }));
    setSelectingFor(null);
  };

  const isFighterSelected = (fighterId: string) => {
    return matches.some(m => m.fighterAId === fighterId || m.fighterBId === fighterId);
  };

  const selectedVenue = VENUES.find(v => v.id === selectedVenueId) || VENUES[0];
  const selectedVenueLocked = promotionTier(state.popularity) < selectedVenue.minPopularity;
  const totalSetupCost = matches.reduce(
    (acc, _, idx) => acc + matchSetupCostAtIndex(selectedVenueId, idx),
    0,
  );
  const totalCost = selectedVenue.cost + totalSetupCost;
  const canAfford = state.money >= totalCost;
  const hasRecoveringOnCard = matches.some((m) => {
    const a = state.roster.find((f) => f.id === m.fighterAId);
    const b = state.roster.find((f) => f.id === m.fighterBId);
    return a?.recoveringFromInjury || b?.recoveringFromInjury;
  });
  const isValid =
    matches.length > 0 &&
    matches.every((m) => m.fighterAId && m.fighterBId) &&
    canAfford &&
    !hasRecoveringOnCard;
  const totalExpectedTicketSalesPreview = computeExpectedTicketSalesTotal(
    matches,
    state.roster,
    state.history,
    state.popularity,
  );
  const expectedTicketUnitPrice = effectiveTicketUnitPrice(
    selectedVenue,
    averageCardExcitement(matches, state.roster, state.history, state.popularity),
    state.ticketPriceUpgrades,
  );
  const totalExpectedTicketRevenue = Math.min(totalExpectedTicketSalesPreview, selectedVenue.maxAudience) * expectedTicketUnitPrice;
  const expectedProfit = totalExpectedTicketRevenue - totalCost;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bg">
      {plannerStep === 'venue' ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-8 pb-4">
            <div className="mb-6 shrink-0">
              <h3 className="text-2xl font-display uppercase text-white">
                Select <span className="text-accent">Venue</span>
              </h3>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Tap a venue, then continue to the card
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pb-4">
              {VENUES.map((venue) => {
                const locked = promotionTier(state.popularity) < venue.minPopularity;
                return (
                  <button
                    key={venue.id}
                    type="button"
                    disabled={locked}
                    onClick={() => setSelectedVenueId(venue.id)}
                    className={cn(
                      'relative overflow-hidden border p-4 text-left transition-all',
                      selectedVenueId === venue.id
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-card hover:border-accent',
                      locked && 'cursor-not-allowed opacity-50 grayscale',
                    )}
                  >
                    <p className="text-xs font-display uppercase text-white">{venue.name}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase text-zinc-500">
                      Cost: {formatCurrency(venue.cost)}
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase text-zinc-500">
                      Cap {formatNumber(venue.maxAudience)} · from{' '}
                      {formatCurrency(effectiveTicketUnitPrice(venue, 0, state.ticketPriceUpgrades))}
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase text-accent">{venue.multiplier}x demand</p>
                    {locked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <span className="text-[8px] font-display uppercase tracking-widest text-white">
                          Pop {venue.minPopularity} Required
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative z-30 flex h-16 shrink-0 border-t border-border bg-card">
            <button
              type="button"
              onClick={onCancel}
              className="flex h-full w-[6.75rem] shrink-0 items-center justify-center border-r border-border px-2 text-center font-display text-[8px] font-bold uppercase leading-snug tracking-wide text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white sm:w-[7.75rem] sm:text-[9px] sm:tracking-widest"
            >
              BACK
            </button>
            <button
              type="button"
              disabled={selectedVenueLocked}
              onClick={() => setPlannerStep('matches')}
              className={cn(
                'flex min-h-0 min-w-0 flex-1 items-center justify-center px-2 text-center font-display text-[10px] font-bold uppercase leading-snug tracking-wide transition-all sm:text-xs sm:tracking-widest',
                selectedVenueLocked
                  ? 'cursor-not-allowed bg-zinc-800 text-zinc-600'
                  : 'bg-white text-black hover:bg-accent hover:text-white',
              )}
            >
              SETUP MATCHES
            </button>
          </div>
        </>
      ) : (
        <>
      <div className="min-h-0 flex-1 overflow-y-auto p-8 pb-4">
        <div className="space-y-12">
        <div className="space-y-4">
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className={cn(
              'flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none]',
              '[&::-webkit-scrollbar]:hidden'
            )}
          >
            {matches.map((match, idx) => (
              <div
                key={match.id}
                className="w-full min-w-full shrink-0 snap-start space-y-3"
              >
                <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                  <h2 className="font-display text-lg uppercase tracking-[0.08em] text-white">
                    Match{' '}
                    <span className="text-accent">{idx + 1}</span>
                    <span className="text-zinc-500">/</span>
                    {slideCount}
                  </h2>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => removeMatch(idx)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-card text-zinc-400 transition-colors hover:border-accent hover:text-white"
                      aria-label={`Remove match ${idx + 1}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <PlannerMatchFighterRow
                  fighter={state.roster.find((f) => f.id === match.fighterAId)}
                  placement="first"
                  onClick={() => setSelectingFor({ matchIndex: idx, side: 'A' })}
                  active={selectingFor?.matchIndex === idx && selectingFor?.side === 'A'}
                />
                <PlannerMatchFighterRow
                  fighter={state.roster.find((f) => f.id === match.fighterBId)}
                  placement="second"
                  onClick={() => setSelectingFor({ matchIndex: idx, side: 'B' })}
                  active={selectingFor?.matchIndex === idx && selectingFor?.side === 'B'}
                />

                {match.fighterAId && match.fighterBId && (() => {
                  const breakdown = computeTicketSalesMatchupBreakdown(
                    match,
                    state.roster,
                    state.history,
                    state.popularity,
                  );
                  if (!breakdown) return null;
                  return (
                    <div className="space-y-2 border border-border/50 bg-card/50 p-4">
                      <div className="flex items-center justify-between gap-2 text-xs font-display uppercase tracking-[2px] text-accent">
                        <span>Expected ticket sales</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="font-bold tabular-nums">
                            {formatNumber(expectedTicketDemandFromHype(breakdown.totalScore))}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTicketSalesInfoIdx(idx)}
                            aria-haspopup="dialog"
                            aria-expanded={ticketSalesInfoIdx === idx}
                            aria-label="How hype and expected ticket sales are calculated"
                            className="inline-flex size-8 items-center justify-center rounded-full border border-border text-zinc-400 transition-colors hover:border-accent hover:text-accent"
                          >
                            <Info className="size-[1.05rem]" strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-border/50 pt-2 text-xs font-display uppercase tracking-[2px] text-zinc-500">
                        <span>Match cost</span>
                        <span className="font-bold text-white">
                          {formatCurrency(matchSetupCostAtIndex(selectedVenueId, idx))}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-bg px-5 py-3 sm:px-8">
        <button
          type="button"
          aria-label="Previous match"
          onClick={() => scrollToSlide(activeSlide - 1)}
          disabled={activeSlide <= 0}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center border border-border bg-card text-zinc-400 transition-colors',
            activeSlide <= 0
              ? 'pointer-events-none opacity-30'
              : 'hover:border-accent hover:text-white',
          )}
        >
          <ChevronLeft size={22} />
        </button>
        {matches.length < matchCap && (
          <button
            type="button"
            onClick={addMatch}
            className="flex h-11 min-w-0 max-w-[11rem] flex-1 items-center justify-center gap-1.5 border border-dashed border-border bg-card/40 px-2 text-zinc-500 transition-all hover:border-accent hover:text-accent sm:max-w-[13rem] sm:px-3"
          >
            <Plus size={18} className="shrink-0" />
            <span className="truncate text-[10px] font-display uppercase tracking-widest">Add Match</span>
          </button>
        )}
        <button
          type="button"
          aria-label="Next match"
          onClick={() => scrollToSlide(activeSlide + 1)}
          disabled={activeSlide >= slideCount - 1}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center border border-border bg-card text-zinc-400 transition-colors',
            activeSlide >= slideCount - 1
              ? 'pointer-events-none opacity-30'
              : 'hover:border-accent hover:text-white',
          )}
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="relative z-30 flex h-16 shrink-0 border-t border-border bg-card">
        <button
          type="button"
          onClick={() => setPlannerStep('venue')}
          className="flex h-full w-[6.75rem] shrink-0 items-center justify-center border-r border-border px-2 text-center font-display text-[8px] font-bold uppercase leading-snug tracking-wide text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white sm:w-[7.75rem] sm:text-[9px] sm:tracking-widest"
        >
          BACK
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={() => setShowScheduleConfirm(true)}
          className={cn(
            'flex min-h-0 min-w-0 flex-1 items-center justify-center px-2 font-display text-base uppercase tracking-tighter transition-all sm:text-lg',
            isValid
              ? 'bg-white text-black hover:bg-accent hover:text-white'
              : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
          )}
        >
          Schedule Show
        </button>
      </div>
      {!canAfford && matches.length > 0 && (
        <p className="shrink-0 border-t border-border bg-bg px-5 py-2 text-center text-[10px] font-bold uppercase text-accent animate-pulse sm:px-8">
          Insufficient Funds for Show
        </p>
      )}
        </>
      )}

      {/* Fighter selection covers planner including action bar */}
      <AnimatePresence>
        {selectingFor && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-50 flex flex-col bg-bg p-8"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-display uppercase text-white">Select <span className="text-accent">Talent</span></h3>
              <button onClick={() => setSelectingFor(null)} className="text-zinc-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {[...state.roster]
                .sort((a, b) => {
                  const aUn = isFighterSelected(a.id) || a.recoveringFromInjury;
                  const bUn = isFighterSelected(b.id) || b.recoveringFromInjury;
                  return Number(aUn) - Number(bUn);
                })
                .map((fighter) => {
                const selected = isFighterSelected(fighter.id);
                const recovering = fighter.recoveringFromInjury;
                const lowEnergy = fighter.energy < 20;
                const activeMatch = matches[selectingFor.matchIndex];
                const otherFighterId =
                  selectingFor.side === 'A' ? activeMatch.fighterBId : activeMatch.fighterAId;
                const pairingPreview =
                  !selected && otherFighterId
                    ? computeTicketSalesMatchupBreakdown(
                        {
                          id: '__pairing_preview__',
                          fighterAId:
                            selectingFor.side === 'A' ? fighter.id : otherFighterId,
                          fighterBId:
                            selectingFor.side === 'B' ? fighter.id : otherFighterId,
                        },
                        state.roster,
                        state.history,
                        state.popularity,
                      )
                    : null;
                const pairingMultBadges = pairingPreview?.multipliers ?? [];
                const pairingAddBadges = pairingPreview?.additiveBonuses ?? [];
                const pairingAddBadgesForList = pairingAddBadges.filter(
                  (a) => !PAIRING_LIST_HIDDEN_ADDITIVE_LABELS.has(a.label),
                );

                return (
                  <button
                    key={fighter.id}
                    disabled={selected || recovering}
                    onClick={() => setFighter(selectingFor.matchIndex, selectingFor.side, fighter.id)}
                    className={cn(
                      'flex w-full flex-col gap-0 bg-card border border-border p-4 text-left transition-all',
                      selected || recovering
                        ? 'cursor-not-allowed border-zinc-700/70 bg-zinc-950/60 opacity-[0.82] saturate-[0.85]'
                        : 'hover:border-accent'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <img src={fighter.image} className="h-24 w-24 shrink-0 rounded-none object-contain" referrerPolicy="no-referrer" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display text-sm uppercase leading-tight text-white">{fighter.name}</p>
                          <span className={cn(
                            "shrink-0 text-[8px] font-display uppercase tracking-widest px-1.5 py-0.5 border",
                            fighter.alignment === 'Face' ? "text-blue-400 border-blue-400/30" : "text-accent border-accent/30"
                          )}>
                            {fighter.alignment}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{fighter.trait}</p>
                        <div className="mt-1 flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[10px] font-bold uppercase text-zinc-500">
                          <span>OVR {fighterOverallRating(fighter.stats)}</span>
                          <span>POPULARITY {fighter.popularity}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-0.5 w-12 bg-zinc-800">
                            <div className="h-full bg-accent" style={{ width: `${fighter.energy}%` }} />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Energy: {fighter.energy}%</span>
                        </div>
                        {recovering && (
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-accent">
                            Recovering — cannot compete until 100% energy
                          </p>
                        )}
                      </div>
                      {(lowEnergy || recovering) && <AlertCircle size={16} className="shrink-0 text-accent" />}
                    </div>
                    {(pairingMultBadges.length > 0 || pairingAddBadgesForList.length > 0) && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                        {pairingAddBadgesForList.map((a, i) => (
                          <span
                            key={`add-${a.label}-${i}`}
                            className="border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[8px] font-display uppercase tracking-widest text-emerald-400"
                          >
                            {pairingMultiplierBadgeLabel(a.label)}
                          </span>
                        ))}
                        {pairingMultBadges.map((m, i) => (
                          <span
                            key={`${m.label}-${i}`}
                            className={cn(
                              'border px-2 py-1 text-[8px] font-display uppercase tracking-widest',
                              m.value > 1 &&
                                'border-emerald-400/40 bg-emerald-400/10 text-emerald-400',
                              m.value < 1 && 'border-red-400/40 bg-red-400/10 text-red-400',
                            )}
                          >
                            {pairingMultiplierBadgeLabel(m.label)}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ticketSalesInfoIdx !== null &&
          (() => {
            const m = matches[ticketSalesInfoIdx];
            const bd =
              m?.fighterAId && m?.fighterBId
                ? computeTicketSalesMatchupBreakdown(m, state.roster, state.history, state.popularity)
                : null;
            if (!bd) return null;
            return (
              <PlannerTicketSalesBreakdownModal
                breakdown={bd}
                matchNumber={ticketSalesInfoIdx + 1}
                onClose={() => setTicketSalesInfoIdx(null)}
              />
            );
          })()}
      </AnimatePresence>

      <AnimatePresence>
        {showScheduleConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] flex items-end bg-black/65 p-4 sm:items-center sm:justify-center"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full border border-border bg-card p-5 sm:max-w-md sm:p-6"
            >
              <p className="text-xs font-display uppercase tracking-[0.18em] text-accent">Schedule Show</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Confirm this booking before locking in the card.
              </p>

              <div className="mt-4 space-y-2 border-t border-border pt-4 text-[11px] font-display uppercase tracking-widest">
                <div className="flex items-center justify-between text-zinc-300">
                  <span>Total Expected Ticket Sales</span>
                  <span className="font-bold text-white">{formatNumber(totalExpectedTicketSalesPreview)}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-300">
                  <span>Total Expected Ticket Revenue</span>
                  <span className="font-bold text-white">{formatCurrency(totalExpectedTicketRevenue)}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-300">
                  <span>Total Cost</span>
                  <span className="font-bold text-white">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 text-zinc-200">
                  <span>Expected Profit</span>
                  <span
                    className={cn(
                      'font-bold',
                      expectedProfit >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {formatCurrency(expectedProfit)}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleConfirm(false)}
                  className="border border-border bg-bg px-3 py-3 text-[10px] font-display uppercase tracking-widest text-zinc-400 transition-colors hover:border-accent hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onScheduleShow(matches, selectedVenueId);
                    setShowScheduleConfirm(false);
                  }}
                  className="bg-white px-3 py-3 text-[10px] font-display uppercase tracking-widest text-black transition-colors hover:bg-accent hover:text-white"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
