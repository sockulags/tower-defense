// The squad in the UI: the Lodge's Squad tab and the strip on a storybook page that shows the
// four towers the player will bring (with a Change button that swaps them on the spot) and the
// shadows the map sends. The rules are in src/game/squad.ts. Everything here is buttons, so mouse,
// touch and keys all work; pictures fill in after the view is on screen.
import { ENEMIES } from '../data/enemies';
import { L } from '../i18n';
import { SQUAD_SIZE, benchTowers, bringTower, mapShadows, playerSquad, squadOpen, unlockedTowers } from '../game/squad';
import { enemyPortraits, towerPortraits } from '../three/view';
import { towerAttrIcons, traitBadges } from './traits';
import type { EnemyType, MapDef, TowerType } from '../types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Fills `img[data-tower]` and `img[data-enemy]` after the view is drawn, so it appears at once. */
function fillPictures(root: HTMLElement) {
  setTimeout(() => {
    if (!root.isConnected) return;
    const towers = root.querySelectorAll<HTMLImageElement>('img[data-tower]');
    if (towers.length) {
      const p = towerPortraits();
      towers.forEach((img) => { img.src = p[img.dataset.tower as TowerType]; img.classList.add('ready'); });
    }
    const enemies = root.querySelectorAll<HTMLImageElement>('img[data-enemy]');
    if (enemies.length) {
      const p = enemyPortraits();
      enemies.forEach((img) => { img.src = p[img.dataset.enemy as EnemyType]; img.classList.add('ready'); });
    }
  }, 30);
}

// ---------- the Lodge's Squad tab ----------

/** The slot a tower chosen in the Lodge goes into. */
let lodgeSlot = SQUAD_SIZE - 1;

export function renderSquadTab(root: HTMLElement, rerender: () => void) {
  const s = L(), q = s.squad, squad = playerSquad();
  lodgeSlot = Math.min(lodgeSlot, squad.length - 1);
  const sec = document.createElement('section');
  sec.className = 'book panel narrow squad-book';
  sec.innerHTML = `<h2>${q.title}</h2><p class="fine">${q.intro}</p>
    <div class="squad-slots" role="group" aria-label="${esc(q.title)}">${squad.map((t, i) => `
      <button class="squad-slot${i === lodgeSlot ? ' on' : ''}" data-slot="${i}" aria-pressed="${i === lodgeSlot}" aria-label="${esc(q.slot(i + 1, s.towers[t].name))}">
        <img data-tower="${t}" alt=""><b>${s.towers[t].name}</b><span class="key">${i + 1}</span>
      </button>`).join('')}
    </div>
    <p class="fine">${q.pickSlot}</p>
    <div class="squad-towers">${unlockedTowers().map((t) => {
      const on = squad.includes(t), text = s.towers[t];
      const label = on ? q.inSquad : q.bringFor(text.name, s.towers[squad[lodgeSlot]].name);
      return `<article class="squad-tower${on ? ' on' : ''}">
        <img data-tower="${t}" alt="">
        <div class="txt"><b>${text.name}</b><p class="fine">${text.desc}</p>${towerAttrIcons(t)}</div>
        <button class="${on ? 'ghost' : 'go small'}" data-bring="${t}" ${on ? 'disabled' : ''} aria-label="${esc(label)}" title="${esc(label)}">${on ? q.inSquad : q.bring}</button>
      </article>`;
    }).join('')}</div>`;
  sec.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((b) => {
    b.onclick = () => { lodgeSlot = Number(b.dataset.slot); rerender(); };
  });
  sec.querySelectorAll<HTMLButtonElement>('[data-bring]').forEach((b) => {
    b.onclick = () => { bringTower(b.dataset.bring as TowerType, lodgeSlot); rerender(); };
  });
  root.appendChild(sec);
  fillPictures(sec);
}

// ---------- the storybook page ----------

/** Whether the page's squad strip is open for swapping, and which left-out tower is being brought. */
let changing = false;
let benchPick: TowerType | null = null;

/** The shadows a map sends, as small portraits with their trait icons. */
function shadowsHtml(map: MapDef) {
  const s = L();
  return `<div class="ss-shadows" role="group" aria-label="${esc(s.squad.shadows)}">
    <span class="eyebrow">${s.squad.shadows}</span>
    <div class="ss-row">${mapShadows(map).map((type) => `
      <span class="ss-shadow" title="${esc(s.enemies[type])}" role="img" aria-label="${esc(s.enemies[type])}">
        <img data-enemy="${type}" alt="">${ENEMIES[type].traits.length ? `<span class="ss-traits">${traitBadges(ENEMIES[type].traits)}</span>` : ''}
      </span>`).join('')}
    </div>
  </div>`;
}

/** The squad strip: hidden until the squad is unlocked. */
function squadHtml() {
  if (!squadOpen()) { changing = false; return ''; }
  const s = L(), q = s.squad, squad = playerSquad(), bench = benchTowers();
  if (!benchPick || !bench.includes(benchPick)) benchPick = bench[0] ?? null;
  const pick = benchPick ? s.towers[benchPick].name : '';
  return `<div class="ss-squad${changing ? ' changing' : ''}" role="group" aria-label="${esc(q.title)}">
    <span class="eyebrow">${q.title}</span>
    <div class="ss-row">${squad.map((t) => `
      <button class="ss-tower" data-swap="${t}" ${changing && benchPick ? '' : 'disabled'}
        aria-label="${esc(changing && benchPick ? q.swapFor(s.towers[t].name, pick) : s.towers[t].name)}" title="${esc(s.towers[t].name)}">
        <img data-tower="${t}" alt="">
      </button>`).join('')}
      <button class="ghost ss-change" id="fSquadChange" aria-expanded="${changing}">${changing ? q.done : q.change}</button>
    </div>
    ${changing && bench.length ? `<div class="ss-bench">
      <p class="fine">${q.swapHint(pick)}</p>
      <div class="ss-row">${bench.map((t) => `
        <button class="ss-tower bench${t === benchPick ? ' on' : ''}" data-bench="${t}" aria-pressed="${t === benchPick}" aria-label="${esc(s.towers[t].name)}" title="${esc(s.towers[t].name)}">
          <img data-tower="${t}" alt="">
        </button>`).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

/** The storybook page's strip: the shadows the map sends, and once unlocked the squad. */
export const storyStripHtml = (map: MapDef) => `<div class="story-strip" id="fStrip">${shadowsHtml(map)}${squadHtml()}</div>`;

/** Wires the strip after the page is rendered; `rerender` redraws only the strip. */
export function wireStoryStrip(root: HTMLElement, map: MapDef) {
  const strip = root.querySelector<HTMLElement>('#fStrip');
  if (!strip) return;
  const redraw = () => {
    strip.outerHTML = storyStripHtml(map);
    wireStoryStrip(root, map);
    root.querySelector<HTMLElement>(changing ? '.ss-tower:not(:disabled)' : '#fSquadChange')?.focus();
  };
  const change = strip.querySelector<HTMLButtonElement>('#fSquadChange');
  if (change) change.onclick = () => { changing = !changing; redraw(); };
  strip.querySelectorAll<HTMLButtonElement>('[data-bench]').forEach((b) => {
    b.onclick = () => { benchPick = b.dataset.bench as TowerType; redraw(); };
  });
  strip.querySelectorAll<HTMLButtonElement>('[data-swap]').forEach((b) => {
    b.onclick = () => {
      if (!benchPick) return;
      const slot = playerSquad().indexOf(b.dataset.swap as TowerType);
      bringTower(benchPick, slot);
      benchPick = null;
      redraw();
    };
  });
  fillPictures(strip);
}
