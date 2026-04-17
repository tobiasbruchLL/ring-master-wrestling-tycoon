import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import type { FighterStats, FighterAlignment, PendingRecruitGraduation } from '../types';
import { cn } from '../lib/utils';

const STAT_KEYS: (keyof FighterStats)[] = ['power', 'technique', 'endurance', 'mic'];

const statLabel: Record<keyof FighterStats, string> = {
  power: '💥 PWR',
  technique: '⚡ TEC',
  endurance: '🛡️ END',
  mic: '🎤 MIC',
};

function formatStatDeltas(d: FighterStats): string {
  const parts: string[] = [];
  for (const k of STAT_KEYS) {
    if (d[k] === 0) continue;
    const sign = d[k] > 0 ? '+' : '';
    parts.push(`${sign}${d[k]} ${statLabel[k]}`);
  }
  return parts.length ? parts.join(' · ') : 'No stat change';
}

function RecruitStatRow({ stats, label = 'Final stats' }: { stats: FighterStats; label?: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
      <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">
        <span>
          {statLabel.power} {stats.power}
        </span>
        <span>
          {statLabel.technique} {stats.technique}
        </span>
        <span>
          {statLabel.endurance} {stats.endurance}
        </span>
        <span>
          {statLabel.mic} {stats.mic}
        </span>
      </div>
    </div>
  );
}

interface RecruitGraduationModalProps {
  isOpen: boolean;
  pending: PendingRecruitGraduation | null;
  /** How many graduates are still queued after this one (for copy only). */
  remainingAfter: number;
  onPickAlignment: (fighterId: string, alignment: FighterAlignment) => void;
}

export default function RecruitGraduationModal({
  isOpen,
  pending,
  remainingAfter,
  onPickAlignment,
}: RecruitGraduationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && pending ? (
        <motion.div
          key={pending.fighter.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[163] flex flex-col bg-bg"
        >
          <header className="shrink-0 border-b border-border px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <p className="text-[10px] font-display uppercase tracking-[4px] text-zinc-500">
              {pending.signedWithoutCamp ? 'Recruiting' : 'Rookie camp'}
            </p>
            <h2 className="text-2xl font-display uppercase text-white leading-tight flex items-center gap-2">
              <Sparkles className="text-gold shrink-0" size={22} aria-hidden />
              {pending.signedWithoutCamp ? 'Signed — no camp' : 'Training complete'}
            </h2>
            {remainingAfter > 0 && (
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                {remainingAfter} more debut{remainingAfter === 1 ? '' : 's'} after this
              </p>
            )}
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="border border-border bg-card p-4 space-y-4">
              <div className="flex gap-3 items-start">
                <img
                  src={pending.fighter.image}
                  alt=""
                  className="size-16 rounded border border-border object-cover shrink-0 bg-zinc-900"
                />
                <div className="min-w-0">
                  <h3 className="font-display uppercase text-xl text-white leading-tight">{pending.fighter.name}</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                    {pending.fighter.trait} · joins your roster
                  </p>
                </div>
              </div>

              {pending.signedWithoutCamp ? (
                <div className="rounded border border-border/80 bg-bg/80 px-3 py-2 space-y-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  <p className="text-zinc-300 normal-case font-bold tracking-normal">
                    Skipped the Performance Center camp — raw signing penalties applied vs. prospect sheet.
                  </p>
                  <p className="text-zinc-500 normal-case font-bold tracking-normal">
                    {formatStatDeltas(pending.trainingSummary.statDeltas)}
                  </p>
                  <p className="text-zinc-500">
                    Energy {pending.trainingSummary.energyAfter}%
                    <span className="text-accent normal-case">
                      {' '}
                      ({pending.trainingSummary.energyDelta >= 0 ? '+' : ''}
                      {pending.trainingSummary.energyDelta})
                    </span>
                  </p>
                </div>
              ) : (
                <div className="rounded border border-border/80 bg-bg/80 px-3 py-2 space-y-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  <p>
                    <span className="text-zinc-500">Last session: </span>
                    {pending.trainingSummary.choice === 'rest'
                      ? 'Rest'
                      : statLabel[pending.trainingSummary.choice as keyof FighterStats]}
                  </p>
                  {pending.trainingSummary.injured ? (
                    <p className="text-amber-400 normal-case font-bold tracking-normal">Mishap — rough session in the ring</p>
                  ) : pending.trainingSummary.choice === 'rest' ? (
                    <p className="text-zinc-300 normal-case font-bold tracking-normal">Rested and recharged</p>
                  ) : (
                    <p className="text-zinc-300 normal-case font-bold tracking-normal">Clean session — gains applied</p>
                  )}
                  <p className="text-zinc-500 normal-case font-bold tracking-normal">
                    {formatStatDeltas(pending.trainingSummary.statDeltas)}
                  </p>
                  <p className="text-zinc-500">
                    Energy {pending.trainingSummary.energyAfter}%
                    <span className="text-accent normal-case">
                      {' '}
                      ({pending.trainingSummary.energyDelta >= 0 ? '+' : ''}
                      {pending.trainingSummary.energyDelta})
                    </span>
                  </p>
                </div>
              )}

              <RecruitStatRow
                stats={pending.trainingSummary.statsAfter}
                label={pending.signedWithoutCamp ? 'Debut stats' : 'Camp totals'}
              />

              <div className="pt-1 space-y-2">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Choose their alignment</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onPickAlignment(pending.fighter.id, 'Face')}
                    className={cn(
                      'font-display py-4 uppercase text-xs tracking-widest border-2 transition-all',
                      'border-blue-500/50 text-blue-300 hover:bg-blue-500/15 hover:border-blue-400',
                    )}
                  >
                    Face
                  </button>
                  <button
                    type="button"
                    onClick={() => onPickAlignment(pending.fighter.id, 'Heel')}
                    className={cn(
                      'font-display py-4 uppercase text-xs tracking-widest border-2 transition-all',
                      'border-accent/50 text-accent hover:bg-accent/10 hover:border-accent',
                    )}
                  >
                    Heel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
