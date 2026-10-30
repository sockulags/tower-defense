import type { MapId, TowerType } from './types';
import type { UpgradeId } from './data/upgrades';
import { TOWERS } from './data/towers';
import { DEFAULT_LOADOUT, STARTING_ITEMS, type Loadout, type TalentId } from './data/hero';

export interface SaveData {
  dust: number;
  /** Lifetime stardust earned; drives the watch level. */
  total: number;
  up: Record<UpgradeId, number>;
  best: Record<MapId, number>;
  won: Partial<Record<MapId, boolean>>;
  hero: {
    /** Unlocked items as 'slot:id', e.g. 'weapon:bell'. */
    owned: string[];
    equip: Loadout;
    talents: Record<TalentId, number>;
  };
}

const KEY = 'duskwatch-save-v1';
const fresh = (): SaveData => ({
  dust: 0, total: 0,
  up: { gold: 0, lives: 0, dmg: 0, craft: 0 },
  best: { mill: 0, marsh: 0, ring: 0 },
  won: {},
  hero: { owned: [...STARTING_ITEMS], equip: { ...DEFAULT_LOADOUT }, talents: { might: 0, reach: 0, focus: 0, veteran: 0 } },
});

export const save: SaveData = load();

function load(): SaveData {
  const d = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const hero = {
        owned: Array.from(new Set([...d.hero.owned, ...(s.hero?.owned ?? [])])),
        equip: { ...d.hero.equip, ...s.hero?.equip },
        talents: { ...d.hero.talents, ...s.hero?.talents },
      };
      return { ...d, ...s, up: { ...d.up, ...s.up }, best: { ...d.best, ...s.best }, won: { ...s.won }, hero };
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
/** Multiplier on tower upgrade prices. */
export const metaDiscount = () => 1 - 0.06 * save.up.craft;
export const towerUnlocked = (t: TowerType) => playerLevel() >= (TOWERS[t].unlock ?? 1);
export const mapOpen = (id: MapId) => id !== 'marsh' || !!save.won.mill;
export const owns = (slot: string, id: string) => save.hero.owned.includes(`${slot}:${id}`);
