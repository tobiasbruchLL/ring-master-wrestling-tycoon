import { useState, useEffect, ReactNode } from 'react';
import { motion } from 'motion/react';
import { Trash2, Users } from 'lucide-react';
import { GameState, Fighter } from '../types';
import { cn, formatCurrency, fighterPower } from '../lib/utils';
import WrestlerDetailModal from '../components/WrestlerDetailModal';

interface RosterProps {
  state: GameState;
  onHire: (fighter: Fighter) => void;
  onFire: (id: string) => void;
  generateFighter: () => Fighter;
}

export default function Roster({ state, onHire, onFire, generateFighter }: RosterProps) {
  const [tab, setTab] = useState<'current' | 'hire'>('current');
  const [candidates] = useState<Fighter[]>(() => Array.from({ length: 3 }, generateFighter));
  const [detailFighter, setDetailFighter] = useState<Fighter | null>(null);

  useEffect(() => {
    setDetailFighter(null);
  }, [tab]);

  useEffect(() => {
    setDetailFighter((prev) => {
      if (!prev) return prev;
      const onRoster = state.roster.some((f) => f.id === prev.id);
      if (!onRoster) return prev;
      const fresh = state.roster.find((f) => f.id === prev.id);
      return fresh ?? null;
    });
  }, [state.roster]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
        {tab === 'current' ? (
          state.roster.length > 0 ? (
            state.roster.map(fighter => (
              <FighterCard 
                key={fighter.id} 
                fighter={fighter}
                onSelect={() => setDetailFighter(fighter)}
                action={
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (detailFighter?.id === fighter.id) setDetailFighter(null);
                      onFire(fighter.id);
                    }}
                    className="p-2 text-zinc-600 hover:text-accent transition-colors"
                    aria-label={`Release ${fighter.name}`}
                  >
                    <Trash2 size={18} />
                  </button>
                }
              />
            ))
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-700 space-y-2">
              <Users size={48} strokeWidth={1} />
              <p className="font-display uppercase text-xs tracking-widest">No fighters</p>
            </div>
          )
        ) : (
          candidates.map(fighter => (
            <FighterCard 
              key={fighter.id} 
              fighter={fighter}
              onSelect={() => setDetailFighter(fighter)}
              action={
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (detailFighter?.id === fighter.id) setDetailFighter(null);
                    onHire(fighter);
                  }}
                  disabled={state.money < fighter.signingBonus || state.roster.some(f => f.id === fighter.id)}
                  className={cn(
                    "px-4 py-2 font-display uppercase text-[10px] tracking-tighter transition-all",
                    state.money >= fighter.signingBonus && !state.roster.some(f => f.id === fighter.id)
                      ? "bg-white text-black hover:bg-accent hover:text-white" 
                      : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  )}
                >
                  Hire {formatCurrency(fighter.signingBonus)}
                </button>
              }
            />
          ))
        )}
      </div>

      <div className="flex shrink-0 gap-px border-t border-border bg-border p-6">
        <button
          type="button"
          onClick={() => setTab('current')}
          className={cn(
            'flex-1 py-3 font-display text-xs uppercase tracking-widest transition-all',
            tab === 'current' ? 'bg-accent text-white' : 'bg-card text-zinc-500',
          )}
        >
          Roster ({state.roster.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('hire')}
          className={cn(
            'flex-1 py-3 font-display text-xs uppercase tracking-widest transition-all',
            tab === 'hire' ? 'bg-accent text-white' : 'bg-card text-zinc-500',
          )}
        >
          Hire Talent
        </button>
      </div>

      <WrestlerDetailModal
        isOpen={detailFighter !== null}
        fighter={detailFighter}
        onClose={() => setDetailFighter(null)}
      />
    </div>
  );
}

interface FighterCardProps {
  fighter: Fighter;
  action: ReactNode;
  onSelect?: () => void;
  key?: string | number;
}

function FighterCard({ fighter, action, onSelect }: FighterCardProps) {
  const ovr = fighterPower(fighter.stats);
  const recovering = fighter.recoveringFromInjury;
  const body = (
    <>
      <div className="shrink-0">
        <img 
          src={fighter.image} 
          alt={fighter.name} 
          className="w-16 h-16 rounded-none object-contain border border-border"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-display text-white uppercase text-lg leading-tight truncate">{fighter.name}</h4>
          <span className={cn(
            "text-[8px] font-display uppercase tracking-widest px-1.5 py-0.5 border shrink-0",
            fighter.alignment === 'Face' ? "text-blue-400 border-blue-400/30" : "text-accent border-accent/30"
          )}>
            {fighter.alignment}
          </span>
        </div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{fighter.trait}</p>
        
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-500 uppercase mt-2">
            <span>POWER {ovr}</span>
            <span>POPULARITY {fighter.popularity}</span>
            <span className="tabular-nums text-accent">
              Energy {fighter.energy}%
              {recovering && <span className="ml-1 text-[8px] font-bold text-zinc-400">(recovery)</span>}
            </span>
          </div>
        
        {/* Skill Bar */}
        <div className="mt-2 h-0.5 bg-zinc-800 w-full">
          <div 
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${fighter.energy}%` }}
          />
        </div>
      </div>
    </>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border p-4 flex gap-4 items-center"
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="flex flex-1 min-w-0 gap-4 items-center text-left hover:bg-white/[0.04] active:bg-white/[0.07] -m-4 p-4 mr-0 transition-colors"
        >
          {body}
        </button>
      ) : (
        <div className="flex flex-1 min-w-0 gap-4 items-center">
          {body}
        </div>
      )}

      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        {action}
      </div>
    </motion.div>
  );
}
