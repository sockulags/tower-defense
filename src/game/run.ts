import { T, W } from '../config';
import { ENEMIES } from '../data/enemies';
import { MAPS } from '../data/maps';
import { L } from '../i18n';
import { save } from '../save';
import { sfx } from '../audio';
import { damage, impact, updateTower } from './combat';
import { updateHero } from './hero';
import { floatText, updateFx } from './fx';
import { buildPath, heartOf, posAt } from './path';
import { hpMultiplier, isGiantWave, makeWave } from './waves';
import type { Enemy, EnemyType, Game, Hooks, MapId } from '../types';

export function createGame(mapId: MapId, hooks: Hooks): Game {
  const map = MAPS[mapId];
  const path = buildPath(map);
  const lives = 20 + 3 * save.up.lives;
  return {
    map, path,
    gold: 160 + 30 * save.up.gold, lives, maxLives: lives,
    wave: 0, cleared: 0, towers: [], enemies: [], shots: [], fx: [], queue: [],
    spawnT: 0, active: false, auto: false, autoT: 0, speed: 1, paused: false, over: false,
    selected: null, build: null, hover: null, t: 0, shake: 0, kills: 0, hooks,
    hero: null, heroSelected: false, loadout: { ...save.hero.equip }, heroTalents: { ...save.hero.talents },
  };
}

export function startWave(g: Game) {
  if (g.active || g.over) return;
  g.wave++;
  g.active = true;
  g.queue = makeWave(g.map, g.wave);
  g.spawnT = 0.3;
  sfx.wave();
  floatText(g, W / 2, 40, isGiantWave(g.map, g.wave) ? L().fx.giantWave(g.wave) : L().fx.wave(g.wave), '#ffb547', 1.8, 22);
}

/** Adds an enemy at the road's start, or `d` pixels along it, scaled for the current wave. */
export function spawnEnemy(g: Game, type: EnemyType, d = 0): Enemy {
  const def = ENEMIES[type];
  const hp = def.hp * hpMultiplier(g.map, Math.max(1, g.wave));
  const p = posAt(g.path, d);
  const e: Enemy = {
    type, def, hp, maxHp: hp, reward: Math.round(def.reward * (1 + 0.02 * g.wave)), d, x: p.x, y: p.y,
    slowUntil: 0, slowAmt: 0, stun: 0, burnUntil: 0, burnDps: 0, burnSrc: null, lastHit: -9,
    seed: Math.random() * 6.28, dead: false,
    armour: (def.armour ?? 0) * (1 + 0.02 * (Math.max(1, g.wave) - 1)), dashing: false, mending: !!def.regen,
  };
  g.enemies.push(e);
  return e;
}

function finish(g: Game, win: boolean) {
  g.over = true;
  g.active = false;
  g.hooks.ended(win);
}

export function update(g: Game, dt: number) {
  g.t += dt;
  g.shake = Math.max(0, g.shake - dt);

  if (g.active && g.queue.length) {
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      const q = g.queue.shift()!;
      spawnEnemy(g, q.type);
      g.spawnT = q.gap;
    }
  }

  for (const e of g.enemies) {
    if (e.dead) continue;
    if (e.burnUntil > g.t) damage(g, e, e.burnDps * dt, e.burnSrc, true);
    if (e.dead) continue;
    const frozen = e.stun > g.t, chilled = e.slowUntil > g.t;
    // Shadow traits: menders heal unless burning or frozen (half as fast while chilled).
    e.mending = !!e.def.regen && e.burnUntil <= g.t && !frozen;
    if (e.mending && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.def.regen! * (chilled ? 0.5 : 1) * dt);
    // Sprinters run in bursts unless chilled or frozen.
    const sprint = e.def.sprint;
    e.dashing = !!sprint && !frozen && !chilled && (g.t + e.seed) % sprint.every < sprint.dur;
    let sp = e.pinned ? 0 : e.def.speed * (e.dashing ? sprint!.mult : 1);
    if (frozen) sp = 0;
    else if (chilled) sp *= 1 - e.slowAmt;
    e.d += sp * T * dt;
    if (e.d >= g.path.len) {
      e.dead = true;
      if (!g.dev?.god) g.lives -= e.def.leak;
      g.shake = 0.35;
      sfx.leak();
      const heart = heartOf(g.path);
      floatText(g, heart.x, heart.y - 30, L().fx.lifeLost(e.def.leak), '#ff5f6d', 1.2, 16);
      continue;
    }
    const p = posAt(g.path, e.d);
    e.x = p.x; e.y = p.y;
  }

  updateHero(g, dt);
  for (const t of g.towers) updateTower(g, t, dt);

  for (const sh of g.shots) {
    if (!sh.target.dead) { sh.tx = sh.target.x; sh.ty = sh.target.y; }
    const dx = sh.tx - sh.x, dy = sh.ty - sh.y, dist = Math.hypot(dx, dy), step = sh.speed * dt;
    if (dist <= step) { sh.done = true; impact(g, sh); }
    else { sh.x += (dx / dist) * step; sh.y += (dy / dist) * step; }
  }
  g.shots = g.shots.filter((s) => !s.done);
  // Shadow traits: splitters that were killed (not leaked) break into smaller shadows where they fell.
  const splits = g.enemies.filter((e) => e.dead && e.hp <= 0 && e.def.split);
  g.enemies = g.enemies.filter((e) => !e.dead);
  for (const e of splits) {
    const { type, count } = e.def.split!;
    for (let i = 0; i < count; i++) spawnEnemy(g, type, Math.max(0, e.d + (i - (count - 1) / 2) * T * 0.3));
  }
  updateFx(g, dt);

  if (g.lives <= 0 && !g.over) { g.lives = 0; finish(g, false); return; }

  if (g.active && !g.queue.length && !g.enemies.length) {
    g.active = false;
    g.cleared = g.wave;
    const bonus = 15 + g.wave * 2;
    g.gold += bonus;
    floatText(g, W / 2, 40, L().fx.waveCleared(g.wave, bonus), '#7fc28a', 1.6, 20);
    if (g.wave >= g.map.waves) { finish(g, true); return; }
    g.autoT = 1.5;
  }
  if (!g.active && g.auto && !g.over) {
    g.autoT -= dt;
    if (g.autoT <= 0) startWave(g);
  }
}

/** Ends the run early because the player gave up. */
export function giveUp(g: Game) {
  if (!g.over) finish(g, false);
}
