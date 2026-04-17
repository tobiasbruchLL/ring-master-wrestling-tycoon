import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, X, GraduationCap } from 'lucide-react';
import { GameState, RecruitProspect, Fighter, getRecruitSlotCap } from '../types';
import { cn } from '../lib/utils';
import { promotionTier } from '../lib/promotionPopularity';

interface RecruitingProps {
  state: GameState;
  onDismissProspect: (id: string) => void;
  onEnlist: (prospectId: string, mentorAId: string, mentorBId: string) => void;
}

function statRow(stats: Fighter['stats']) {
  return (
    <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
      <span>PWR {stats.strength}</span>
      <span>MIC {stats.charisma}</span>
      <span>STM {stats.stamina}</span>
      <span>TEC {stats.skill}</span>
    </div>
  );
}

export default function Recruiting({ state, onDismissProspect, onEnlist }: RecruitingProps) {
  const cap = getRecruitSlotCap(state);
  const [pickFor, setPickFor] = useState<RecruitProspect | null>(null);
  const [mentorA, setMentorA] = useState<string>('');
  const [mentorB, setMentorB] = useState<string>('');

  const mentors = state.roster;

  const canEnlist =
    pickFor &&
    mentorA &&
    mentorB &&
    mentorA !== mentorB &&
    state.activeRecruits.length < cap;

  const handleOpenPick = (p: RecruitProspect) => {
    setPickFor(p);
    setMentorA('');
    setMentorB('');
  };

  const handleConfirmEnlist = () => {
    if (!pickFor || !canEnlist) return;
    onEnlist(pickFor.id, mentorA, mentorB);
    setPickFor(null);
  };

  const repLabel = useMemo(() => {
    const p = promotionTier(state.popularity);
    if (p < 8) return 'Regional';
    if (p < 20) return 'Growing';
    if (p < 40) return 'National buzz';
    return 'Elite draw';
  }, [state.popularity]);

  return (
    <div className="p-6 space-y-8 pb-28">
      <section className="space-y-2">
        <p className="text-[10px] font-display uppercase tracking-[4px] text-zinc-500">Pipeline</p>
        <h2 className="text-4xl font-display uppercase leading-none text-white">
          Recruiting <span className="text-accent">&amp;</span> dev
        </h2>
        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
          Slots {state.activeRecruits.length}/{cap} · Reputation tier: {repLabel} · POPULARITY{' '}
          {promotionTier(state.popularity)}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-[10px] font-display uppercase tracking-[3px] text-zinc-500 flex items-center gap-2">
          <GraduationCap size={14} />
          In training
        </h3>
        {state.activeRecruits.length === 0 ? (
          <div className="border border-dashed border-border p-6 text-center text-zinc-600 text-xs font-display uppercase tracking-widest">
            No active recruits
          </div>
        ) : (
          <div className="space-y-3">
            {state.activeRecruits.map((r) => {
              const ma = state.roster.find((f) => f.id === r.mentorIds[0]);
              const mb = state.roster.find((f) => f.id === r.mentorIds[1]);
              return (
                <div key={r.id} className="bg-card border border-border p-4 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <img
                      src={r.image}
                      alt=""
                      className="w-14 h-14 shrink-0 object-contain border border-border"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between gap-2">
                        <h4 className="font-display uppercase text-lg text-white leading-tight truncate">{r.name}</h4>
                        <span className="text-[10px] font-display text-gold uppercase shrink-0">
                          {r.daysTrained}/10 days
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        Mentors: {ma?.name ?? 'Former coach'} &amp; {mb?.name ?? 'Former coach'}
                      </p>
                      {statRow(r.stats)}
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                    <span>Energy</span>
                    <span className="text-accent">{r.energy}%</span>
                  </div>
                  <div className="h-1 bg-zinc-800">
                    <div className="h-full bg-accent" style={{ width: `${r.energy}%` }} />
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
            After each show, new prospects may appear. Higher reputation attracts better rookies.
          </p>
        ) : (
          <div className="space-y-3">
            {state.recruitProspects.map((p) => (
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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDismissProspect(p.id)}
                    className="flex-1 py-2 border border-border text-[10px] font-display uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={state.activeRecruits.length >= cap || state.roster.length < 2}
                    onClick={() => handleOpenPick(p)}
                    className={cn(
                      'flex-1 py-2 font-display uppercase text-[10px] tracking-widest transition-all',
                      state.activeRecruits.length < cap && state.roster.length >= 2
                        ? 'bg-white text-black hover:bg-accent hover:text-white'
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                    )}
                  >
                    Add recruit
                  </button>
                </div>
              </motion.div>
            ))}
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
                    Choose two roster fighters. Their stats shape how fast this rookie improves.
                  </p>
                </div>
                <button type="button" onClick={() => setPickFor(null)} className="p-1 text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

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

              <button
                type="button"
                disabled={!canEnlist}
                onClick={handleConfirmEnlist}
                className={cn(
                  'w-full py-3 font-display uppercase text-xs tracking-widest transition-all',
                  canEnlist ? 'bg-accent text-white hover:bg-white hover:text-black' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                )}
              >
                Start 10-day camp
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
