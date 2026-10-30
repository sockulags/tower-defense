import type { EnemyType, MapDef, QueueItem } from '../types';

export const hpMultiplier = (map: MapDef, wave: number) =>
  (1 + 0.14 * (wave - 1) + 0.009 * (wave - 1) * (wave - 1)) * map.hard;

export const isGiantWave = (wave: number) => wave % 10 === 0;

export function makeWave(n: number): QueueItem[] {
  const q: QueueItem[] = [];
  const add = (type: EnemyType, count: number, gap: number) => { for (let i = 0; i < count; i++) q.push({ type, gap }); };
  const base = 5 + Math.floor(n * 1.4);

  if (isGiantWave(n)) {
    add('crawler', base, 0.5);
    add('lump', Math.floor(n / 4), 1);
  } else if (n % 5 === 0) {
    add('flitter', base + 5, 0.32);
  } else {
    add('crawler', base, 0.7);
    if (n >= 3) add('flitter', Math.floor(n / 2), 0.4);
    if (n >= 4) add('lump', Math.floor((n - 2) / 3), 1.2);
    if (n >= 6) add('shimmer', Math.floor((n - 4) / 2), 0.8);
  }
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  // Giants arrive last, after the escort.
  if (isGiantWave(n)) for (let i = 0; i < Math.max(1, Math.floor(n / 10)); i++) q.push({ type: 'giant', gap: 3 });
  return q;
}
