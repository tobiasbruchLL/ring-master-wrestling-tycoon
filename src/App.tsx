import { useEffect, useRef, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Building2, Settings as SettingsIcon, UserPlus } from 'lucide-react';
import { useGameState } from './hooks/useGameState';
import { cn, formatNumber } from './lib/utils';
import { getPromotionPopularityBar } from './lib/promotionPopularity';

// Components
import Dashboard from './features/Dashboard';
import Roster from './features/Roster';
import Facilities from './features/Facilities';
import Recruiting from './features/Recruiting';
import ShowPlanner from './features/ShowPlanner';
import MatchSimulation from './features/MatchSimulation';
import SettingsMenu from './components/SettingsMenu';
import DebugMenu from './components/DebugMenu';
import ShowResultModal from './components/ShowResultModal';
import RecruitTrainingModal from './components/RecruitTrainingModal';
import { Match, ShowSimulationResult, hasPendingRecruitTraining, getRecruitSlotCap } from './types';

type View = 'dashboard' | 'roster' | 'facilities' | 'recruiting' | 'planner' | 'simulating';

export default function App() {
  const {
    state,
    hireFighter,
    fireFighter,
    upgradeFacility,
    simulateShow,
    commitSimulatedShow,
    generateRandomFighter,
    resetGame,
    addMoney,
    calculateMatchScore,
    dismissRecruitProspect,
    enlistRecruit,
    submitRecruitTrainingChoices,
  } = useGameState();

  const recruitCap = getRecruitSlotCap(state);
  const pendingTrainingRecruits = state.activeRecruits.filter((r) => r.needsTrainingChoice);
  const popularityBar = getPromotionPopularityBar(state.popularity);

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [recruitTrainingOpen, setRecruitTrainingOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [pendingShowSimulation, setPendingShowSimulation] = useState<ShowSimulationResult | null>(null);
  const bootstrappedTrainingRef = useRef(false);
  const prevShowResultOpenRef = useRef(showResult);
  const toastDismissTimerRef = useRef<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (bootstrappedTrainingRef.current) return;
    bootstrappedTrainingRef.current = true;
    if (hasPendingRecruitTraining(state)) setRecruitTrainingOpen(true);
  }, []);

  useEffect(() => {
    if (prevShowResultOpenRef.current && !showResult && hasPendingRecruitTraining(state)) {
      setRecruitTrainingOpen(true);
    }
    prevShowResultOpenRef.current = showResult;
  }, [showResult, state]);

  useEffect(() => {
    if (currentView === 'recruiting' && recruitCap <= 0) {
      setCurrentView('dashboard');
    }
  }, [currentView, recruitCap]);

  useEffect(() => {
    return () => {
      if (toastDismissTimerRef.current !== null) {
        window.clearTimeout(toastDismissTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    if (toastDismissTimerRef.current !== null) {
      window.clearTimeout(toastDismissTimerRef.current);
    }
    setToastMessage(message);
    toastDismissTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastDismissTimerRef.current = null;
    }, 3600);
  };

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
      case 'recruiting':
        return (
          <Recruiting
            state={state}
            onDismissProspect={dismissRecruitProspect}
            onEnlist={enlistRecruit}
          />
        );
      case 'planner':
        return <ShowPlanner 
          state={state} 
          calculateMatchScore={calculateMatchScore}
          onRunShow={(matches, venueId) => {
            setPendingMatches(matches);
            setPendingShowSimulation(simulateShow(matches, venueId));
            setCurrentView('simulating');
          }} 
          onCancel={() => setCurrentView('dashboard')} 
        />;
      case 'simulating':
        return pendingShowSimulation ? (
          <MatchSimulation
            matches={pendingMatches}
            roster={state.roster}
            perMatchOutcomes={pendingShowSimulation.perMatchOutcomes}
            onComplete={() => {
              commitSimulatedShow(pendingShowSimulation);
              setPendingShowSimulation(null);
              setCurrentView('dashboard');
              setShowResult(true);
            }}
          />
        ) : null;
      default:
        return <Dashboard state={state} onPlanShow={() => setCurrentView('planner')} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-accent selection:text-white flex justify-center">
      {/* Mobile-style Portrait Container */}
      <div className="relative flex h-dvh max-h-dvh min-h-0 w-full max-w-md flex-col overflow-hidden border-x border-border bg-bg shadow-2xl">
        
        {/* Header */}
        <header
          className="p-6 border-b-4 border-accent flex justify-end items-center bg-bg sticky top-0 z-40"
          onClick={handleDebugTap}
        >
          <div
            className="flex items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1 text-white font-display text-lg">
                <span className="text-accent">$</span>
                <span>{formatNumber(state.money)}</span>
              </div>
              <div className="flex w-[min(11rem,52vw)] flex-col items-end gap-1">
                <div className="flex w-full items-center justify-between gap-2 text-[10px] font-bold font-display uppercase tracking-widest text-zinc-500">
                  <span>Popularity</span>
                  <span className="text-gold tabular-nums">{state.popularity}</span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
                  title={
                    popularityBar.segmentHigh >= 100
                      ? `Reputation ${state.popularity} (max segment)`
                      : `Progress toward ${popularityBar.segmentHigh} popularity`
                  }
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-700 to-gold transition-[width] duration-500 ease-out"
                    style={{ width: `${popularityBar.fillPercent}%` }}
                  />
                </div>
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
        <main
          className={cn(
            'flex-1 bg-[radial-gradient(circle_at_center,#1a1a1a_0%,#0d0d0d_100%)]',
            currentView === 'planner' ||
              currentView === 'simulating' ||
              currentView === 'roster' ||
              currentView === 'recruiting'
              ? 'flex min-h-0 flex-col overflow-hidden'
              : 'overflow-y-auto pb-24',
            (currentView === 'roster' || currentView === 'recruiting') && 'pb-24',
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                currentView === 'planner' ||
                  currentView === 'simulating' ||
                  currentView === 'roster' ||
                  currentView === 'recruiting'
                  ? 'flex min-h-0 flex-1 flex-col'
                  : 'h-full',
              )}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav
          className={cn(
            'absolute bottom-0 left-0 right-0 z-40 flex h-20 items-center justify-around border-t border-border bg-card px-2',
            (currentView === 'planner' || currentView === 'simulating') && 'hidden'
          )}
        >
          <NavButton
            active={currentView === 'roster'}
            onClick={() => setCurrentView('roster')}
            icon={<Users size={20} />}
            label="Roster"
          />
          <NavButton
            active={currentView === 'recruiting'}
            locked={recruitCap <= 0}
            onClick={() => {
              if (recruitCap <= 0) {
                showToast('Unlock recruiting by upgrading your Performance Center in Upgrades.');
                return;
              }
              setCurrentView('recruiting');
            }}
            icon={<UserPlus size={20} />}
            label="Recruit"
          />
          <NavButton
            active={currentView === 'dashboard'}
            onClick={() => setCurrentView('dashboard')}
            icon={<Trophy size={20} />}
            label="Home"
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
          <ShowResultModal isOpen={showResult} onClose={() => setShowResult(false)} show={state.lastShowResult} />
        )}
        <RecruitTrainingModal
          isOpen={recruitTrainingOpen}
          recruits={pendingTrainingRecruits}
          roster={state.roster}
          onClose={() => setRecruitTrainingOpen(false)}
          onSubmit={(choices) => submitRecruitTrainingChoices(choices)}
        />

        <AnimatePresence>
          {toastMessage && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute bottom-24 left-4 right-4 z-50 rounded-xl border border-border bg-card px-4 py-3 text-center text-xs font-bold uppercase leading-snug tracking-wide text-zinc-200 shadow-lg"
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NavButton({
  active,
  locked,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  locked?: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={locked ? true : undefined}
      className={cn(
        'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
        locked
          ? 'cursor-not-allowed text-zinc-600 opacity-50'
          : active
            ? 'text-yellow-500 bg-yellow-500/10'
            : 'text-zinc-500 hover:text-zinc-300',
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
