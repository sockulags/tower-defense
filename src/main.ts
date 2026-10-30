import './style.css';
import { initAudio } from './audio';
import { locale, setLocale } from './i18n';
import { renderMenu, showMenu } from './ui/menu';
import { nav } from './ui/nav';
import { currentGame, frame, startRun } from './ui/play';

nav.menu = showMenu;
nav.play = startRun;

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

renderMenu();

// Dev-only handle for driving the game from the browser console.
if (import.meta.env.DEV) {
  Promise.all([import('./game/run'), import('./game/towers')]).then(([run, towers]) => {
    (window as unknown as Record<string, unknown>).__dw = { currentGame, startRun, ...run, ...towers };
  });
}
