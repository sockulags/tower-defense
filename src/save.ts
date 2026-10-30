// Progress between runs, kept per local profile so several people can share one device.
// Each profile has its own save key; a small index remembers the profiles and which one is active.
// The exported `save` object keeps its identity when the profile changes: switching replaces its
// contents, so every module that imported it sees the new profile at once.
import type { MapId, TowerType } from './types';
import type { UpgradeId } from './data/upgrades';
import { TOWERS, TOWER_ORDER } from './data/towers';
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
  /** Finished runs, sandbox excluded. */
  runs: number;
  /** The map of the latest run, so Play can continue where the player left off. */
  last: MapId | null;
  /** First-run hints already done; they never come back for this profile. */
  hints: string[];
  /** True once the player signed the watch book or skipped it. */
  named: boolean;
}

export interface ProfileInfo { id: string; name: string }
interface ProfileIndex { active: string; list: ProfileInfo[] }

/** The save from before profiles existed; it becomes the first profile. */
const LEGACY_KEY = 'duskwatch-save-v1';
const INDEX_KEY = 'duskwatch-profiles-v1';
const saveKey = (id: string) => `duskwatch-save-v1:${id}`;
export const DEFAULT_NAME = 'Watcher';

const fresh = (): SaveData => ({
  dust: 0, total: 0,
  up: { gold: 0, lives: 0, dmg: 0, craft: 0 },
  best: { mill: 0, marsh: 0, ring: 0 },
  won: {},
  hero: { owned: [...STARTING_ITEMS], equip: { ...DEFAULT_LOADOUT }, talents: { might: 0, reach: 0, focus: 0, veteran: 0 } },
  runs: 0, last: null, hints: [], named: false,
});

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: play without saving */ }
}

/** Fills in fields that older saves lack. */
function upgrade(raw: unknown): SaveData {
  const d = fresh();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw as Partial<SaveData>;
  const hero = {
    owned: Array.from(new Set([...d.hero.owned, ...(s.hero?.owned ?? [])])),
    equip: { ...d.hero.equip, ...s.hero?.equip },
    talents: { ...d.hero.talents, ...s.hero?.talents },
  };
  const out: SaveData = {
    ...d, ...s,
    up: { ...d.up, ...s.up }, best: { ...d.best, ...s.best }, won: { ...s.won }, hero,
    hints: Array.isArray(s.hints) ? [...s.hints] : [],
  };
  // A save from before profiles has no run count; any progress means at least one run was played.
  if (typeof s.runs !== 'number') out.runs = out.total > 0 ? 1 : 0;
  if (typeof s.named !== 'boolean') out.named = out.runs > 0;
  return out;
}

function loadIndex(): ProfileIndex {
  const idx = read(INDEX_KEY) as ProfileIndex | null;
  if (idx && Array.isArray(idx.list) && idx.list.length && idx.list.some((p) => p.id === idx.active)) return idx;
  // First start with profiles: the existing save, if any, becomes the first profile.
  const first: ProfileInfo = { id: 'p1', name: DEFAULT_NAME };
  const legacy = read(LEGACY_KEY);
  if (legacy && !read(saveKey(first.id))) write(saveKey(first.id), upgrade(legacy));
  const made = { active: first.id, list: [first] };
  write(INDEX_KEY, made);
  return made;
}

const index = loadIndex();
export const save: SaveData = upgrade(read(saveKey(index.active)));

export function persist() {
  write(saveKey(index.active), save);
}

/** Replaces the contents of `save` without replacing the object. */
function replaceSave(next: SaveData) {
  for (const k of Object.keys(save)) delete (save as unknown as Record<string, unknown>)[k];
  Object.assign(save, next);
}

// ---------- profiles ----------

export const profiles = (): readonly ProfileInfo[] => index.list;
export const activeProfile = (): ProfileInfo => index.list.find((p) => p.id === index.active)!;

/** Watch level, name and Warden of any profile, for the profile list. */
export function profileSummary(id: string): { name: string; level: number; equip: Loadout } {
  const p = index.list.find((q) => q.id === id)!;
  const data = id === index.active ? save : upgrade(read(saveKey(id)));
  return { name: p.name, level: levelFor(data.total), equip: data.hero.equip };
}

export function switchProfile(id: string) {
  if (id === index.active || !index.list.some((p) => p.id === id)) return;
  persist();
  index.active = id;
  write(INDEX_KEY, index);
  replaceSave(upgrade(read(saveKey(id))));
}

/** Makes a new profile with a fresh save and switches to it. */
export function newProfile(name: string): ProfileInfo {
  let n = index.list.length + 1;
  while (index.list.some((p) => p.id === `p${n}`)) n++;
  const p = { id: `p${n}`, name: cleanName(name) || `${DEFAULT_NAME} ${n}` };
  index.list.push(p);
  write(saveKey(p.id), fresh());
  switchProfile(p.id);
  return p;
}

export function renameProfile(name: string) {
  const clean = cleanName(name);
  if (!clean) return;
  activeProfile().name = clean;
  write(INDEX_KEY, index);
}

/** Wipes the active profile's progress but keeps its name. */
export function resetProfile() {
  replaceSave({ ...fresh(), named: true });
  persist();
}

export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 24);

// ---------- progress ----------

export const levelThreshold = (level: number) => Math.round(15 * Math.pow(level - 1, 1.7));

function levelFor(total: number) {
  let level = 1;
  while (total >= levelThreshold(level + 1)) level++;
  return level;
}
export const playerLevel = () => levelFor(save.total);

export const metaDamage = () => 1 + 0.06 * save.up.dmg;
/** Multiplier on tower upgrade prices. */
export const metaDiscount = () => 1 - 0.06 * save.up.craft;
export const towerUnlocked = (t: TowerType) => playerLevel() >= (TOWERS[t].unlock ?? 1);
/** Survival opens once every tower is unlocked, so it is always played with the full set. */
export const survivalOpen = () => TOWER_ORDER.every(towerUnlocked);
export const mapOpen = (id: MapId) => (id === 'marsh' ? !!save.won.mill : id === 'ring' ? survivalOpen() : true);
export const owns = (slot: string, id: string) => save.hero.owned.includes(`${slot}:${id}`);

export const hintDone = (id: string) => save.hints.includes(id);
export function markHint(id: string) {
  if (hintDone(id)) return;
  save.hints.push(id);
  persist();
}
