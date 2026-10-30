import { en, type Strings } from './en';
import { sv } from './sv';

export type Locale = 'en' | 'sv';

const TABLES: Record<Locale, Strings> = { en, sv };
const KEY = 'duskwatch-locale';

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'sv', label: 'Svenska' },
];

let current: Locale = (() => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'sv') return v;
  } catch { /* ignore */ }
  // First visit: follow the browser's language when the game speaks it.
  try { if (navigator.language?.toLowerCase().startsWith('sv')) return 'sv'; } catch { /* no navigator */ }
  return 'en';
})();

/** The active string table. */
export const L = () => TABLES[current];
export const locale = () => current;

export function setLocale(l: Locale) {
  current = l;
  document.documentElement.lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
}

export const fmt = (n: number) => Math.round(n).toLocaleString(current === 'sv' ? 'sv-SE' : 'en-US');
