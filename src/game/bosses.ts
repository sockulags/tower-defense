// Bosses with their own mechanics (docs/plans/gameplay.md, phase 6). Each story map sends its own
// boss on its boss waves (src/data/maps.ts); what a boss does is data on its EnemyDef
// (`boss` in src/data/enemies.ts), and the rules for each mechanic live here:
// - stomp (the Stomper): every few seconds it stomps and knocks the towers near it out.
// - steal (the Thief): halfway along the road it grabs gold and runs back to the rift.
// - mend (the Mender): it heals every shadow around it while it is not burning.
// Bosses also carry one shadow trait each, handled by the trait rules in run.ts and combat.ts.
// No DOM here: the view and the UI read `Enemy.boss` and `Tower.knocked`.
import { T } from '../config';
import { ENEMIES, ENEMY_ORDER, isBoss } from '../data/enemies';
import { L } from '../i18n';
import { sfx } from '../audio';
import { burst, floatText } from './fx';
import { posAt } from './path';
import { waveSpec } from './waves';
import type { BossState, Enemy, EnemyType, Game, MapDef } from '../types';

export { isBoss };

/** Every boss type, in gallery order. */
export const BOSS_TYPES: EnemyType[] = ENEMY_ORDER.filter(isBoss);

/** The boss a wave sends, if any. */
export function waveBoss(map: MapDef, wave: number): EnemyType | null {
  return waveSpec(map, wave).find(([t]) => isBoss(t))?.[0] ?? null;
}

/** A map's signature boss: the first boss its waves send. */
export function mapBoss(map: MapDef): EnemyType | null {
  for (const spec of map.waveList) for (const [t] of spec) if (isBoss(t)) return t;
  return null;
}

/** The Gloom's colours for each mechanic, shared with the view: stomp dust, stolen gold, mending light. */
export const BOSS_COLORS = { stomp: '#9b6bff', steal: '#ffcf4a', mend: '#d8ff7a' };

function state(e: Enemy): BossState {
  if (!e.boss) {
    const b = e.def.boss!;
    // The first stomp or mend comes a little after it arrives, so it reads as a boss first.
    e.boss = { at: -9, next: (b.stomp?.every ?? b.mend?.every ?? 0) * 0.6, loot: 0, fleeing: false };
  }
  return e.boss;
}

/** Road speed multiplier for a boss: a Thief with its loot runs back toward the rift. */
export const roadDirection = (e: Enemy) => (e.boss?.fleeing ? -(e.def.boss?.steal?.flee ?? 1) : 1);

/** Gold the Thief takes from a purse at this wave. */
export function stealAmount(g: Game, e: Enemy) {
  const s = e.def.boss!.steal!;
  return Math.max(0, Math.min(Math.floor(g.gold), Math.round(Math.min(g.gold * s.share, s.max + s.perWave * g.wave))));
}

// ---------- the mechanics ----------

/** Stomper: knocks out every tower within reach. Also used by the lab's button. */
export function stomp(g: Game, e: Enemy) {
  const s = e.def.boss!.stomp!, b = state(e), R = s.radius * T;
  b.at = g.t;
  for (const t of g.towers) {
    if (Math.hypot(t.x - e.x, t.y - e.y) > R) continue;
    t.knocked = Math.max(t.knocked ?? 0, s.knock);
    // A knocked-out tower cannot fire: its cooldown runs no shorter than the knock.
    t.cd = Math.max(t.cd, s.knock);
  }
  g.fx.push({ k: 'ring', x: e.x, y: e.y, r0: T * 0.3, r1: R, life: 0.6, max: 0.6, color: BOSS_COLORS.stomp });
  sfx.boom();
}

/** Thief: takes gold from the purse and turns back toward the rift. Also used by the lab's button. */
export function steal(g: Game, e: Enemy) {
  const b = state(e);
  if (b.fleeing) return;
  const take = stealAmount(g, e);
  g.gold -= take;
  b.loot += take;
  b.fleeing = true;
  b.at = g.t;
  floatText(g, e.x, e.y - 26, L().bosses.stole(take), BOSS_COLORS.steal, 1.6, 17);
  burst(g, e.x, e.y, BOSS_COLORS.steal, 14);
  sfx.leak();
}

/** The shadows a Mender reaches: every live one around it except bosses, so Menders never heal each other. */
const mendable = (g: Game, e: Enemy) => {
  const R = e.def.boss!.mend!.radius * T;
  return g.enemies.filter((n) => n !== e && !n.dead && !n.def.boss && Math.hypot(n.x - e.x, n.y - e.y) <= R);
};

/** Mender: heals the shadows around it. Also used by the lab's button. */
export function mend(g: Game, e: Enemy) {
  const s = e.def.boss!.mend!, b = state(e), R = s.radius * T;
  b.at = g.t;
  for (const n of mendable(g, e)) n.hp = Math.min(n.maxHp, n.hp + n.maxHp * s.heal);
  g.fx.push({ k: 'ring', x: e.x, y: e.y, r0: T * 0.3, r1: R, life: 0.7, max: 0.7, color: BOSS_COLORS.mend });
  sfx.pulse();
}

/**
 * Runs once per tick from run.ts, after movement and combat and before dead shadows are removed:
 * counts down knocked-out towers, returns a killed Thief's gold, lets an escaped Thief go, and
 * triggers each live boss's stomp, grab or mend.
 */
export function updateBosses(g: Game, dt: number) {
  for (const t of g.towers) if (t.knocked) t.knocked = Math.max(0, t.knocked - dt);
  for (const e of g.enemies) {
    const def = e.def.boss;
    if (!def) continue;
    const b = state(e);
    if (e.dead) {
      // Killing the Thief spills the gold it carried back into the purse.
      if (e.hp <= 0 && b.loot > 0) {
        g.gold += b.loot;
        floatText(g, e.x, e.y - 34, L().bosses.returned(b.loot), BOSS_COLORS.steal, 1.6, 18);
        burst(g, e.x, e.y, BOSS_COLORS.steal, 24);
        b.loot = 0;
      }
      continue;
    }
    if (def.steal) {
      if (!b.fleeing && e.d >= g.path.len * def.steal.at) steal(g, e);
      else if (b.fleeing && e.d <= 0) escape(g, e);
      continue;
    }
    // A stunned boss loses its rhythm: stomps and mends wait while it is stunned.
    if (e.stun > g.t) continue;
    b.next -= dt;
    if (b.next > 0) continue;
    if (def.stomp) { b.next = def.stomp.every; stomp(g, e); }
    else if (def.mend) {
      // Burning stops the mending, as for every shadow that mends.
      b.next = e.mending ? def.mend.every : 0.3;
      if (e.mending && mendable(g, e).length) mend(g, e);
    }
  }
}

/** The Thief made it back to the rift: the gold is gone and it costs lives like any leak. */
function escape(g: Game, e: Enemy) {
  const b = state(e);
  e.dead = true;
  if (!g.dev?.god) g.lives -= e.def.leak;
  const p = posAt(g.path, 0);
  floatText(g, p.x + T, p.y - 20, L().bosses.escaped(b.loot), BOSS_COLORS.steal, 1.8, 17);
  floatText(g, p.x + T, p.y + 4, L().fx.lifeLost(e.def.leak), '#ff5f6d', 1.4, 15);
  sfx.leak();
  b.loot = 0;
}

/** Live bosses on the board, for the health bars. */
export const liveBosses = (g: Game) => g.enemies.filter((e) => !e.dead && ENEMIES[e.type].boss);
