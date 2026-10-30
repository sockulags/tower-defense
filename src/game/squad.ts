// The squad: a run always brings four tower types to the belt. Until a fifth tower is unlocked
// the four are simply the first four; after that the player picks them in the Lodge (Squad tab)
// or on a storybook page before Begin, and the choice is kept per profile in `save.squad`.
// Bots pick a squad for each map by trying every squad once (`botSquad` in game/bots.ts).
// No DOM here, so the simulation and the bots can use it headless.
import { TOWER_ORDER } from '../data/towers';
import { persist, save, towerUnlocked } from '../save';
import type { EnemyType, Game, MapDef, TowerType } from '../types';

export const SQUAD_SIZE = 4;
/** The squad before the squad unlocks: the first four towers. */
export const BASE_SQUAD: TowerType[] = TOWER_ORDER.slice(0, SQUAD_SIZE);

/** Unlocked tower types, in belt order. */
export const unlockedTowers = () => TOWER_ORDER.filter(towerUnlocked);

/** The squad unlocks with the fifth tower: once there are more towers than belt slots. */
export const squadOpen = () => unlockedTowers().length > SQUAD_SIZE;

/**
 * Makes any list into a valid squad: known, distinct types from `pool`, topped up in tower order
 * so it always has four (or every tower in the pool, if it has fewer).
 */
export function cleanSquad(list: readonly unknown[] | undefined, pool: readonly TowerType[] = TOWER_ORDER): TowerType[] {
  const out: TowerType[] = [];
  for (const t of list ?? []) if (pool.includes(t as TowerType) && !out.includes(t as TowerType) && out.length < SQUAD_SIZE) out.push(t as TowerType);
  for (const t of pool) if (out.length < SQUAD_SIZE && !out.includes(t)) out.push(t);
  return out;
}

/** The four towers the player brings to a run now. Locked towers never count. */
export function playerSquad(): TowerType[] {
  if (!squadOpen()) return [...BASE_SQUAD];
  return cleanSquad(save.squad, unlockedTowers());
}

export function setSquad(list: readonly TowerType[]) {
  save.squad = cleanSquad(list, unlockedTowers());
  persist();
}

/** Puts `type` into the squad. If it is already in, nothing changes; otherwise it takes `slot`'s place. */
export function bringTower(type: TowerType, slot: number) {
  const squad = playerSquad();
  if (squad.includes(type) || !towerUnlocked(type)) return squad;
  squad[Math.max(0, Math.min(SQUAD_SIZE - 1, slot))] = type;
  setSquad(squad);
  return playerSquad();
}

/** Unlocked towers left out of the squad. */
export const benchTowers = () => unlockedTowers().filter((t) => !playerSquad().includes(t));

/** Whether this run lets the player build a tower type: in its squad, or every tower in the lab. */
export const inSquad = (g: Game, type: TowerType) => !g.squad || g.squad.includes(type);

/** The tower types on this run's belt, in order. The lab's "all towers" switch shows every one. */
export const beltTowers = (g: Game): TowerType[] => (g.dev?.allTowers ? [...TOWER_ORDER] : g.squad ? [...g.squad] : [...BASE_SQUAD]);

// ---------- the shadows a map sends ----------

/** Every shadow type a map sends directly (not the Droplets that splitters break into), in first-seen order. */
export function mapShadows(map: MapDef): EnemyType[] {
  const out: EnemyType[] = [];
  for (const wave of map.waveList) for (const [type] of wave) if (!out.includes(type)) out.push(type);
  return out;
}

// ---------- bots pick squads ----------

/** Every possible squad of four from a pool of towers; bots try them to pick one (game/bots.ts). */
export function allSquads(pool: readonly TowerType[] = TOWER_ORDER): TowerType[][] {
  const out: TowerType[][] = [];
  const walk = (from: number, pick: TowerType[]) => {
    if (pick.length === SQUAD_SIZE) { out.push([...pick]); return; }
    for (let i = from; i < pool.length; i++) walk(i + 1, [...pick, pool[i]]);
  };
  walk(0, []);
  return out.length ? out : [[...pool]];
}
