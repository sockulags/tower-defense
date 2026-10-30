import { COLS, H, ROWS, T, W } from '../config';
import type { MapDef, Path } from '../types';

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pre-renders the static ground and road for a map. */
export function renderBackground(map: MapDef, path: Path): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const rnd = mulberry(map.seed);

  g.fillStyle = '#151925';
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const v = rnd();
    g.fillStyle = `rgba(${(70 + v * 30) | 0},${(95 + v * 40) | 0},105,${0.05 + v * 0.06})`;
    g.fillRect(x * T, y * T, T, T);
  }
  g.lineWidth = 1.3;
  for (let i = 0; i < 700; i++) {
    const x = rnd() * W, y = rnd() * H;
    g.strokeStyle = `rgba(120,175,140,${0.07 + rnd() * 0.14})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 4 - 2, y - 3 - rnd() * 6); g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W, y = rnd() * H;
    g.fillStyle = `rgba(200,190,230,${0.05 + rnd() * 0.08})`;
    g.beginPath(); g.arc(x, y, 1 + rnd() * 2.5, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.028)';
  g.lineWidth = 1;
  for (let x = 1; x < COLS; x++) { g.beginPath(); g.moveTo(x * T + 0.5, 0); g.lineTo(x * T + 0.5, H); g.stroke(); }
  for (let y = 1; y < ROWS; y++) { g.beginPath(); g.moveTo(0, y * T + 0.5); g.lineTo(W, y * T + 0.5); g.stroke(); }

  g.lineJoin = 'round';
  g.lineCap = 'round';
  const road = () => { g.beginPath(); path.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); };
  road(); g.strokeStyle = '#0c0d15'; g.lineWidth = T * 0.92; g.stroke();
  road(); g.strokeStyle = '#2d2940'; g.lineWidth = T * 0.78; g.stroke();
  road(); g.strokeStyle = 'rgba(255,230,190,0.06)'; g.setLineDash([3, 15]); g.lineWidth = T * 0.42; g.stroke(); g.setLineDash([]);
  return c;
}
