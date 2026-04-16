import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { GameState, Match, Fighter, Show } from '../types';
import { cn } from '../lib/utils';

interface ShowPlannerProps {
  state: GameState;
  onRunShow: (matches: Match[], venueId: string) => void;
  onCancel: () => void;
  calculateMatchScore: (match: Match, roster: Fighter[], history: Show[]) => { 
    powerA: number, 
    powerB: number, 
    multipliers: { label: string, value: number }[], 
    totalScore: number,
    projectedStars: number 
  } | null;
}

export default function ShowPlanner({ state, onRunShow, onCancel, calculateMatchScore }: ShowPlannerProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(VENUES[0].id);
  const [selectingFor, setSelectingFor] = useState<{ matchIndex: number, side: 'A' | 'B' } | null>(null);

  const addMatch = () => {
    if (matches.length < 3) {
      setMatches([...matches, { id: Math.random().toString(), fighterAId: '', fighterBId: '' }]);
    }
  };

  const removeMatch = (index: number) => {
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
  const totalSetupCost = matches.reduce((acc, _, idx) => acc + ([0, 1500, 0][idx] || 0), 0);
  const totalCost = selectedVenue.cost + totalSetupCost;
  const canAfford = state.money >= totalCost;
  const isValid = matches.length > 0 && matches.every(m => m.fighterAId && m.fighterBId) && canAfford;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bg">
      <div className="min-h-0 flex-1 overflow-y-auto p-8 pb-4">
        {/* Header */}
        <div className="border-b border-border pb-8">
          <h2 className="text-14 font-display uppercase tracking-[2px] text-zinc-500">Show Planner</h2>
          <h3 className="mt-4 text-4xl font-display uppercase leading-none">
            Next <span className="text-accent">Event</span>
          </h3>
        </div>

        <div className="space-y-12 pt-8">
        {/* Venue Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-display text-gold uppercase tracking-widest">Select Venue</span>
            <div className="h-px bg-border flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {VENUES.map(venue => {
              const locked = state.popularity < venue.minPopularity;
              return (
                <button
                  key={venue.id}
                  disabled={locked}
                  onClick={() => setSelectedVenueId(venue.id)}
                  className={cn(
                    "p-4 border text-left transition-all relative overflow-hidden",
                    selectedVenueId === venue.id ? "border-accent bg-accent/5" : "border-border bg-card hover:border-accent",
                    locked && "opacity-50 grayscale cursor-not-allowed"
                  )}
                >
                  <p className="text-xs font-display uppercase text-white">{venue.name}</p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1">Cost: {formatCurrency(venue.cost)}</p>
                  <p className="text-[10px] font-bold text-accent uppercase mt-0.5">{venue.multiplier}x Earnings</p>
                  {locked && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-[8px] font-display uppercase tracking-widest text-white">Pop {venue.minPopularity} Required</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {matches.map((match, idx) => (
          <div key={match.id} className="space-y-6 relative">
            <button 
              onClick={() => removeMatch(idx)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-accent text-white flex items-center justify-center z-10"
            >
              <X size={12} />
            </button>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-display text-gold uppercase tracking-widest">Match {idx + 1}</span>
              <div className="h-px bg-border flex-1" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <FighterSlot 
                fighter={state.roster.find(f => f.id === match.fighterAId)} 
                onClick={() => setSelectingFor({ matchIndex: idx, side: 'A' })}
                active={selectingFor?.matchIndex === idx && selectingFor?.side === 'A'}
                align="right"
              />
              
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="font-display text-2xl text-accent italic -rotate-12">VS</div>
              </div>

              <FighterSlot 
                fighter={state.roster.find(f => f.id === match.fighterBId)} 
                onClick={() => setSelectingFor({ matchIndex: idx, side: 'B' })}
                active={selectingFor?.matchIndex === idx && selectingFor?.side === 'B'}
                align="left"
              />
            </div>

            {/* Score Breakdown */}
            {match.fighterAId && match.fighterBId && (() => {
              const breakdown = calculateMatchScore(match, state.roster, state.history);
              if (!breakdown) return null;
              return (
                <div className="bg-card/50 border border-border/50 p-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-display uppercase tracking-widest text-zinc-500">
                    <span>1st Fighter Power</span>
                    <span className="text-white">+{breakdown.powerA}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-display uppercase tracking-widest text-zinc-500">
                    <span>2nd Fighter Power</span>
                    <span className="text-white">+{breakdown.powerB}</span>
                  </div>
                  {breakdown.multipliers.map((m, mIdx) => (
                    <div key={mIdx} className="flex justify-between text-[10px] font-display uppercase tracking-widest text-gold">
                      <span>{m.label}</span>
                      <span>*{m.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border/50 flex justify-between text-xs font-display uppercase tracking-[2px] text-accent">
                    <span>Match Score</span>
                    <span className="font-bold">{breakdown.totalScore}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}

        {matches.length < 3 && (
          <button 
            onClick={addMatch}
            className="w-full border border-dashed border-border hover:border-accent py-10 flex flex-col items-center justify-center text-zinc-600 hover:text-accent transition-all gap-2"
          >
            <Plus size={24} />
            <span className="text-[10px] font-display uppercase tracking-widest">Add Match</span>
          </button>
        )}

        <div className="space-y-6 border-t border-border pt-8">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[10px] font-display uppercase tracking-widest text-zinc-500">
              <span>Matches: {matches.length}/3</span>
              <span>Venue Cost: {formatCurrency(selectedVenue.cost)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-display uppercase tracking-widest text-zinc-500">
              <span>Match Setup: {formatCurrency(totalSetupCost)}</span>
              <span>Budget: {formatCurrency(state.money)}</span>
            </div>
          </div>
          {!canAfford && matches.length > 0 && (
            <p className="text-center text-[10px] font-bold uppercase text-accent animate-pulse">
              Insufficient Funds for Show
            </p>
          )}
        </div>
        </div>
      </div>

      <div className="relative z-30 flex shrink-0 border-t border-border bg-card">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-20 w-[6.75rem] shrink-0 items-center justify-center border-r border-border px-2 text-center font-display text-[8px] font-bold uppercase leading-snug tracking-wide text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white sm:w-[7.75rem] sm:text-[9px] sm:tracking-widest"
        >
          Back / Cancel
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={() => onRunShow(matches, selectedVenueId)}
          className={cn(
            'min-w-0 flex-1 py-5 font-display text-lg uppercase tracking-tighter transition-all sm:text-xl',
            isValid
              ? 'bg-white text-black hover:bg-accent hover:text-white'
              : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
          )}
        >
          Start Show
        </button>
      </div>

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
              {state.roster.map(fighter => {
                const selected = isFighterSelected(fighter.id);
                const lowEnergy = fighter.energy < 20;

                return (
                  <button
                    key={fighter.id}
                    disabled={selected}
                    onClick={() => setFighter(selectingFor.matchIndex, selectingFor.side, fighter.id)}
                    className={cn(
                      "w-full bg-card border border-border p-4 flex items-center gap-4 transition-all",
                      selected ? "opacity-30 grayscale cursor-not-allowed" : "hover:border-accent"
                    )}
                  >
                    <img src={fighter.image} className="w-12 h-12 rounded-none object-contain border border-border" referrerPolicy="no-referrer" />
                    <div className="flex-1 text-left">
                      <div className="flex justify-between items-start">
                        <p className="font-display text-white uppercase text-sm leading-tight">{fighter.name}</p>
                        <span className={cn(
                          "text-[8px] font-display uppercase tracking-widest px-1.5 py-0.5 border",
                          fighter.alignment === 'Face' ? "text-blue-400 border-blue-400/30" : "text-accent border-accent/30"
                        )}>
                          {fighter.alignment}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{fighter.trait}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-0.5 w-12 bg-zinc-800">
                          <div className="h-full bg-accent" style={{ width: `${fighter.energy}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Energy: {fighter.energy}%</span>
                      </div>
                    </div>
                    {lowEnergy && <AlertCircle size={16} className="text-accent" />}
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
        "flex-1 h-24 border flex flex-col items-center justify-center gap-2 transition-all relative",
        active ? "border-accent bg-accent/5" : "border-border bg-bg hover:border-accent",
        fighter ? "border-border" : "border-dashed",
        align === 'right' ? "text-right" : "text-left"
      )}
    >
      {fighter ? (
        <div className="p-3 w-full h-full flex flex-col justify-center">
          <div className="flex flex-col gap-0.5">
            <span className={cn(
              "text-[8px] font-display uppercase tracking-widest",
              fighter.alignment === 'Face' ? "text-blue-400" : "text-accent"
            )}>
              {fighter.alignment}
            </span>
            <p className="text-xs font-display uppercase text-white leading-tight break-words">{fighter.name}</p>
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1">{fighter.trait}</p>
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

import { formatCurrency as utilsFormatCurrency } from '../lib/utils';
import { VENUES } from '../constants';
const formatCurrency = utilsFormatCurrency;
