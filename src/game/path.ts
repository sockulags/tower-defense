import { COLS, ROWS, T } from '../config';
import type { MapDef, Path, Pt } from '../types';

/** A road from tile waypoints; by default the map's main road (rifts that move pass another). */
export function buildPath(map: MapDef, road: [number, number][] = map.pts): Path {
  const pts = road.map(([x, y]) => ({ x: (x + 0.5) * T, y: (y + 0.5) * T }));
  const segs: Path['segs'] = [];
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, l, start: len });
    len += l;
  }
  // Waypoints are axis-aligned, so walk each segment tile by tile.
  const tiles = new Set<string>();
  for (let i = 0; i < road.length - 1; i++) {
    const [x0, y0] = road[i], [x1, y1] = road[i + 1];
    const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    let x = x0, y = y0;
    for (;;) {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) tiles.add(x + ',' + y);
      if (x === x1 && y === y1) break;
      x += sx; y += sy;
    }
  }
  return { pts, segs, len, tiles };
}

export function posAt(p: Path, d: number): Pt {
  if (d <= 0) return { x: p.pts[0].x, y: p.pts[0].y };
  for (const s of p.segs) {
    if (d <= s.start + s.l) {
      const f = (d - s.start) / s.l;
      return { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f };
    }
  }
  const e = p.pts[p.pts.length - 1];
  return { x: e.x, y: e.y };
}

export const heartOf = (p: Path) => p.pts[p.pts.length - 1];

/** Shortest distance from a point to the road centreline, in simulation pixels. */
export function distToPath(p: Path, x: number, y: number) {
  let best = Infinity;
  for (const s of p.segs) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (y - s.a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(x - s.a.x - dx * t, y - s.a.y - dy * t));
  }
  return best;
}

/** Rifts that move: shortest distance from a point to any of the roads. */
export const distToPaths = (paths: Path[], x: number, y: number) => Math.min(...paths.map((p) => distToPath(p, x, y)));
