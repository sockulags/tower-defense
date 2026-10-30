// Terrain that matters and rifts that move (docs/plans/gameplay.md, phases 8 and 9).
//
// Terrain is data on a map (`terrain` in src/data/maps.ts): round patches of hill, wood and water,
// each a centre in tile coordinates and a radius in tiles. Overlapping patches make longer shapes,
// such as a river. The rules:
// - Hills: a tower or the Warden standing on a hill reaches further.
// - Woods: nothing is built inside them, and trees block straight shots (Spark, Rime's bolts and
//   the Warden's shots). Starfall's shells arc over them and Ember's pulse spreads through them.
// - Water: nothing is built in it, shadows wading through slow down, and Thunder Pulse hits harder.
//
// A map with `rifts` has more than one road into the heart; each wave comes from one of them
// (`riftOrder`). No DOM here: the view, the UI and the bots read these helpers.
import { T } from '../config';
import type { Enemy, Game, MapDef, Path } from '../types';

/** Range multiplier for a tower or the Warden standing on a hill. */
export const HILL_REACH = 1.25;
/** Speed multiplier for a shadow wading through water. */
export const WATER_SLOW = 0.6;
/** Extra damage share Thunder Pulse deals to shadows standing in water. */
export const WATER_THUNDER = 0.6;
/** Trees block a line that passes this deep inside a wood (share of its radius). */
const WOOD_CORE = 0.85;

/** One round patch in simulation pixels. */
interface Patch { x: number; y: number; r: number }
interface Terrain { hills: Patch[]; woods: Patch[]; water: Patch[] }

const cache = new WeakMap<MapDef, Terrain>();
const toPx = ([x, y, r]: [number, number, number]): Patch => ({ x: (x + 0.5) * T, y: (y + 0.5) * T, r: r * T });

function terrainOf(map: MapDef): Terrain {
  let t = cache.get(map);
  if (!t) {
    const d = map.terrain;
    t = { hills: (d?.hills ?? []).map(toPx), woods: (d?.woods ?? []).map(toPx), water: (d?.water ?? []).map(toPx) };
    cache.set(map, t);
  }
  return t;
}

const inside = (ps: Patch[], x: number, y: number, pad = 0) => ps.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + pad);

export const onHill = (map: MapDef, x: number, y: number) => inside(terrainOf(map).hills, x, y);
export const inWater = (map: MapDef, x: number, y: number) => inside(terrainOf(map).water, x, y);
export const inWoods = (map: MapDef, x: number, y: number) => inside(terrainOf(map).woods, x, y);

/** Range multiplier for something standing at this point. */
export const reachAt = (map: MapDef, x: number, y: number) => (onHill(map, x, y) ? HILL_REACH : 1);

/** Trees and water keep towers out; a tower may stand on a hill. */
export const terrainBlocksBuild = (map: MapDef, x: number, y: number) =>
  inside(terrainOf(map).woods, x, y, 0.15 * T) || inside(terrainOf(map).water, x, y, 0.2 * T);

/** Whether a straight shot from (ax, ay) to (bx, by) passes through a wood. */
export function lineBlocked(map: MapDef, ax: number, ay: number, bx: number, by: number) {
  const woods = terrainOf(map).woods;
  if (!woods.length) return false;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  for (const w of woods) {
    const t = Math.max(0, Math.min(1, ((w.x - ax) * dx + (w.y - ay) * dy) / len2));
    if (Math.hypot(ax + dx * t - w.x, ay + dy * t - w.y) < w.r * WOOD_CORE) return true;
  }
  return false;
}

/** Whether any wood lies within `range` pixels of a point, for the placement hint. */
export const woodsNear = (map: MapDef, x: number, y: number, range: number) =>
  terrainOf(map).woods.some((w) => Math.hypot(w.x - x, w.y - y) < range + w.r * WOOD_CORE);

export const hasTerrain = (map: MapDef) => {
  const t = terrainOf(map);
  return !!(t.hills.length || t.woods.length || t.water.length);
};

// ---------- rifts that move ----------

/** How many rifts (roads into the heart) a map has. */
export const riftCount = (map: MapDef) => 1 + (map.rifts?.length ?? 0);

/** Which rift a wave comes from: an index into the game's `paths`. */
export function waveRift(map: MapDef, wave: number) {
  const order = map.riftOrder;
  if (!order?.length || riftCount(map) < 2) return 0;
  return order[(Math.max(1, wave) - 1) % order.length] % riftCount(map);
}

/** Every road on a map in tile waypoints, the main one first. */
export const roadsOf = (map: MapDef): [number, number][][] => [map.pts, ...(map.rifts ?? [])];

/** The road a shadow walks. */
export const roadOf = (g: Game, e: Enemy): Path => g.paths[e.road ?? 0] ?? g.path;

/** Which side of the board a rift opens on, for the next-wave preview. */
export function riftSide(map: MapDef, rift: number): 'north' | 'south' | 'east' | 'west' {
  const road = roadsOf(map)[rift] ?? map.pts;
  const [x0, y0] = road[0], [x1, y1] = road[1];
  if (y1 > y0) return 'north';
  if (y1 < y0) return 'south';
  return x1 > x0 ? 'west' : 'east';
}
// ---------- end rifts that move ----------
