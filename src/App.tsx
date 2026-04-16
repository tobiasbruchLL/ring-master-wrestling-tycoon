import { useEffect, useRef, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Building2, Settings as SettingsIcon, UserPlus } from 'lucide-react';
import { useGameState, getPlannedShowRunBlockReason, isPlannedShowRunnableNow } from './hooks/useGameState';
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
import OnboardingDraftOverlay from './components/OnboardingDraftOverlay';
import { useToastStack } from './components/ToastStack';
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
    scheduleUpcomingShow,
    endDay,
    completeOpeningDraft,
  } = useGameState();

  const { enqueueMessage, enqueueInjuryRecoveries, stack: toastStack } = useToastStack();

  const recruitCap = getRecruitSlotCap(state);
  const pendingTrainingRecruits = state.activeRecruits.filter((r) => r.needsTrainingChoice);
  const popularityBar = getPromotionPopularityBar(state.popularity);

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [recruitTrainingOpen, setRecruitTrainingOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [pendingShowSimulation, setPendingShowSimulation] = useState<ShowSimulationResult | null>(null);
  const bootstrappedTrainingRef = useRef(false);
  const prevShowResultOpenRef = useRef(showResult);
  const debugTapCountRef = useRef(0);
  const debugTapResetTimerRef = useRef<number | null>(null);
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
      if (debugTapResetTimerRef.current !== null) {
        window.clearTimeout(debugTapResetTimerRef.current);
      }
    };
  }, []);

  const plannedShowRunBlockedReason = getPlannedShowRunBlockReason(state);
  const mustRunShowBeforeEndDay = isPlannedShowRunnableNow(state);

  const showToast = (message: string) => {
    enqueueMessage(message);
  };

  const openPlanner = () => {
    if (state.upcomingShow) {
      showToast('You already have a show booked.');
      return;
    }
    setCurrentView('planner');
  };

  const handleRunPlannedShow = () => {
    const err = getPlannedShowRunBlockReason(state);
    if (err) {
      showToast(err);
      return;
    }
    const plan = state.upcomingShow!;
    setPendingMatches(plan.matches);
    setPendingShowSimulation(simulateShow(plan.matches, plan.venueId));
    setCurrentView('simulating');
  };

  const handleEndDay = () => {
    const result = endDay();
    if (result.ok === false) {
      if (hasPendingRecruitTraining(state)) setRecruitTrainingOpen(true);
      showToast(result.reason);
    } else {
      enqueueInjuryRecoveries(result.injuryRecoveries);
      showToast('All Fighters restore some energy');
    }
  };

  const handleDebugTap = () => {
    if (debugTapResetTimerRef.current !== null) {
      window.clearTimeout(debugTapResetTimerRef.current);
    }
    debugTapCountRef.current += 1;
    debugTapResetTimerRef.current = window.setTimeout(() => {
      debugTapCountRef.current = 0;
      debugTapResetTimerRef.current = null;
    }, 2000);
    if (debugTapCountRef.current >= 10) {
      setIsDebugOpen(true);
      debugTapCountRef.current = 0;
      if (debugTapResetTimerRef.current !== null) {
        window.clearTimeout(debugTapResetTimerRef.current);
        debugTapResetTimerRef.current = null;
      }
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            state={state}
            onPlanShow={openPlanner}
            onRunPlannedShow={handleRunPlannedShow}
            plannedShowRunBlockedReason={plannedShowRunBlockedReason}
          />
        );
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
        return (
          <ShowPlanner
            state={state}
            calculateMatchScore={calculateMatchScore}
            onScheduleShow={(matches, venueId) => {
              scheduleUpcomingShow(matches, venueId);
              setCurrentView('dashboard');
            }}
            onCancel={() => setCurrentView('dashboard')}
          />
        );
      case 'simulating':
        return pendingShowSimulation ? (
          <MatchSimulation
            matches={pendingMatches}
            roster={state.roster}
            perMatchOutcomes={pendingShowSimulation.perMatchOutcomes}
            onComplete={() => {
              const sim = pendingShowSimulation;
              commitSimulatedShow(sim);
              enqueueInjuryRecoveries(sim.injuryRecoveries);
              setPendingShowSimulation(null);
              setCurrentView('dashboard');
              setShowResult(true);
              showToast('All Fighters restore some energy');
            }}
          />
        ) : null;
      default:
        return (
          <Dashboard
            state={state}
            onPlanShow={openPlanner}
            onRunPlannedShow={handleRunPlannedShow}
            plannedShowRunBlockedReason={plannedShowRunBlockedReason}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-accent selection:text-white flex justify-center">
      {/* Mobile-style Portrait Container */}
      <div className="relative flex h-dvh max-h-dvh min-h-0 w-full max-w-md flex-col overflow-hidden border-x border-border bg-bg shadow-2xl">
        {/* Full-width secret debug hit target above modals; leaves room for settings */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={handleDebugTap}
          className={cn(
            'absolute left-0 top-0 z-[250] box-border border-0 bg-transparent p-0',
            'w-[calc(100%-3.25rem)] pt-[env(safe-area-inset-top,0px)]',
            'min-h-[calc(3.25rem+env(safe-area-inset-top,0px))]',
            isDebugOpen && 'pointer-events-none',
          )}
        />

        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b-2 border-accent bg-bg px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <div
              className="flex min-w-0 flex-1 flex-col gap-0.5"
              title={`Progress toward popularity ${popularityBar.segmentHigh}`}
            >
              <div className="flex w-full items-center justify-between gap-2 text-[9px] font-bold font-display uppercase tracking-widest text-zinc-500">
                <span className="truncate">Popularity</span>
                <span className="shrink-0 tabular-nums text-gold">{state.popularity}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-700 to-gold transition-[width] duration-500 ease-out"
                  style={{ width: `${popularityBar.fillPercent}%` }}
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 font-display text-base leading-none text-white tabular-nums">
              <span className="text-accent">$</span>
              <span>{formatNumber(state.money)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="shrink-0 rounded p-1 transition-colors hover:bg-card"
          >
            <SettingsIcon size={18} />
          </button>
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
              : 'overflow-y-auto pb-20',
            currentView === 'dashboard' && 'pb-28',
            (currentView === 'roster' || currentView === 'recruiting') && 'pb-20',
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

        {currentView === 'dashboard' && (
          <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-30 px-4 pb-3">
            <button
              type="button"
              disabled={mustRunShowBeforeEndDay}
              title={
                mustRunShowBeforeEndDay
                  ? 'Run the booked show tonight; the day advances after the event.'
                  : undefined
              }
              onClick={handleEndDay}
              className={cn(
                'pointer-events-auto w-full border border-border bg-zinc-900 py-4 font-display text-lg uppercase tracking-tighter text-white shadow-lg transition-colors',
                mustRunShowBeforeEndDay
                  ? 'cursor-not-allowed opacity-45 hover:border-border hover:bg-zinc-900'
                  : 'hover:border-accent hover:bg-card',
              )}
            >
              END DAY
            </button>
          </div>
        )}

        {/* Bottom Navigation */}
        <nav
          className={cn(
            'absolute bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-card px-2',
            (currentView === 'planner' || currentView === 'simulating') && 'hidden'
          )}
        >
          <NavButton
            active={currentView === 'roster'}
            onClick={() => setCurrentView('roster')}
            icon={<Users size={18} />}
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
            icon={<UserPlus size={18} />}
            label="Recruit"
          />
          <NavButton
            active={currentView === 'dashboard'}
            onClick={() => setCurrentView('dashboard')}
            icon={<Trophy size={18} />}
            label="Home"
          />
          <NavButton 
            active={currentView === 'facilities'} 
            onClick={() => setCurrentView('facilities')} 
            icon={<Building2 size={18} />} 
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

        {toastStack}

        {!state.hasCompletedOpeningDraft && (
          <OnboardingDraftOverlay onComplete={completeOpeningDraft} />
        )}
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
        'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all',
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
