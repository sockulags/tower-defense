// Boons between waves: after every fifth cleared wave the run offers three boons and waits until
// the player takes one. Taken boons add up in the run's `BoonMods`, which towers and the Warden
// read through `boonStats` and `boonHeroStats`; gold and lives boons pay out once when taken.
// The data is in src/data/boons.ts. No DOM here, so bots can pick boons headless.
import { BOONS, BOON_CHOICES, BOON_EVERY, BOON_ORDER, type BoonId, type BoonMods } from '../data/boons';
import { TOWER_ORDER } from '../data/towers';
import { towerUnlocked } from '../save';
import { sfx } from '../audio';
import { floatText } from './fx';
import { W } from '../config';
import { L } from '../i18n';
import type { BoonState, Game, Hero, Stats, Tower, TowerType } from '../types';

export function newMods(): BoonMods {
  return {
    tower: Object.fromEntries(TOWER_ORDER.map((t) => [t, { dmg: 0, range: 0, rate: 0 }])) as BoonMods['tower'],
    splash: 0, slow: 0, freeze: 0, chillTime: 0, kindle: 0, burnDmg: 0, sunder: 0, allRate: 0,
    upgradeDiscount: 0, waveGold: 0, bounty: 0, interest: 0, interestCap: 0,
    heroDmg: 0, heroRange: 0, heroHaste: 0, heroRate: 0,
  };
}

export const newBoonState = (): BoonState => ({ taken: [], offer: null, mods: newMods(), enabled: true, anyTower: false });

/** Boons the run could still be offered: not taken yet, and tower boons only for towers the player can build. */
export function boonPool(g: Game): BoonId[] {
  const usable = (t: TowerType) => g.boons.anyTower || !!g.dev?.allTowers || towerUnlocked(t) || g.towers.some((x) => x.type === t);
  return BOON_ORDER.filter((id) => !g.boons.taken.includes(id) && (!BOONS[id].tower || usable(BOONS[id].tower!)));
}

/** Puts a choice of boons in front of the player now. Uses Math.random, which bots seed. */
export function offerBoons(g: Game) {
  const pool = boonPool(g);
  const offer: BoonId[] = [];
  while (offer.length < BOON_CHOICES && pool.length) offer.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  g.boons.offer = offer.length ? offer : null;
}

/** Takes one of the offered boons and closes the choice. Returns whether it was taken. */
export function takeBoon(g: Game, id: BoonId): boolean {
  const b = g.boons;
  if (!b.offer?.includes(id)) return false;
  b.offer = null;
  b.taken.push(id);
  const d = BOONS[id], m = b.mods;
  if (d.tower && d.towerMods) {
    const tm = m.tower[d.tower];
    tm.dmg += d.towerMods.dmg ?? 0;
    tm.range += d.towerMods.range ?? 0;
    tm.rate += d.towerMods.rate ?? 0;
  }
  for (const [k, v] of Object.entries(d.add ?? {}) as [Exclude<keyof BoonMods, 'tower'>, number][]) m[k] += v;
  g.gold += (d.gold ?? 0) + (d.goldPerWave ?? 0) * g.cleared;
  if (d.lives) { g.lives += d.lives; g.maxLives += d.lives; }
  sfx.level();
  floatText(g, W / 2, 70, L().boons.list[id].name, d.color, 1.6, 20);
  return true;
}

/** Waits for a choice: the next wave cannot start while boons are on offer. */
export const boonPending = (g: Game) => !!g.boons.offer;

/** Called when a wave is cleared (and the run goes on): extra gold, interest, and every fifth wave a choice. */
export function boonWaveCleared(g: Game): number {
  const m = g.boons.mods;
  const extra = m.waveGold + Math.min(m.interestCap, Math.floor(g.gold * m.interest));
  g.gold += extra;
  if (extra > 0) floatText(g, W / 2, 66, `+${extra}`, '#f0bf55', 1.4, 16);
  if (g.boons.enabled && g.wave % BOON_EVERY === 0) offerBoons(g);
  return extra;
}

/** Applies a tower's boons to its stats. `stats()` calls this last. */
export function boonStats(t: Tower, s: Stats) {
  const m = t.mods;
  if (!m) return;
  const tm = m.tower[t.type];
  s.dmg *= 1 + tm.dmg;
  s.range *= 1 + tm.range;
  s.rate /= (1 + tm.rate) * (1 + m.allRate);
  if (t.type === 'star') s.splash *= 1 + m.splash;
  if (t.type === 'frost') {
    s.slow = Math.min(0.8, s.slow + m.slow);
    s.slowDur *= 1 + m.chillTime;
    if (m.freeze) s.freeze = Math.min(0.6, (s.freeze ?? 0) + m.freeze);
  }
  if (t.type === 'pulse' && m.kindle) s.burn = (s.burn ?? 0) + s.dmg * m.kindle;
  if (s.burn) s.burn *= 1 + m.burnDmg;
}

/** Applies the Warden's boons to their stats. `heroStats()` calls this last. */
export function boonHeroStats(h: Hero, s: Stats & { cooldown: number; power: number }) {
  const m = h.mods;
  if (!m) return;
  s.dmg *= 1 + m.heroDmg;
  s.power *= 1 + m.heroDmg;
  s.range *= 1 + m.heroRange;
  s.cooldown /= 1 + m.heroHaste;
  s.rate /= 1 + m.heroRate;
  if (s.burn) s.burn *= 1 + m.burnDmg;
}

/** Multiplier on a tower's upgrade price. */
export const boonDiscount = (t: Tower) => 1 - (t.mods?.upgradeDiscount ?? 0);

/** A new shadow's gold and armour under the run's boons. */
export const boonReward = (g: Game, reward: number) => Math.round(reward * (1 + g.boons.mods.bounty));
export const boonArmour = (g: Game, armour: number) => armour * (1 - g.boons.mods.sunder);
