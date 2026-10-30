import { COLS, MAX_LEVEL, ROWS, T } from '../config';
import { TOWERS } from '../data/towers';
import { L } from '../i18n';
import { metaDamage, metaDiscount, towerUnlocked } from '../save';
import { sfx } from '../audio';
import { burst, floatText } from './fx';
import { distToPath } from './path';
import type { Game, Stats, Tower, TowerType } from '../types';

/** At this level the next upgrade is a choice between two branches. */
export const BRANCH_LEVEL = 3;
/** Towers earn a name when they reach this level, which is the branch upgrade. */
export const NAMED_LEVEL = 4;

export function stats(t: Tower): Stats {
  const d = TOWERS[t.type], lv = t.level - 1, b = t.branch;
  const s: Stats = {
    range: d.range * (1 + 0.06 * lv),
    rate: d.rate * Math.pow(0.93, lv),
    dmg: d.dmg * (1 + 0.3 * lv) * metaDamage(),
    splash: d.splash ?? 0,
    slow: d.slow ? Math.min(0.72, d.slow + 0.04 * lv) : 0,
    slowDur: d.slowDur ?? 0,
    targets: 1,
  };
  if (t.type === 'spark') { if (b === 0) s.targets = 2; if (b === 1) { s.range *= 1.6; s.dmg *= 2; s.rate *= 1.5; } }
  if (t.type === 'frost') { if (b === 0) s.freeze = 0.2; if (b === 1) { s.area = true; s.range *= 1.15; } }
  if (t.type === 'pulse') { if (b === 0) s.burn = s.dmg * 0.7; if (b === 1) { s.rate *= 0.7; s.stun = 0.25; } }
  if (t.type === 'star') { if (b === 0) { s.splash *= 1.6; s.dmg *= 1.4; } if (b === 1) s.shards = 5; }
  return s;
}

export const needsBranch = (t: Tower) => t.level === BRANCH_LEVEL && t.branch === null;
export const nickname = (t: Tower) => { const n = L().nicknames; return n[t.nick % n.length]; };

/** How far a tower's centre must stay from the road centreline, and from another tower. */
export const ROAD_CLEARANCE = 0.8 * T;
export const TOWER_SPACING = 0.95 * T;
const EDGE = 0.42 * T;

/** Towers stand anywhere on the grass: inside the board, off the road and not overlapping another tower. */
export function canBuild(g: Game, x: number, y: number) {
  if (x < EDGE || y < EDGE || x > COLS * T - EDGE || y > ROWS * T - EDGE) return false;
  if (distToPath(g.path, x, y) < ROAD_CLEARANCE) return false;
  return !g.towers.some((t) => Math.hypot(t.x - x, t.y - y) < TOWER_SPACING);
}

/** The tower whose footprint covers a point, if any. */
export const towerAt = (g: Game, x: number, y: number) =>
  g.towers.find((t) => Math.hypot(t.x - x, t.y - y) < TOWER_SPACING / 2);

/** `anyTower` skips the watch-level unlock check, for the menu's background demo. */
export function placeTower(g: Game, type: TowerType, x: number, y: number, anyTower = false): Tower | null {
  const d = TOWERS[type];
  if (g.gold < d.cost || !canBuild(g, x, y) || (!anyTower && !towerUnlocked(type))) return null;
  g.gold -= d.cost;
  const t: Tower = {
    type, x, y, level: 1, branch: null, cd: 0,
    invested: d.cost, angle: -Math.PI / 2, kills: 0, dealt: 0, nick: Math.floor(Math.random() * 1000), flash: 0,
  };
  g.towers.push(t);
  sfx.build();
  burst(g, t.x, t.y, d.color, 10);
  return t;
}

/** Gold price of the next level. */
export const upgradeCost = (tw: Tower) => Math.round(TOWERS[tw.type].cost * 0.8 * tw.level * metaDiscount());
export const canUpgrade = (g: Game, tw: Tower) => tw.level < MAX_LEVEL && g.gold >= upgradeCost(tw);

function levelUp(g: Game, tw: Tower) {
  const cost = upgradeCost(tw);
  g.gold -= cost;
  tw.invested += cost;
  tw.level++;
  tw.flash = 1;
  sfx.level();
  const color = TOWERS[tw.type].color;
  floatText(g, tw.x, tw.y - 30, tw.level === NAMED_LEVEL ? `${nickname(tw)}!` : L().fx.level(tw.level), color, 1.4, 15);
  burst(g, tw.x, tw.y, color, tw.level === NAMED_LEVEL ? 30 : 18);
  g.hooks.towerChanged(tw);
}

export function upgrade(g: Game, tw: Tower) {
  if (needsBranch(tw) || !canUpgrade(g, tw)) return;
  levelUp(g, tw);
}

/** The branch choice is itself the upgrade from level 3 to 4. */
export function chooseBranch(g: Game, tw: Tower, b: 0 | 1) {
  if (!needsBranch(tw) || !canUpgrade(g, tw)) return;
  tw.branch = b;
  levelUp(g, tw);
}

export const sellValue = (tw: Tower) => Math.round(tw.invested * 0.7);

export function sell(g: Game, tw: Tower) {
  g.gold += sellValue(tw);
  g.towers = g.towers.filter((t) => t !== tw);
  burst(g, tw.x, tw.y, '#888', 8);
  if (g.selected === tw) g.selected = null;
}
