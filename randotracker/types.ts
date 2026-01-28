
export enum ShineStatus {
  INACTIVE = 'INACTIVE',
  COLLECTED = 'COLLECTED',
  EXTRA = 'EXTRA'
}

export interface World {
  id: string;
  name: string;
  color: string;
  shineCount: number;
}

export interface ShineState {
  [worldId: string]: ShineStatus[];
}
