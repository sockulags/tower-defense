export const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;

/** Sets text only when it changed, so per-frame HUD updates stay cheap. */
const cache = new Map<string, string>();
export function setText(id: string, value: string) {
  if (cache.get(id) === value) return;
  cache.set(id, value);
  $(id).textContent = value;
}
export const clearTextCache = () => cache.clear();

