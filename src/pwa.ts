// The installable web app: self-hosted fonts, the app version, and (in the GitHub Pages build only)
// the service worker with its "New version, tap to update" note. The claude.ai Artifact build never
// registers a worker; __PWA__ is false there.
import './fonts/fonts.css';
import { L } from './i18n';

declare const __APP_VERSION__: string;
declare const __PWA__: boolean;

/** The game's version from package.json, shown small in settings so testers can say which build they had. */
export const APP_VERSION: string = __APP_VERSION__;

function showUpdateNote(worker: ServiceWorker) {
  if (document.getElementById('updateNote')) return;
  const note = document.createElement('button');
  note.id = 'updateNote';
  note.className = 'update-note';
  note.type = 'button';
  note.textContent = L().pwa.update;
  note.addEventListener('click', () => {
    note.disabled = true;
    worker.postMessage({ type: 'skip-waiting' });
  });
  document.body.appendChild(note);
}

function registerWorker() {
  const sw = navigator.serviceWorker;
  let reloading = false;
  sw.register(`${import.meta.env.BASE_URL}sw.js`).then((reg) => {
    // Only offer an update when a worker already controls the page; the first install is silent.
    const offer = (w: ServiceWorker | null) => { if (w && sw.controller) showUpdateNote(w); };
    offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
    });
    // A home-screen app can stay open for days; look for a new deploy whenever it comes back.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => { /* offline */ });
    });
  }).catch(() => { /* no worker: the game still runs, just not offline */ });
  sw.addEventListener('controllerchange', () => {
    if (reloading || !document.getElementById('updateNote')) return;
    reloading = true;
    location.reload();
  });
}

if (__PWA__ && 'serviceWorker' in navigator) {
  if (document.readyState === 'complete') registerWorker();
  else window.addEventListener('load', registerWorker, { once: true });
}
