import type { MapDef, MapId } from '../types';

export const MAPS: Record<MapId, MapDef> = {
  mill: { id: 'mill', waves: 20, hard: 1, seed: 7,
    pts: [[-1, 2], [4, 2], [4, 7], [9, 7], [9, 2], [13, 2], [13, 7], [15, 7]] },
  marsh: { id: 'marsh', waves: 25, hard: 1.2, seed: 21,
    pts: [[-1, 8], [3, 8], [3, 1], [7, 1], [7, 8], [11, 8], [11, 4], [15, 4]] },
  ring: { id: 'ring', waves: Infinity, hard: 1, seed: 3, survival: true,
    pts: [[-1, 1], [14, 1], [14, 8], [1, 8], [1, 4], [10, 4]] },
};

export const MAP_ORDER: MapId[] = ['mill', 'marsh', 'ring'];
