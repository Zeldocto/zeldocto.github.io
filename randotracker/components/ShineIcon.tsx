
import React from 'react';
import { ShineStatus } from '../types';

interface ShineIconProps {
  status: ShineStatus;
  onClick: () => void;
  index: number;
}

const ShineIcon: React.FC<ShineIconProps> = ({ status, onClick, index }) => {
  const getStyles = () => {
    switch (status) {
      case ShineStatus.COLLECTED:
        return "filter-none brightness-110 drop-shadow-[0_0_6px_rgba(255,223,0,0.6)]";
      case ShineStatus.EXTRA:
        return "animate-rainbow drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] scale-105";
      default:
        return "grayscale contrast-50 opacity-30 brightness-75";
    }
  };

  const getNumberColor = () => {
    switch (status) {
      case ShineStatus.COLLECTED:
      case ShineStatus.EXTRA:
        return "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]";
      default:
        return "text-white/30";
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`relative cursor-pointer transition-all duration-200 transform hover:scale-115 active:scale-90 flex flex-col items-center justify-center min-w-[2.75rem] md:min-w-[3rem]`}
      title={`Status: ${status}`}
    >
      <div className="relative">
        <svg 
          viewBox="0 0 100 100" 
          className={`w-8 h-8 md:w-9 md:h-9 transition-all duration-200 ${getStyles()}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M50 5 L61 35 L95 35 L67 55 L78 85 L50 65 L22 85 L33 55 L5 35 L39 35 Z" 
            fill="#FFD700" 
            stroke="#B8860B" 
            strokeWidth="2"
          />
          <circle cx="50" cy="48" r="8" fill="#FFFACD" />
          <ellipse cx="46" cy="44" rx="2" ry="3" fill="#000" />
          <ellipse cx="54" cy="44" rx="2" ry="3" fill="#000" />
          <path d="M44 54 Q50 60 56 54" stroke="#000" fill="none" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {status === ShineStatus.EXTRA && (
          <div className="absolute inset-0 bg-white/10 blur-lg rounded-full animate-pulse -z-10" />
        )}
      </div>
      <span className={`text-[9px] md:text-[10px] font-bold -mt-0.5 ${getNumberColor()} select-none`}>
        {index}
      </span>
    </div>
  );
};

export default ShineIcon;
