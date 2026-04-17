import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Trophy, X } from 'lucide-react';
import { Fighter, FighterBookingDelta, Show, SimulatedMatchOutcomeDetail } from '../types';
import { cn, fighterOverallRating, formatNumber } from '../lib/utils';
import {
  buildMatchScoreCalculationSheet,
  popularityGainFromMatchScore,
  resolveMatchScore,
  type MatchScoreCalculationSheet,
} from '../lib/matchScoring';

interface MatchOutcomeModalProps {
  isOpen: boolean;
  outcome: SimulatedMatchOutcomeDetail | null;
  matchNumber: number;
  matchTotal: number;
  onContinue: () => void;
  /** When set, finish band + match score reflect the fight UI (winner's remaining HP). */
  winnerHpFromFight?: number | null;
  /** Used with `winnerHpFromFight` to recompute popularity lines when booking total exists. */
  fighterAFull?: Fighter | null;
  fighterBFull?: Fighter | null;
  /** When provided with `showHistory`, the score info sheet includes the pre-finish booking breakdown. */
  roster?: Fighter[];
  showHistory?: Show[];
}

function StatRangeRow({
  label,
  before,
  after,
  format,
}: {
  label: string;
  before: number;
  after: number;
  format: (n: number) => string;
}) {
  const beforeStr = format(before);
  const afterStr = format(after);
  const newTone =
    after > before ? 'text-green-400' : after < before ? 'text-red-400' : 'text-zinc-500';
  return (
    <div className="flex justify-between gap-3 text-[10px] font-bold uppercase tracking-widest">
      <span className="text-zinc-500">{label}</span>
      <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
        <span className="text-zinc-500">{beforeStr}</span>
        <span className="font-normal text-zinc-600">→</span>
        <span className={newTone}>{afterStr}</span>
      </span>
    </div>
  );
}

function FighterOutcomeHalf({
  name,
  image,
  isWinner,
  delta,
  placement,
}: {
  name: string;
  image: string;
  isWinner: boolean;
  delta: SimulatedMatchOutcomeDetail['deltaA'];
  placement: 'first' | 'second';
}) {
  const imageOnLeft = placement === 'first';

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden border-border bg-card">
      {imageOnLeft ? (
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
      <div className="relative z-20 flex shrink-0 flex-col items-center justify-center px-3 pt-3 pb-1 sm:pt-4 sm:pb-2">
        {isWinner ? (
          <p className="flex items-center gap-2.5 font-display text-2xl uppercase leading-none tracking-[0.12em] text-gold sm:text-3xl sm:tracking-[0.14em]">
            <Trophy className="size-7 shrink-0 sm:size-8" strokeWidth={1.75} />
            Winner
          </p>
        ) : (
          <p className="font-display text-2xl uppercase leading-none tracking-[0.12em] text-zinc-500 sm:text-3xl sm:tracking-[0.14em]">
            Loser
          </p>
        )}
      </div>
      <div
        className={cn(
          'relative z-10 flex min-h-0 flex-1 flex-row items-stretch px-1 pb-3 pt-1 sm:px-2 sm:pb-4 sm:pt-2',
          !imageOnLeft && 'flex-row-reverse',
        )}
      >
        <div
          className={cn(
            'relative flex min-h-0 w-[min(46%,min(42vw,15rem))] shrink-0 items-end justify-center sm:w-[min(46%,min(40vw,17rem))]',
            imageOnLeft ? 'justify-start pl-0.5 pr-0 sm:pl-1' : 'justify-end pl-0 pr-0.5 sm:pr-1',
          )}
        >
          <img
            src={image}
            alt=""
            className={cn(
              'max-h-[min(30vh,17rem)] w-full max-w-none min-h-[6rem] object-contain sm:max-h-[min(34vh,18rem)] sm:min-h-[7rem]',
              imageOnLeft ? 'object-left object-bottom' : 'object-right object-bottom -scale-x-100',
            )}
            referrerPolicy="no-referrer"
          />
        </div>
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col justify-center gap-2 px-2 py-1 sm:gap-2.5 sm:px-3',
            !imageOnLeft && 'items-end text-right',
          )}
        >
          <div className={cn('w-full', !imageOnLeft && 'flex flex-col items-end')}>
            <h3 className="text-balance font-display text-base uppercase leading-tight tracking-tight text-white sm:text-lg">
              {name}
            </h3>
          </div>
          <div
            className={cn(
              'w-full max-w-[14rem] space-y-1.5 border-t border-border pt-2 sm:max-w-none sm:pt-3',
              !imageOnLeft && 'ml-auto',
            )}
          >
            <StatRangeRow
              label="Popularity"
              before={delta.popularityBefore}
              after={delta.popularityAfter}
              format={(n) => String(Math.round(n))}
            />
            <StatRangeRow
              label="Energy"
              before={delta.energyBefore}
              after={delta.energyAfter}
              format={(n) => String(Math.round(n))}
            />
            {delta.injurySustained && (
              <p className="text-[9px] font-bold uppercase tracking-widest text-accent sm:text-[10px]">
                Injury — sidelined until fully rested
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchScoreInfoSheet({
  combinedOvr,
  combinedMic,
  finish,
  displayedMatchScore,
  onClose,
}: {
  combinedOvr: number | null;
  combinedMic: number | null;
  finish: MatchScoreCalculationSheet['finish'];
  displayedMatchScore: number;
  onClose: () => void;
}) {
  const finishLine = finish.finishMultipliers[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-labelledby="match-score-info-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[165] flex flex-col justify-end bg-black/65 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="mx-auto w-full max-w-sm rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <h3
            id="match-score-info-title"
            className="text-left font-display text-sm uppercase leading-tight tracking-wide text-white"
          >
            Match score
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded border border-border p-1.5 text-zinc-400 transition-colors hover:border-accent hover:text-white"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4 text-left">
          <div className="flex justify-between gap-6 text-xs text-zinc-300">
            <span className="text-zinc-500">Combined rating (OVR)</span>
            <span className="shrink-0 tabular-nums text-white">
              {combinedOvr != null ? `+${formatNumber(combinedOvr)}` : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-6 text-xs text-zinc-300">
            <span className="text-zinc-500">Combined MIC</span>
            <span className="shrink-0 tabular-nums text-white">
              {combinedMic != null ? `+${formatNumber(combinedMic)}` : '—'}
            </span>
          </div>
          {finishLine && (
            <div className="flex justify-between gap-6 text-xs text-zinc-300">
              <span className="text-zinc-500">{finishLine.label}</span>
              <span className="shrink-0 tabular-nums text-white">×{finishLine.value}</span>
            </div>
          )}
          <div className="flex justify-between gap-6 border-t border-border pt-3 text-xs font-bold uppercase tracking-wide text-gold">
            <span>Match Score</span>
            <span className="tabular-nums">{formatNumber(Math.round(displayedMatchScore))}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function MatchOutcomeModal({
  isOpen,
  outcome,
  matchNumber,
  matchTotal,
  onContinue,
  winnerHpFromFight,
  fighterAFull,
  fighterBFull,
  roster,
  showHistory,
}: MatchOutcomeModalProps) {
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);
  const winnerId = outcome?.match.winnerId;
  const matchupTotal = outcome?.match.matchupTotalScore;
  const rolledHp = outcome?.match.winnerHpPercent;
  const effectiveHp =
    typeof winnerHpFromFight === 'number' && Number.isFinite(winnerHpFromFight)
      ? Math.max(1, Math.min(100, Math.round(winnerHpFromFight)))
      : typeof rolledHp === 'number'
        ? rolledHp
        : undefined;

  const matchScore =
    typeof effectiveHp === 'number' &&
    typeof matchupTotal === 'number' &&
    Number.isFinite(matchupTotal)
      ? resolveMatchScore(matchupTotal, effectiveHp)
      : (outcome?.match.matchScore ?? 0);

  const scoreSheet =
    outcome?.match &&
    typeof matchupTotal === 'number' &&
    Number.isFinite(matchupTotal) &&
    typeof effectiveHp === 'number'
      ? buildMatchScoreCalculationSheet({
          match: outcome.match,
          matchupTotal,
          winnerHpPercent: effectiveHp,
          roster,
          history: showHistory,
        })
      : null;

  const matchFighterA =
    fighterAFull ??
    (roster && outcome?.match ? roster.find((f) => f.id === outcome.match.fighterAId) : undefined);
  const matchFighterB =
    fighterBFull ??
    (roster && outcome?.match ? roster.find((f) => f.id === outcome.match.fighterBId) : undefined);

  const useFightDeltas =
    typeof winnerHpFromFight === 'number' &&
    Number.isFinite(winnerHpFromFight) &&
    typeof matchupTotal === 'number' &&
    Number.isFinite(matchupTotal) &&
    fighterAFull &&
    fighterBFull &&
    winnerId;

  const deltaA: FighterBookingDelta | undefined = outcome?.deltaA;
  const deltaB: FighterBookingDelta | undefined = outcome?.deltaB;
  const displayDeltaA =
    useFightDeltas && deltaA
      ? (() => {
          const popularity = popularityGainFromMatchScore(
            matchScore,
            fighterAFull,
            winnerId === fighterAFull.id,
          );
          return {
            ...deltaA,
            popularity,
            popularityAfter: deltaA.popularityBefore + popularity,
          };
        })()
      : deltaA;
  const displayDeltaB =
    useFightDeltas && deltaB
      ? (() => {
          const popularity = popularityGainFromMatchScore(
            matchScore,
            fighterBFull,
            winnerId === fighterBFull.id,
          );
          return {
            ...deltaB,
            popularity,
            popularityAfter: deltaB.popularityBefore + popularity,
          };
        })()
      : deltaB;

  useEffect(() => {
    if (!isOpen) setScoreInfoOpen(false);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && outcome && displayDeltaA && displayDeltaB && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[161] flex flex-col bg-[radial-gradient(circle_at_center,#1a1a1a_0%,#0d0d0d_100%)]"
        >
          <AnimatePresence>
            {scoreInfoOpen && scoreSheet && (
              <MatchScoreInfoSheet
                combinedOvr={
                  scoreSheet.preFinishBreakdown?.matchupBaseBeforeMultipliers ??
                  (matchFighterA && matchFighterB
                    ? fighterOverallRating(matchFighterA.stats) +
                      fighterOverallRating(matchFighterB.stats)
                    : null)
                }
                combinedMic={
                  matchFighterA && matchFighterB
                    ? matchFighterA.stats.mic + matchFighterB.stats.mic
                    : null
                }
                finish={scoreSheet.finish}
                displayedMatchScore={matchScore}
                onClose={() => setScoreInfoOpen(false)}
              />
            )}
          </AnimatePresence>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pt-[max(0.75rem,env(safe-area-inset-top))]">
            <FighterOutcomeHalf
              name={outcome.fighterA.name}
              image={outcome.fighterA.image}
              isWinner={winnerId === outcome.fighterA.id}
              delta={displayDeltaA}
              placement="first"
            />
            <div
              className="pointer-events-none relative z-20 h-3 w-full shrink-0 overflow-hidden bg-gradient-to-r from-zinc-950 via-card to-zinc-950"
              aria-hidden
            >
              <div className="absolute left-1/2 top-1/2 h-px w-[122%] max-w-none -translate-x-1/2 -translate-y-1/2 -rotate-[2.25deg] bg-border" />
            </div>
            <FighterOutcomeHalf
              name={outcome.fighterB.name}
              image={outcome.fighterB.image}
              isWinner={winnerId === outcome.fighterB.id}
              delta={displayDeltaB}
              placement="second"
            />
          </div>

          <div className="shrink-0 border-t border-border bg-card/40 backdrop-blur-sm">
            <div className="border-b border-border px-4 py-3 text-center">
              <p className="font-display text-[10px] uppercase tracking-[0.2em] text-gold sm:text-[11px]">
                Match {matchNumber} of {matchTotal}
              </p>
              <h2 className="mt-1 font-display text-2xl uppercase leading-none text-white sm:text-3xl">Match Result</h2>
              <div className="mt-2 flex items-center justify-center gap-1.5 sm:gap-2">
                <p className="font-display text-4xl tabular-nums text-gold sm:text-5xl">
                  {formatNumber(Math.round(matchScore))}
                </p>
                {scoreSheet && (
                  <button
                    type="button"
                    onClick={() => setScoreInfoOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={scoreInfoOpen}
                    aria-label="How this match score is calculated"
                    className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-zinc-400 transition-colors hover:border-gold hover:text-gold sm:size-10"
                  >
                    <Info className="size-[1.125rem] sm:size-5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Match score</p>
            </div>
            <div className="px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onContinue}
                className="w-full bg-white py-4 font-display uppercase tracking-tighter text-black transition-all hover:bg-accent hover:text-white"
              >
                {matchNumber < matchTotal ? 'Next match' : 'Finish event'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
