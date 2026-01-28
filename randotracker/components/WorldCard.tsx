
import React from 'react';
import { World, ShineStatus } from '../types';
import ShineIcon from './ShineIcon';

interface WorldCardProps {
  world: World;
  shines: ShineStatus[];
  onShineClick: (index: number) => void;
  isLarge?: boolean;
}

const WorldCard: React.FC<WorldCardProps> = ({ world, shines, onShineClick, isLarge }) => {
  const collectedCount = shines.filter(s => s !== ShineStatus.INACTIVE).length;

  return (
    <div className={`bg-white/5 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 shadow-lg transition-all hover:bg-white/10 ${isLarge ? 'md:col-span-2' : ''}`}>
      <div className={`${world.color} px-3 py-1.5 flex justify-between items-center border-b border-black/5 shadow-inner`}>
        <h2 className="mario-font text-white text-sm md:text-base tracking-wide drop-shadow-sm truncate pr-2">
          {world.name}
        </h2>
        <span className="bg-black/20 text-white font-bold px-2 py-0.5 rounded-lg text-[10px] md:text-xs flex-shrink-0">
          {collectedCount} / {world.shineCount}
        </span>
      </div>
      <div className="p-2 overflow-x-auto custom-scrollbar">
        <div className="flex flex-row items-center gap-0.5 min-w-max">
          {shines.map((status, idx) => (
            <ShineIcon 
              key={`${world.id}-${idx}`} 
              index={idx + 1}
              status={status} 
              onClick={() => onShineClick(idx)} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorldCard;
