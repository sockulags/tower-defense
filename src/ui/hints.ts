// First-run hints: one at a time, each waiting for the player to do it, and never shown again for
// that profile once done (or dismissed). Order: build a tower, call the wave, upgrade a tower, and
// place the Warden once a couple of waves have passed.
import { canUpgrade } from '../game/towers';
import { L } from '../i18n';
import { hintDone, markHint } from '../save';
import { ICONS } from './icons';
import { $ } from './dom';
import type { Game } from '../types';

type HintId = 'build' | 'wave' | 'upgrade' | 'warden';

interface Hint {
  id: HintId;
  /** True once the player has done it. */
  done: (g: Game) => boolean;
  /** True when the moment for the hint has come. */
  ready: (g: Game) => boolean;
  /** The element the bubble points at. */
  anchor: () => Element | null;
}

const HINTS: Hint[] = [
  { id: 'build', done: (g) => g.towers.length > 0, ready: () => true, anchor: () => $('belt') },
  { id: 'wave', done: (g) => g.wave > 0, ready: (g) => g.towers.length > 0, anchor: () => $('bWave') },
  {
    id: 'upgrade',
    done: (g) => g.towers.some((t) => t.level > 1),
    ready: (g) => g.wave > 0 && g.towers.some((t) => canUpgrade(g, t)),
    anchor: () => $('belt'),
  },
  {
    id: 'warden',
    done: (g) => !!g.hero,
    ready: (g) => g.wave >= 2,
    anchor: () => $('belt').querySelector('[data-type="hero"]'),
  },
];

const SHORT = window.matchMedia('(max-height: 500px)');

let game: Game | null = null;
let timer = 0;
let showing: HintId | null = null;

/** Starts watching a new run. Sandbox runs get no hints. */
export function startHints(g: Game) {
  stopHints();
  if (g.dev || HINTS.every((h) => hintDone(h.id))) return;
  game = g;
  timer = window.setInterval(tick, 250);
  tick();
}

export function stopHints() {
  clearInterval(timer);
  game = null;
  hide();
}

function hide() {
  showing = null;
  $('hint').hidden = true;
}

function tick() {
  const g = game;
  if (!g || g.over || $('hud').hidden) { stopHints(); return; }
  // Anything the player already did counts, even before its hint came up.
  for (const h of HINTS) if (!hintDone(h.id) && h.done(g)) markHint(h.id);
  const next = HINTS.find((h) => !hintDone(h.id));
  if (!next) { stopHints(); return; }
  // On a short screen the open tower card has the floor; the hint waits until it closes.
  if (!next.ready(g) || g.paused || (SHORT.matches && !$('card').hidden)) { hide(); return; }
  if (showing !== next.id) show(next);
  place(next);
}

function show(h: Hint) {
  const el = $('hint'), s = L().front;
  showing = h.id;
  el.innerHTML = `<p>${s.hints[h.id]}</p><button class="x" id="hintX" aria-label="${s.gotIt}" title="${s.gotIt}">${ICONS.close}</button>`;
  el.hidden = false;
  $('hintX').onclick = () => { markHint(h.id); hide(); tick(); };
}

/** Keeps the bubble just above what it talks about (beside it on short screens), inside the window. */
function place(h: Hint) {
  const el = $('hint'), a = h.anchor();
  if (!a) return;
  const r = a.getBoundingClientRect();
  const w = el.offsetWidth, ht = el.offsetHeight;
  if (SHORT.matches) {
    // A phone held sideways: the controls stand in side columns, so the bubble sits beside its
    // target, level with the target's top, and points sideways at it.
    const right = r.left + r.width / 2 > window.innerWidth / 2;
    const left = right ? r.left - w - 14 : r.right + 14;
    const top = Math.max(8, Math.min(window.innerHeight - ht - 8, r.top));
    el.classList.remove('below');
    el.classList.toggle('side-l', right);
    el.classList.toggle('side-r', !right);
    el.style.transform = `translate(${Math.round(Math.max(8, left))}px, ${Math.round(top)}px)`;
    el.style.setProperty('--tail', `${Math.round(Math.max(14, Math.min(ht - 14, Math.min(r.height, 60) / 2 + r.top - top)))}px`);
    return;
  }
  el.classList.remove('side-l', 'side-r');
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  // Above the target when there is room under the top bar, otherwise below it, so the bubble
  // never covers what it points at.
  const above = r.top - ht - 16 >= 70;
  const top = above ? r.top - ht - 16 : r.bottom + 16;
  el.classList.toggle('below', !above);
  el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  el.style.setProperty('--tail', `${Math.round(Math.max(16, Math.min(w - 16, r.left + r.width / 2 - left)))}px`);
}
