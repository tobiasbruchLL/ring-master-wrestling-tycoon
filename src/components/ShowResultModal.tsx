import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Users, DollarSign, TrendingUp } from 'lucide-react';
import { Show } from '../types';
import { formatCurrency, formatNumber, cn } from '../lib/utils';

interface ShowResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  show: Show;
}

export default function ShowResultModal({ isOpen, onClose, show }: ShowResultModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[150]"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xs bg-bg border-4 border-accent p-8 z-[151] space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-14 font-display uppercase tracking-[4px] text-gold">Show Result</h2>
              <h3 className="text-4xl font-display uppercase leading-none text-white">{show.name}</h3>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Revenue</p>
                  <p className="text-xl font-display text-white">{formatCurrency(show.revenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Score</p>
                  <p className="text-xl font-display text-gold">{Math.round(show.rating * 80)}</p>
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

              <div className="flex justify-between items-center bg-card p-4 border border-border">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Net Profit</p>
                  <p className={cn(
                    "text-3xl font-display",
                    (show.revenue - (show.venueCost + show.setupCost)) >= 0 ? "text-green-500" : "text-accent"
                  )}>
                    {formatCurrency(show.revenue - (show.venueCost + show.setupCost))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Popularity</p>
                  <p className="text-lg font-display text-accent">+{show.popularityGain}</p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Attendance</p>
                <p className="text-lg font-display text-white">{formatNumber(show.attendance)}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-white hover:bg-accent hover:text-white text-black font-display py-4 uppercase tracking-tighter transition-all"
            >
              Continue
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
