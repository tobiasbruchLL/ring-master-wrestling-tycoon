import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, X, GraduationCap } from 'lucide-react';
import { GameState, RecruitProspect, Fighter, getRecruitSlotCap } from '../types';
import { cn, fighterOverallRating, formatCurrency, getRecruitSigningFee } from '../lib/utils';
import { getMaxRosterSize } from '../lib/rosterCapacity';
import {
  INSTANT_RECRUIT_SIGN_STAT_FLOOR,
  INSTANT_RECRUIT_SIGN_STAT_PENALTY,
  RECRUIT_TRAINING_DAYS_TOTAL,
} from '../lib/recruitTraining';

interface RecruitingProps {
  state: GameState;
  onEnlist: (prospectId: string, mentorAId: string, mentorBId: string) => void;
  onSkipCamp: (prospectId: string) => void;
}

function statRow(stats: Fighter['stats']) {
  return (
    <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
      <span>💥 PWR {stats.power}</span>
      <span>⚡ TEC {stats.technique}</span>
      <span>🛡️ END {stats.endurance}</span>
      <span>🎤 MIC {stats.mic}</span>
    </div>
  );
}

export default function Recruiting({ state, onEnlist, onSkipCamp }: RecruitingProps) {
  const cap = getRecruitSlotCap(state);
  const maxRoster = getMaxRosterSize(state);
  const rosterHasRoom = state.roster.length < maxRoster;
  const rosterEnoughForMentors = state.roster.length >= 2;
  const [pickFor, setPickFor] = useState<RecruitProspect | null>(null);
  const [mentorA, setMentorA] = useState<string>('');
  const [mentorB, setMentorB] = useState<string>('');

  const mentors = state.roster;

  const pickSigningFee = pickFor ? getRecruitSigningFee(pickFor.stats) : 0;
  const canAffordPick = pickFor ? state.money >= pickSigningFee : false;

  const canEnlistCamp =
    Boolean(pickFor) &&
    Boolean(mentorA) &&
    Boolean(mentorB) &&
    mentorA !== mentorB &&
    cap > 0 &&
    state.activeRecruits.length < cap &&
    rosterHasRoom &&
    canAffordPick &&
    rosterEnoughForMentors;

  const canSkipCampSign = Boolean(pickFor) && rosterHasRoom && canAffordPick;

  const handleOpenPick = (p: RecruitProspect) => {
    setPickFor(p);
    setMentorA('');
    setMentorB('');
  };

  const handleConfirmEnlist = () => {
    if (!pickFor || !canEnlistCamp) return;
    onEnlist(pickFor.id, mentorA, mentorB);
    setPickFor(null);
  };

  const handleSkipCampSign = () => {
    if (!pickFor || !canSkipCampSign) return;
    onSkipCamp(pickFor.id);
    setPickFor(null);
  };

  return (
    <div className="p-6 space-y-8 pb-28">
      <section className="space-y-2">
        <p className="text-[10px] font-display uppercase tracking-[4px] text-zinc-500">Pipeline</p>
        <h2 className="text-4xl font-display uppercase leading-none text-white">
          Recruiting <span className="text-accent">&amp;</span> dev
        </h2>
        {!rosterHasRoom && (
          <p className="text-[10px] text-accent font-bold uppercase tracking-wide leading-snug">
            Roster is full — release someone or buy Locker Room Expansion in Upgrades before enlisting a new recruit.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[10px] font-display uppercase tracking-[3px] text-zinc-500 flex items-center gap-2">
          <GraduationCap size={14} />
          In training ({state.activeRecruits.length}/{cap})
        </h3>
        {cap <= 0 && (
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide leading-snug">
            No camp slots yet — upgrade Performance Center in Upgrades, or sign prospects raw from the pipeline (same
            fee, weaker stats, instant debut).
          </p>
        )}
        {state.activeRecruits.length === 0 ? (
          <div className="border border-dashed border-border p-6 text-center text-zinc-600 text-xs font-display uppercase tracking-widest">
            No active recruits
          </div>
        ) : (
          <div className="space-y-3">
            {state.activeRecruits.map((r) => {
              const ma = state.roster.find((f) => f.id === r.mentorIds[0]);
              const mb = state.roster.find((f) => f.id === r.mentorIds[1]);
              const ovr = fighterOverallRating(r.stats);
              return (
                <div key={r.id} className="bg-card border border-border p-4 flex gap-4 items-center">
                  <div className="shrink-0">
                    <img
                      src={r.image}
                      alt={r.name}
                      className="h-24 w-24 rounded-none object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display text-white uppercase text-lg leading-tight truncate">{r.name}</h4>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'text-[8px] font-display uppercase tracking-widest px-1.5 py-0.5 border shrink-0',
                          r.alignment === 'Face'
                            ? 'text-blue-400 border-blue-400/30'
                            : 'text-accent border-accent/30',
                        )}
                      >
                        {r.alignment}
                      </span>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{r.trait}</p>
                    </div>
                    <p className="mt-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                      Mentors: {ma?.name ?? 'Former coach'} &amp; {mb?.name ?? 'Former coach'}
                    </p>
                    <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-500 uppercase mt-2">
                      <span>OVR {ovr}</span>
                      <span className="tabular-nums">
                        Camp {r.daysTrained}/{RECRUIT_TRAINING_DAYS_TOTAL}
                      </span>
                      <span className="tabular-nums text-accent">Energy {r.energy}%</span>
                    </div>
                    <div className="mt-2 h-0.5 w-full bg-zinc-800">
                      <div
                        className="h-full bg-accent transition-all duration-500"
                        style={{ width: `${r.energy}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[10px] font-display uppercase tracking-[3px] text-zinc-500 flex items-center gap-2">
          <UserPlus size={14} />
          Prospects
        </h3>
        {state.recruitProspects.length === 0 ? (
          <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest">
            After your first show, two prospects arrive after every event. Pass on them and they cycle out when the
            next card runs. Higher reputation attracts better rookies.
          </p>
        ) : (
          <div className="space-y-3">
            {state.recruitProspects.map((p) => {
              const signingFee = getRecruitSigningFee(p.stats);
              const canAfford = state.money >= signingFee;
              const canOpenPick = rosterHasRoom && canAfford;
              return (
                <motion.div
                  key={p.id}
                  layout
                  className="bg-card border border-border p-4 flex flex-col gap-3"
                >
                  <div className="flex gap-3">
                    <img
                      src={p.image}
                      alt=""
                      className="w-14 h-14 object-contain border border-border"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="font-display uppercase text-white text-lg leading-tight truncate">{p.name}</h4>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{p.trait}</p>
                      {statRow(p.stats)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canOpenPick}
                    onClick={() => handleOpenPick(p)}
                    className={cn(
                      'group w-full py-2.5 font-display uppercase text-[10px] tracking-widest transition-all flex flex-col items-center justify-center gap-0.5 leading-tight',
                      canOpenPick ? 'bg-white text-black hover:bg-accent hover:text-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                    )}
                  >
                    <span>Add recruit</span>
                    <span
                      className={cn(
                        'text-[9px] font-bold tracking-widest tabular-nums',
                        canOpenPick && 'text-zinc-500 group-hover:text-white/90',
                        !canOpenPick && canAfford && 'text-zinc-500',
                        !canAfford && 'text-accent',
                      )}
                    >
                      Signing fee {formatCurrency(signingFee)}
                      {!canAfford && ' · need cash'}
                    </span>
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <AnimatePresence>
        {pickFor && (
          <>
            <motion.button
              type="button"
              aria-label="Close mentor picker"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-[140]"
              onClick={() => setPickFor(null)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t-4 border-accent bg-bg p-6 z-[141] space-y-4 max-h-[70dvh] overflow-y-auto"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-[10px] font-display text-zinc-500 uppercase tracking-widest">Assign mentors</p>
                  <h3 className="text-xl font-display uppercase text-white">{pickFor.name}</h3>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Choose two roster fighters for camp. Their stats shape how fast this rookie improves — or skip camp
                    for an instant, weaker debut (no training slot).
                  </p>
                  {cap <= 0 && (
                    <p className="text-[10px] text-accent font-bold uppercase tracking-wide mt-2 leading-snug">
                      No training slots — upgrade Performance Center to run camp, or use skip camp below.
                    </p>
                  )}
                  {cap > 0 && state.activeRecruits.length >= cap && (
                    <p className="text-[10px] text-accent font-bold uppercase tracking-wide mt-2 leading-snug">
                      All {cap} camp slot{cap === 1 ? '' : 's'} full — finish training or skip camp to add this prospect.
                    </p>
                  )}
                  {!rosterEnoughForMentors && (
                    <p className="text-[10px] text-accent font-bold uppercase tracking-wide mt-2 leading-snug">
                      Need at least two roster fighters to assign mentors for camp.
                    </p>
                  )}
                  <p
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-widest mt-2 tabular-nums',
                      canAffordPick ? 'text-gold' : 'text-accent',
                    )}
                  >
                    Signing fee {formatCurrency(pickSigningFee)}
                    {!canAffordPick && ' — need more cash'}
                  </p>
                </div>
                <button type="button" onClick={() => setPickFor(null)} className="p-1 text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className={cn('space-y-4', !rosterEnoughForMentors && 'opacity-40 pointer-events-none')}>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Mentor A</label>
                  <select
                    value={mentorA}
                    onChange={(e) => setMentorA(e.target.value)}
                    className="w-full bg-card border border-border px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select…</option>
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id} disabled={m.id === mentorB}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Mentor B</label>
                  <select
                    value={mentorB}
                    onChange={(e) => setMentorB(e.target.value)}
                    className="w-full bg-card border border-border px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select…</option>
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id} disabled={m.id === mentorA}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                disabled={!canEnlistCamp}
                onClick={handleConfirmEnlist}
                className={cn(
                  'w-full py-3 font-display uppercase text-xs tracking-widest transition-all',
                  canEnlistCamp
                    ? 'bg-accent text-white hover:bg-white hover:text-black'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                )}
              >
                Pay {formatCurrency(pickSigningFee)} and start {RECRUIT_TRAINING_DAYS_TOTAL}-day camp
              </button>

              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-snug">
                  Skip camp — pay {formatCurrency(pickSigningFee)}, lose {INSTANT_RECRUIT_SIGN_STAT_PENALTY} on each stat
                  (min {INSTANT_RECRUIT_SIGN_STAT_FLOOR}), debut immediately after you pick Face/Heel. Does not use a
                  training slot.
                </p>
                <button
                  type="button"
                  disabled={!canSkipCampSign}
                  onClick={handleSkipCampSign}
                  className={cn(
                    'w-full py-3 font-display uppercase text-xs tracking-widest transition-all border border-border',
                    canSkipCampSign
                      ? 'bg-card text-white hover:border-accent hover:text-accent'
                      : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border-transparent',
                  )}
                >
                  Skip camp — sign now
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
