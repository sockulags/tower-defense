import type { MapId } from '../types';

/** Screen switching, wired up in main.ts so the screens don't import each other. */
export const nav = {
  menu: () => {},
  play: (_id: MapId) => {},
  lab: () => {},
  lodge: () => {},
};
