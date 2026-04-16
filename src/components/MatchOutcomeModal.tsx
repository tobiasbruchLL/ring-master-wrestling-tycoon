import { motion, AnimatePresence } from 'motion/react';
import { Star, Trophy } from 'lucide-react';
import { SimulatedMatchOutcomeDetail } from '../types';
import { cn } from '../lib/utils';

interface MatchOutcomeModalProps {
  isOpen: boolean;
  outcome: SimulatedMatchOutcomeDetail | null;
  matchNumber: number;
  matchTotal: number;
  onContinue: () => void;
}

function formatDelta(value: number, suffix = ''): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : Math.round(value * 10) / 10;
  if (rounded === 0) return `0${suffix}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${rounded}${suffix}`;
}

function DeltaRow({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0;
  return (
    <div className="flex justify-between gap-3 text-[10px] font-bold uppercase tracking-widest">
      <span className="text-zinc-500">{label}</span>
      <span className={cn('tabular-nums', good ? 'text-green-400' : 'text-accent')}>{formatDelta(value)}</span>
    </div>
  );
}

function FighterOutcomeCard({
  name,
  image,
  isWinner,
  delta,
}: {
  name: string;
  image: string;
  isWinner: boolean;
  delta: SimulatedMatchOutcomeDetail['deltaA'];
}) {
  return (
    <div className="border border-border bg-card/80 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <img src={image} alt="" className="h-14 w-14 shrink-0 border border-border object-contain" referrerPolicy="no-referrer" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm uppercase text-white">{name}</p>
          {isWinner && (
            <p className="mt-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-gold">
              <Trophy size={12} className="shrink-0" />
              Winner
            </p>
          )}
        </div>
      </div>
      <div className="space-y-1.5 border-t border-border pt-3">
        <DeltaRow label="Popularity" value={delta.popularity} />
        <DeltaRow label="Energy" value={delta.energy} invert />
        {delta.injurySustained && (
          <p className="text-[9px] font-bold uppercase tracking-widest text-accent">Injury — sidelined until fully rested</p>
        )}
      </div>
    </div>
  );
}

export default function MatchOutcomeModal({
  isOpen,
  outcome,
  matchNumber,
  matchTotal,
  onContinue,
}: MatchOutcomeModalProps) {
  const rating = outcome?.match.rating ?? 0;
  const fullStars = Math.round(rating);
  const winnerId = outcome?.match.winnerId;

  return (
    <AnimatePresence>
      {isOpen && outcome && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/95 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            className="fixed left-1/2 top-1/2 z-[161] w-full max-w-xs -translate-x-1/2 -translate-y-1/2 border-4 border-accent bg-bg p-6 shadow-2xl"
          >
            <div className="mb-6 space-y-2 text-center">
              <p className="text-[10px] font-display uppercase tracking-[3px] text-gold">
                Match {matchNumber} of {matchTotal}
              </p>
              <h2 className="font-display text-2xl uppercase leading-none text-white">Match Result</h2>
              <div className="flex items-center justify-center gap-1 pt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={22}
                    className={cn(i < fullStars ? 'fill-gold text-gold' : 'text-zinc-700')}
                    strokeWidth={i < fullStars ? 0 : 1.5}
                  />
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Match rating <span className="text-white">{rating.toFixed(1)}</span> / 5
              </p>
            </div>

            <div className="max-h-[min(52vh,22rem)] space-y-4 overflow-y-auto pr-1">
              <FighterOutcomeCard
                name={outcome.fighterA.name}
                image={outcome.fighterA.image}
                isWinner={winnerId === outcome.fighterA.id}
                delta={outcome.deltaA}
              />
              <FighterOutcomeCard
                name={outcome.fighterB.name}
                image={outcome.fighterB.image}
                isWinner={winnerId === outcome.fighterB.id}
                delta={outcome.deltaB}
              />
            </div>

            <button
              type="button"
              onClick={onContinue}
              className="mt-6 w-full bg-white py-4 font-display uppercase tracking-tighter text-black transition-all hover:bg-accent hover:text-white"
            >
              {matchNumber < matchTotal ? 'Next match' : 'Finish event'}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
