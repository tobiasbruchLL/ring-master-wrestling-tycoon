import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import {
  ActiveRecruit,
  Fighter,
  FighterStats,
  RecruitTrainingChoice,
  RecruitTrainingSessionSummary,
} from '../types';
import { cn } from '../lib/utils';
import {
  getRecruitBestYieldStatKeys,
  getRecruitStatGainRangePreview,
  getRecruitTrainingInjuryChancePercent,
  RECRUIT_TRAINING_HIGH_MISHAP_WARNING_OVER_PERCENT,
  RECRUIT_TRAINING_LOW_ENERGY_THRESHOLD,
  RECRUIT_TRAINING_DAYS_TOTAL,
} from '../lib/recruitTraining';

type ChoiceMap = Record<string, RecruitTrainingChoice | null>;

const STAT_KEYS: (keyof FighterStats)[] = ['power', 'technique', 'endurance', 'mic'];

const statLabel: Record<keyof FighterStats, string> = {
  power: '💥 PWR',
  technique: '⚡ TEC',
  endurance: '🛡️ END',
  mic: '🎤 MIC',
};

interface RecruitTrainingModalProps {
  isOpen: boolean;
  recruits: ActiveRecruit[];
  roster: Fighter[];
  /** Roster cap from HQ expansion + league tier; used to block final-day debuts when the roster is full. */
  maxRosterSize: number;
  onClose: () => void;
  onSubmit: (choices: { recruitId: string; choice: RecruitTrainingChoice }[]) => RecruitTrainingSessionSummary[];
}

function dedupeTrainingSummariesByRecruitId(list: RecruitTrainingSessionSummary[]): RecruitTrainingSessionSummary[] {
  const seen = new Set<string>();
  const out: RecruitTrainingSessionSummary[] = [];
  for (const row of list) {
    if (seen.has(row.recruitId)) continue;
    seen.add(row.recruitId);
    out.push(row);
  }
  return out;
}

function formatStatDeltas(d: FighterStats): string {
  const parts: string[] = [];
  for (const k of STAT_KEYS) {
    if (d[k] === 0) continue;
    const sign = d[k] > 0 ? '+' : '';
    parts.push(`${sign}${d[k]} ${statLabel[k]}`);
  }
  return parts.length ? parts.join(' · ') : 'No stat change';
}

function RecruitStatRow({ stats, label = 'Current stats' }: { stats: FighterStats; label?: string }) {
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

function isRosterFullDebutBlocked(r: ActiveRecruit, rosterLen: number, maxRosterSize: number): boolean {
  return r.daysTrained === RECRUIT_TRAINING_DAYS_TOTAL - 1 && rosterLen >= maxRosterSize;
}

export default function RecruitTrainingModal({
  isOpen,
  recruits,
  roster,
  maxRosterSize,
  onClose,
  onSubmit,
}: RecruitTrainingModalProps) {
  const [choices, setChoices] = useState<ChoiceMap>({});
  const [phase, setPhase] = useState<'pick' | 'results'>('pick');
  const [summaries, setSummaries] = useState<RecruitTrainingSessionSummary[]>([]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      const m: ChoiceMap = {};
      for (const r of recruits) m[r.id] = null;
      setChoices(m);
      setPhase('pick');
      setSummaries([]);
      wasOpenRef.current = true;
    }
  }, [isOpen, recruits]);

  const allPicked =
    recruits.length > 0 &&
    recruits.every(
      (r) =>
        isRosterFullDebutBlocked(r, roster.length, maxRosterSize) ||
        (choices[r.id] !== null && choices[r.id] !== undefined),
    );

  const setChoice = (id: string, c: RecruitTrainingChoice) => {
    setChoices((prev) => ({ ...prev, [id]: c }));
  };

  const handleSubmit = () => {
    if (!allPicked) return;
    const list = recruits.map((r) => ({
      recruitId: r.id,
      choice: isRosterFullDebutBlocked(r, roster.length, maxRosterSize) ? 'rest' : choices[r.id]!,
    }));
    const nextSummaries = dedupeTrainingSummariesByRecruitId(onSubmit(list));
    setSummaries(nextSummaries);
    setPhase('results');
  };

  const handleDoneResults = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[161] flex flex-col bg-bg"
        >
          <header className="shrink-0 border-b border-border px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <p className="text-[10px] font-display uppercase tracking-[4px] text-zinc-500">New day</p>
            <h2 className="text-2xl font-display uppercase text-white leading-tight">
              {phase === 'pick' ? 'Rookie training' : 'Training results'}
            </h2>
            {phase === 'pick' && (
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 max-w-[min(100%,20rem)]">
                Pick focus or rest for each recruit. Mentors shape gains. Below {RECRUIT_TRAINING_LOW_ENERGY_THRESHOLD}% energy,
                stat training risks a mishap.
              </p>
            )}
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 space-y-5">
            {phase === 'pick' && (
              <>
                {recruits.map((r) => {
                  const debutBlocked = isRosterFullDebutBlocked(r, roster.length, maxRosterSize);
                  const ch = choices[r.id];
                  const mishapPct = ch != null ? getRecruitTrainingInjuryChancePercent(r.energy, ch) : null;
                  const gainPreview = ch != null ? getRecruitStatGainRangePreview(r, ch, roster) : null;
                  const bestYieldKeys = getRecruitBestYieldStatKeys(r, roster);
                  const statFocusMishapPct = getRecruitTrainingInjuryChancePercent(r.energy, 'power');
                  const showHighMishapWarning =
                    statFocusMishapPct > RECRUIT_TRAINING_HIGH_MISHAP_WARNING_OVER_PERCENT;
                  const pickHasHighMishap =
                    ch != null && ch !== 'rest' && (mishapPct ?? 0) > RECRUIT_TRAINING_HIGH_MISHAP_WARNING_OVER_PERCENT;
                  return (
                    <div key={r.id} className="border border-border bg-card p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-display uppercase text-lg text-white leading-tight">{r.name}</h3>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            Day {Math.min(RECRUIT_TRAINING_DAYS_TOTAL, r.daysTrained + 1)} /{' '}
                            {RECRUIT_TRAINING_DAYS_TOTAL}
                          </p>
                        </div>
                        <span className="text-[10px] font-display text-accent uppercase">Energy {r.energy}%</span>
                      </div>
                      <div className="h-1 bg-zinc-800">
                        <div className="h-full bg-accent transition-all" style={{ width: `${r.energy}%` }} />
                      </div>
                      <RecruitStatRow stats={r.stats} />
                      {debutBlocked && (
                        <p className="flex gap-2 items-start text-[10px] text-accent font-bold uppercase tracking-wide leading-snug">
                          <AlertTriangle className="shrink-0 mt-0.5" size={14} aria-hidden />
                          <span>
                            Roster is full ({roster.length}/{maxRosterSize}). Release someone or buy Locker Room
                            Expansion in Upgrades before this rookie can debut.
                          </span>
                        </p>
                      )}
                      {showHighMishapWarning && (
                        <p className="flex gap-2 items-start text-[10px] text-red-400 font-bold uppercase tracking-wide leading-snug">
                          <AlertTriangle className="shrink-0 mt-0.5" size={14} aria-hidden />
                          <span>
                            Warning: stat training has a {statFocusMishapPct}% mishap chance (over{' '}
                            {RECRUIT_TRAINING_HIGH_MISHAP_WARNING_OVER_PERCENT}%). Rest removes that risk.
                          </span>
                        </p>
                      )}
                      {r.energy < RECRUIT_TRAINING_LOW_ENERGY_THRESHOLD && !showHighMishapWarning && (
                        <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wide">
                          Low energy — stat training can misfire
                        </p>
                      )}
                      {!debutBlocked && (
                        <div className="flex flex-wrap gap-2">
                          {STAT_KEYS.map((k) => {
                            const isBestYield = bestYieldKeys.includes(k);
                            return (
                              <button
                                key={k}
                                type="button"
                                title={
                                  isBestYield
                                    ? 'Highest potential stat gain if the session goes well (mentor-based)'
                                    : undefined
                                }
                                onClick={() => setChoice(r.id, k)}
                                className={cn(
                                  'px-3 py-2 font-display uppercase text-[10px] tracking-widest border transition-all',
                                  choices[r.id] === k
                                    ? 'border-accent bg-accent text-white'
                                    : isBestYield
                                      ? 'border-emerald-500 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.22)] hover:border-emerald-400'
                                      : 'border-border text-zinc-400 hover:text-white',
                                )}
                              >
                                {statLabel[k]}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setChoice(r.id, 'rest')}
                            className={cn(
                              'px-3 py-2 font-display uppercase text-[10px] tracking-widest border transition-all',
                              choices[r.id] === 'rest'
                                ? 'border-gold bg-gold text-black'
                                : 'border-border text-zinc-400 hover:text-white',
                            )}
                          >
                            Rest
                          </button>
                        </div>
                      )}
                      {ch != null && !debutBlocked && (
                        <div className="rounded border border-border/80 bg-bg/80 px-3 py-2 space-y-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                          <p>
                            <span className="text-zinc-500">Mishap chance (this pick): </span>
                            <span className={(mishapPct ?? 0) > 0 ? 'text-amber-400' : 'text-zinc-300'}>
                              {mishapPct ?? 0}%
                            </span>
                          </p>
                          {ch === 'rest' ? (
                            <p className="text-zinc-500 normal-case font-bold tracking-normal">
                              Recover +36 energy (max 100). No training risk.
                            </p>
                          ) : gainPreview ? (
                            <>
                              <p className="text-zinc-500 normal-case font-bold tracking-normal">
                                If the day goes well: +{gainPreview.min}–{gainPreview.max} {statLabel[gainPreview.statKey]}, −22
                                energy. Mishap: all stats −4 (min 5 each), −24 energy.
                              </p>
                              {pickHasHighMishap && (
                                <p className="flex gap-1.5 items-center text-red-400 normal-case font-bold tracking-normal">
                                  <AlertTriangle size={12} className="shrink-0" aria-hidden />
                                  Mishap chance is above {RECRUIT_TRAINING_HIGH_MISHAP_WARNING_OVER_PERCENT}%.
                                </p>
                              )}
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {phase === 'results' && (
              <div className="space-y-4">
                {(recruits.length > 0
                  ? [...summaries].sort(
                      (a, b) =>
                        recruits.findIndex((r) => r.id === a.recruitId) -
                        recruits.findIndex((r) => r.id === b.recruitId),
                    )
                  : [...summaries]
                ).map((s) => (
                  <div key={s.recruitId} className="border border-border bg-card p-4 space-y-2">
                    <div className="flex justify-between gap-2 items-start">
                      <h3 className="font-display uppercase text-lg text-white leading-tight">{s.recruitName}</h3>
                      {s.graduated && (
                        <span className="text-[9px] font-display uppercase text-gold border border-gold px-2 py-0.5 shrink-0">
                          Graduated
                        </span>
                      )}
                    </div>
                    {s.blockedBecauseRosterFull ? (
                      <p className="text-sm text-accent font-bold uppercase tracking-wide leading-snug">
                        Debut held — roster is full. Free a slot or expand capacity in Upgrades, then run another day.
                      </p>
                    ) : (
                      <>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Focus: {s.choice === 'rest' ? 'Rest' : statLabel[s.choice as keyof FighterStats]}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      Mishap chance rolled: {s.injuryRiskPercent}%
                    </p>
                    {s.injured ? (
                      <p className="text-sm text-amber-400 font-bold uppercase tracking-wide">Mishap — rough session in the ring</p>
                    ) : s.choice === 'rest' ? (
                      <p className="text-sm text-zinc-300 font-bold uppercase tracking-wide">Rested and recharged</p>
                    ) : (
                      <p className="text-sm text-zinc-300 font-bold uppercase tracking-wide">Clean session — gains applied</p>
                    )}
                    <RecruitStatRow stats={s.statsAfter} label={s.graduated ? 'Final camp stats' : 'Stats after today'} />
                    <p className="text-xs text-zinc-400 font-bold">{formatStatDeltas(s.statDeltas)}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      Energy {s.energyAfter}%{' '}
                      <span className="text-accent normal-case">
                        ({s.energyDelta >= 0 ? '+' : ''}
                        {s.energyDelta})
                      </span>
                    </p>
                      </>
                    )}
                  </div>
                  ))}
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-bg">
            {phase === 'pick' ? (
              <button
                type="button"
                disabled={!allPicked}
                onClick={handleSubmit}
                className={cn(
                  'w-full font-display py-4 uppercase tracking-tighter transition-all',
                  allPicked ? 'bg-white text-black hover:bg-accent hover:text-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                )}
              >
                Confirm training
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDoneResults}
                className="w-full font-display py-4 uppercase tracking-tighter bg-white text-black hover:bg-accent hover:text-white transition-all"
              >
                Continue
              </button>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
