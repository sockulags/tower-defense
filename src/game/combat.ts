import { T } from '../config';
import { TOWERS } from '../data/towers';
import { sfx } from '../audio';
import { burst, floatText } from './fx';
import { JAR_GOLD } from '../data/hero';
import { heroReach } from './hero';
import { stats } from './towers';
import type { Enemy, Game, Shot, Source, Stats, Tower } from '../types';

export function damage(g: Game, e: Enemy, amount: number, src: Source | null) {
  if (e.dead) return;
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
    burst(g, e.x, e.y, e.def.color, e.type === 'giant' ? 40 : 10);
    sfx.kill();
    if (e.type === 'giant') {
      g.shake = 0.5;
      floatText(g, e.x, e.y - 20, `+${e.reward}`, '#ffb547', 1.4, 18);
    }
  }
}

export const inRange = (g: Game, x: number, y: number, r: number) =>
  g.enemies.filter((e) => !e.dead && Math.hypot(e.x - x, e.y - y) <= r);

export function applySlow(g: Game, e: Enemy, s: Stats) {
  const stillSlowed = e.slowUntil > g.t;
  // Giants only take half the slow and can't be frozen.
  const amount = e.type === 'giant' ? s.slow * 0.5 : s.slow;
  e.slowAmt = Math.max(stillSlowed ? e.slowAmt : 0, amount);
  e.slowUntil = g.t + s.slowDur;
  if (s.freeze && e.type !== 'giant' && Math.random() < s.freeze) e.stun = g.t + 1.2;
}

export function updateTower(g: Game, t: Tower, dt: number) {
  t.flash = Math.max(0, t.flash - dt * 2);
  t.cd -= dt;
  if (t.cd > 0) return;
  const s = stats(t), r = s.range * T, d = TOWERS[t.type];
  // Target whoever is furthest along the road.
  const targets = inRange(g, t.x, t.y, r).sort((a, b) => b.d - a.d);
  if (!targets.length) return;
  t.cd = s.rate;

  if (d.kind === 'pulse' || s.area) {
    for (const e of targets) {
      damage(g, e, s.dmg, t);
      if (s.burn) { e.burnUntil = g.t + 3; e.burnDps = Math.max(e.burnDps, s.burn); e.burnSrc = t; }
      if (s.stun && Math.random() < s.stun) e.stun = g.t + 0.6;
      if (s.slow) applySlow(g, e, s);
    }
    g.fx.push({ k: 'ring', x: t.x, y: t.y, r0: T * 0.3, r1: r, life: 0.45, max: 0.45, color: d.color });
    sfx.pulse();
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
  if (d.kind === 'shell') sfx.shell(); else sfx.shot();
}

export function impact(g: Game, sh: Shot) {
  if (sh.kind === 'shell') {
    const R = sh.s.splash * T;
    for (const e of inRange(g, sh.tx, sh.ty, R)) {
      const falloff = 1 - 0.5 * Math.hypot(e.x - sh.tx, e.y - sh.ty) / R;
      damage(g, e, sh.dmg * falloff, sh.src);
    }
    g.fx.push({ k: 'ring', x: sh.tx, y: sh.ty, r0: 4, r1: R, life: 0.4, max: 0.4, color: sh.color });
    burst(g, sh.tx, sh.ty, sh.color, 14);
    sfx.boom();
    if (sh.s.shards) {
      const near = inRange(g, sh.tx, sh.ty, T * 2.2);
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
  if (sh.s.slow) applySlow(g, e, sh.s);
  if (sh.s.burn) { e.burnUntil = g.t + 3; e.burnDps = Math.max(e.burnDps, sh.s.burn); e.burnSrc = sh.src; }
}
