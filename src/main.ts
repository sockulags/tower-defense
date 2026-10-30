import './style.css';
import { initAudio } from './audio';
import { locale, setLocale } from './i18n';
import { hideLab, showLab } from './ui/lab';
import { hideLodge, showLodge } from './ui/lodge';
import { renderMenu, showMenu } from './ui/menu';
import { nav } from './ui/nav';
import { currentGame, currentView, frame, startAttract, startRun } from './ui/play';

// Four screens share one board: the menu and the lodge float over a live demo, a run plays on
// it, and the lab takes it over. The lab and the lodge have their own addresses (#lab, #lodge).
const setHash = (h: string) => {
  try { history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search); } catch { /* sandboxed */ }
};

nav.menu = () => { hideLab(); hideLodge(); startAttract(); showMenu(); setHash(''); };
nav.play = (id) => { hideLab(); hideLodge(); startRun(id); setHash(''); };
nav.lab = () => { hideLodge(); showLab(); setHash('lab'); };
nav.lodge = () => { hideLab(); startAttract(); showLodge(); setHash('lodge'); };

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

const start = location.hash.replace('#', '');
if (start === 'lab') nav.lab();
else if (start === 'lodge') nav.lodge();
else { startAttract(); renderMenu(); }

// Dev-only handle for driving the game from the browser console.
if (import.meta.env.DEV) {
  Promise.all([import('./game/run'), import('./game/towers'), import('./game/hero')]).then(([run, towers, hero]) => {
    (window as unknown as Record<string, unknown>).__dw = { currentGame, currentView, startRun, ...run, ...towers, ...hero };
  });
}
