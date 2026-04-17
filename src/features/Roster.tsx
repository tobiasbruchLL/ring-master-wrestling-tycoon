import { Fragment, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users } from 'lucide-react';
import { GameState, Fighter } from '../types';
import { cn, fighterOverallRating } from '../lib/utils';
import { getMaxRosterSize } from '../lib/rosterCapacity';
import WrestlerDetailModal from '../components/WrestlerDetailModal';

interface RosterProps {
  state: GameState;
  onFire: (id: string) => void;
}

export default function Roster({ state, onFire }: RosterProps) {
  const [detailFighter, setDetailFighter] = useState<Fighter | null>(null);
  const [releaseConfirm, setReleaseConfirm] = useState<Fighter | null>(null);

  useEffect(() => {
    setDetailFighter((prev) => {
      if (!prev) return prev;
      const onRoster = state.roster.some((f) => f.id === prev.id);
      if (!onRoster) return prev;
      const fresh = state.roster.find((f) => f.id === prev.id);
      return fresh ?? null;
    });
    setReleaseConfirm((prev) => {
      if (!prev) return prev;
      const onRoster = state.roster.some((f) => f.id === prev.id);
      if (!onRoster) return null;
      const fresh = state.roster.find((f) => f.id === prev.id);
      return fresh ?? null;
    });
  }, [state.roster]);

  const maxRoster = getMaxRosterSize(state);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="shrink-0 border-b border-border px-6 py-3">
        <p className="text-[10px] font-display uppercase tracking-[3px] text-zinc-500">Active roster</p>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          {state.roster.length} / {maxRoster} fighters
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
        {state.roster.length > 0 ? (
          state.roster.map((fighter) => (
            <FighterCard key={fighter.id} fighter={fighter} onSelect={() => setDetailFighter(fighter)} />
          ))
        ) : (
          <div className="flex h-64 flex-col items-center justify-center space-y-2 text-zinc-700">
            <Users size={48} strokeWidth={1} />
            <p className="font-display text-xs uppercase tracking-widest">No fighters</p>
          </div>
        )}
      </div>

      <WrestlerDetailModal
        isOpen={detailFighter !== null}
        fighter={detailFighter}
        onClose={() => setDetailFighter(null)}
        onRequestRelease={() => {
          if (!detailFighter) return;
          setReleaseConfirm(detailFighter);
          setDetailFighter(null);
        }}
      />

      <AnimatePresence>
        {releaseConfirm && (
          <Fragment key={releaseConfirm.id}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReleaseConfirm(null)}
              className="fixed inset-0 z-[160] bg-black/95 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="release-confirm-title"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="fixed left-1/2 top-1/2 z-[161] w-full max-w-xs -translate-x-1/2 -translate-y-1/2 border-4 border-accent bg-bg p-6 shadow-2xl"
            >
              <p
                id="release-confirm-title"
                className="text-center font-display text-xl uppercase leading-tight text-white"
              >
                Release {releaseConfirm.name}?
              </p>
              <p className="mt-3 text-center text-[11px] text-zinc-500">
                They leave your roster for good.
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setReleaseConfirm(null)}
                  className="flex-1 border border-border bg-card py-3 font-display text-xs uppercase tracking-tighter text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onFire(releaseConfirm.id);
                    setReleaseConfirm(null);
                  }}
                  className="flex-1 bg-accent py-3 font-display text-xs uppercase tracking-tighter text-white transition-colors hover:brightness-110"
                >
                  Release
                </button>
              </div>
            </motion.div>
          </Fragment>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FighterCardProps {
  fighter: Fighter;
  onSelect?: () => void;
  key?: string | number;
}

function FighterCard({ fighter, onSelect }: FighterCardProps) {
  const ovr = fighterOverallRating(fighter.stats);
  const recovering = fighter.recoveringFromInjury;
  const body = (
    <>
      <div className="shrink-0">
        <img 
          src={fighter.image} 
          alt={fighter.name} 
          className="h-24 w-24 rounded-none object-contain"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-display text-white uppercase text-lg leading-tight truncate">{fighter.name}</h4>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-[8px] font-display uppercase tracking-widest px-1.5 py-0.5 border shrink-0',
              fighter.alignment === 'Face'
                ? 'text-blue-400 border-blue-400/30'
                : 'text-accent border-accent/30',
            )}
          >
            {fighter.alignment}
          </span>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{fighter.trait}</p>
        </div>
        
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-500 uppercase mt-2">
            <span>OVR {ovr}</span>
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
          className="flex flex-1 min-w-0 gap-4 items-center text-left hover:bg-white/[0.04] active:bg-white/[0.07] -m-4 p-4 transition-colors"
        >
          {body}
        </button>
      ) : (
        <div className="flex flex-1 min-w-0 gap-4 items-center">
          {body}
        </div>
      )}
    </motion.div>
  );
}
