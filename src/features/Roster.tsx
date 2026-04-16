import { useState, ReactNode } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Zap, Star, Shield, Brain, Users } from 'lucide-react';
import { GameState, Fighter } from '../types';
import { cn, formatCurrency } from '../lib/utils';

interface RosterProps {
  state: GameState;
  onHire: (fighter: Fighter) => void;
  onFire: (id: string) => void;
  generateFighter: () => Fighter;
}

export default function Roster({ state, onHire, onFire, generateFighter }: RosterProps) {
  const [tab, setTab] = useState<'current' | 'hire'>('current');
  const [candidates] = useState<Fighter[]>(() => Array.from({ length: 3 }, generateFighter));

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Tabs */}
      <div className="flex p-6 gap-px bg-border border-b border-border">
        <button 
          onClick={() => setTab('current')}
          className={cn(
            "flex-1 py-3 font-display uppercase text-xs tracking-widest transition-all",
            tab === 'current' ? "bg-accent text-white" : "bg-card text-zinc-500"
          )}
        >
          Roster ({state.roster.length})
        </button>
        <button 
          onClick={() => setTab('hire')}
          className={cn(
            "flex-1 py-3 font-display uppercase text-xs tracking-widest transition-all",
            tab === 'hire' ? "bg-accent text-white" : "bg-card text-zinc-500"
          )}
        >
          Hire Talent
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {tab === 'current' ? (
          state.roster.length > 0 ? (
            state.roster.map(fighter => (
              <FighterCard 
                key={fighter.id} 
                fighter={fighter} 
                action={
                  <button 
                    onClick={() => onFire(fighter.id)}
                    className="p-2 text-zinc-600 hover:text-accent transition-colors"
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
              action={
                <button 
                  onClick={() => onHire(fighter)}
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
    </div>
  );
}

interface FighterCardProps {
  fighter: Fighter;
  action: ReactNode;
  key?: string | number;
}

function FighterCard({ fighter, action }: FighterCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border p-4 flex gap-4 items-center"
    >
      <div className="relative shrink-0">
        <img 
          src={fighter.image} 
          alt={fighter.name} 
          className="w-16 h-16 rounded-none object-contain border border-border"
          referrerPolicy="no-referrer"
        />
        <div className="absolute -bottom-1 -right-1 bg-gold text-black text-[10px] font-display px-1.5">
          {fighter.popularity}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h4 className="font-display text-white uppercase text-lg leading-tight truncate">{fighter.name}</h4>
          <span className={cn(
            "text-[8px] font-display uppercase tracking-widest px-1.5 py-0.5 border",
            fighter.alignment === 'Face' ? "text-blue-400 border-blue-400/30" : "text-accent border-accent/30"
          )}>
            {fighter.alignment}
          </span>
        </div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{fighter.trait}</p>
        
          <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase mt-2">
            <span>OVR {Math.round((fighter.stats.strength + fighter.stats.charisma + fighter.stats.skill + fighter.stats.stamina) / 4)}</span>
            <span className="text-accent">Energy {fighter.energy}%</span>
          </div>
        
        {/* Skill Bar */}
        <div className="mt-2 h-0.5 bg-zinc-800 w-full">
          <div 
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${fighter.energy}%` }}
          />
        </div>
      </div>

      <div>{action}</div>
    </motion.div>
  );
}

function StatMini({ icon, value, color }: { icon: ReactNode, value: number, color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={color}>{icon}</span>
      <span className="text-[10px] font-mono font-bold text-zinc-400">{value}</span>
    </div>
  );
}
