
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WORLDS, TOTAL_MAX_SHINES } from './constants';
import { ShineStatus, ShineState } from './types';
import WorldCard from './components/WorldCard';

const App: React.FC = () => {
  const [shineState, setShineState] = useState<ShineState>(() => {
    const saved = localStorage.getItem('sms-randomizer-tracker-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        WORLDS.forEach(world => {
          if (!parsed[world.id] || parsed[world.id].length !== world.shineCount) {
            const current = parsed[world.id] || [];
            if (current.length < world.shineCount) {
              parsed[world.id] = [
                ...current,
                ...new Array(world.shineCount - current.length).fill(ShineStatus.INACTIVE)
              ];
            } else if (current.length > world.shineCount) {
              parsed[world.id] = current.slice(0, world.shineCount);
            }
          }
        });
        return parsed;
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
    
    const initial: ShineState = {};
    WORLDS.forEach(world => {
      initial[world.id] = new Array(world.shineCount).fill(ShineStatus.INACTIVE);
    });
    return initial;
  });

  useEffect(() => {
    localStorage.setItem('sms-randomizer-tracker-state', JSON.stringify(shineState));
  }, [shineState]);

  const handleShineClick = useCallback((worldId: string, shineIndex: number) => {
    setShineState(prev => {
      const worldShines = [...prev[worldId]];
      const currentStatus = worldShines[shineIndex];
      
      let nextStatus: ShineStatus;
      if (currentStatus === ShineStatus.INACTIVE) {
        nextStatus = ShineStatus.COLLECTED;
      } else if (currentStatus === ShineStatus.COLLECTED) {
        nextStatus = ShineStatus.EXTRA;
      } else {
        nextStatus = ShineStatus.INACTIVE;
      }

      worldShines[shineIndex] = nextStatus;
      return {
        ...prev,
        [worldId]: worldShines
      };
    });
  }, []);

  const resetTracker = () => {
    if (window.confirm("Are you sure you want to reset all progress?")) {
      const reset: ShineState = {};
      WORLDS.forEach(world => {
        reset[world.id] = new Array(world.shineCount).fill(ShineStatus.INACTIVE);
      });
      setShineState(reset);
    }
  };

  const totalCollected = useMemo(() => 
    Object.values(shineState).flat().filter(s => s !== ShineStatus.INACTIVE).length,
  [shineState]);

  const totalRainbow = useMemo(() => 
    Object.values(shineState).flat().filter(s => s === ShineStatus.EXTRA).length,
  [shineState]);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 relative">
      {/* Background with a subtle water pattern overlay */}
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_center,#60a5fa,#1d4ed8)]"></div>
      <div className="fixed inset-0 -z-10 opacity-10 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }}></div>

      <header className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10">
        <div className="text-center sm:text-left">
          <h1 className="mario-font text-3xl md:text-5xl text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)] tracking-tighter">
            SMS <span className="text-yellow-300">RANDOMIZER</span>
          </h1>
          <p className="text-blue-100/80 text-xs font-bold uppercase tracking-widest">Isle Delfino Tracking System</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-black/30 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 shadow-2xl flex items-center gap-5">
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase font-black text-blue-300 tracking-tighter mb-0.5">Shines</span>
              <span className="mario-font text-2xl text-white leading-none">
                {totalCollected}<span className="text-sm opacity-40 ml-1">/{TOTAL_MAX_SHINES}</span>
              </span>
            </div>
            
            <div className="h-8 w-px bg-white/10"></div>
            
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase font-black text-pink-300 tracking-tighter mb-0.5">Rainbow</span>
              <span className="mario-font text-2xl text-transparent bg-clip-text bg-gradient-to-br from-red-400 via-yellow-300 to-blue-400 animate-rainbow-text leading-none">
                {totalRainbow}<span className="text-sm text-white/40 ml-1">/22</span>
              </span>
            </div>

            <button 
              onClick={resetTracker}
              className="ml-2 hover:bg-white/10 p-2 rounded-lg transition-colors group"
              title="Reset All"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-rose-400 group-hover:rotate-180 transition-transform duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
        {WORLDS.map(world => (
          <WorldCard 
            key={world.id}
            world={world}
            shines={shineState[world.id]}
            onShineClick={(idx) => handleShineClick(world.id, idx)}
            isLarge={world.id === 'dp'} // Make Delfino Plaza wider
          />
        ))}
      </main>

      <footer className="max-w-6xl mx-auto mt-8 pb-4 text-center">
        <div className="inline-block bg-white/5 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/5">
           <p className="text-blue-100/40 text-[10px] font-medium tracking-wide">
             COLLECTED &bull; RAINBOW &bull; RESET
           </p>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        @keyframes rainbow-text {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
        .animate-rainbow-text {
          animation: rainbow-text 5s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
