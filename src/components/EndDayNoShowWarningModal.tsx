import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

type EndDayNoShowWarningModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dontShowAgain: boolean) => void;
};

export default function EndDayNoShowWarningModal({ isOpen, onClose, onConfirm }: EndDayNoShowWarningModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) setDontShowAgain(false);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[140] bg-black/95 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed left-1/2 top-1/2 z-[141] w-full max-w-xs -translate-x-1/2 -translate-y-1/2 space-y-6 border-4 border-accent bg-bg p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg uppercase leading-tight tracking-tight text-white">
                End day without a show?
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-card hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-zinc-400">
              If you end today without booking a show, your promotion popularity drops by{' '}
              <span className="font-bold text-accent">10%</span>. The same penalty applies every day you end
              without a card on the schedule.
            </p>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className={cn(
                  'mt-0.5 size-4 shrink-0 rounded border border-border bg-zinc-900',
                  'accent-accent checked:border-accent',
                )}
              />
              <span>Do not show this warning again</span>
            </label>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => onConfirm(dontShowAgain)}
                className="w-full border border-accent bg-accent py-3 font-display text-sm uppercase tracking-tighter text-white transition-colors hover:bg-accent/90"
              >
                End day anyway
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full border border-border py-3 font-display text-sm uppercase tracking-tighter text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-card hover:text-white"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
