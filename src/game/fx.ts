import type { Game } from '../types';

export function burst(g: Game, x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, v = 40 + Math.random() * 120;
    g.fx.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.4, max: 0.7, color, size: 1.5 + Math.random() * 2.5 });
  }
}

export function floatText(g: Game, x: number, y: number, text: string, color: string, life: number, size: number) {
  g.fx.push({ k: 'txt', x, y, text, color, life, max: life, size });
}

export function updateFx(g: Game, dt: number) {
  for (const f of g.fx) {
    f.life -= dt;
    if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.94; f.vy *= 0.94; }
    if (f.k === 'txt') f.y -= 18 * dt;
  }
  g.fx = g.fx.filter((f) => f.life > 0);
}
