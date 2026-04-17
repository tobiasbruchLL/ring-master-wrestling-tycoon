import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { GameState, Match, Fighter, Show } from '../types';
import { cn, formatCurrency, formatNumber, fighterPower } from '../lib/utils';
import { computeShowPrepDays } from '../lib/showScheduling';
import { matchSetupCostAtIndex, maxMatchesForVenue } from '../lib/showEconomy';
import { VENUES } from '../constants';
import { promotionTier } from '../lib/promotionPopularity';

interface ShowPlannerProps {
  state: GameState;
  onScheduleShow: (matches: Match[], venueId: string) => void;
  onCancel: () => void;
  calculateMatchScore: (match: Match, roster: Fighter[], history: Show[]) => { 
    popularityA: number, 
    popularityB: number, 
    multipliers: { label: string, value: number }[], 
    totalScore: number,
    projectedStars: number 
  } | null;
}

function createEmptyMatch(): Match {
  return { id: Math.random().toString(), fighterAId: '', fighterBId: '' };
}

/** Short uppercase text for buzz modifier badges (matches `matchScoring` labels). */
function pairingMultiplierBadgeLabel(label: string): string {
  return label
    .replace(/\s+bonus$/i, '')
    .replace(/\s+penalty$/i, '')
    .trim()
    .toUpperCase();
}

type PlannerStep = 'venue' | 'matches';

export default function ShowPlanner({ state, onScheduleShow, onCancel, calculateMatchScore }: ShowPlannerProps) {
  const [plannerStep, setPlannerStep] = useState<PlannerStep>('venue');
  const [matches, setMatches] = useState<Match[]>(() => [createEmptyMatch()]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(VENUES[0].id);
  const [selectingFor, setSelectingFor] = useState<{ matchIndex: number, side: 'A' | 'B' } | null>(null);
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

  const addMatch = () => {
    if (matches.length < matchCap) {
      setMatches([...matches, createEmptyMatch()]);
    }
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
  const totalBuzzPreview = matches.reduce((sum, m) => {
    if (!m.fighterAId || !m.fighterBId) return sum;
    const breakdown = calculateMatchScore(m, state.roster, state.history);
    return breakdown ? sum + breakdown.totalScore : sum;
  }, 0);
  const prepDaysPreview = computeShowPrepDays(matches.length, selectedVenueId);

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
                      Cap {formatNumber(venue.maxAudience)} · from {formatCurrency(venue.baseTicketPrice)}
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
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-display text-gold uppercase tracking-widest">
              Matches: {matches.length}/{matchCap}
            </span>
            <div className="h-px bg-border flex-1" />
          </div>

          <div className="relative">
            <button
              type="button"
              aria-label="Previous match"
              onClick={() => scrollToSlide(activeSlide - 1)}
              disabled={activeSlide <= 0}
              className={cn(
                'absolute -left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center border border-border bg-bg/90 text-zinc-400 transition-colors',
                activeSlide <= 0 ? 'pointer-events-none opacity-30' : 'hover:border-accent hover:text-white'
              )}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next match"
              onClick={() => scrollToSlide(activeSlide + 1)}
              disabled={activeSlide >= slideCount - 1}
              className={cn(
                'absolute -right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center border border-border bg-bg/90 text-zinc-400 transition-colors',
                activeSlide >= slideCount - 1 ? 'pointer-events-none opacity-30' : 'hover:border-accent hover:text-white'
              )}
            >
              <ChevronRight size={18} />
            </button>

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
                  className="w-full min-w-full shrink-0 snap-start space-y-6 px-5"
                >
                  <div className="relative">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => removeMatch(idx)}
                        className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center bg-accent text-white"
                        aria-label={`Remove match ${idx + 1}`}
                      >
                        <X size={12} />
                      </button>
                    )}

                    <div className="flex items-center justify-between gap-4">
                      <FighterSlot
                        fighter={state.roster.find((f) => f.id === match.fighterAId)}
                        onClick={() => setSelectingFor({ matchIndex: idx, side: 'A' })}
                        active={selectingFor?.matchIndex === idx && selectingFor?.side === 'A'}
                        align="right"
                      />

                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <div className="font-display text-2xl text-accent italic -rotate-12">VS</div>
                      </div>

                      <FighterSlot
                        fighter={state.roster.find((f) => f.id === match.fighterBId)}
                        onClick={() => setSelectingFor({ matchIndex: idx, side: 'B' })}
                        active={selectingFor?.matchIndex === idx && selectingFor?.side === 'B'}
                        align="left"
                      />
                    </div>

                    {match.fighterAId && match.fighterBId && (() => {
                      const breakdown = calculateMatchScore(match, state.roster, state.history);
                      if (!breakdown) return null;
                      return (
                        <div className="mt-6 space-y-2 border border-border/50 bg-card/50 p-4">
                          <div className="flex justify-between text-[10px] font-display uppercase tracking-widest text-zinc-500">
                            <span>Fighter Popularity</span>
                            <span className="text-white">
                              +{breakdown.popularityA + breakdown.popularityB}
                            </span>
                          </div>
                          {breakdown.multipliers.map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className={cn(
                                'flex justify-between text-[10px] font-display uppercase tracking-widest',
                                m.value > 1 && 'text-emerald-400',
                                m.value < 1 && 'text-red-400',
                                m.value === 1 && 'text-gold',
                              )}
                            >
                              <span>{m.label}</span>
                              <span>*{m.value}</span>
                            </div>
                          ))}
                          <div className="flex justify-between border-t border-border/50 pt-2 text-xs font-display uppercase tracking-[2px] text-accent">
                            <span>Generated Buzz</span>
                            <span className="font-bold">{breakdown.totalScore}</span>
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
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-2 pt-1" role="tablist" aria-label="Match slides">
            {Array.from({ length: slideCount }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === activeSlide}
                aria-label={`Match ${i + 1}`}
                onClick={() => scrollToSlide(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === activeSlide ? 'w-6 bg-accent' : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
                )}
              />
            ))}
          </div>

          {matches.length < matchCap && (
            <button
              type="button"
              onClick={addMatch}
              className="flex w-full items-center justify-center gap-2 border border-dashed border-border py-4 text-zinc-600 transition-all hover:border-accent hover:text-accent"
            >
              <Plus size={20} />
              <span className="text-[10px] font-display uppercase tracking-widest">Add Match</span>
            </button>
          )}
        </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-bg px-5 py-2 sm:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-x-2 text-[10px] font-display uppercase leading-none tracking-wide sm:text-xs sm:tracking-[2px]">
          <div className="flex min-w-0 items-baseline justify-start gap-1.5 text-accent">
            <span className="shrink-0">Total Buzz</span>
            <span className="min-w-0 truncate font-bold tabular-nums">{totalBuzzPreview}</span>
          </div>
          <div className="flex shrink-0 items-baseline justify-center gap-1.5 text-gold">
            <span>Prep Days</span>
            <span className="font-bold tabular-nums text-white">{prepDaysPreview}</span>
          </div>
          <div className="flex min-w-0 items-baseline justify-end gap-1.5 text-zinc-500">
            <span className="shrink-0">Total Cost</span>
            <span className="min-w-0 truncate font-bold tabular-nums text-white">{formatCurrency(totalCost)}</span>
          </div>
        </div>
        {!canAfford && matches.length > 0 && (
          <p className="mt-1 text-center text-[10px] font-bold uppercase text-accent animate-pulse">
            Insufficient Funds for Show
          </p>
        )}
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
          onClick={() => onScheduleShow(matches, selectedVenueId)}
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
                    ? calculateMatchScore(
                        {
                          id: '__pairing_preview__',
                          fighterAId:
                            selectingFor.side === 'A' ? fighter.id : otherFighterId,
                          fighterBId:
                            selectingFor.side === 'B' ? fighter.id : otherFighterId,
                        },
                        state.roster,
                        state.history,
                      )
                    : null;
                const pairingBadges = pairingPreview?.multipliers ?? [];

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
                          <span>POWER {fighterPower(fighter.stats)}</span>
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
                    {pairingBadges.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                        {pairingBadges.map((m, i) => (
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
    </div>
  );
}

function FighterSlot({ fighter, onClick, active, align }: { 
  fighter?: Fighter, 
  onClick: () => void, 
  active: boolean,
  align: 'left' | 'right'
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex-1 h-36 border flex flex-col items-center justify-center gap-2 transition-all relative",
        active ? "border-accent bg-accent/5" : "border-border bg-bg hover:border-accent",
        fighter ? "border-border" : "border-dashed",
        !fighter && (align === 'right' ? "text-right" : "text-left")
      )}
    >
      {fighter ? (
        <div className="flex h-full w-full min-h-0 flex-col items-center justify-center gap-1 px-1 py-1">
          <div className={cn(align === 'left' && '-scale-x-100')}>
            <img
              src={fighter.image}
              alt=""
              className="h-24 w-24 shrink-0 rounded-none object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="line-clamp-2 w-full text-center text-[10px] font-display uppercase leading-tight text-white">
            {fighter.name}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <Plus size={16} className="text-zinc-700" />
          <span className="text-[8px] font-display uppercase tracking-widest text-zinc-600">Select</span>
        </div>
      )}
    </button>
  );
}

