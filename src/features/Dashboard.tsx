import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Play, TrendingUp, Users, Star, DollarSign } from 'lucide-react';
import { GameState } from '../types';
import { formatCurrency, formatNumber } from '../lib/utils';

interface DashboardProps {
  state: GameState;
  onPlanShow: () => void;
}

export default function Dashboard({ state, onPlanShow }: DashboardProps) {
  const lastShow = state.history[0];

  return (
    <div className="p-8 space-y-10">
      {/* Welcome Section */}
      <section>
        <h2 className="text-14 font-display uppercase tracking-[2px] text-zinc-500 flex items-center gap-3 after:h-px after:bg-border after:flex-1">
          Dashboard
        </h2>
        <div className="mt-4">
          <h3 className="text-4xl font-display uppercase leading-none">
            Season <span className="text-accent">01</span>
          </h3>
          <p className="text-zinc-500 text-xs font-bold uppercase mt-1 tracking-widest">Show #{state.currentShowNumber}</p>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-px bg-border border border-border">
        <StatCard 
          label="Revenue" 
          value={formatCurrency(state.history.reduce((acc, s) => acc + s.revenue, 0))} 
          icon={<DollarSign size={14} className="text-accent" />}
        />
        <StatCard 
          label="Roster" 
          value={state.roster.length.toString()} 
          icon={<Users size={14} className="text-accent" />}
        />
        <StatCard 
          label="Avg Score" 
          value={state.history.length > 0 
            ? Math.round((state.history.reduce((acc, s) => acc + s.rating, 0) / state.history.length) * 80).toString()
            : 'N/A'} 
          icon={<TrendingUp size={14} className="text-gold" />}
        />
        <StatCard 
          label="Popularity" 
          value={state.popularity.toString()} 
          icon={<TrendingUp size={14} className="text-accent" />}
        />
      </div>

      {/* Last Show Summary */}
      {lastShow && (
        <section className="space-y-4">
          <h2 className="text-14 font-display uppercase tracking-[2px] text-zinc-500 flex items-center gap-3 after:h-px after:bg-border after:flex-1">
            Last Event
          </h2>
          <div className="bg-card border border-border p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-display bg-accent px-2 py-1 text-white">{lastShow.name}</span>
              <span className="text-2xl font-display text-gold">{Math.round(lastShow.rating * 80)}</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-display text-white leading-none">{formatCurrency(lastShow.revenue)}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1">Total Revenue</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Action Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onPlanShow}
        className="w-full bg-white hover:bg-accent hover:text-white text-black font-display py-6 text-xl uppercase tracking-tighter transition-all"
      >
        Plan Next Show
      </motion.button>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: ReactNode }) {
  return (
    <div className="bg-bg p-4 space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-display text-white tracking-tight">{value}</p>
    </div>
  );
}
