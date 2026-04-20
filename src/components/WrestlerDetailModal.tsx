import { Fragment, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Dumbbell, Mic2, HeartPulse, Crosshair, AlertTriangle, Trash2 } from 'lucide-react';
import { Fighter } from '../types';
import { cn, fighterOverallRating } from '../lib/utils';

interface WrestlerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fighter: Fighter | null;
  onRequestRelease?: () => void;
}

function StatRow({
  label,
  value,
  icon,
  iconClass,
  hint,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  iconClass: string;
  hint: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1.5">
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
          className="h-full bg-accent"
        />
      </div>
      <p className="text-[10px] leading-snug text-zinc-500 pl-[22px]">{hint}</p>
    </div>
  );
}

function WrestlerDetailBody({
  fighter,
  onClose,
  onRequestRelease,
}: {
  fighter: Fighter;
  onClose: () => void;
  onRequestRelease?: () => void;
}) {
  const ovr = fighterOverallRating(fighter.stats);
  const recovering = fighter.recoveringFromInjury;

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
              <div className="min-w-0 pr-2">
                <p className="text-[10px] font-display uppercase tracking-[0.35em] text-gold">Roster file</p>
                <h2 className="text-2xl font-display uppercase leading-tight text-white">{fighter.name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'text-[9px] font-display uppercase tracking-widest px-2 py-1 border shrink-0',
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
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-card border border-border p-2">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">OVR</p>
                      <p className="text-2xl font-display text-white leading-none">{ovr}</p>
                      <p className="text-[8px] text-zinc-600 mt-0.5 leading-tight">💥PWR · ⚡TEC · 🛡️END</p>
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

              {recovering && (
                <div className="flex gap-3 items-start bg-accent/10 border border-accent/40 p-3">
                  <AlertTriangle className="text-accent shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-display uppercase tracking-wide text-accent">Recovering</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Cannot be booked until energy is back at 100%. Each day restores more energy than a normal rest
                      day until they are cleared.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Attributes</p>
                <div className="space-y-3">
                  <StatRow
                    label="💥 Power · PWR"
                    value={fighter.stats.power}
                    icon={<Dumbbell size={14} />}
                    iconClass="text-red-400"
                    hint="Adds damage on each strike in the fight sim."
                  />
                  <StatRow
                    label="⚡ Technique · TEC"
                    value={fighter.stats.technique}
                    icon={<Crosshair size={14} />}
                    iconClass="text-cyan-400"
                    hint="Faster in-ring pace; higher average technique in the match lowers injury risk."
                  />
                  <StatRow
                    label="🛡️ Endurance · END"
                    value={fighter.stats.endurance}
                    icon={<HeartPulse size={14} />}
                    iconClass="text-emerald-400"
                    hint="Lose less energy after a booked match."
                  />
                  <StatRow
                    label="🎤 Mic work · MIC"
                    value={fighter.stats.mic}
                    icon={<Mic2 size={14} />}
                    iconClass="text-purple-400"
                    hint="Bigger popularity bumps from a strong match score (not counted in OVR)."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Condition</p>
                <div className="h-1.5 bg-zinc-800 w-full">
                  <div className="h-full bg-accent transition-all" style={{ width: `${fighter.energy}%` }} />
                </div>
                <p className="text-[11px] text-zinc-500">
                  Injury risk rises when energy is low and drops when both workers bring strong technique to the match.
                  Higher endurance means you lose less energy after a fight. When the calendar advances, everyone gains
                  daily energy; upgrading the Wellness Center at HQ increases that amount.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border shrink-0 flex gap-2">
              {onRequestRelease && (
                <button
                  type="button"
                  onClick={onRequestRelease}
                  className="flex shrink-0 items-center justify-center border border-border bg-card px-4 py-3.5 text-zinc-400 transition-colors hover:border-accent/50 hover:text-accent"
                  aria-label={`Release ${fighter.name}`}
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-w-0 flex-1 bg-white hover:bg-accent hover:text-white text-black font-display py-3.5 uppercase tracking-tighter transition-all text-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
    </>
  );
}

export default function WrestlerDetailModal({
  isOpen,
  onClose,
  fighter,
  onRequestRelease,
}: WrestlerDetailModalProps) {
  return (
    <AnimatePresence>
      {isOpen && fighter && (
        <Fragment key={fighter.id}>
          <WrestlerDetailBody fighter={fighter} onClose={onClose} onRequestRelease={onRequestRelease} />
        </Fragment>
      )}
    </AnimatePresence>
  );
}
