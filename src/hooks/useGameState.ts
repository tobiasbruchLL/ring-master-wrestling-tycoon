import { useState, useEffect, useCallback } from 'react';
import { GameState, Fighter, Show, Match, Facility, MarketingCampaign, FighterAlignment, FighterTrait } from '../types';
import { INITIAL_MONEY, INITIAL_POPULARITY, STARTING_FIGHTERS, AVAILABLE_FACILITIES, FIGHTER_NAMES, ALIGNMENTS, TRAITS, VENUES } from '../constants';

const STORAGE_KEY = 'ring_master_save';

export function useGameState() {
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load save', e);
      }
    }
    return {
      money: INITIAL_MONEY,
      popularity: INITIAL_POPULARITY,
      roster: STARTING_FIGHTERS,
      facilities: AVAILABLE_FACILITIES,
      activeMarketing: [],
      history: [],
      currentShowNumber: 1,
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const generateRandomFighter = useCallback((): Fighter => {
    const name = FIGHTER_NAMES[Math.floor(Math.random() * FIGHTER_NAMES.length)] + ' ' + (Math.floor(Math.random() * 100));
    const stats = {
      strength: Math.floor(Math.random() * 60) + 20,
      charisma: Math.floor(Math.random() * 60) + 20,
      stamina: Math.floor(Math.random() * 60) + 20,
      skill: Math.floor(Math.random() * 60) + 20,
    };
    const avgStat = (stats.strength + stats.charisma + stats.stamina + stats.skill) / 4;
    const salary = 0;
    const signingBonus = Math.floor(avgStat * 150); // Significant upfront cost
    const popularity = Math.floor(Math.random() * 30);

    return {
      id: Math.random().toString(36).substr(2, 9),
      name,
      stats,
      salary,
      signingBonus,
      popularity,
      energy: 100,
      alignment: ALIGNMENTS[Math.floor(Math.random() * ALIGNMENTS.length)] as FighterAlignment,
      trait: TRAITS[Math.floor(Math.random() * TRAITS.length)] as FighterTrait,
      injuryDays: 0,
      image: '/wrestler.png',
    };
  }, []);

  const hireFighter = (fighter: Fighter) => {
    if (state.money >= fighter.signingBonus) {
      setState(prev => ({
        ...prev,
        money: prev.money - fighter.signingBonus,
        roster: [...prev.roster, fighter],
      }));
    }
  };

  const fireFighter = (id: string) => {
    setState(prev => ({
      ...prev,
      roster: prev.roster.filter(f => f.id !== id),
    }));
  };

  const upgradeFacility = (facilityId: string) => {
    const facility = state.facilities.find(f => f.id === facilityId);
    if (!facility) return;

    const cost = Math.floor(facility.baseCost * Math.pow(2.2, facility.level - 1));
    if (state.money >= cost) {
      setState(prev => ({
        ...prev,
        money: prev.money - cost,
        facilities: prev.facilities.map(f =>
          f.id === facilityId ? { ...f, level: f.level + 1 } : f
        ),
      }));
    }
  };

  const calculateMatchScore = useCallback((match: Match, roster: Fighter[], history: Show[]) => {
    const fighterA = roster.find(f => f.id === match.fighterAId);
    const fighterB = roster.find(f => f.id === match.fighterBId);
    if (!fighterA || !fighterB) return null;

    const powerA = Math.round((fighterA.stats.strength + fighterA.stats.charisma + fighterA.stats.stamina + fighterA.stats.skill) / 4);
    const powerB = Math.round((fighterB.stats.strength + fighterB.stats.charisma + fighterB.stats.stamina + fighterB.stats.skill) / 4);
    
    let totalScore = powerA + powerB;
    const multipliers: { label: string, value: number }[] = [];

    // Heel vs Face bonus
    if (fighterA.alignment !== fighterB.alignment) {
      totalScore *= 1.5;
      multipliers.push({ label: 'Heel vs Face bonus', value: 1.5 });
    }

    // Evenly matched bonus
    const statDiff = Math.abs(powerA - powerB);
    if (statDiff < 15) {
      totalScore *= 1.5;
      multipliers.push({ label: 'Evenly matched bonus', value: 1.5 });
    }

    // Trait Synergies
    const traits = [fighterA.trait, fighterB.trait];
    if (traits.includes('Technician') && traits.includes('High Flyer')) {
      totalScore *= 1.2;
      multipliers.push({ label: 'Technical Masterpiece', value: 1.2 });
    } else if (traits.includes('Brawler') && traits.includes('Powerhouse')) {
      totalScore *= 1.2;
      multipliers.push({ label: 'Clash of Titans', value: 1.2 });
    }

    // Repeat Penalty
    const lastShow = history[0];
    if (lastShow) {
      const wasInLastShow = lastShow.matches.some(m => 
        (m.fighterAId === fighterA.id && m.fighterBId === fighterB.id) ||
        (m.fighterAId === fighterB.id && m.fighterBId === fighterA.id)
      );
      if (wasInLastShow) {
        totalScore *= 0.5;
        multipliers.push({ label: 'Repeat Matchup Penalty', value: 0.5 });
      }
    }

    // Map to stars for internal logic (1-5)
    // Max score is roughly 200 * 1.5 * 1.5 * 1.2 = 540
    // Let's say 400+ is 5 stars
    const projectedStars = Math.min(5, Math.max(1, totalScore / 80));

    return { 
      powerA,
      powerB,
      multipliers,
      totalScore: Math.floor(totalScore),
      projectedStars
    };
  }, []);

  const runShow = (matches: Match[], venueId: string) => {
    const venue = VENUES.find(v => v.id === venueId) || VENUES[0];
    
    // Simulate matches
    const simulatedMatches = matches.map(match => {
      const breakdown = calculateMatchScore(match, state.roster, state.history);
      if (!breakdown) return { ...match, rating: 0 };
      
      const fighterA = state.roster.find(f => f.id === match.fighterAId)!;
      const fighterB = state.roster.find(f => f.id === match.fighterBId)!;
      const winnerId = Math.random() > 0.5 ? fighterA.id : fighterB.id;

      // Add small randomness to final rating
      const finalRating = Math.min(5, Math.max(1, breakdown.projectedStars + (Math.random() * 0.4 - 0.2)));

      return { ...match, rating: finalRating, winnerId };
    });

    const avgRating = simulatedMatches.reduce((acc, m) => acc + (m.rating || 0), 0) / simulatedMatches.length;
    
    // Show Rating: Average Match Rating + Production Rating (Venue Level)
    const arena = state.facilities.find(f => f.id === 'arena')!;
    const productionRating = arena.level; // Level 1 = 1 star production
    const showRating = Math.min(5, (avgRating + productionRating) / 2);

    // Attendance based on popularity and arena level
    const maxAttendance = 200 + (arena.level * 300);
    const attendance = Math.floor(Math.min(maxAttendance, (state.popularity * 150) * (0.8 + Math.random() * 0.4)));
    
    // Revenue: Ticket price scales with show quality and venue multiplier
    const baseTicketPrice = 8;
    const qualityBonus = showRating * 3; // $3 extra per star
    const revenue = Math.floor(attendance * (baseTicketPrice + qualityBonus) * venue.multiplier);
    
    // Costs: Match Setup Costs (First match is free)
    const setupCostSteps = [0, 1500, 0];
    const setupCost = matches.reduce((acc, _, idx) => acc + (setupCostSteps[idx] || 0), 0);
    const totalCost = venue.cost + setupCost;
    
    const popularityGain = showRating > 3 ? 1 : 0;
    
    const newShow: Show = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Show #${state.currentShowNumber}`,
      matches: simulatedMatches,
      revenue,
      attendance,
      rating: showRating,
      popularityGain,
      date: state.currentShowNumber,
      venueCost: venue.cost,
      setupCost: setupCost,
    };

    setState(prev => {
      // Update fighters: lose energy, gain popularity, and grow stats based on Gym
      const gym = prev.facilities.find(f => f.id === 'gym')!;
      const updatedRoster = prev.roster.map(f => {
        const wasInShow = matches.some(m => m.fighterAId === f.id || m.fighterBId === f.id);
        if (wasInShow) {
          const growth = (gym.level * 0.2);
          return {
            ...f,
            energy: Math.max(0, f.energy - 20),
            popularity: f.popularity + (showRating > 3 ? 2 : 1),
            stats: {
              ...f.stats,
              strength: Math.min(100, f.stats.strength + growth),
              charisma: Math.min(100, f.stats.charisma + growth),
              stamina: Math.min(100, f.stats.stamina + growth),
              skill: Math.min(100, f.stats.skill + growth),
            }
          };
        }
        return { ...f, energy: Math.min(100, f.energy + 10) };
      });

      return {
        ...prev,
        money: prev.money + revenue - totalCost,
        popularity: prev.popularity + popularityGain,
        roster: updatedRoster,
        history: [newShow, ...prev.history],
        currentShowNumber: prev.currentShowNumber + 1,
        lastShowResult: newShow,
      };
    });
  };

  const resetGame = () => {
    if (confirm('Are you sure you want to reset your progress?')) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const addMoney = (amount: number) => {
    setState(prev => ({ ...prev, money: prev.money + amount }));
  };

  return {
    state,
    hireFighter,
    fireFighter,
    upgradeFacility,
    runShow,
    generateRandomFighter,
    resetGame,
    addMoney,
    calculateMatchScore,
  };
}
