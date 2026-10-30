import type { TowerDef, TowerType } from '../types';

// Display names and descriptions live in src/i18n. Tuned with `npm run balance` so a mixed build
// beats any single tower: Spark is cheap single-target damage, Rime's slow helps everyone near it,
// Ember clears crowds up close but cannot stop a giant, and Starfall splashes from afar.
//
// `attrs` say what each tower can hit and which shadow traits it is strong against; `branchAttrs`
// change them per branch (A, B). Ember's ground pulse and Starfall's impacts never reach flyers.
export const TOWERS: Record<TowerType, TowerDef> = {
  spark: { cost: 50, range: 2.4, rate: 0.5, dmg: 7.5, color: '#ffd27a', kind: 'shot', speed: 15,
    attrs: { air: true, ground: true, bonus: { flying: 0.5 } },
    branchAttrs: [null, { bonus: { flying: 0.5, armoured: 0.5 } }] },
  frost: { cost: 70, range: 2.4, rate: 0.9, dmg: 6, color: '#8fd3ff', kind: 'shot', speed: 10, slow: 0.55, slowDur: 2,
    attrs: { air: true, ground: true, bonus: { sprints: 0.5 } },
    branchAttrs: [{ bonus: { sprints: 0.5, mends: 0.5 } }, { bonus: { sprints: 1, flying: 0.5 } }] },
  pulse: { cost: 85, range: 1.6, rate: 1.2, dmg: 18, color: '#ff6b3d', kind: 'pulse', unlock: 2,
    attrs: { air: false, ground: true, bonus: { splits: 0.5 } },
    branchAttrs: [{ bonus: { splits: 0.5, mends: 0.5 } }, { bonus: { splits: 0.5, armoured: 0.5 } }] },
  star: { cost: 140, range: 3.4, rate: 2.4, dmg: 38, color: '#c7a6ff', kind: 'shell', speed: 7, splash: 1.2, unlock: 3,
    attrs: { air: false, ground: true, bonus: { armoured: 0.5, splits: 0.25 } },
    branchAttrs: [{ bonus: { armoured: 1, splits: 0.25 } }, null] },
  // ---------- the fifth tower: Skyhook ----------
  // A harpoon ballista with a kite on a line, built to answer flyers, which Ember and Starfall
  // cannot touch and Spark and Rime only nibble at. Long reach and heavy single harpoons, double
  // damage against flyers. Kite Flock (A) gives up the ground for three harpoons at once against
  // flyers; Whaler (B) throws one huge harpoon that also punches through a Brute's armour.
  kite: { cost: 90, range: 3.2, rate: 1.2, dmg: 22, color: '#7fe6c9', kind: 'shot', speed: 18, unlock: 5,
    attrs: { air: true, ground: true, bonus: { flying: 1 } },
    branchAttrs: [{ ground: false, bonus: { flying: 1.5 } }, { bonus: { flying: 1, armoured: 0.75 } }] },
  // ---------- end the fifth tower ----------
};

export const TOWER_ORDER: TowerType[] = ['spark', 'frost', 'pulse', 'star', 'kite'];
