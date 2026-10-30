import { COLS, MAX_LEVEL, ROWS, T } from '../config';
import { TOWERS } from '../data/towers';
import { L } from '../i18n';
import { metaDamage, metaXp, towerUnlocked } from '../save';
import { sfx } from '../audio';
import { burst, floatText } from './fx';
import type { Game, Stats, Tower, TowerType } from '../types';

export const BRANCH_LEVEL = 3;
export const NAMED_LEVEL = 4;

export const xpNeed = (level: number) => Math.round(30 * Math.pow(level, 1.8));

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

export function canBuild(g: Game, tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  if (g.path.tiles.has(tx + ',' + ty)) return false;
  return !g.towers.some((t) => t.tx === tx && t.ty === ty);
}

export function placeTower(g: Game, type: TowerType, tx: number, ty: number): Tower | null {
  const d = TOWERS[type];
  if (g.gold < d.cost || !canBuild(g, tx, ty) || !towerUnlocked(type)) return null;
  g.gold -= d.cost;
  const t: Tower = {
    type, tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T, level: 1, xp: 0, branch: null, cd: 0,
    invested: d.cost, angle: -Math.PI / 2, kills: 0, dealt: 0, nick: Math.floor(Math.random() * 1000), flash: 0,
  };
  g.towers.push(t);
  sfx.build();
  burst(g, t.x, t.y, d.color, 10);
  return t;
}

export function giveXp(g: Game, tw: Tower, amount: number) {
  if (tw.level >= MAX_LEVEL) return;
  tw.xp += amount * 0.15 * metaXp();
  while (tw.level < MAX_LEVEL && tw.xp >= xpNeed(tw.level)) {
    // Levelling pauses at the branch level until the player picks a branch.
    if (needsBranch(tw)) { tw.xp = xpNeed(BRANCH_LEVEL); return; }
    tw.xp -= xpNeed(tw.level);
    levelUp(g, tw);
  }
}

function levelUp(g: Game, tw: Tower) {
  tw.level++;
  tw.flash = 1;
  sfx.level();
  const color = TOWERS[tw.type].color;
  floatText(g, tw.x, tw.y - 30, tw.level === NAMED_LEVEL ? `${nickname(tw)}!` : L().fx.level(tw.level), color, 1.4, 15);
  burst(g, tw.x, tw.y, color, 18);
  g.hooks.towerChanged(tw);
}

export const trainCost = (tw: Tower) => Math.round(TOWERS[tw.type].cost * 0.55 * tw.level);
export const canTrain = (g: Game, tw: Tower) => tw.level < MAX_LEVEL && !needsBranch(tw) && g.gold >= trainCost(tw);

export function train(g: Game, tw: Tower) {
  if (!canTrain(g, tw)) return;
  const c = trainCost(tw);
  g.gold -= c;
  tw.invested += c;
  tw.xp = 0;
  levelUp(g, tw);
}

export const sellValue = (tw: Tower) => Math.round(tw.invested * 0.7);

export function sell(g: Game, tw: Tower) {
  g.gold += sellValue(tw);
  g.towers = g.towers.filter((t) => t !== tw);
  burst(g, tw.x, tw.y, '#888', 8);
  if (g.selected === tw) g.selected = null;
}

export function chooseBranch(g: Game, tw: Tower, b: 0 | 1) {
  tw.branch = b;
  tw.flash = 1;
  sfx.level();
  burst(g, tw.x, tw.y, TOWERS[tw.type].color, 24);
  giveXp(g, tw, 0);
  g.hooks.towerChanged(tw);
}
