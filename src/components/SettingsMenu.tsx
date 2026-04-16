import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, RefreshCw, Github, ExternalLink } from 'lucide-react';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
}

export default function SettingsMenu({ isOpen, onClose, onReset }: SettingsMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 border-t border-zinc-800 rounded-t-[32px] p-8 z-[101] space-y-8"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Settings</h2>
              <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <a 
                href="mailto:support@nightskygames.com?subject=Ring Master: Wrestling Tycoon Support"
                className="w-full flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-2xl border border-zinc-700 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">Support Email</p>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">support@nightskygames.com</p>
                  </div>
                </div>
                <ExternalLink size={16} className="text-zinc-600 group-hover:text-zinc-400" />
              </a>

              <button 
                onClick={onReset}
                className="w-full flex items-center justify-between p-4 bg-red-500/5 hover:bg-red-500/10 rounded-2xl border border-red-500/20 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-red-400 text-sm">Reset Progress</p>
                    <p className="text-[10px] text-red-500/60 uppercase font-bold">Delete all save data</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-4 text-center">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Ring Master v1.0.0</p>
              <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest mt-1">© 2026 Night Sky Games</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
