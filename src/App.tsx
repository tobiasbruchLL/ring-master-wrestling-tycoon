import { useEffect, useRef, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Building2, Settings as SettingsIcon, UserPlus, Crown } from 'lucide-react';
import {
  useGameState,
  getPlannedShowRunBlockReason,
  applyWinnerHpOverridesToShowSimulation,
} from './hooks/useGameState';
import { cn, formatNumber, hasAffordableFacilityUpgrade } from './lib/utils';
import { getMaxRosterSize, hasAffordableRosterCapacityUpgrade } from './lib/rosterCapacity';
import { hasAffordableTicketPriceUpgrade } from './lib/ticketPriceUpgrade';
import { getPromotionPopularityBar, promotionTier } from './lib/promotionPopularity';

// Components
import Dashboard from './features/Dashboard';
import Roster from './features/Roster';
import Facilities from './features/Facilities';
import Recruiting from './features/Recruiting';
import ShowPlanner from './features/ShowPlanner';
import Leagues from './features/Leagues';
import MatchSimulation from './features/MatchSimulation';
import SettingsMenu from './components/SettingsMenu';
import DebugMenu from './components/DebugMenu';
import ShowResultModal from './components/ShowResultModal';
import RecruitTrainingModal from './components/RecruitTrainingModal';
import RecruitGraduationModal from './components/RecruitGraduationModal';
import OnboardingDraftOverlay from './components/OnboardingDraftOverlay';
import EndDayNoShowWarningModal from './components/EndDayNoShowWarningModal';
import { useToastStack } from './components/ToastStack';
import {
  GameState,
  Match,
  ShowSimulationResult,
  hasPendingRecruitGraduation,
  hasPendingRecruitTraining,
} from './types';

type View = 'dashboard' | 'roster' | 'facilities' | 'recruiting' | 'planner' | 'simulating' | 'leagues';

export default function App() {
  const {
    state,
    fireFighter,
    upgradeFacility,
    upgradeRosterCapacity,
    upgradeTicketPrice,
    promoteLeague,
    simulateShow,
    commitSimulatedShow,
    resetGame,
    addMoney,
    markRecruitProspectsSeen,
    enlistRecruit,
    enlistRecruitSkipCamp,
    submitRecruitTrainingChoices,
    completePendingRecruitGraduation,
    scheduleUpcomingShow,
    endDay,
    endDayWithoutBookedShow,
    completeOpeningDraft,
  } = useGameState();

  const { enqueueMessage, enqueueInjuryRecoveries, stack: toastStack } = useToastStack();

  const pendingTrainingRecruits = state.activeRecruits.filter((r) => r.needsTrainingChoice);
  const popularityBar = getPromotionPopularityBar(state.popularity);

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [endDayNoShowWarningOpen, setEndDayNoShowWarningOpen] = useState(false);
  const [recruitTrainingOpen, setRecruitTrainingOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [pendingShowSimulation, setPendingShowSimulation] = useState<ShowSimulationResult | null>(null);
  const showSimBaselineRef = useRef<GameState | null>(null);
  const pendingGrads = state.pendingRecruitGraduations ?? [];
  const pendingGradHead = pendingGrads[0] ?? null;
  const graduationModalOpen = Boolean(pendingGradHead) && !recruitTrainingOpen;
  const showUpgradesNavDot =
    currentView !== 'facilities' &&
    (hasAffordableFacilityUpgrade(state) ||
      hasAffordableRosterCapacityUpgrade(state) ||
      hasAffordableTicketPriceUpgrade(state));
  const showRecruitNavDot = currentView !== 'recruiting' && state.recruitProspectsUnread;
  const bootstrappedTrainingRef = useRef(false);
  const prevShowResultOpenRef = useRef(showResult);
  const debugTapCountRef = useRef(0);
  const debugTapResetTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (bootstrappedTrainingRef.current) return;
    bootstrappedTrainingRef.current = true;
    if (hasPendingRecruitGraduation(state)) return;
    if (hasPendingRecruitTraining(state)) setRecruitTrainingOpen(true);
  }, []);

  useEffect(() => {
    if (prevShowResultOpenRef.current && !showResult && !hasPendingRecruitGraduation(state) && hasPendingRecruitTraining(state)) {
      setRecruitTrainingOpen(true);
    }
    prevShowResultOpenRef.current = showResult;
  }, [showResult, state]);

  useEffect(() => {
    if (currentView === 'recruiting') {
      markRecruitProspectsSeen();
    }
  }, [currentView, markRecruitProspectsSeen]);

  /** After the graduation queue clears, reopen rookie training if the new day still needs picks. */
  useEffect(() => {
    if ((state.pendingRecruitGraduations?.length ?? 0) > 0) return;
    if (!state.activeRecruits.some((r) => r.needsTrainingChoice)) return;
    if (recruitTrainingOpen) return;
    setRecruitTrainingOpen(true);
  }, [state.activeRecruits, state.pendingRecruitGraduations, recruitTrainingOpen]);

  useEffect(() => {
    return () => {
      if (debugTapResetTimerRef.current !== null) {
        window.clearTimeout(debugTapResetTimerRef.current);
      }
    };
  }, []);

  const plannedShowRunBlockedReason = getPlannedShowRunBlockReason(state);
  const bookedShow = state.upcomingShow;
  const showNightIsDue = Boolean(bookedShow && state.currentDay >= bookedShow.showDay);
  const canRunShowTonight = showNightIsDue && plannedShowRunBlockedReason === null;
  const primaryDayAction: 'plan_show' | 'run_show' | 'end_day' = !bookedShow
    ? 'plan_show'
    : canRunShowTonight
      ? 'run_show'
      : 'end_day';

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
    showSimBaselineRef.current = state;
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
      if (result.needsRecruitTrainingChoice && !hasPendingRecruitGraduation(state)) {
        setRecruitTrainingOpen(true);
      }
    }
  };

  const finalizeEndDayWithoutBookedShow = (persistDontShowAgain: boolean) => {
    const result = endDayWithoutBookedShow({ persistDontShowAgain });
    if (result.ok === false) {
      if (hasPendingRecruitTraining(state)) setRecruitTrainingOpen(true);
      showToast(result.reason);
      return;
    }
    enqueueInjuryRecoveries(result.injuryRecoveries);
    showToast('Fans cooled on the brand (−10% promotion popularity). Fighters recover energy.');
    if (result.needsRecruitTrainingChoice && !hasPendingRecruitGraduation(state)) {
      setRecruitTrainingOpen(true);
    }
  };

  const requestEndDayWithoutBookedShow = () => {
    if (state.skipEndDayNoShowWarning) {
      finalizeEndDayWithoutBookedShow(false);
      return;
    }
    setEndDayNoShowWarningOpen(true);
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
          <Dashboard state={state} />
        );
      case 'roster':
        return <Roster state={state} onFire={fireFighter} />;
      case 'facilities':
        return (
          <Facilities
            state={state}
            onUpgrade={upgradeFacility}
            onUpgradeRosterCapacity={upgradeRosterCapacity}
            onUpgradeTicketPrice={upgradeTicketPrice}
          />
        );
      case 'leagues':
        return <Leagues state={state} onPromote={promoteLeague} />;
      case 'recruiting':
        return (
          <Recruiting state={state} onEnlist={enlistRecruit} onSkipCamp={enlistRecruitSkipCamp} />
        );
      case 'planner':
        return (
          <ShowPlanner
            state={state}
            onScheduleShow={(matches, venueId) => {
              scheduleUpcomingShow(matches, venueId);
              setCurrentView('dashboard');
            }}
            onCancel={() => setCurrentView('dashboard')}
            onToast={showToast}
          />
        );
      case 'simulating':
        return pendingShowSimulation ? (
          <MatchSimulation
            matches={pendingMatches}
            roster={state.roster}
            showHistory={state.history}
            perMatchOutcomes={pendingShowSimulation.perMatchOutcomes}
            onComplete={(winnerHpPercents) => {
              const sim = pendingShowSimulation;
              const baseline = showSimBaselineRef.current;
              const toCommit =
                baseline != null
                  ? applyWinnerHpOverridesToShowSimulation(baseline, sim, winnerHpPercents)
                  : sim;
              showSimBaselineRef.current = null;
              commitSimulatedShow(toCommit);
              enqueueInjuryRecoveries(toCommit.injuryRecoveries);
              setPendingShowSimulation(null);
              setCurrentView('dashboard');
              setShowResult(true);
              showToast('All Fighters restore some energy');
            }}
          />
        ) : null;
      default:
        return (
          <Dashboard state={state} />
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
                <span className="shrink-0 tabular-nums text-gold">{promotionTier(state.popularity)}</span>
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
            currentView === 'dashboard' && 'pb-40',
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
          <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-30 space-y-2 px-4 pb-3">
            {primaryDayAction === 'plan_show' && (
              <>
                <button
                  type="button"
                  onClick={requestEndDayWithoutBookedShow}
                  className="pointer-events-auto w-full border border-zinc-600 bg-transparent py-3 font-display text-sm uppercase tracking-tighter text-zinc-400 shadow-sm transition-colors hover:border-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200"
                >
                  End day
                </button>
                <button
                  type="button"
                  onClick={openPlanner}
                  className="pointer-events-auto w-full border border-border bg-white py-4 font-display text-lg uppercase tracking-tighter text-black shadow-lg transition-colors hover:border-accent hover:bg-accent hover:text-white"
                >
                  PLAN SHOW
                </button>
              </>
            )}
            {primaryDayAction === 'run_show' && (
              <>
                <button
                  type="button"
                  disabled={plannedShowRunBlockedReason !== null}
                  title={plannedShowRunBlockedReason ?? "Run tonight's card; the day advances after the event."}
                  onClick={handleRunPlannedShow}
                  className={cn(
                    'pointer-events-auto w-full border border-border py-4 font-display text-lg uppercase tracking-tighter shadow-lg transition-colors',
                    plannedShowRunBlockedReason
                      ? 'cursor-not-allowed bg-zinc-800 text-zinc-600 opacity-90'
                      : 'bg-white text-black hover:border-accent hover:bg-accent hover:text-white',
                  )}
                >
                  RUN SHOW
                </button>
                {plannedShowRunBlockedReason && (
                  <p className="pointer-events-auto text-center text-[10px] font-bold uppercase leading-snug tracking-wide text-accent">
                    {plannedShowRunBlockedReason}
                  </p>
                )}
              </>
            )}
            {primaryDayAction === 'end_day' && (
              <button
                type="button"
                onClick={handleEndDay}
                className="pointer-events-auto w-full border border-border bg-zinc-900 py-4 font-display text-lg uppercase tracking-tighter text-white shadow-lg transition-colors hover:border-accent hover:bg-card"
              >
                END DAY
              </button>
            )}
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
            onClick={() => setCurrentView('recruiting')}
            icon={<UserPlus size={18} />}
            label="Recruit"
            notify={showRecruitNavDot}
          />
          <NavButton
            active={currentView === 'dashboard'}
            onClick={() => setCurrentView('dashboard')}
            icon={<Trophy size={18} />}
            label="Home"
          />
          <NavButton
            active={currentView === 'leagues'}
            onClick={() => setCurrentView('leagues')}
            icon={<Crown size={18} />}
            label="Leagues"
          />
          <NavButton
            active={currentView === 'facilities'}
            onClick={() => setCurrentView('facilities')}
            icon={<Building2 size={18} />}
            label="Upgrades"
            notify={showUpgradesNavDot}
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
          maxRosterSize={getMaxRosterSize(state)}
          onClose={() => setRecruitTrainingOpen(false)}
          onSubmit={(choices) => submitRecruitTrainingChoices(choices)}
        />
        <RecruitGraduationModal
          isOpen={graduationModalOpen}
          pending={pendingGradHead}
          remainingAfter={Math.max(0, pendingGrads.length - 1)}
          onPickAlignment={completePendingRecruitGraduation}
        />
        <EndDayNoShowWarningModal
          isOpen={endDayNoShowWarningOpen}
          onClose={() => setEndDayNoShowWarningOpen(false)}
          onConfirm={(dontShowAgain) => {
            setEndDayNoShowWarningOpen(false);
            finalizeEndDayWithoutBookedShow(dontShowAgain);
          }}
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
  notify,
}: {
  active: boolean;
  locked?: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  notify?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={locked ? true : undefined}
      className={cn(
        'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all',
        locked
          ? 'cursor-not-allowed text-zinc-600 opacity-50'
          : active
            ? 'text-yellow-500 bg-yellow-500/10'
            : 'text-zinc-500 hover:text-zinc-300',
      )}
    >
      <span className="relative inline-flex">
        {icon}
        {notify && (
          <span
            className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-card"
            aria-hidden
          />
        )}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
