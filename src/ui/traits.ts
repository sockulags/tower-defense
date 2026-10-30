// Shadow traits and tower attributes in the UI: tiny trait icons, a tower's attributes as an icon
// row (for the belt tooltip and the tower card), and the next-wave preview at the wave horn.
// The rules themselves live in data (src/data/enemies.ts, src/data/towers.ts) and src/game.
import { ENEMIES } from '../data/enemies';
import { towerAttrs } from '../game/towers';
import { wavePreview } from '../game/waves';
import { enemyPortraits } from '../three/view';
import { L } from '../i18n';
import type { Branch, EnemyType, MapDef, Trait, TowerType } from '../types';

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const INK = 'stroke="#2a1c2c" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"';

/** One small icon per trait, in the storybook ink-and-fill style. Add one when adding a trait. */
export const TRAIT_ICONS: Record<Trait, string> = {
  flying: svg(`<path d="M3 15c3-7 9-10 18-10-2 3-4 4-6 4.5 1.5.5 2.5 1.5 3 3-2.5 0-4.5-.3-6-1 0 2-1 4-3 5.5-.5-1.5-1-2.5-2-3C6 15 4.5 15.5 3 15z" fill="#3fd6c2" ${INK}/>`),
  armoured: svg(`<path d="M12 2.8l7.5 3v5.6c0 4.6-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5.2-7.5-9.8V5.8z" fill="#e2d4b6" ${INK}/><path d="M12 6v12" stroke="#a89878" stroke-width="1.6"/>`),
  mends: svg(`<circle cx="12" cy="12" r="9" fill="#8fd8ff" ${INK}/><path d="M12 7.5v9M7.5 12h9" stroke="#2a1c2c" stroke-width="2.6" stroke-linecap="round"/>`),
  splits: svg(`<path d="M12 2.5c2.5 3.2 4 5.2 4 7a4 4 0 0 1-8 0c0-1.8 1.5-3.8 4-7z" fill="#9c6ad8" ${INK}/><path d="M6 12.5c1.7 2.2 2.7 3.5 2.7 4.7a2.7 2.7 0 0 1-5.4 0c0-1.2 1-2.5 2.7-4.7zM18 12.5c1.7 2.2 2.7 3.5 2.7 4.7a2.7 2.7 0 0 1-5.4 0c0-1.2 1-2.5 2.7-4.7z" fill="#9c6ad8" ${INK}/>`),
  sprints: svg(`<path d="M13 3L6 13.5h5L9.5 21 18 9.5h-5.2z" fill="#ff7ab8" ${INK}/>`),
};

/** A struck-out wing: the tower cannot reach flyers. */
const NO_AIR = svg(`<path d="M3 15c3-7 9-10 18-10-2 3-4 4-6 4.5 1.5.5 2.5 1.5 3 3-2.5 0-4.5-.3-6-1 0 2-1 4-3 5.5-.5-1.5-1-2.5-2-3C6 15 4.5 15.5 3 15z" fill="#cfc4b0" ${INK}/><path d="M4 4l16 16" stroke="#c9333c" stroke-width="2.6" stroke-linecap="round"/>`);

/** Struck-out ground: the tower cannot hit shadows on the ground. */
const NO_GROUND = svg(`<path d="M3 17h18" stroke="#2a1c2c" stroke-width="2.4" stroke-linecap="round"/><path d="M7 17c0-3 2-5 5-5s5 2 5 5" fill="#cfc4b0" ${INK}/><path d="M4 4l16 16" stroke="#c9333c" stroke-width="2.6" stroke-linecap="round"/>`);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Tiny trait icons for a shadow, each with its name and meaning as a tooltip. */
export function traitBadges(traits: readonly Trait[]): string {
  const t = L().traits;
  return traits.map((tr) => `<span class="trait" title="${esc(`${t.names[tr]}: ${t.desc[tr]}`)}" aria-label="${esc(t.names[tr])}">${TRAIT_ICONS[tr]}</span>`).join('');
}

/**
 * A tower's attributes as a short icon row: a struck-out wing when it cannot hit flyers, a wing
 * when it can, and each trait it is strong against with its bonus. Used by the belt tooltip and
 * the tower card; each icon carries its meaning as a tooltip and accessible label.
 */
export function towerAttrIcons(type: TowerType, branch: Branch = null): string {
  const a = towerAttrs(type, branch), t = L().traits;
  const item = (icon: string, label: string, extra = '', cls = '') =>
    `<span class="attr ${cls}" title="${esc(label)}" role="img" aria-label="${esc(label)}">${icon}${extra}</span>`;
  const parts: string[] = [];
  if (!a.ground) parts.push(item(NO_GROUND, t.noGround, '', 'noair'));
  parts.push(a.air ? item(TRAIT_ICONS.flying, t.hitsAir, '', 'air') : item(NO_AIR, t.noAir, '', 'noair'));
  for (const [tr, v] of Object.entries(a.bonus) as [Trait, number][]) {
    if (!v) continue;
    const pct = Math.round(v * 100);
    parts.push(item(TRAIT_ICONS[tr], t.strong(pct, t.against[tr]), `<b>+${pct}%</b>`));
  }
  return `<span class="attrs">${parts.join('')}</span>`;
}

/**
 * The next-wave preview: one small portrait per kind of shadow with its count and trait icons.
 * Each portrait is a button; hovering or tapping it shows what its traits mean in one line.
 */
export function renderWavePreview(el: HTMLElement, map: MapDef, wave: number) {
  const s = L(), portraits = enemyPortraits(), groups = wavePreview(map, wave);
  el.setAttribute('aria-label', s.traits.nextWave(wave));
  el.innerHTML = `<div class="wp-row">${groups.map(({ type, count }) => `
    <button class="wp-chip" data-type="${type}" aria-label="${esc(s.traits.count(count, s.enemies[type]))}">
      <img src="${portraits[type]}" alt=""><b class="num">${count}</b>
      ${ENEMIES[type].traits.length ? `<span class="wp-traits">${traitBadges(ENEMIES[type].traits)}</span>` : ''}
    </button>`).join('')}</div><p class="wp-say" hidden></p>`;
  const say = el.querySelector<HTMLElement>('.wp-say')!;
  let pinned: string | null = null;
  const show = (type: EnemyType | null) => {
    if (!type) { say.hidden = true; return; }
    const tr = ENEMIES[type].traits;
    say.textContent = `${s.enemies[type]}${tr.length ? `: ${tr.map((x) => s.traits.desc[x]).join(' ')}` : ''}`;
    say.hidden = false;
  };
  el.querySelectorAll<HTMLButtonElement>('.wp-chip').forEach((b) => {
    const type = b.dataset.type as EnemyType;
    b.onmouseenter = () => show(type);
    b.onmouseleave = () => show(pinned as EnemyType | null);
    b.onclick = () => { pinned = pinned === type ? null : type; show(pinned as EnemyType | null); };
  });
}
