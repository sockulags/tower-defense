import type { MapId } from '../types';

/** Screen switching, wired up in main.ts so menu and play don't import each other. */
export const nav = {
  menu: () => {},
  play: (_id: MapId) => {},
};
