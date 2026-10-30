import { T } from '../config';
import { TOWERS } from '../data/towers';
import { sfx } from '../audio';
import { burst, floatText } from './fx';
import { JAR_GOLD } from '../data/hero';
import { heroReach } from './hero';
import { canHit, stats, towerAttrs, traitBonus } from './towers';
import { findCombo, noteTowerStatus, recordCombo } from './combos';
import { WATER_THUNDER, inWater, lineBlocked } from './terrain'; // terrain that matters
import type { Enemy, Game, Shot, Source, Stats, Tower, TowerAttrs } from '../types';

/** Smallest share of a hit that gets through armour. */
const ARMOUR_FLOOR = 0.25;

/**
 * Deals damage from a source. A direct hit (not `dot`, which is burning) gains the source's trait
 * bonuses and then loses the shadow's armour, but always keeps a quarter of the hit.
 */
export function damage(g: Game, e: Enemy, amount: number, src: Source | null, dot = false) {
  if (e.dead) return;
  // Combos between towers: a direct tower hit on a shadow another tower has left chilled, frozen or stunned.
  const combo = !dot && !comboDepth ? findCombo(g, e, src) : null;
  if (combo) amount *= combo.mult;
  const comboHit = amount;
  // end combos
  // Shadow traits: trait bonuses and armour.
  if (!dot) {
    if (src && !('isHero' in src)) amount *= traitBonus(towerAttrs(src.type, src.branch), e);
    if (e.armour) amount = Math.max(amount * ARMOUR_FLOOR, amount - e.armour);
  }
  const real = Math.min(e.hp, amount);
  e.hp -= amount;
  e.lastHit = g.t;
  if (src) src.dealt += real;
  if (e.hp <= 0) {
    e.dead = true;
    g.gold += e.reward;
    g.kills++;
    if (src) src.kills++;
    // Firefly Jar: shadows that fall near the Warden drop extra gold.
    const h = g.hero;
    if (h && h.loadout.charm === 'jar' && Math.hypot(e.x - h.x, e.y - h.y) <= heroReach(h)) {
      g.gold += JAR_GOLD;
      floatText(g, e.x, e.y - 16, `+${JAR_GOLD}`, '#d8ff9a', 0.9, 13);
    }
    burst(g, e.x, e.y, e.def.color, e.def.boss ? 40 : 10);
    sfx.kill(!!e.def.boss);
    if (e.def.boss) {
      g.shake = 0.5;
      floatText(g, e.x, e.y - 20, `+${e.reward}`, '#ffb547', 1.4, 18);
    }
  }
  // Combos between towers: count it, letter it, and burst onto the shadows around it.
  if (combo) {
    recordCombo(g, combo, e);
    if (combo.burst) comboBurst(g, e, combo.burst, comboHit, combo.color, src);
  }
}

// ---------- combos between towers ----------

/** Above zero while a combo's burst deals its damage, so a burst never sets off further combos. */
let comboDepth = 0;

function comboBurst(g: Game, e: Enemy, b: { r: number; share: number }, hit: number, color: string, src: Source | null) {
  const R = b.r * T;
  comboDepth++;
  try {
    for (const n of inRange(g, e.x, e.y, R)) if (n !== e) damage(g, n, hit * b.share, src);
  } finally {
    comboDepth--;
  }
  g.fx.push({ k: 'ring', x: e.x, y: e.y, r0: 4, r1: R, life: 0.4, max: 0.4, color });
}
// ---------- end combos between towers ----------

/** Live shadows within `r` pixels; with `attrs`, only those the source can hit (flyers need `air`). */
export const inRange = (g: Game, x: number, y: number, r: number, attrs?: TowerAttrs) =>
  g.enemies.filter((e) => !e.dead && Math.hypot(e.x - x, e.y - y) <= r && canHit(attrs, e));

export function applySlow(g: Game, e: Enemy, s: Stats) {
  const stillSlowed = e.slowUntil > g.t;
  // Bosses (the giant included) only take half the slow and can't be frozen.
  const amount = e.def.boss ? s.slow * 0.5 : s.slow;
  e.slowAmt = Math.max(stillSlowed ? e.slowAmt : 0, amount);
  e.slowUntil = g.t + s.slowDur;
  if (s.freeze && !e.def.boss && Math.random() < s.freeze) e.stun = g.t + 1.2;
}

export function updateTower(g: Game, t: Tower, dt: number) {
  t.flash = Math.max(0, t.flash - dt * 2);
  t.cd -= dt;
  if (t.cd > 0) return;
  const s = stats(t), r = s.range * T, d = TOWERS[t.type];
  // Target whoever is furthest along the road, among the shadows this tower can hit.
  // Terrain: trees block straight shots; Starfall's shells arc over and pulses spread through.
  const straight = d.kind === 'shot' && !s.area;
  const targets = inRange(g, t.x, t.y, r, s.attrs).filter((e) => !straight || !lineBlocked(g.map, t.x, t.y, e.x, e.y)).sort((a, b) => b.d - a.d);
  if (!targets.length) return;
  t.cd = s.rate;

  if (d.kind === 'pulse' || s.area) {
    // Terrain: Thunder Pulse hits harder on shadows standing in water.
    const thunder = t.type === 'pulse' && t.branch === 1;
    for (const e of targets) {
      damage(g, e, thunder && inWater(g.map, e.x, e.y) ? s.dmg * (1 + WATER_THUNDER) : s.dmg, t);
      if (s.burn) { e.burnUntil = g.t + 3; e.burnDps = Math.max(e.burnDps, s.burn); e.burnSrc = t; }
      const was = { stun: e.stun, slowUntil: e.slowUntil }; // combos
      if (s.stun && Math.random() < s.stun) e.stun = g.t + 0.6;
      if (s.slow) applySlow(g, e, s);
      noteTowerStatus(e, was); // combos: towers' chills and stuns can set combos off
    }
    g.fx.push({ k: 'ring', x: t.x, y: t.y, r0: T * 0.3, r1: r, life: 0.45, max: 0.45, color: d.color });
    sfx.fire(t.type);
    return;
  }

  for (const e of targets.slice(0, s.targets)) {
    t.angle = Math.atan2(e.y - t.y, e.x - t.x);
    g.shots.push({
      x: t.x + Math.cos(t.angle) * T * 0.25, y: t.y + Math.sin(t.angle) * T * 0.25,
      target: e, tx: e.x, ty: e.y, speed: (d.speed ?? 10) * T, dmg: s.dmg, src: t, look: t.type, s,
      kind: d.kind === 'shell' ? 'shell' : 'shot', color: d.color,
    });
  }
  sfx.fire(t.type);
}

export function impact(g: Game, sh: Shot) {
  if (sh.kind === 'shell') {
    const R = sh.s.splash * T;
    for (const e of inRange(g, sh.tx, sh.ty, R, sh.s.attrs)) {
      const falloff = 1 - 0.5 * Math.hypot(e.x - sh.tx, e.y - sh.ty) / R;
      damage(g, e, sh.dmg * falloff, sh.src);
    }
    g.fx.push({ k: 'ring', x: sh.tx, y: sh.ty, r0: 4, r1: R, life: 0.4, max: 0.4, color: sh.color });
    burst(g, sh.tx, sh.ty, sh.color, 14);
    sfx.thud();
    if (sh.s.shards) {
      const near = inRange(g, sh.tx, sh.ty, T * 2.2, sh.s.attrs);
      for (let i = 0; i < sh.s.shards && near.length; i++) {
        const e = near[Math.floor(Math.random() * near.length)];
        damage(g, e, sh.dmg * 0.35, sh.src);
        g.fx.push({ k: 'line', x: sh.tx, y: sh.ty, x2: e.x, y2: e.y, life: 0.2, max: 0.2, color: sh.color });
      }
    }
    return;
  }
  const e = sh.target;
  if (e.dead) return;
  damage(g, e, sh.dmg, sh.src);
  const was = { stun: e.stun, slowUntil: e.slowUntil }; // combos
  if (sh.s.slow) applySlow(g, e, sh.s);
  if (!('isHero' in sh.src)) noteTowerStatus(e, was); // combos: towers' chills and stuns can set combos off
  if (sh.s.burn) { e.burnUntil = g.t + 3; e.burnDps = Math.max(e.burnDps, sh.s.burn); e.burnSrc = sh.src; }
}
