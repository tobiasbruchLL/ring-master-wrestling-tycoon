import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Match, Fighter, SimulatedMatchOutcomeDetail } from '../types';
import { cn } from '../lib/utils';
import MatchOutcomeModal from '../components/MatchOutcomeModal';

interface MatchSimulationProps {
  matches: Match[];
  roster: Fighter[];
  perMatchOutcomes: SimulatedMatchOutcomeDetail[];
  onComplete: () => void;
}

export default function MatchSimulation({
  matches,
  roster,
  perMatchOutcomes,
  onComplete,
}: MatchSimulationProps) {
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'trash-talk' | 'fighting' | 'finish'>('intro');
  const [healthA, setHealthA] = useState(100);
  const [healthB, setHealthB] = useState(100);
  const [isHitting, setIsHitting] = useState<'A' | 'B' | null>(null);
  const [dialogue, setDialogue] = useState<{ side: 'A' | 'B', text: string } | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);

  const currentMatch = matches[currentMatchIndex];
  const fighterA = roster.find(f => f.id === currentMatch.fighterAId)!;
  const fighterB = roster.find(f => f.id === currentMatch.fighterBId)!;
  const matchOutcome = perMatchOutcomes[currentMatchIndex];
  const plannedWinnerId = matchOutcome?.match.winnerId;
  const loserSide: 'A' | 'B' | null =
    plannedWinnerId === fighterA.id ? 'B' : plannedWinnerId === fighterB.id ? 'A' : null;

  const trashTalkLines = {
    Face: [
      "I'm doing this for the fans!",
      "You're going down, fairly and squarely!",
      "Respect the ring!",
      "It's time for a clean fight!",
      "I'll show you what a real hero looks like!"
    ],
    Heel: [
      "You're nothing but a joke!",
      "I'll break you in half!",
      "The crowd hates you, and so do I!",
      "Rules are for losers!",
      "I'm the best there is, period."
    ]
  };

  useEffect(() => {
    if (phase === 'intro') {
      const timer = setTimeout(() => setPhase('trash-talk'), 1500);
      return () => clearTimeout(timer);
    }

    if (phase === 'trash-talk') {
      // Fighter A speaks
      const lineA = trashTalkLines[fighterA.alignment][Math.floor(Math.random() * 5)];
      setDialogue({ side: 'A', text: lineA });
      
      const timer1 = setTimeout(() => {
        // Fighter B speaks
        const lineB = trashTalkLines[fighterB.alignment][Math.floor(Math.random() * 5)];
        setDialogue({ side: 'B', text: lineB });
        
        const timer2 = setTimeout(() => {
          setDialogue(null);
          setPhase('fighting');
        }, 2000);
        return () => clearTimeout(timer2);
      }, 2000);
      
      return () => clearTimeout(timer1);
    }

    if (phase === 'fighting') {
      const interval = setInterval(() => {
        let attacker: 'A' | 'B';
        if (loserSide && Math.random() < 0.82) {
          attacker = loserSide === 'A' ? 'B' : 'A';
        } else {
          attacker = Math.random() > 0.5 ? 'A' : 'B';
        }

        const hitsLoser =
          (loserSide === 'A' && attacker === 'B') || (loserSide === 'B' && attacker === 'A');
        const damage = Math.floor(Math.random() * 14) + (hitsLoser && loserSide ? 9 : 5);

        setIsHitting(attacker);
        setTimeout(() => setIsHitting(null), 100);

        if (attacker === 'A') {
          setHealthB((prev) => Math.max(0, prev - damage));
        } else {
          setHealthA((prev) => Math.max(0, prev - damage));
        }
      }, 600);

      return () => clearInterval(interval);
    }
  }, [phase, loserSide]);

  useEffect(() => {
    if (phase !== 'fighting') return;
    if (healthA === 0 || healthB === 0) {
      setPhase('finish');
      setShowOutcome(true);
    }
  }, [healthA, healthB, phase]);

  const handleOutcomeContinue = () => {
    setShowOutcome(false);
    if (currentMatchIndex < matches.length - 1) {
      setCurrentMatchIndex((i) => i + 1);
      setHealthA(100);
      setHealthB(100);
      setPhase('intro');
      setDialogue(null);
    } else {
      onComplete();
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg relative overflow-hidden">
      {/* Background Text */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <h1 className="text-[20rem] font-display uppercase italic -rotate-12">FIGHT</h1>
      </div>

      {/* Match Header */}
      <div className="p-8 text-center z-10">
        <h2 className="text-gold font-display text-sm tracking-[4px] uppercase mb-2">
          Match {currentMatchIndex + 1} of {matches.length}
        </h2>
        <h3 className="text-2xl font-display uppercase text-white">
          {phase === 'intro' ? 'Get Ready' : phase === 'trash-talk' ? 'Trash Talk' : phase === 'fighting' ? 'Live Action' : 'Match Over'}
        </h3>
      </div>

      {/* Combat Area */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 gap-20 relative">
        {/* Dialogue Bubbles */}
        <AnimatePresence>
          {dialogue && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn(
                "absolute top-1/4 z-50 px-6 py-3 bg-white text-black font-bold text-sm rounded-2xl shadow-2xl max-w-[200px] text-center",
                dialogue.side === 'A' ? "left-8" : "right-8",
                "after:content-[''] after:absolute after:top-full after:w-0 after:h-0 after:border-l-[10px] after:border-l-transparent after:border-r-[10px] after:border-r-transparent after:border-t-[10px] after:border-t-white",
                dialogue.side === 'A' ? "after:left-1/4" : "after:right-1/4"
              )}
            >
              {dialogue.text}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Health Bars */}
        <div className="w-full flex justify-between gap-8 px-4">
          <HealthBar health={healthA} name={fighterA.name} align="left" />
          <HealthBar health={healthB} name={fighterB.name} align="right" />
        </div>

        {/* Fighters */}
        <div className="flex items-center justify-center gap-12 relative w-full h-64">
          {/* Fighter A */}
          <motion.div
            animate={
              phase === 'fighting' 
                ? { x: isHitting === 'A' ? 40 : 0, scale: isHitting === 'A' ? 1.1 : 1 } 
                : phase === 'finish' && healthA === 0 
                  ? { rotate: -90, y: 100, opacity: 0.5 }
                  : {}
            }
            className={cn(
              "w-48 h-48 flex items-center justify-center relative",
              isHitting === 'B' && "animate-shake"
            )}
          >
            <img 
              src={fighterA.image} 
              alt={fighterA.name}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
            {isHitting === 'B' && (
              <motion.div 
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                className="absolute inset-0 bg-white"
              />
            )}
          </motion.div>

          <div className="font-display text-4xl text-zinc-800 italic -rotate-12">VS</div>

          {/* Fighter B */}
          <motion.div
            animate={
              phase === 'fighting' 
                ? { x: isHitting === 'B' ? -40 : 0, scale: isHitting === 'B' ? 1.1 : 1 } 
                : phase === 'finish' && healthB === 0 
                  ? { rotate: 90, y: 100, opacity: 0.5 }
                  : {}
            }
            className={cn(
              "w-48 h-48 flex items-center justify-center relative",
              isHitting === 'A' && "animate-shake"
            )}
          >
            <img 
              src={fighterB.image} 
              alt={fighterB.name}
              className="w-full h-full object-contain scale-x-[-1]"
              referrerPolicy="no-referrer"
            />
            {isHitting === 'A' && (
              <motion.div 
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                className="absolute inset-0 bg-white"
              />
            )}
          </motion.div>
        </div>

        {/* Action Text Overlay */}
        <AnimatePresence>
          {isHitting && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: -20 }}
              animate={{ opacity: 1, scale: 1.5, y: -50 }}
              exit={{ opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
              <span className="text-white font-display text-4xl italic uppercase tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                {Math.random() > 0.5 ? 'BAM!' : 'POW!'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="p-8 bg-card border-t border-border flex justify-between items-center">
        <div className="text-left">
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-widest",
            fighterA.alignment === 'Face' ? "text-blue-400" : "text-accent"
          )}>
            {fighterA.alignment} • {fighterA.trait}
          </p>
          <p className="font-display text-white uppercase">{fighterA.name}</p>
        </div>
        <div className="text-right">
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-widest",
            fighterB.alignment === 'Face' ? "text-blue-400" : "text-accent"
          )}>
            {fighterB.alignment} • {fighterB.trait}
          </p>
          <p className="font-display text-white uppercase">{fighterB.name}</p>
        </div>
      </div>

      <MatchOutcomeModal
        isOpen={showOutcome}
        outcome={matchOutcome ?? null}
        matchNumber={currentMatchIndex + 1}
        matchTotal={matches.length}
        onContinue={handleOutcomeContinue}
      />
    </div>
  );
}

function HealthBar({ health, name, align }: { health: number, name: string, align: 'left' | 'right' }) {
  return (
    <div className={cn("flex-1 space-y-2", align === 'right' && "text-right")}>
      <p className="text-[10px] font-display text-zinc-500 uppercase truncate">{name}</p>
      <div className="h-4 bg-zinc-900 border border-border relative overflow-hidden">
        <motion.div 
          animate={{ width: `${health}%` }}
          className={cn(
            "h-full transition-colors duration-300",
            health > 50 ? "bg-green-500" : health > 20 ? "bg-yellow-500" : "bg-accent"
          )}
          style={{ float: align === 'right' ? 'right' : 'left' }}
        />
      </div>
    </div>
  );
}
