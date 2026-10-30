import type { MapId } from '../types';

/**
 * Screen switching, wired up in main.ts so the screens don't import each other.
 *
 * Views outside a run have addresses: '' title, 'play' mode choice, 'story' or 'story/<map>',
 * 'survival', 'lodge', 'lodge/talents', 'lodge/workshop' and 'lab'. `go` moves to one of them and
 * adds a browser history entry, so the back button works.
 */
export const nav = {
  go: (_address: string) => {},
  /** The title view. */
  menu: () => {},
  play: (_id: MapId) => {},
  lab: () => {},
  lodge: () => {},
  /** Leaves the current view for the one the player came from (the Lodge's back button). */
  back: () => {},
};
