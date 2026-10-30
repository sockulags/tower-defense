// The Warden: placed once per run for free, levelled up with gold, with one ability the player
// casts. The weapon decides the attack and the ability; the charm adds a passive.
import { T } from '../config';
import { BADGE_BONUS, BADGE_RADIUS, EMBER_BURN, HERO_MAX_LEVEL, WEAPONS, heroUpgradeCost } from '../data/hero';
import { metaDamage } from '../save';
import { sfx } from '../audio';
import { L } from '../i18n';
import { applySlow, damage, inRange } from './combat';
import { burst, floatText } from './fx';
import { canBuild } from './towers';
import type { Game, Hero, Stats } from '../types';

export interface HeroStats extends Stats {
  /** Seconds between ability casts. */
  cooldown: number;
  /** Multiplier on ability damage. */
  power: number;
}

export function heroStats(h: Hero): HeroStats {
  const w = WEAPONS[h.loadout.weapon], lv = h.level - 1, t = h.talents;
  const dmg = w.dmg * (1 + 0.35 * lv) * (1 + 0.1 * t.might) * metaDamage();
  return {
    range: w.range * (1 + 0.05 * lv) * (1 + 0.08 * t.reach),
    rate: w.rate * Math.pow(0.93, lv),
    dmg,
    splash: 0, slow: 0, slowDur: 0, targets: 1,
    burn: h.loadout.charm === 'ember' ? dmg * EMBER_BURN : undefined,
    cooldown: w.cooldown * (1 - 0.1 * t.focus),
    power: (1 + 0.3 * lv) * (1 + 0.1 * t.might) * metaDamage(),
  };
}

export function placeHero(g: Game, x: number, y: number): Hero | null {
  if (g.hero || !canBuild(g, x, y)) return null;
  const h: Hero = {
    isHero: true, x, y, level: 1 + g.heroTalents.veteran, loadout: { ...g.loadout }, talents: { ...g.heroTalents },
    cd: 0, abilityCd: 0, castAt: -99, angle: -Math.PI / 2, kills: 0, dealt: 0, invested: 0, flash: 1,
  };
  g.hero = h;
  sfx.build();
  burst(g, x, y, WEAPONS[h.loadout.weapon].color, 20);
  floatText(g, x, y - 34, L().hero.arrives, '#ffc35a', 1.6, 17);
  return h;
}

export const canUpgradeHero = (g: Game) => !!g.hero && g.hero.level < HERO_MAX_LEVEL && g.gold >= heroUpgradeCost(g.hero.level);

export function upgradeHero(g: Game) {
  const h = g.hero;
  if (!h || !canUpgradeHero(g)) return;
  const cost = heroUpgradeCost(h.level);
  g.gold -= cost;
  h.invested += cost;
  h.level++;
  h.flash = 1;
  sfx.level();
  floatText(g, h.x, h.y - 34, L().fx.level(h.level), '#ffc35a', 1.4, 15);
  burst(g, h.x, h.y, WEAPONS[h.loadout.weapon].color, 18);
}

/** Casts the weapon's ability if it is ready. Returns whether it went off. */
export function castAbility(g: Game): boolean {
  const h = g.hero;
  if (!h || h.abilityCd > 0 || g.over) return false;
  const s = heroStats(h), color = WEAPONS[h.loadout.weapon].color;
  if (h.loadout.weapon === 'staff') {
    // Flare: a burst of lantern light that scorches and stuns everything close by.
    const R = 2 * T;
    for (const e of inRange(g, h.x, h.y, R)) { damage(g, e, 45 * s.power, h); e.stun = Math.max(e.stun, g.t + 1.2); }
    g.fx.push({ k: 'ring', x: h.x, y: h.y, r0: 10, r1: R, life: 0.6, max: 0.6, color });
    burst(g, h.x, h.y, color, 30);
  } else if (h.loadout.weapon === 'bell') {
    // Toll: one ring of the bell slows every shadow on the board.
    for (const e of g.enemies) {
      if (e.dead) continue;
      damage(g, e, 10 * s.power, h);
      applySlow(g, e, { ...s, slow: 0.55, slowDur: 3.5, freeze: 0 });
    }
    g.fx.push({ k: 'ring', x: h.x, y: h.y, r0: 10, r1: 14 * T, life: 1, max: 1, color });
  } else {
    // Shooting Star: a heavy shot at whichever shadow is closest to the heart, anywhere on the board.
    const target = g.enemies.filter((e) => !e.dead).sort((a, b) => b.d - a.d)[0];
    if (!target) return false;
    const tx = target.x, ty = target.y;
    damage(g, target, 160 * s.power, h);
    for (const e of inRange(g, tx, ty, T)) if (e !== target) damage(g, e, 60 * s.power, h);
    g.fx.push({ k: 'line', x: h.x, y: h.y, x2: tx, y2: ty, life: 0.35, max: 0.35, color });
    g.fx.push({ k: 'ring', x: tx, y: ty, r0: 6, r1: T * 1.1, life: 0.5, max: 0.5, color });
    burst(g, tx, ty, color, 24);
  }
  h.abilityCd = s.cooldown;
  h.castAt = g.t;
  h.flash = 1;
  sfx.boom();
  return true;
}

export function updateHero(g: Game, dt: number) {
  const h = g.hero;
  for (const t of g.towers) t.boost = 0;
  if (!h) return;
  h.flash = Math.max(0, h.flash - dt * 2);
  h.abilityCd = Math.max(0, h.abilityCd - dt);
  if (h.loadout.charm === 'badge') {
    for (const t of g.towers) if (Math.hypot(t.x - h.x, t.y - h.y) <= BADGE_RADIUS * T) t.boost = BADGE_BONUS;
  }
  h.cd -= dt;
  if (h.cd > 0) return;
  const s = heroStats(h), w = WEAPONS[h.loadout.weapon];
  const targets = inRange(g, h.x, h.y, s.range * T).sort((a, b) => b.d - a.d);
  if (!targets.length) return;
  h.cd = s.rate;
  h.angle = Math.atan2(targets[0].y - h.y, targets[0].x - h.x);
  if (w.kind === 'wave') {
    for (const e of targets) {
      damage(g, e, s.dmg, h);
      if (s.burn) { e.burnUntil = g.t + 3; e.burnDps = Math.max(e.burnDps, s.burn); e.burnSrc = h; }
    }
    g.fx.push({ k: 'ring', x: h.x, y: h.y, r0: 8, r1: s.range * T, life: 0.4, max: 0.4, color: w.color });
    sfx.pulse();
    return;
  }
  const e = targets[0];
  g.shots.push({
    x: h.x + Math.cos(h.angle) * T * 0.2, y: h.y + Math.sin(h.angle) * T * 0.2, target: e, tx: e.x, ty: e.y,
    speed: (w.kind === 'shot' ? 16 : 12) * T, dmg: s.dmg, src: h, look: 'hero', s, kind: 'shot', color: w.color,
  });
  sfx.shot();
}

/** How far the Warden reaches, in simulation pixels; used by the Firefly Jar charm. */
export const heroReach = (h: Hero) => heroStats(h).range * T;
