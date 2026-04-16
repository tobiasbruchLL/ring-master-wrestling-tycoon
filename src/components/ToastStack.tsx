import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { InjuryRecoveryNotice } from '../types';
import { cn } from '../lib/utils';

const FRONT_MS = 2000;
/** Each toast behind the front sits this many pixels further up (partly off-screen). */
const STACK_STEP_PX = 40;

type ToastItem =
  | { toastId: string; type: 'message'; text: string }
  | { toastId: string; type: 'recovery'; fighterName: string };

export function useToastStack() {
  const [queue, setQueue] = useState<ToastItem[]>([]);

  const enqueueMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQueue((q) => [...q, { toastId: `msg-${crypto.randomUUID()}`, type: 'message', text: trimmed }]);
  }, []);

  const enqueueInjuryRecoveries = useCallback((notices: InjuryRecoveryNotice[]) => {
    if (!notices.length) return;
    setQueue((q) => [
      ...q,
      ...notices.map((n) => ({
        toastId: `rec-${n.fighterId}-${crypto.randomUUID()}`,
        type: 'recovery' as const,
        fighterName: n.name,
      })),
    ]);
  }, []);

  const frontToastId = queue[0]?.toastId;
  useEffect(() => {
    if (!frontToastId) return;
    const t = window.setTimeout(() => {
      setQueue((q) => q.slice(1));
    }, FRONT_MS);
    return () => window.clearTimeout(t);
  }, [frontToastId]);

  const dismissById = useCallback((toastId: string) => {
    setQueue((q) => q.filter((x) => x.toastId !== toastId));
  }, []);

  const stack =
    queue.length === 0 ? null : (
      <div
        className="pointer-events-none absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-[52] flex justify-center"
        aria-live="polite"
      >
        <div className="relative min-h-[4.25rem] w-full max-w-sm">
          {queue.map((item, depth) => {
            const isFront = depth === 0;
            const yUp = -depth * STACK_STEP_PX;
            const label =
              item.type === 'recovery'
                ? `${item.fighterName} recovery notification`
                : 'Notification';

            return (
              <motion.div
                key={item.toastId}
                layout
                role={isFront ? 'status' : undefined}
                initial={isFront ? { opacity: 0, y: yUp - 8, scale: 0.98 } : false}
                animate={{
                  opacity: isFront ? 1 : Math.max(0.45, 0.9 - depth * 0.14),
                  y: yUp,
                  scale: 1 - depth * 0.024,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                style={{ zIndex: 20 - depth }}
                className={cn(
                  'absolute left-0 right-0 top-0 origin-top',
                  'rounded-xl border border-border bg-card py-3 pl-3 pr-10 shadow-lg',
                  'pointer-events-auto',
                )}
              >
                {item.type === 'recovery' ? (
                  <p className="text-left text-xs font-bold uppercase leading-snug tracking-wide text-zinc-200">
                    <span className="text-accent">{item.fighterName}</span>
                    <span className="font-sans font-semibold normal-case tracking-normal text-zinc-400">
                      {' '}
                      is fully recovered from injury.
                    </span>
                  </p>
                ) : (
                  <p className="text-left text-xs font-bold uppercase leading-snug tracking-wide text-zinc-200">
                    {item.text}
                  </p>
                )}
                <button
                  type="button"
                  aria-label={`Dismiss ${label}`}
                  onClick={() => dismissById(item.toastId)}
                  className={cn(
                    'absolute right-1.5 rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200',
                    depth > 0 ? 'bottom-1.5' : 'top-1.5',
                  )}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    );

  return { enqueueMessage, enqueueInjuryRecoveries, stack };
}
