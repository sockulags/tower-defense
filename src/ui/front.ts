// The front door: small views over the live demo board, each with one job.
// - Title: the game's name, one big Play button, the Lodge, the settings gear and the profile chip.
// - Mode choice (#play): Story or Survival, only once Survival is unlocked.
// - Storybook (#story, #story/<map>): one spread per story map; unreached pages are pencil sketches.
// - Survival (#survival): the survival maps with their best wave.
import { GAME_TITLE } from '../config';
import { MAPS, MAP_ORDER } from '../data/maps';
import { L } from '../i18n';
import { activeProfile, mapOpen, playerLevel, save, survivalOpen } from '../save';
import { heroPortrait, mapPortrait } from '../three/view';
import { $ } from './dom';
import { FRONT_ICONS } from './front-icons';
import { nav } from './nav';
import { openProfiles, openSettings } from './settings';
// The squad and the map's shadows on a storybook page.
import { storyStripHtml, wireStoryStrip } from './squad';
import type { MapId } from '../types';

export const STORY_MAPS: MapId[] = MAP_ORDER.filter((id) => !MAPS[id].survival);
export const SURVIVAL_MAPS: MapId[] = MAP_ORDER.filter((id) => !!MAPS[id].survival);

export type FrontView = 'title' | 'play' | 'story' | 'survival';

/** The page Play and the mode card lead to: the first reached page without a dawn yet. */
export function nextPage(): MapId {
  const open = STORY_MAPS.filter(mapOpen);
  return open.find((id) => !save.won[id]) ?? open[open.length - 1] ?? STORY_MAPS[0];
}

/** What the title's Play button does: start the first page on a first visit, otherwise continue. */
export function playAction() {
  if (save.runs === 0) nav.play(STORY_MAPS[0]);
  else if (survivalOpen()) nav.go('play');
  else nav.go('story');
}

let shown: { view: FrontView; page: MapId } = { view: 'title', page: STORY_MAPS[0] };

export function showFront(view: FrontView, sub?: string) {
  const page = (STORY_MAPS as string[]).includes(sub ?? '') ? (sub as MapId) : nextPage();
  shown = { view, page };
  $('menu').hidden = false;
  $('menu').scrollTop = 0;
  renderFront();
}

export function hideFront() { $('menu').hidden = true; }

/** Re-renders the visible view, e.g. after a language or profile change. */
export function renderFront() {
  document.title = GAME_TITLE;
  const root = $('front');
  root.className = `front ${shown.view}-view`;
  if (shown.view === 'title') renderTitle(root);
  else if (shown.view === 'play') renderModes(root);
  else if (shown.view === 'story') renderStory(root, shown.page);
  else renderSurvival(root);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Map stills take a moment to render, so views appear first and pictures fill in one by one. */
function fillMapPictures(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img[data-map]'));
  const step = () => {
    const img = imgs.shift();
    if (!img) return;
    setTimeout(() => {
      if (img.isConnected) { img.src = mapPortrait(MAPS[img.dataset.map as MapId]); img.classList.add('ready'); }
      step();
    }, 30);
  };
  step();
}

function backButton(to: string) {
  const s = L().front;
  return `<button class="ghost fback" data-go="${to}">${FRONT_ICONS.left}<span>${s.back}</span></button>`;
}

function wireGo(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => { b.onclick = () => nav.go(b.dataset.go!); });
}

// ---------- title ----------

function renderTitle(root: HTMLElement) {
  const s = L(), f = s.front, p = activeProfile();
  root.innerHTML = `
    <div class="fcorner left">
      <button class="profile-chip" id="fProfile" aria-label="${esc(f.switchWatcher)}" title="${esc(f.switchWatcher)}">
        <span><b>${esc(p.name)}</b><small>${f.watchLevel(playerLevel())}</small></span>
      </button>
    </div>
    <div class="fcorner right">
      <button class="orb" id="fGear" aria-label="${esc(f.settings)}" title="${esc(f.settings)}">${FRONT_ICONS.gear}</button>
    </div>
    <div class="title-center">
      <h1>${GAME_TITLE}</h1>
      <p class="ribbon">${s.tagline}</p>
      <button class="go play-big" id="fPlay">${f.play}</button>
      <button class="go lodge-link" id="fLodge"><img src="${heroPortrait(save.hero.equip, 96)}" alt=""><span>${f.lodge}</span></button>
    </div>`;
  $('fPlay').onclick = () => playAction();
  $('fLodge').onclick = () => nav.go('lodge');
  $('fGear').onclick = () => openSettings();
  $('fProfile').onclick = () => openProfiles();
}

// ---------- mode choice ----------

function renderModes(root: HTMLElement) {
  const f = L().front, next = nextPage(), allWon = STORY_MAPS.every((id) => save.won[id]);
  const bestSurvival = Math.max(0, ...SURVIVAL_MAPS.map((id) => save.best[id]));
  root.innerHTML = `
    <div class="fbar">${backButton('')}</div>
    <div class="mode-cards">
      <button class="mode-card panel" data-go="story">
        <span class="shot"><img data-map="${next}" alt=""></span>
        <b>${f.story}</b>
        <small>${allWon ? f.storyDone : f.storyNext(L().maps[next].name)}</small>
      </button>
      <button class="mode-card panel" data-go="survival">
        <span class="shot"><img data-map="${SURVIVAL_MAPS[0]}" alt=""></span>
        <b>${f.survival}</b>
        <small>${f.survivalBest(bestSurvival)}</small>
      </button>
    </div>`;
  wireGo(root);
  fillMapPictures(root);
}

// ---------- storybook ----------

function renderStory(root: HTMLElement, id: MapId) {
  const s = L(), f = s.front, i = STORY_MAPS.indexOf(id), reached = mapOpen(id);
  const prev = STORY_MAPS[i - 1], next = STORY_MAPS[i + 1];
  const pages = f.pages as Record<string, string>;
  const result = save.won[id] ? f.resultWon : save.best[id] > 0 ? f.resultTried(save.best[id]) : f.resultNew;
  const right = reached
    ? `<span class="eyebrow">${f.pageOf(i + 1, STORY_MAPS.length)}</span>
       <h2>${s.maps[id].name}</h2>
       <p class="story-line">${pages[id] ?? ''}</p>
       ${storyStripHtml(MAPS[id]) /* the squad: the map's shadows and the four towers to bring */}
       <div class="begin-row">
         <button class="go begin" id="fBegin">${f.begin}</button>
         <p class="result${save.won[id] ? ' won-line' : ''}">${result}</p>
       </div>`
    : `<div class="pencil" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
  root.innerHTML = `
    <div class="fbar">${backButton(survivalOpen() ? 'play' : '')}</div>
    <div class="storybook">
      <button class="page-edge prev" id="fPrev" aria-label="${esc(f.prevPage)}" ${prev ? '' : 'disabled'}>${FRONT_ICONS.left}</button>
      <article class="spread${reached ? '' : ' sketch'}" id="fSpread" ${reached ? '' : `aria-label="${esc(f.unwritten)}"`}>
        <div class="leaf picture"><span class="frame"><img data-map="${id}" alt=""></span></div>
        <div class="leaf words">${right}</div>
      </article>
      <button class="page-edge next" id="fNext" aria-label="${esc(f.nextPage)}" ${next ? '' : 'disabled'}>${FRONT_ICONS.right}</button>
    </div>`;
  const flip = (to: MapId | undefined) => { if (to) nav.go(`story/${to}`); };
  $('fPrev').onclick = () => flip(prev);
  $('fNext').onclick = () => flip(next);
  if (reached) $('fBegin').onclick = () => nav.play(id);
  if (reached) wireStoryStrip(root, MAPS[id]); // the squad
  // Swipe sideways to turn the page on touch screens.
  const spread = $('fSpread');
  let startX = 0, startY = 0, tracking = false;
  spread.onpointerdown = (e) => { tracking = true; startX = e.clientX; startY = e.clientY; };
  spread.onpointerup = (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) flip(dx < 0 ? next : prev);
  };
  spread.onpointercancel = () => { tracking = false; };
  wireGo(root);
  fillMapPictures(root);
}

// Arrow keys turn the storybook's pages.
document.addEventListener('keydown', (e) => {
  if ($('menu').hidden || shown.view !== 'story' || !$('sheet').hidden) return;
  if (e.target instanceof HTMLInputElement) return;
  const i = STORY_MAPS.indexOf(shown.page);
  const to = e.key === 'ArrowLeft' ? STORY_MAPS[i - 1] : e.key === 'ArrowRight' ? STORY_MAPS[i + 1] : undefined;
  if (to) { e.preventDefault(); nav.go(`story/${to}`); }
});

// ---------- survival ----------

function renderSurvival(root: HTMLElement) {
  const s = L(), f = s.front;
  root.innerHTML = `
    <div class="fbar">${backButton('play')}</div>
    <h2 class="sec-title">${f.survival}</h2>
    <p class="ribbon">${f.survivalIntro}</p>
    <div class="survival-maps">${SURVIVAL_MAPS.map((id) => `
      <article class="mcard panel">
        <div class="shot"><img data-map="${id}" alt=""></div>
        <div class="mbody"><h3>${s.maps[id].name}</h3><p class="best">${f.survivalBest(save.best[id])}</p></div>
        <button class="go" data-begin="${id}">${f.begin}</button>
      </article>`).join('')}
    </div>`;
  root.querySelectorAll<HTMLButtonElement>('[data-begin]').forEach((b) => { b.onclick = () => nav.play(b.dataset.begin as MapId); });
  wireGo(root);
  fillMapPictures(root);
}
