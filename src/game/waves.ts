import type { EnemyType, MapDef, QueueItem, WaveSpec } from '../types';

export const hpMultiplier = (map: MapDef, wave: number) =>
  (1 + 0.14 * (wave - 1) + 0.009 * (wave - 1) * (wave - 1)) * map.hard;

/** The groups of a wave on a map. A survival map repeats its list with 35 % more shadows per round. */
export function waveSpec(map: MapDef, n: number): WaveSpec {
  const list = map.waveList, i = (Math.max(1, n) - 1) % list.length, round = Math.floor((Math.max(1, n) - 1) / list.length);
  if (!round) return list[i];
  return list[i].map(([type, count, gap]) => [type, type === 'giant' ? count + round : Math.round(count * (1 + 0.35 * round)), gap]);
}

export const isGiantWave = (map: MapDef, wave: number) => waveSpec(map, wave).some(([t]) => t === 'giant');

/** What a wave will send, grouped by shadow type, for the next-wave preview. */
export function wavePreview(map: MapDef, n: number): { type: EnemyType; count: number }[] {
  const out: { type: EnemyType; count: number }[] = [];
  for (const [type, count] of waveSpec(map, n)) {
    const have = out.find((o) => o.type === type);
    if (have) have.count += count; else out.push({ type, count });
  }
  return out;
}

/**
 * The spawn queue for a wave. Groups are woven together evenly over the wave, so a mixed wave
 * arrives mixed; giants always come last, after their escort. Deterministic, so the preview is exact.
 */
export function makeWave(map: MapDef, n: number): QueueItem[] {
  const items: { type: EnemyType; gap: number; at: number }[] = [];
  const giants: QueueItem[] = [];
  for (const [type, count, gap] of waveSpec(map, n)) {
    for (let i = 0; i < count; i++) {
      if (type === 'giant') giants.push({ type, gap });
      else items.push({ type, gap, at: (i + 0.5) / count });
    }
  }
  items.sort((a, b) => a.at - b.at);
  return [...items.map(({ type, gap }) => ({ type, gap })), ...giants];
}
