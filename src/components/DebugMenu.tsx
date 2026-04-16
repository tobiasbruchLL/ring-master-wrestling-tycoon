import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, DollarSign, Trophy } from 'lucide-react';

interface DebugMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMoney: (amount: number) => void;
}

export default function DebugMenu({ isOpen, onClose, onAddMoney }: DebugMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200]"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-6 z-[201] space-y-6 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-yellow-500">
                <Zap size={20} fill="currentColor" />
                <h2 className="text-lg font-black uppercase italic tracking-tighter">Debug Menu</h2>
              </div>
              <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <DebugButton 
                onClick={() => onAddMoney(10000)} 
                icon={<DollarSign size={16} />} 
                label="Add $10,000" 
              />
              <DebugButton 
                onClick={() => onAddMoney(100000)} 
                icon={<DollarSign size={16} />} 
                label="Add $100,000" 
              />
              <DebugButton 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }} 
                icon={<Trophy size={16} />} 
                label="Hard Reset" 
              />
            </div>

            <p className="text-[10px] text-zinc-600 text-center font-bold uppercase tracking-widest">
              Authorized Personnel Only
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DebugButton({ onClick, icon, label }: { onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-all text-sm font-bold text-zinc-300"
    >
      <span className="text-yellow-500">{icon}</span>
      {label}
    </button>
  );
}
