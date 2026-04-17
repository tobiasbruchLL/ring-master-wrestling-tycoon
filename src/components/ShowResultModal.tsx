import { motion, AnimatePresence } from 'motion/react';
import { Show } from '../types';
import { formatCurrency, formatNumber, cn } from '../lib/utils';

interface ShowResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  show: Show;
}

export default function ShowResultModal({ isOpen, onClose, show }: ShowResultModalProps) {
  const showScore =
    show.averageMatchScore !== undefined
      ? Math.round(show.averageMatchScore)
      : Math.max(0, Math.round((show.rating - 1.4) * 120));
  const expectedScore =
    show.expectedAverageMatchScore !== undefined
      ? Math.round(show.expectedAverageMatchScore)
      : null;
  const popDelta = show.popularityGain;
  const popLabel = (() => {
    if (popDelta === 0) return '±0';
    const legacyWholeTier = Number.isInteger(popDelta) && Math.abs(popDelta) >= 1;
    if (legacyWholeTier) {
      return popDelta > 0 ? `+${popDelta}` : `−${Math.abs(popDelta)}`;
    }
    return `${popDelta > 0 ? '+' : '−'}${Math.round(Math.abs(popDelta) * 100)}%`;
  })();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal
          aria-labelledby="show-result-title"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="absolute inset-0 z-[150] flex min-h-0 flex-col bg-[radial-gradient(circle_at_center,#1a1a1a_0%,#0d0d0d_100%)]"
        >
          <header className="shrink-0 border-b-4 border-accent px-6 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
            <p id="show-result-title" className="text-14 font-display uppercase tracking-[4px] text-gold">
              Show Result
            </p>
            <h2 className="mt-2 text-4xl font-display uppercase leading-none text-white">{show.name}</h2>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex w-full max-w-sm flex-col space-y-8">
              <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ticket sales</p>
                  <p className="text-xl font-display text-white tabular-nums">
                    {formatNumber(show.ticketsSoldTotal ?? 0)}
                  </p>
                  {show.revenue > 0 && (
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500 tabular-nums">
                      {formatCurrency(show.revenue)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Score</p>
                  <p className="text-xl font-display text-gold">{showScore}</p>
                  {expectedScore !== null && (
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                      Expected {expectedScore}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Venue Cost</p>
                  <p className="text-sm font-display text-zinc-400">{formatCurrency(show.venueCost)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Setup Cost</p>
                  <p className="text-sm font-display text-zinc-400">{formatCurrency(show.setupCost)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border border-border bg-card p-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Net Profit</p>
                  <p
                    className={cn(
                      'text-3xl font-display',
                      show.revenue - (show.venueCost + show.setupCost) >= 0 ? 'text-green-500' : 'text-accent',
                    )}
                  >
                    {formatCurrency(show.revenue - (show.venueCost + show.setupCost))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Popularity</p>
                  <p
                    className={cn(
                      'text-lg font-display tabular-nums',
                      popDelta > 0 && 'text-green-500',
                      popDelta < 0 && 'text-accent',
                      popDelta === 0 && 'text-zinc-400',
                    )}
                  >
                    {popLabel}
                  </p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Attendance</p>
                <p className="text-lg font-display text-white">{formatNumber(show.attendance)}</p>
              </div>
            </div>
          </div>

          <footer className="shrink-0 border-t border-border bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-white py-4 font-display uppercase tracking-tighter text-black transition-all hover:bg-accent hover:text-white"
            >
              Continue
            </button>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
