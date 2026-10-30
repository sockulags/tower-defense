import { TOWERS, TOWER_ORDER } from './data/towers';
import { mapOpen, persist, playerLevel, save } from './save';
import type { Game, MapId, Tower, TowerType } from './types';

export interface RunResult {
  win: boolean;
  cleared: number;
  dust: number;
  newBest: boolean;
  levelBefore: number;
  levelAfter: number;
  newTowers: TowerType[];
  newMaps: MapId[];
  hero: Tower | null;
}

/** Pays out stardust for a finished run and records progress. */
export function finishRun(g: Game, win: boolean): RunResult {
  const m = g.map;
  const cleared = win ? m.waves : g.cleared;
  const dust = m.survival ? cleared * 3 : Math.round((cleared * 2 + (win ? 25 + g.lives : 0)) * m.hard);
  const levelBefore = playerLevel();
  const marshWasOpen = mapOpen('marsh');

  save.dust += dust;
  save.total += dust;
  const newBest = cleared > save.best[m.id];
  if (newBest) save.best[m.id] = cleared;
  if (win) save.won[m.id] = true;
  persist();

  const levelAfter = playerLevel();
  const newTowers = TOWER_ORDER.filter((t) => {
    const u = TOWERS[t].unlock ?? 1;
    return u > levelBefore && u <= levelAfter;
  });
  const newMaps: MapId[] = !marshWasOpen && mapOpen('marsh') ? ['marsh'] : [];
  const hero = [...g.towers].sort((a, b) => b.dealt - a.dealt)[0] ?? null;

  return { win, cleared, dust, newBest, levelBefore, levelAfter, newTowers, newMaps, hero };
}
