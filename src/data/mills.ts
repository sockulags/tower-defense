// Economy buildings (experiment, gameplay.md phase 10): a mill costs gold and pays a little gold
// after every cleared wave. It grows in stages the longer it stands, so an early mill pays the
// most, and an early mill is also gold that is not defending the road yet. Plain numbers only;
// display text is in src/i18n. Rules in src/game/mills.ts. Off for players: only the lab's
// sandbox switch and the bots (`npm run balance -- --mills ...`) turn it on.
export const MILL = {
  cost: 60,
  /** Most mills one run may hold. */
  max: 3,
  /** Gold paid after each cleared wave, by stage (1, 2, 3). */
  pay: [5, 10, 15],
  /** Cleared waves a mill must stand (counting from when it was built) to reach stage 2 and 3. */
  grow: [2, 4],
  /** Share of the price returned when sold. */
  sell: 0.5,
  /** Coin colour for the payout text and puffs. */
  color: '#f0bf55',
};

/** Stage (1 to 3) of a mill that has stood through this many cleared waves. */
export const millStage = (waves: number) => (waves >= MILL.grow[1] ? 3 : waves >= MILL.grow[0] ? 2 : 1);
