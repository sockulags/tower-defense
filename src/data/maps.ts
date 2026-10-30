import type { MapDef, MapId, WaveSpec } from '../types';

// Wave lists: each wave is a list of [shadow, count, seconds between spawns]. Groups are woven
// together when the wave spawns, and bosses always come last. Each map sends its own boss (see
// src/game/bosses.ts): the Thief on Mill Hill, the Stomper on Marsh Ditch, the Mender on Ring Rampart. Each map mixes shadow traits on
// purpose, so no single tower type can answer every wave: flyers for the ground towers, armour for
// small hits, menders for towers that neither burn nor freeze, splitters and sprinters for
// single-target and slow-less builds. Tuned with `npm run balance`.

/** Mill Hill: the first evening. Introduces one trait at a time, then mixes them. */
const MILL: WaveSpec[] = [
  [['crawler', 10, 0.65]],
  [['crawler', 14, 0.55]],
  [['crawler', 10, 0.6], ['flitter', 5, 0.45]],
  [['crawler', 16, 0.5], ['flitter', 5, 0.4]],
  [['flitter', 10, 0.35]],
  [['crawler', 14, 0.55], ['lump', 2, 1.2]],
  [['crawler', 14, 0.5], ['dasher', 5, 0.8]],
  [['lump', 3, 1], ['flitter', 8, 0.4], ['crawler', 8, 0.6]],
  [['crawler', 16, 0.5], ['splitter', 4, 0.9]],
  [['crawler', 20, 0.45], ['lump', 3, 1], ['thief', 1, 3]],
  [['crawler', 16, 0.5], ['shimmer', 5, 0.7]],
  [['dasher', 8, 0.7], ['flitter', 8, 0.4]],
  [['splitter', 6, 0.8], ['lump', 3, 1], ['crawler', 10, 0.5]],
  [['flitter', 15, 0.3]],
  [['lump', 6, 0.9], ['shimmer', 6, 0.7], ['crawler', 10, 0.5]],
  [['crawler', 22, 0.4], ['dasher', 11, 0.6], ['splitter', 4, 0.9]],
  [['flitter', 12, 0.35], ['lump', 5, 0.9], ['shimmer', 6, 0.7]],
  [['splitter', 9, 0.7], ['dasher', 12, 0.55]],
  [['lump', 5, 0.95], ['flitter', 12, 0.35], ['shimmer', 6, 0.7], ['crawler', 10, 0.5]],
  [['crawler', 26, 0.4], ['lump', 5, 0.9], ['flitter', 10, 0.35], ['splitter', 4, 0.8], ['thief', 2, 3]],
];

/** Marsh Ditch: a shorter road and tougher shadows, heavy on flyers and sprinters. */
const MARSH: WaveSpec[] = [
  [['crawler', 13, 0.56]],
  [['crawler', 13, 0.49], ['flitter', 5, 0.35]],
  [['crawler', 16, 0.49], ['dasher', 5, 0.77]],
  [['flitter', 10, 0.34]],
  [['crawler', 16, 0.49], ['lump', 5, 0.91]],
  [['dasher', 11, 0.56], ['splitter', 5, 0.84]],
  [['shimmer', 8, 0.63], ['flitter', 8, 0.35]],
  [['lump', 8, 0.84], ['crawler', 16, 0.42]],
  [['flitter', 17, 0.27]],
  [['crawler', 22, 0.35], ['lump', 6, 0.77], ['dasher', 6, 0.7], ['stomper', 1, 3]],
  [['splitter', 10, 0.7], ['shimmer', 8, 0.63]],
  [['dasher', 19, 0.42], ['flitter', 8, 0.32]],
  [['lump', 13, 0.7], ['shimmer', 6, 0.63]],
  [['flitter', 16, 0.27], ['splitter', 8, 0.7]],
  [['dasher', 16, 0.49], ['lump', 8, 0.77], ['shimmer', 6, 0.63]],
  [['crawler', 32, 0.32], ['splitter', 10, 0.63]],
  [['flitter', 18, 0.3], ['dasher', 10, 0.56]],
  [['lump', 16, 0.63], ['shimmer', 10, 0.56]],
  [['splitter', 14, 0.56], ['dasher', 16, 0.42], ['flitter', 8, 0.32]],
  [['crawler', 26, 0.38], ['lump', 8, 0.8], ['shimmer', 8, 0.6], ['stomper', 2, 3]],
  [['flitter', 21, 0.24], ['shimmer', 13, 0.49]],
  [['dasher', 22, 0.39], ['splitter', 13, 0.56]],
  [['lump', 19, 0.59], ['flitter', 16, 0.28]],
  [['shimmer', 16, 0.49], ['dasher', 19, 0.39], ['splitter', 10, 0.63]],
  [['crawler', 38, 0.28], ['lump', 16, 0.63], ['flitter', 19, 0.24], ['shimmer', 13, 0.49], ['splitter', 10, 0.56], ['stomper', 2, 3]],
];

/** Ring Rampart: a ten-wave round that repeats, with more shadows each round. */
const RING: WaveSpec[] = [
  [['crawler', 16, 0.49], ['flitter', 5, 0.35]],
  [['crawler', 13, 0.49], ['lump', 5, 0.91]],
  [['dasher', 10, 0.63], ['flitter', 6, 0.35]],
  [['splitter', 8, 0.77], ['crawler', 13, 0.49]],
  [['flitter', 13, 0.3]],
  [['shimmer', 8, 0.63], ['lump', 5, 0.84]],
  [['dasher', 14, 0.49], ['splitter', 6, 0.77]],
  [['lump', 10, 0.77], ['flitter', 11, 0.32]],
  [['shimmer', 10, 0.56], ['dasher', 13, 0.49], ['crawler', 16, 0.42]],
  [['crawler', 22, 0.35], ['lump', 8, 0.77], ['flitter', 8, 0.32], ['splitter', 6, 0.7], ['mender', 1, 3]],
];

export const MAPS: Record<MapId, MapDef> = {
  mill: { id: 'mill', waves: 20, hard: 1, seed: 7, waveList: MILL,
    pts: [[-1, 2], [4, 2], [4, 7], [9, 7], [9, 2], [13, 2], [13, 7], [15, 7]] },
  marsh: { id: 'marsh', waves: 25, hard: 1.2, seed: 21, waveList: MARSH,
    pts: [[-1, 8], [3, 8], [3, 1], [7, 1], [7, 8], [11, 8], [11, 4], [15, 4]] },
  ring: { id: 'ring', waves: Infinity, hard: 1, seed: 3, survival: true, waveList: RING,
    pts: [[-1, 1], [14, 1], [14, 8], [1, 8], [1, 4], [10, 4]] },
};

export const MAP_ORDER: MapId[] = ['mill', 'marsh', 'ring'];
