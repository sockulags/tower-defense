// Economy buildings (experiment, gameplay.md phase 10). A mill is placed like a tower (the same
// free placement and spacing, through canBuild), costs gold, and pays a little gold after every
// cleared wave; it grows a stage after standing a few waves, and pays more at each stage. It can be
// sold for part of its price. It never fights. Numbers in src/data/mills.ts. No DOM here, so bots
// can build mills headless. Only allowed when `g.dev.mills` is on (the lab switch, or a bot run).
import { MILL, millStage } from '../data/mills';
import { sfx } from '../audio';
import { burst, floatText } from './fx';
import { canBuild, TOWER_SPACING } from './towers';
import type { Game, Mill } from '../types';

/** Whether this run may build mills at all. Off for players until the user decides. */
export const millsAllowed = (g: Game) => !!g.dev?.mills;

export const millCount = (g: Game) => g.mills?.length ?? 0;

/** Whether one more mill may be built now, anywhere. */
export const canAffordMill = (g: Game) => millsAllowed(g) && millCount(g) < MILL.max && g.gold >= MILL.cost;

/** The mill whose footprint covers a point, if any. */
export const millAt = (g: Game, x: number, y: number) =>
  g.mills?.find((m) => Math.hypot(m.x - x, m.y - y) < TOWER_SPACING / 2);

export function placeMill(g: Game, x: number, y: number): Mill | null {
  if (!canAffordMill(g) || !canBuild(g, x, y)) return null;
  g.gold -= MILL.cost;
  const m: Mill = { x, y, waves: 0, paid: 0, invested: MILL.cost, payAt: -9 };
  (g.mills ??= []).push(m);
  sfx.build();
  burst(g, x, y, MILL.color, 10);
  return m;
}

export const millStageOf = (m: Mill) => millStage(m.waves);
/** Gold this mill pays after the next cleared wave. */
export const millPay = (m: Mill) => MILL.pay[millStage(m.waves) - 1];
export const millSellValue = (m: Mill) => Math.round(m.invested * MILL.sell);

export function sellMill(g: Game, m: Mill) {
  if (!g.mills?.includes(m)) return;
  g.gold += millSellValue(m);
  g.mills = g.mills.filter((x) => x !== m);
  burst(g, m.x, m.y, '#888', 8);
  if (g.millSelected === m) g.millSelected = null;
}

/** Called when a wave is cleared and the run goes on: every mill pays, then grows a little. Returns the gold paid. */
export function millsWaveCleared(g: Game): number {
  let total = 0;
  for (const m of g.mills ?? []) {
    const pay = millPay(m);
    m.paid += pay;
    m.waves++;
    m.payAt = g.t;
    total += pay;
    floatText(g, m.x, m.y - 34, `+${pay}`, MILL.color, 1.4, 15);
  }
  g.gold += total;
  return total;
}
