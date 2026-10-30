// Combos between towers: a tower's direct hit on a shadow that another tower has left in a state
// (chilled, frozen, stunned, burning) does something extra. Each combo is one row in COMBOS, so a
// new combo is a new id in `ComboId` (types.ts), a row here, and its word in src/i18n.
//
// combat.ts asks `findCombo` on every direct tower hit, applies the multiplier and the burst, and
// calls `recordCombo`, which counts it and queues a short word for the view to letter over the
// shadow. Words are rate-limited so a busy wave stays readable.
import type { ComboId, ComboLog, Enemy, Game, Source, TowerType } from '../types';

/** States a shadow can be in that combos look for. */
export type ShadowState = 'chilled' | 'frozen' | 'stunned' | 'burning';

export interface ComboDef {
  id: ComboId;
  /** The tower type whose direct hit sets it off. */
  by: TowerType;
  /** The shadow must be in at least one of these states when the hit lands. */
  on: ShadowState[];
  /** Multiplier on the triggering hit. */
  mult: number;
  /** A burst around the shadow: other shadows within `r` tiles take `share` of the hit. */
  burst?: { r: number; share: number };
  /** Seconds before the same shadow can set this combo off again; 0 means every hit. */
  cooldown: number;
  /** Lettering colour for the word. */
  color: string;
}

// Tuned with `npm run balance` so mixed builds standing near each other beat single tower types.
export const COMBOS: Record<ComboId, ComboDef> = {
  // Starfall on a chilled or frozen shadow: the ice shatters for double damage.
  shatter: { id: 'shatter', by: 'star', on: ['chilled', 'frozen'], mult: 2, cooldown: 0, color: '#bfe8ff' },
  // Ember's flame on a chilled shadow: a puff of steam scalds the shadows around it.
  steam: { id: 'steam', by: 'pulse', on: ['chilled', 'frozen'], mult: 1, burst: { r: 1.1, share: 0.4 }, cooldown: 1, color: '#fff4e0' },
  // Spark on a stunned (or frozen) shadow: the charge runs straight through it.
  conduct: { id: 'conduct', by: 'spark', on: ['stunned'], mult: 2, cooldown: 0, color: '#ffe066' },
};

export const COMBO_ORDER: ComboId[] = ['shatter', 'steam', 'conduct'];

/**
 * Until when a tower has left each shadow chilled or stunned. Combos are between towers, so a chill
 * or stun from the Warden's abilities does not count.
 */
const byTower = new WeakMap<Enemy, { chill: number; stun: number }>();

/** combat.ts calls this after a tower's hit may have chilled or stunned a shadow, with the values from before. */
export function noteTowerStatus(e: Enemy, was: { stun: number; slowUntil: number }) {
  if (e.stun === was.stun && e.slowUntil === was.slowUntil) return;
  const m = byTower.get(e) ?? { chill: 0, stun: 0 };
  if (e.stun !== was.stun) m.stun = e.stun;
  if (e.slowUntil !== was.slowUntil) m.chill = e.slowUntil;
  byTower.set(e, m);
}

const chilled = (g: Game, e: Enemy) => e.slowUntil > g.t && (byTower.get(e)?.chill ?? 0) > g.t;
const stunned = (g: Game, e: Enemy) => e.stun > g.t && (byTower.get(e)?.stun ?? 0) > g.t;

const STATE: Record<ShadowState, (g: Game, e: Enemy) => boolean> = {
  chilled,
  // A freeze holds the shadow still and chills it.
  frozen: (g, e) => stunned(g, e) && chilled(g, e),
  stunned,
  burning: (g, e) => e.burnUntil > g.t,
};

/** When each shadow last set each combo off, for cooldowns. */
const lastFired = new WeakMap<Enemy, Partial<Record<ComboId, number>>>();

/** The combo this direct hit sets off, if any. Only towers set combos off, not the Warden. */
export function findCombo(g: Game, e: Enemy, src: Source | null): ComboDef | null {
  if (!src || 'isHero' in src) return null;
  for (const id of COMBO_ORDER) {
    const c = COMBOS[id];
    if (c.by !== src.type || !c.on.some((s) => STATE[s](g, e))) continue;
    const at = lastFired.get(e)?.[id];
    if (c.cooldown && at !== undefined && g.t - at < c.cooldown) continue;
    return c;
  }
  return null;
}

// ---------- words over the shadow ----------

/** How long a combo word stays up, in seconds of game time here and of real time in the view. */
export const WORD_LIFE = 0.9;
/** Words are kept a little longer than they show, and never more than this many, for the view to find. */
const KEEP_WORDS = 12;
/** At most this many words on the board at once. */
const MAX_WORDS = 4;
/** One word per shadow at a time. */
const WORD_GAP = 0.8;
/** The same word is not repeated within this many pixels and seconds. */
const SAME_NEAR = 60, SAME_GAP = 0.45;

export const comboLog = (g: Game): ComboLog =>
  (g.combo ??= { counts: { shatter: 0, steam: 0, conduct: 0 }, words: [] });

/** Counts a combo and, unless the board is already busy with words, letters it over the shadow. */
export function recordCombo(g: Game, c: ComboDef, e: Enemy, forceWord = false) {
  const log = comboLog(g);
  log.counts[c.id]++;
  const fired = lastFired.get(e) ?? {};
  fired[c.id] = g.t;
  lastFired.set(e, fired);
  log.words = log.words.filter((w) => g.t - w.at < 3 * WORD_LIFE && g.t >= w.at).slice(-KEEP_WORDS);
  if (!forceWord) {
    if (log.words.filter((w) => g.t - w.at < WORD_LIFE).length >= MAX_WORDS) return;
    if (log.words.some((w) => w.enemy === e && g.t - w.at < WORD_GAP)) return;
    if (log.words.some((w) => w.id === c.id && g.t - w.at < SAME_GAP && Math.hypot(w.x - e.x, w.y - e.y) < SAME_NEAR)) return;
  }
  log.words.push({ id: c.id, enemy: e, x: e.x, y: e.y, at: g.t });
}
