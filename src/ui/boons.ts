// Boons between waves in the UI: the three cards of a choice, and the small row of taken boons
// beside the resource plaque. The rules live in src/game/boons.ts and the numbers in src/data/boons.ts;
// src/ui/play.ts decides when these show.
import { BOONS, type BoonId } from '../data/boons';
import { heroPortrait, towerPortraits } from '../three/view';
import { L } from '../i18n';
import { ICONS } from './icons';
import type { Game } from '../types';

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const INK = 'stroke="#2a1c2c" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"';

/** Glyphs for boons that belong to no tower and not to the Warden. */
const GLYPHS: Partial<Record<BoonId, string>> = {
  thrift: svg(`<path d="M5 19l8-8" stroke="#8a5a2b" stroke-width="3" stroke-linecap="round"/><path d="M11 5.5l4-2 5.5 5.5-2 4z" fill="#c9c2b4" ${INK}/>`),
  tithe: svg(`<path d="M8 6.5h8l-1.5 2.5c3 1.5 4.5 4 4.5 6.5 0 3-3 5-7 5s-7-2-7-5c0-2.5 1.5-5 4.5-6.5z" fill="#d9b071" ${INK}/><path d="M9.5 9h5" ${INK}/>`),
  bounty: ICONS.coin,
  savings: svg(`<path d="M7 7h10v2.5c2 1 3 3 3 5.5 0 3.5-3.5 5.5-8 5.5s-8-2-8-5.5c0-2.5 1-4.5 3-5.5z" fill="#cfe7f2" ${INK}/><circle cx="12" cy="15" r="3.2" fill="#f2c14e" ${INK}/>`),
  windfall: ICONS.star,
  hotBurn: svg(`<path d="M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-3 1.8-4.5 2.8-6 .4 2 1.2 3 2.2 3.3-.6-3 0-5.5.5-8.3z" fill="#ff7a3d" ${INK}/><path d="M12 13.5c1.2 1.3 2.2 2.3 2.2 3.6a2.2 2.2 0 0 1-4.4 0c0-1.3 1-2.3 2.2-3.6z" fill="#ffd27a"/>`),
  deepChill: svg(`<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" stroke="#2a1c2c" stroke-width="4.2" stroke-linecap="round"/><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" stroke="#8fd3ff" stroke-width="2" stroke-linecap="round"/>`),
  sunder: svg(`<path d="M12 2.8l7.5 3v5.6c0 4.6-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5.2-7.5-9.8V5.8z" fill="#c7a172" ${INK}/><path d="M13 3.5l-2.5 6 3 2.5-3 9" fill="none" ${INK}/>`),
  hearth: ICONS.heart,
  steady: svg(`<path d="M7 3.5h10M7 20.5h10" ${INK}/><path d="M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5h8c0-5-8-5-8-8.5s8-3.5 8-8.5z" fill="#f3e1b6" ${INK}/><path d="M10 18.5h4l-2-2.5z" fill="#d9a441"/>`),
};

/** A boon's face: the tower's or the Warden's portrait, or a small glyph. */
export function boonFace(g: Game, id: BoonId, size: 'big' | 'small'): string {
  const d = BOONS[id];
  if (d.tower) return `<img src="${towerPortraits()[d.tower]}" alt="">`;
  if (d.kind === 'warden') return `<img src="${heroPortrait(g.loadout, size === 'big' ? 128 : 64)}" alt="">`;
  return GLYPHS[id] ?? ICONS.star;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The choice: a title, a line about the wave, three cards and a button to look at the board first. */
export function boonChoiceHtml(g: Game): string {
  const s = L().boons, offer = g.boons.offer ?? [];
  const cards = offer.map((id, i) => {
    const d = BOONS[id], text = s.list[id];
    return `<button class="boon-card" data-boon="${id}" style="--accent:${d.color}">
      <span class="boon-kind">${s.kinds[d.kind]}</span>
      <span class="boon-face">${boonFace(g, id, 'big')}</span>
      <b class="boon-name">${text.name}</b>
      <span class="boon-desc">${text.desc}</span>
      <span class="boon-take">${s.take}<span class="key">${i + 1}</span></span>
    </button>`;
  }).join('');
  return `<h2 class="boon-title">${s.title}</h2>
    <p class="ribbon boon-sub">${s.sub(g.cleared)}</p>
    <div class="boon-cards">${cards}</div>
    <button class="ghost boon-peek" id="boonPeek">${s.peek}</button>`;
}

/** The taken boons as small round icons; each carries its name and effect for the note. */
export function boonStripHtml(g: Game): string {
  const s = L().boons;
  return g.boons.taken.map((id) => {
    const text = s.list[id];
    return `<button class="boon-chip" data-boon="${id}" style="--accent:${BOONS[id].color}" aria-label="${esc(`${text.name}: ${text.desc}`)}">${boonFace(g, id, 'small')}</button>`;
  }).join('');
}

/** The note for one taken boon. */
export function boonNoteHtml(id: BoonId): string {
  const s = L().boons, text = s.list[id];
  return `<b>${text.name}</b><span>${text.desc}</span>`;
}
