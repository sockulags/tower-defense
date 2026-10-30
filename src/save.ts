import type { MapId, TowerType } from './types';
import type { UpgradeId } from './data/upgrades';
import { TOWERS } from './data/towers';

export interface SaveData {
  dust: number;
  /** Lifetime stardust earned; drives the watch level. */
  total: number;
  up: Record<UpgradeId, number>;
  best: Record<MapId, number>;
  won: Partial<Record<MapId, boolean>>;
}

const KEY = 'duskwatch-save-v1';
const fresh = (): SaveData => ({
  dust: 0, total: 0,
  up: { gold: 0, lives: 0, dmg: 0, xp: 0 },
  best: { mill: 0, marsh: 0, ring: 0 },
  won: {},
});

export const save: SaveData = load();

function load(): SaveData {
  const d = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...d, ...s, up: { ...d.up, ...s.up }, best: { ...d.best, ...s.best }, won: { ...s.won } };
    }
  } catch { /* storage unavailable: play without saving */ }
  return d;
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export const levelThreshold = (level: number) => Math.round(15 * Math.pow(level - 1, 1.7));

export function playerLevel() {
  let level = 1;
  while (save.total >= levelThreshold(level + 1)) level++;
  return level;
}

export const metaDamage = () => 1 + 0.06 * save.up.dmg;
export const metaXp = () => 1 + 0.15 * save.up.xp;
export const towerUnlocked = (t: TowerType) => playerLevel() >= (TOWERS[t].unlock ?? 1);
export const mapOpen = (id: MapId) => id !== 'marsh' || !!save.won.mill;
