import './style.css';
import './pwa';
import { initAudio } from './audio';
import { locale, setLocale } from './i18n';
import { hideFront, renderFront, showFront, type FrontView } from './ui/front';
import { hideLab, showLab } from './ui/lab';
import { hideLodge, renderLodge, showLodge } from './ui/lodge';
import { nav } from './ui/nav';
import { survivalOpen } from './save';
import { currentGame, currentView, frame, openPauseMenu, runActive, startAttract, startRun } from './ui/play';
import { closeSheet, sheetHooks } from './ui/settings';

// Every screen shares one board. The front door's views and the Lodge float over a live demo,
// a run plays on it, and the lab takes it over. Views outside a run have addresses, so the
// browser's back button and links work:
//   #  title · #play  mode choice · #story, #story/<map> · #survival
//   #lodge, #lodge/talents, #lodge/workshop · #lab
// Settings and profiles are overlays without an address.

const FRONT: Record<string, FrontView> = { '': 'title', play: 'play', story: 'story', survival: 'survival' };

/** True while the silent demo is on the board, so moving between views does not restart it. */
let demoOn = false;
/** The address a run was started from; kept in the address bar during the run. */
let runAddress = '';
/** The last address outside the Lodge, for the Lodge's back button. */
let returnTo = '';

const address = () => decodeURIComponent(location.hash.replace(/^#/, ''));

function setAddress(a: string, push: boolean) {
  const url = a ? `#${a}` : location.pathname + location.search;
  try {
    if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
  } catch { /* sandboxed: the views still switch, only the address stays */ }
}

function demo() {
  if (!demoOn) startAttract();
  demoOn = true;
}

/** Shows the view for an address. */
function route(a: string) {
  const [view, sub] = a.split('/');
  closeSheet();
  if (view === 'lab') {
    demoOn = false;
    hideFront(); hideLodge(); showLab();
    return;
  }
  hideLab();
  if (view === 'lodge') {
    demo();
    hideFront(); showLodge(sub);
    return;
  }
  hideLodge();
  const fv = FRONT[view];
  // Addresses for views that do not exist (yet) lead to the title.
  if (fv === undefined) { setAddress('', false); route(''); return; }
  // The mode choice and Survival only exist once Survival is unlocked.
  if ((fv === 'play' || fv === 'survival') && !survivalOpen()) { setAddress('story', false); route('story'); return; }
  returnTo = a;
  demo();
  showFront(fv, sub);
}

nav.go = (a) => {
  if (a !== address()) setAddress(a, true);
  route(a);
};
nav.menu = () => nav.go('');
nav.lodge = () => nav.go('lodge');
nav.lab = () => nav.go('lab');
nav.back = () => nav.go(returnTo === address() ? '' : returnTo);
nav.play = (id) => {
  closeSheet();
  hideLab(); hideLodge(); hideFront();
  demoOn = false;
  runAddress = address();
  startRun(id);
};

window.addEventListener('popstate', () => {
  // The back button during a run pauses it instead of throwing the run away.
  if (runActive()) {
    setAddress(runAddress, true);
    openPauseMenu();
    return;
  }
  route(address());
});

sheetHooks.game = currentGame;
sheetHooks.inRun = runActive;
sheetHooks.languageChanged = () => { if (!$hidden('menu')) renderFront(); if (!$hidden('lodge')) renderLodge(); };
sheetHooks.profileChanged = () => {
  // The demo shows the active profile's Warden, so it starts over.
  if (demoOn) { demoOn = false; demo(); }
  sheetHooks.languageChanged();
};
const $hidden = (id: string) => document.getElementById(id)!.hidden;

// First visit: pick the language from the browser unless the player already chose one.
setLocale(locale());
document.addEventListener('pointerdown', initAudio, { once: true });

let last = 0;
function loop(ts: number) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
  last = ts;
  frame(dt);
}
requestAnimationFrame(loop);

route(address());

// Dev-only handle for driving the game from the browser console.
if (import.meta.env.DEV) {
  Promise.all([import('./game/run'), import('./game/towers'), import('./game/hero')]).then(([run, towers, hero]) => {
    (window as unknown as Record<string, unknown>).__dw = { currentGame, currentView, startRun, ...run, ...towers, ...hero };
  });
}
