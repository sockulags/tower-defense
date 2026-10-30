export type UpgradeId = 'gold' | 'lives' | 'dmg' | 'craft';

export const UPGRADES: { id: UpgradeId; max: number }[] = [
  { id: 'gold', max: 5 },
  { id: 'lives', max: 5 },
  { id: 'dmg', max: 5 },
  { id: 'craft', max: 5 },
];

export const upgradeCost = (level: number) => 10 + level * 12;
