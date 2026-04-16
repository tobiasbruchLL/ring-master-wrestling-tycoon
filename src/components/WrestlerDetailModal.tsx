import { Fragment, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Dumbbell, Mic2, HeartPulse, Crosshair, AlertTriangle } from 'lucide-react';
import { Fighter, FighterTrait, FighterStats } from '../types';
import { cn } from '../lib/utils';

interface WrestlerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fighter: Fighter | null;
}

const TRAIT_FOCUS: Record<FighterTrait, keyof FighterStats> = {
  Technician: 'skill',
  Brawler: 'strength',
  'High Flyer': 'skill',
  Powerhouse: 'strength',
};

function overallRating(stats: FighterStats) {
  return Math.round((stats.strength + stats.charisma + stats.skill + stats.stamina) / 4);
}

function StatRow({
  label,
  value,
  icon,
  iconClass,
  highlight,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  iconClass: string;
  highlight?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('space-y-1.5', highlight && 'rounded border border-gold/40 bg-gold/5 p-2 -mx-2')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('shrink-0', iconClass)}>{icon}</span>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{label}</span>
        </div>
        <span className="text-sm font-mono font-bold text-white tabular-nums">{value}</span>
      </div>
      <div className="h-1 bg-zinc-800 w-full">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={cn('h-full', highlight ? 'bg-gold' : 'bg-accent')}
        />
      </div>
    </div>
  );
}

function WrestlerDetailBody({ fighter, onClose }: { fighter: Fighter; onClose: () => void }) {
  const ovr = overallRating(fighter.stats);
  const focusKey = TRAIT_FOCUS[fighter.trait];
  const injured = fighter.injuryDays > 0;

  return (
    <>
      <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-[150] flex min-h-0 h-[100dvh] max-h-[100dvh] w-full flex-col bg-bg border-4 border-accent shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2 p-4 border-b border-border shrink-0">
              <div>
                <p className="text-[10px] font-display uppercase tracking-[0.35em] text-gold">Roster file</p>
                <h2 className="text-2xl font-display uppercase leading-tight text-white pr-2">{fighter.name}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-zinc-500 hover:text-white transition-colors shrink-0"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div className="flex gap-4">
                <div className="shrink-0">
                  <img
                    src={fighter.image}
                    alt=""
                    className="w-28 h-28 object-contain border-2 border-border bg-card"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cn(
                        'text-[9px] font-display uppercase tracking-widest px-2 py-1 border',
                        fighter.alignment === 'Face'
                          ? 'text-blue-400 border-blue-400/40'
                          : 'text-accent border-accent/40',
                      )}
                    >
                      {fighter.alignment}
                    </span>
                    <span className="text-[9px] font-display uppercase tracking-widest px-2 py-1 border border-zinc-600 text-zinc-300">
                      {fighter.trait}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-card border border-border p-2">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">RATING</p>
                      <p className="text-2xl font-display text-white leading-none">{ovr}</p>
                    </div>
                    <div className="bg-card border border-border p-2">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">POPULARITY</p>
                      <p className="text-2xl font-display text-gold leading-none">{fighter.popularity}</p>
                    </div>
                    <div className="bg-card border border-border p-2">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Energy</p>
                      <p className="text-2xl font-display text-accent leading-none">{fighter.energy}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {injured && (
                <div className="flex gap-3 items-start bg-accent/10 border border-accent/40 p-3">
                  <AlertTriangle className="text-accent shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-display uppercase tracking-wide text-accent">Injured</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {fighter.injuryDays} day{fighter.injuryDays === 1 ? '' : 's'} remaining before cleared to compete.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Attributes</p>
                <div className="space-y-3">
                  <StatRow
                    label="Strength"
                    value={fighter.stats.strength}
                    icon={<Dumbbell size={14} />}
                    iconClass="text-red-400"
                    highlight={focusKey === 'strength'}
                  />
                  <StatRow
                    label="Charisma"
                    value={fighter.stats.charisma}
                    icon={<Mic2 size={14} />}
                    iconClass="text-purple-400"
                    highlight={focusKey === 'charisma'}
                  />
                  <StatRow
                    label="Stamina"
                    value={fighter.stats.stamina}
                    icon={<HeartPulse size={14} />}
                    iconClass="text-emerald-400"
                    highlight={focusKey === 'stamina'}
                  />
                  <StatRow
                    label="Skill"
                    value={fighter.stats.skill}
                    icon={<Crosshair size={14} />}
                    iconClass="text-cyan-400"
                    highlight={focusKey === 'skill'}
                  />
                </div>
                <p className="text-[10px] text-zinc-600 mt-3 italic">
                  Style emphasis: {focusKey.charAt(0).toUpperCase() + focusKey.slice(1)} (matches {fighter.trait}{' '}
                  presentation).
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Condition</p>
                <div className="h-1.5 bg-zinc-800 w-full">
                  <div className="h-full bg-accent transition-all" style={{ width: `${fighter.energy}%` }} />
                </div>
                <p className="text-[11px] text-zinc-500">
                  High energy improves match quality; schedule rest between demanding shows.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-white hover:bg-accent hover:text-white text-black font-display py-3.5 uppercase tracking-tighter transition-all text-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
    </>
  );
}

export default function WrestlerDetailModal({ isOpen, onClose, fighter }: WrestlerDetailModalProps) {
  return (
    <AnimatePresence>
      {isOpen && fighter && (
        <Fragment key={fighter.id}>
          <WrestlerDetailBody fighter={fighter} onClose={onClose} />
        </Fragment>
      )}
    </AnimatePresence>
  );
}
