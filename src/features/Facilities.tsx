import { ArrowUpCircle } from 'lucide-react';
import { GameState } from '../types';
import { cn, formatCurrency, getFacilityUpgradeCost } from '../lib/utils';

interface FacilitiesProps {
  state: GameState;
  onUpgrade: (id: string) => void;
}

export default function Facilities({ state, onUpgrade }: FacilitiesProps) {
  return (
    <div className="p-8 space-y-10">
      <section>
        <h3 className="text-4xl font-display uppercase leading-none">
          HQ <span className="text-accent">Upgrades</span>
        </h3>
        <p className="text-zinc-500 text-xs font-bold uppercase mt-1 tracking-widest">Invest in your promotion</p>
      </section>

      <div className="space-y-0 border-t border-border">
        {state.facilities.map(facility => {
          const cost = getFacilityUpgradeCost(facility);
          const canAfford = state.money >= cost;

          return (
            <div key={facility.id} className="py-6 border-b border-border space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="text-lg font-display text-white uppercase leading-tight">{facility.name}</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed max-w-[240px]">{facility.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-display text-gold uppercase tracking-widest">Level {facility.level}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest">
                  <ArrowUpCircle size={12} />
                  <span>{facility.effect}</span>
                </div>
                
                <button
                  onClick={() => onUpgrade(facility.id)}
                  disabled={!canAfford}
                  className={cn(
                    "px-6 py-2 font-display uppercase text-[10px] tracking-widest transition-all",
                    canAfford 
                      ? "bg-white text-black hover:bg-accent hover:text-white" 
                      : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  )}
                >
                  {formatCurrency(cost)}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
