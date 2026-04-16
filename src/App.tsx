import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Building2, 
  Settings as SettingsIcon,
  DollarSign,
  Star
} from 'lucide-react';
import { useGameState } from './hooks/useGameState';
import { cn, formatNumber } from './lib/utils';

// Components
import Dashboard from './features/Dashboard';
import Roster from './features/Roster';
import Facilities from './features/Facilities';
import ShowPlanner from './features/ShowPlanner';
import MatchSimulation from './features/MatchSimulation';
import SettingsMenu from './components/SettingsMenu';
import DebugMenu from './components/DebugMenu';
import ShowResultModal from './components/ShowResultModal';
import { Match } from './types';

type View = 'dashboard' | 'roster' | 'facilities' | 'planner' | 'simulating';

export default function App() {
  const { 
    state, 
    hireFighter, 
    fireFighter, 
    upgradeFacility, 
    runShow, 
    generateRandomFighter,
    resetGame,
    addMoney,
    calculateMatchScore
  } = useGameState();

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [tapCount, setTapCount] = useState(0);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [pendingVenueId, setPendingVenueId] = useState<string>('');

  // Debug menu trigger
  const handleDebugTap = () => {
    setTapCount(prev => prev + 1);
    setTimeout(() => setTapCount(0), 2000);
    if (tapCount >= 9) {
      setIsDebugOpen(true);
      setTapCount(0);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard state={state} onPlanShow={() => setCurrentView('planner')} />;
      case 'roster':
        return <Roster state={state} onHire={hireFighter} onFire={fireFighter} generateFighter={generateRandomFighter} />;
      case 'facilities':
        return <Facilities state={state} onUpgrade={upgradeFacility} />;
      case 'planner':
        return <ShowPlanner 
          state={state} 
          calculateMatchScore={calculateMatchScore}
          onRunShow={(matches, venueId) => {
            setPendingMatches(matches);
            setPendingVenueId(venueId);
            setCurrentView('simulating');
          }} 
          onCancel={() => setCurrentView('dashboard')} 
        />;
      case 'simulating':
        return <MatchSimulation 
          matches={pendingMatches} 
          roster={state.roster} 
          onComplete={() => {
            runShow(pendingMatches, pendingVenueId);
            setCurrentView('dashboard');
            setShowResult(true);
          }} 
        />;
      default:
        return <Dashboard state={state} onPlanShow={() => setCurrentView('planner')} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-accent selection:text-white flex justify-center">
      {/* Mobile-style Portrait Container */}
      <div className="w-full max-w-md bg-bg shadow-2xl relative flex flex-col overflow-hidden border-x border-border">
        
        {/* Header */}
        <header className="p-6 border-b-4 border-accent flex justify-between items-center bg-bg sticky top-0 z-40">
          <div className="flex flex-col cursor-pointer" onClick={handleDebugTap}>
            <h1 className="text-2xl font-display text-white leading-none">
              Iron Grip <span className="text-accent">Manager</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 text-white font-display text-lg">
                <span className="text-accent">$</span>
                <span>{formatNumber(state.money)}</span>
              </div>
              <div className="flex items-center gap-1 text-gold text-[10px] font-display">
                <span>★</span>
                <span>{state.popularity}</span>
              </div>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1 hover:bg-card rounded transition-colors"
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-24 bg-[radial-gradient(circle_at_center,#1a1a1a_0%,#0d0d0d_100%)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 h-20 bg-card border-t border-border flex items-center justify-around px-2 z-40">
          <NavButton 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
            icon={<Trophy size={20} />} 
            label="Home" 
          />
          <NavButton 
            active={currentView === 'roster'} 
            onClick={() => setCurrentView('roster')} 
            icon={<Users size={20} />} 
            label="Roster" 
          />
          <NavButton 
            active={currentView === 'facilities'} 
            onClick={() => setCurrentView('facilities')} 
            icon={<Building2 size={20} />} 
            label="Upgrades" 
          />
        </nav>

        {/* Modals & Menus */}
        <SettingsMenu 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          onReset={resetGame}
        />
        <DebugMenu 
          isOpen={isDebugOpen} 
          onClose={() => setIsDebugOpen(false)} 
          onAddMoney={addMoney}
        />
        {state.lastShowResult && (
          <ShowResultModal 
            isOpen={showResult} 
            onClose={() => setShowResult(false)} 
            show={state.lastShowResult} 
          />
        )}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
        active ? "text-yellow-500 bg-yellow-500/10" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
