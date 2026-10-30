import { COLS, ROWS, T } from '../config';
import type { MapDef, Path, Pt } from '../types';

export function buildPath(map: MapDef): Path {
  const pts = map.pts.map(([x, y]) => ({ x: (x + 0.5) * T, y: (y + 0.5) * T }));
  const segs: Path['segs'] = [];
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, l, start: len });
    len += l;
  }
  // Waypoints are axis-aligned, so walk each segment tile by tile.
  const tiles = new Set<string>();
  for (let i = 0; i < map.pts.length - 1; i++) {
    const [x0, y0] = map.pts[i], [x1, y1] = map.pts[i + 1];
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
