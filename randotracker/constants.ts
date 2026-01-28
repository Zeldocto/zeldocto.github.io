
import { World } from './types';

export const WORLDS: World[] = [
  { id: 'dp', name: 'Delfino Plaza', color: 'bg-rose-500', shineCount: 19 },
  { id: 'bh', name: 'Bianco Hills', color: 'bg-emerald-500', shineCount: 11 },
  { id: 'rh', name: 'Ricco Harbor', color: 'bg-blue-600', shineCount: 11 },
  { id: 'gb', name: 'Gelato Beach', color: 'bg-amber-400', shineCount: 11 },
  { id: 'pp', name: 'Pinna Park', color: 'bg-indigo-500', shineCount: 11 },
  { id: 'sb', name: 'Sirena Beach', color: 'bg-orange-500', shineCount: 11 },
  { id: 'nb', name: 'Noki Bay', color: 'bg-cyan-600', shineCount: 11 },
  { id: 'pv', name: 'Pianta Village', color: 'bg-purple-600', shineCount: 11 },
];

export const TOTAL_MAX_SHINES = WORLDS.reduce((acc, w) => acc + w.shineCount, 0);
