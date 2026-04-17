import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fighter } from '../types';
import { OPENING_DRAFT_PICKS, rollDistinctLowStatPair } from '../lib/draftRoster';
import { cn, fighterOverallRating } from '../lib/utils';

type OnboardingDraftOverlayProps = {
  onComplete: (roster: Fighter[]) => void;
};

const MENTOR = {
  name: 'Buck "The Mic" Malone',
  title: 'Retired ringside voice',
};

function Em({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-accent">{children}</span>;
}

/** Whole card + backgrounds tilt; each row counter-rotates its inner flex so type and art stay readable. */
const DRAFT_CARD_TILT_CLASS = '-rotate-[1.15deg]';
const DRAFT_ROW_COUNTER_TILT_CLASS = 'rotate-[1.15deg]';

export default function OnboardingDraftOverlay({ onComplete }: OnboardingDraftOverlayProps) {
  const [introDone, setIntroDone] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [picked, setPicked] = useState<Fighter[]>([]);
  const [pair, setPair] = useState<[Fighter, Fighter]>(() => rollDistinctLowStatPair('Face'));

  useEffect(() => {
    if (!introDone) return;
    const alignment = roundIndex === 0 ? 'Face' : roundIndex === 1 ? 'Heel' : 'either';
    setPair(rollDistinctLowStatPair(alignment));
  }, [introDone, roundIndex]);

  const pickNumber = introDone ? roundIndex + 1 : 0;

  const speech: ReactNode = !introDone ? (
    <>
      <span className="block">
        {
          "Kid, I've been around every locker room from Tijuana to Tokyo. You want fighters? I know fighters."
        }
      </span>
      <span className="mt-2 block">
        We got <Em>{OPENING_DRAFT_PICKS * 2}</Em> prospects on the board. You <Em>pick {OPENING_DRAFT_PICKS}</Em>.
      </span>
    </>
  ) : roundIndex === 0 ? (
    <>
      A <Em>face</Em> is the hero: plays fair, crowd is with them. Pick one.
    </>
  ) : roundIndex === 1 ? (
    <>
      A <Em>heel</Em> bends rules on purpose. Against a <Em>face</Em>, that tension sells tickets. Pick your <Em>heel</Em>.
    </>
  ) : (
    <>Pick one.</>
  );

  const handlePick = useCallback(
    (fighter: Fighter) => {
      const next = [...picked, fighter];
      if (next.length >= OPENING_DRAFT_PICKS) {
        onComplete(next);
        return;
      }
      setPicked(next);
      setRoundIndex((i) => i + 1);
    },
    [picked, onComplete],
  );

  return (
    <div className="absolute inset-0 z-[270] flex flex-col bg-[radial-gradient(circle_at_center,#1a1a1a_0%,#0d0d0d_100%)]">
      <div className="shrink-0 border-b border-border px-4 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-gold">Opening draft</p>
        <h1 className="mt-0.5 font-display text-base uppercase tracking-tight text-white">Build your first roster</h1>
        {introDone && (
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Signing {pickNumber} / {OPENING_DRAFT_PICKS}
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-visible px-3 pt-3 pb-2">
          {introDone && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`round-${roundIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex min-h-0 w-full flex-1 flex-col overflow-visible"
              >
                <div
                  className={cn(
                    'relative mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col origin-center',
                    DRAFT_CARD_TILT_CLASS,
                  )}
                >
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-y border-border bg-card shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                    <OnboardingHalfPick
                      fighter={pair[0]}
                      imageSide="left"
                      onSelect={() => handlePick(pair[0])}
                    />
                    <div
                      className="pointer-events-none relative z-10 h-3 w-full shrink-0 overflow-hidden bg-gradient-to-r from-zinc-950 via-card to-zinc-950"
                      aria-hidden
                    >
                      <div className="absolute left-1/2 top-1/2 h-px w-[122%] max-w-none -translate-x-1/2 -translate-y-1/2 -rotate-[2.25deg] bg-border" />
                    </div>
                    <OnboardingHalfPick fighter={pair[1]} imageSide="right" onSelect={() => handlePick(pair[1])} />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <div className="relative shrink-0 border-t border-border/60 bg-gradient-to-t from-bg from-40% via-bg/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
          <div className="relative w-full">
            <div className="pointer-events-none relative h-44 w-full overflow-visible">
              <img
                src="/wrestler.png"
                alt=""
                aria-hidden
                className="absolute bottom-2 left-0 z-0 h-[min(52vw,240px)] w-[min(52vw,240px)] max-w-none -translate-y-2 scale-[0.925] object-contain object-left object-bottom"
                width={240}
                height={240}
              />
            </div>

            <div className="relative z-10 mx-auto -mt-24 w-full max-w-sm space-y-3">
              <div className="relative rounded-xl border border-border bg-card/95 px-3 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                <div
                  className="absolute left-1/2 top-0 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-border bg-card/95"
                  aria-hidden
                />
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {MENTOR.name}
                  <span className="font-sans font-normal normal-case text-zinc-600"> · {MENTOR.title}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-200">{speech}</p>
              </div>

              {!introDone && (
                <motion.div
                  key="intro-cta"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => setIntroDone(true)}
                    className="w-full border border-accent bg-accent py-3 font-display text-sm uppercase tracking-tight text-white transition-colors hover:bg-white hover:text-black"
                  >
                    Start draft
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingHalfPick({
  fighter,
  imageSide,
  onSelect,
  className,
}: {
  fighter: Fighter;
  imageSide: 'left' | 'right';
  onSelect: () => void;
  className?: string;
}) {
  const ovr = fighterOverallRating(fighter.stats);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex min-h-0 flex-1 basis-0 overflow-hidden text-left transition-colors hover:brightness-[1.03] active:brightness-[0.98]',
        className,
      )}
    >
      {/* Tilts with the draft card (no counter-rotate); sits under the straightened row content. */}
      {imageSide === 'left' ? (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[48%] bg-gradient-to-br from-zinc-900 via-zinc-950 to-black/55"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-[48%] right-0 bg-gradient-to-tr from-zinc-950/95 via-zinc-900/40 to-zinc-950/80"
            aria-hidden
          />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-[48%] bg-gradient-to-bl from-zinc-950 via-zinc-900 to-black/55"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 right-[48%] bg-gradient-to-tl from-zinc-900/95 via-zinc-950/50 to-zinc-900/80"
            aria-hidden
          />
        </>
      )}
      <div
        className={cn(
          'relative z-10 flex h-full min-h-0 w-full min-w-[104%] max-w-none flex-row items-stretch justify-center self-center',
          DRAFT_ROW_COUNTER_TILT_CLASS,
          'origin-center',
          imageSide === 'right' && 'flex-row-reverse',
        )}
      >
        <div
          className={cn(
            'relative flex min-h-0 w-[min(48%,11.5rem)] shrink-0 items-end bg-transparent',
            imageSide === 'left' ? 'justify-start pl-1 pr-0.5' : 'justify-end pl-0.5 pr-1',
          )}
        >
          <img
            src={fighter.image}
            alt=""
            className={cn(
              'h-full max-h-full w-full max-w-none object-contain',
              imageSide === 'left' ? 'object-left object-bottom' : 'object-right object-bottom -scale-x-100',
            )}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 bg-transparent px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-balance font-display text-lg uppercase leading-tight tracking-tight text-white">
              {fighter.name}
            </h3>
            <span
              className={cn(
                'shrink-0 border px-1.5 py-0.5 text-[8px] font-display uppercase tracking-widest',
                fighter.alignment === 'Face' ? 'border-blue-400/40 text-blue-400' : 'border-accent/40 text-accent',
              )}
            >
              {fighter.alignment}
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{fighter.trait}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-bold uppercase tracking-tight text-zinc-400">
            <span>💥 PWR {fighter.stats.power}</span>
            <span>⚡ TEC {fighter.stats.technique}</span>
            <span>🛡️ END {fighter.stats.endurance}</span>
            <span>🎤 MIC {fighter.stats.mic}</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            OVR {ovr} · Pop {fighter.popularity}
          </p>
        </div>
      </div>
    </button>
  );
}
