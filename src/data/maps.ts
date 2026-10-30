import type { MapDef, MapId, WaveSpec } from '../types';

// Wave lists: each wave is a list of [shadow, count, seconds between spawns]. Groups are woven
// together when the wave spawns, and bosses always come last. Each map sends its own boss (see
// src/game/bosses.ts): the Thief on Mill Hill and Willow Ford, the Stomper on Marsh Ditch and Bramble Wood, the Mender on Ring
// Rampart and the Forked Road. Each map mixes shadow traits on
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

// ---------- terrain and rifts that move (docs/plans/gameplay.md, phases 8 and 9) ----------
// Three later story maps. Terrain patches are [centre x, centre y, radius] in tiles (game/terrain.ts):
// hills reach further, woods block straight shots, water slows waders and wets them for Thunder Pulse.

/** Willow Ford: a river runs across the meadow and the road wades it twice. Sprinters and menders slow down in the water; swarms of moths fly over it. */
const FORD: WaveSpec[] = [
  [['crawler', 12, 0.6]],
  [['crawler', 10, 0.5], ['dasher', 4, 0.8]],
  [['flitter', 8, 0.4], ['crawler', 8, 0.6]],
  [['dasher', 9, 0.6], ['crawler', 10, 0.5]],
  [['shimmer', 5, 0.8], ['flitter', 6, 0.45]],
  [['flitter', 10, 0.38], ['dasher', 6, 0.6]],
  [['shimmer', 6, 0.7], ['crawler', 12, 0.5]],
  [['dasher', 12, 0.5], ['flitter', 8, 0.4]],
  [['flitter', 14, 0.32], ['lump', 2, 1.2]],
  [['crawler', 16, 0.42], ['dasher', 8, 0.6], ['shimmer', 4, 0.7], ['thief', 1, 3]],
  [['flitter', 16, 0.3], ['dasher', 8, 0.55]],
  [['shimmer', 10, 0.6], ['flitter', 8, 0.38]],
  [['dasher', 16, 0.45], ['splitter', 4, 0.8]],
  [['flitter', 16, 0.3], ['shimmer', 6, 0.6]],
  [['dasher', 18, 0.42], ['shimmer', 8, 0.6]],
  [['flitter', 16, 0.3], ['crawler', 14, 0.45]],
  [['shimmer', 14, 0.5], ['dasher', 12, 0.5]],
  [['flitter', 18, 0.28], ['lump', 3, 1]],
  [['dasher', 20, 0.4], ['shimmer', 10, 0.55], ['flitter', 12, 0.3]],
  [['crawler', 20, 0.38], ['dasher', 14, 0.45], ['shimmer', 10, 0.55], ['flitter', 16, 0.28], ['thief', 2, 3]],
];

/** Bramble Wood: the road runs into the trees, where only arcs and pulses reach. Brutes and inkblots for the arcs, and moths that the trees hide from Spark. */
const BRAMBLE: WaveSpec[] = [
  [['crawler', 12, 0.6]],
  [['crawler', 14, 0.5]],
  [['splitter', 4, 0.9], ['crawler', 8, 0.6]],
  [['lump', 3, 1.1], ['crawler', 10, 0.5]],
  [['flitter', 8, 0.4], ['crawler', 8, 0.55]],
  [['splitter', 6, 0.8], ['lump', 2, 1.2]],
  [['lump', 5, 0.95], ['dasher', 6, 0.7]],
  [['flitter', 10, 0.36], ['splitter', 5, 0.8]],
  [['crawler', 20, 0.4], ['lump', 4, 1]],
  [['lump', 6, 0.9], ['splitter', 5, 0.8], ['crawler', 10, 0.5], ['stomper', 1, 3]],
  [['shimmer', 6, 0.7], ['lump', 4, 0.95]],
  [['splitter', 10, 0.65], ['flitter', 10, 0.36]],
  [['lump', 9, 0.8], ['dasher', 8, 0.6]],
  [['flitter', 14, 0.3], ['lump', 5, 0.9]],
  [['splitter', 12, 0.6], ['shimmer', 6, 0.7]],
  [['lump', 11, 0.75], ['crawler', 16, 0.42]],
  [['flitter', 16, 0.3], ['splitter', 8, 0.7]],
  [['lump', 12, 0.7], ['shimmer', 8, 0.6]],
  [['splitter', 14, 0.55], ['dasher', 12, 0.5], ['flitter', 10, 0.32]],
  [['lump', 10, 0.75], ['splitter', 10, 0.6], ['flitter', 12, 0.32], ['crawler', 14, 0.45], ['stomper', 1, 3]],
];

/** The Forked Road: three rifts take turns, and the next one is shown before every wave. Everything the Gloom has, led by the Mender. */
const FORK: WaveSpec[] = [
  [['crawler', 12, 0.6]],
  [['crawler', 12, 0.5], ['flitter', 4, 0.45]],
  [['dasher', 6, 0.75], ['crawler', 10, 0.55]],
  [['lump', 3, 1.1], ['crawler', 10, 0.5]],
  [['shimmer', 5, 0.8], ['flitter', 6, 0.4]],
  [['splitter', 6, 0.8], ['dasher', 6, 0.65]],
  [['flitter', 12, 0.35], ['lump', 3, 1]],
  [['shimmer', 7, 0.7], ['crawler', 14, 0.45]],
  [['lump', 6, 0.9], ['splitter', 5, 0.8]],
  [['crawler', 18, 0.42], ['shimmer', 6, 0.65], ['lump', 3, 1], ['mender', 1, 3]],
  [['dasher', 14, 0.5], ['flitter', 8, 0.36]],
  [['splitter', 9, 0.7], ['shimmer', 6, 0.65]],
  [['lump', 9, 0.8], ['flitter', 10, 0.34]],
  [['shimmer', 10, 0.55], ['dasher', 12, 0.5]],
  [['flitter', 16, 0.3], ['splitter', 7, 0.7]],
  [['lump', 10, 0.75], ['shimmer', 8, 0.6], ['crawler', 12, 0.45]],
  [['dasher', 18, 0.42], ['splitter', 8, 0.7]],
  [['flitter', 18, 0.28], ['lump', 7, 0.8]],
  [['shimmer', 12, 0.5], ['splitter', 10, 0.6]],
  [['crawler', 22, 0.38], ['lump', 8, 0.8], ['shimmer', 8, 0.6], ['flitter', 8, 0.34], ['mender', 2, 3]],
  [['dasher', 20, 0.4], ['flitter', 14, 0.3]],
  [['lump', 14, 0.65], ['splitter', 10, 0.6]],
  [['shimmer', 14, 0.48], ['flitter', 16, 0.28]],
  [['splitter', 14, 0.55], ['dasher', 18, 0.4], ['lump', 8, 0.8]],
  [['crawler', 28, 0.32], ['lump', 12, 0.7], ['shimmer', 10, 0.55], ['flitter', 14, 0.3], ['splitter', 8, 0.6], ['mender', 3, 3]],
];
// ---------- end terrain and rifts that move ----------

export const MAPS: Record<MapId, MapDef> = {
  mill: { id: 'mill', waves: 20, hard: 1, seed: 7, waveList: MILL,
    pts: [[-1, 2], [4, 2], [4, 7], [9, 7], [9, 2], [13, 2], [13, 7], [15, 7]] },
  marsh: { id: 'marsh', waves: 25, hard: 1.25, seed: 21, waveList: MARSH,
    pts: [[-1, 8], [3, 8], [3, 1], [7, 1], [7, 8], [11, 8], [11, 4], [15, 4]] },
  ring: { id: 'ring', waves: Infinity, hard: 1, seed: 3, survival: true, waveList: RING,
    pts: [[-1, 1], [14, 1], [14, 8], [1, 8], [1, 4], [10, 4]] },
  // ---------- terrain and rifts that move ----------
  ford: { id: 'ford', waves: 20, hard: 1.34, seed: 11, waveList: FORD,
    pts: [[-1, 1], [4, 1], [4, 8], [10, 8], [10, 1], [15, 1]],
    terrain: {
      water: [[-1, 4.11, 0.8], [0.25, 4.48, 0.8], [1.5, 4.8, 0.8], [2.75, 4.95, 0.8], [4, 4.84, 0.8], [5.25, 4.54, 0.8], [6.5, 4.17, 0.8],
        [7.75, 3.9, 0.8], [9, 3.87, 0.8], [10.25, 4.07, 0.8], [11.5, 4.42, 0.8], [12.75, 4.77, 0.8], [14, 4.94, 0.8], [15.25, 4.87, 0.8]],
      hills: [[7, 1.8, 1.1], [7, 6.3, 0.9], [1.5, 7, 1.2], [13, 7, 1.2]],
    } },
  bramble: { id: 'bramble', waves: 20, hard: 1.1, seed: 17, waveList: BRAMBLE,
    pts: [[-1, 7], [3, 7], [3, 1], [7, 1], [7, 8], [11, 8], [11, 2], [15, 2]],
    terrain: {
      woods: [[7, 4.5, 1.3], [5, 5.3, 1], [9, 4.1, 1], [1, 4, 1], [13.5, 6.7, 1]],
      hills: [[9, 6.4, 0.9], [5, 8.6, 1], [1, 9, 0.9], [13.6, 4.2, 1]],
    } },
  // Three branches meet at a crossroads and share the last stretch, which loops around a meadow to the heart.
  fork: { id: 'fork', waves: 25, hard: 1.4, seed: 29, waveList: FORK,
    pts: [[-1, 2], [3, 2], [3, 5], [8, 5], [8, 8], [13, 8], [13, 3], [15, 3]],
    rifts: [[[8, -1], [8, 5], [8, 8], [13, 8], [13, 3], [15, 3]], [[4, 10], [4, 7], [8, 7], [8, 8], [13, 8], [13, 3], [15, 3]]],
    riftOrder: [0, 0, 1, 0, 2, 1, 2, 0, 1, 2, 2, 1, 0, 2, 1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0],
    terrain: {
      hills: [[10.5, 4.6, 1], [11, 0.8, 1]],
      water: [[4, 8.6, 0.85], [13, 5.6, 0.8]],
      woods: [[5.5, 3.4, 1], [1, 7.6, 1.3]],
    } },
  // ---------- end terrain and rifts that move ----------
};

/** Story maps in story order, then survival. */
export const MAP_ORDER: MapId[] = ['mill', 'marsh', 'ford', 'bramble', 'fork', 'ring'];
