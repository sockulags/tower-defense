// Overlays that float over whatever is on screen, so the game behind them never resets:
// settings, the profile list, how-to-play cards and the keyboard shortcuts list.
// All of them share one sheet (#sheet). Settings and profiles have no address of their own.
import { getVolume, initAudio, setVolume, sfx } from '../audio';
import { TOWERS } from '../data/towers';
import { L, LOCALES, locale, setLocale } from '../i18n';
import { APP_VERSION } from '../pwa';
import {
  activeProfile, newProfile, profileSummary, profiles, renameProfile, resetProfile, switchProfile,
} from '../save';
import { heroPortrait, towerPortraits } from '../three/view';
import { ICONS } from './icons';
import { $ } from './dom';
import { FRONT_ICONS } from './front-icons';
import type { Game } from '../types';

type Sheet = 'settings' | 'profiles' | 'howto' | 'keys';

/** Wired up in main.ts so this module does not import the play screen. */
export const sheetHooks = {
  /** The running game, if a run is on the board. */
  game: (): Game | null => null,
  /** True while the player is in a run (not the demo, the lab or a finished run). */
  inRun: () => false,
  /** Called after the language changes. */
  languageChanged: () => {},
  /** Called after the active profile changes or is reset. */
  profileChanged: () => {},
};

let open: Sheet | null = null;
/** Whether the run was already paused when a sheet opened, so closing restores it. */
let wasPaused = true;
let resetArmed = false;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const sheetOpen = () => open !== null;

function show(kind: Sheet) {
  const g = sheetHooks.inRun() ? sheetHooks.game() : null;
  if (!open && g) { wasPaused = g.paused; g.paused = true; }
  open = kind;
  resetArmed = false;
  $('sheet').hidden = false;
  render();
  // Move focus into the sheet so keyboard players land on its first control.
  ($('sheetBox').querySelector<HTMLElement>('button, input') ?? $('sheetBox')).focus({ preventScroll: true });
}

export function closeSheet() {
  if (!open) return;
  open = null;
  $('sheet').hidden = true;
  $('sheetBox').innerHTML = '';
  const g = sheetHooks.inRun() ? sheetHooks.game() : null;
  // Opened from the pause menu, the game stays paused; opened with '?', it carries on.
  if (g && $('menuPop').hidden) g.paused = wasPaused;
}

export const openSettings = () => show('settings');
export const openProfiles = () => show('profiles');
export const openHowTo = () => show('howto');
export const openShortcuts = () => show('keys');

function render() {
  const box = $('sheetBox');
  const f = L().front;
  const title = open === 'settings' ? f.settings : open === 'profiles' ? f.watchers : open === 'howto' ? f.howTo : f.shortcuts;
  let body = '';
  if (open === 'settings') body = settingsHtml();
  else if (open === 'profiles') body = profilesHtml();
  else if (open === 'howto') body = howToHtml();
  else body = keysHtml();
  box.className = `sheet-box panel sheet-${open}`;
  box.setAttribute('aria-label', title);
  box.innerHTML = `<header><h2>${title}</h2><button class="x" id="sClose" aria-label="${esc(f.close)}" title="${esc(f.close)}">${ICONS.close}</button></header>${body}`;
  $('sClose').onclick = () => closeSheet();
  if (open === 'settings') wireSettings();
  else if (open === 'profiles') wireProfiles();
  else if (open === 'howto') $('sGotIt').onclick = () => closeSheet();
}

// ---------- settings ----------

function settingsHtml() {
  const s = L(), f = s.front, inRun = sheetHooks.inRun(), p = activeProfile();
  const vol = Math.round(getVolume() * 100);
  let h = `<section class="srow">
      <label for="sVolume">${f.volume}</label>
      <input type="range" id="sVolume" min="0" max="100" step="5" value="${vol}">
      <output id="sVolumeOut" class="num">${vol}%</output>
    </section>`;
  // Language and profiles change the whole front door, so they live outside runs.
  if (!inRun) {
    h += `<section class="srow"><span class="lbl">${s.language}</span><div class="langs">${LOCALES.map((l) =>
      `<button class="chip${l.id === locale() ? ' on' : ''}" data-lang="${l.id}">${l.label}</button>`).join('')}</div></section>`;
  }
  h += `<section class="srow"><span class="lbl">${f.shortcuts}</span><button class="ghost" id="sKeys">${FRONT_ICONS.keys}<span>${f.shortcuts}</span></button></section>`;
  if (!inRun) {
    h += `<section class="sprofile">
        <div class="who"><img src="${heroPortrait(profileSummary(p.id).equip, 96)}" alt=""><b>${esc(p.name)}</b></div>
        <form class="rename" id="sRename"><input id="sName" maxlength="24" value="${esc(p.name)}" aria-label="${esc(f.yourName)}" autocomplete="off"><button class="ghost" type="submit">${f.rename}</button></form>
        <div class="btnrow">
          <button class="ghost" id="sSwitch">${f.switchWatcher}</button>
          <button class="ghost danger" id="sReset">${f.reset}</button>
        </div>
      </section>`;
  }
  h += `<p class="version fine">${f.version(APP_VERSION)}</p>`;
  return h;
}

function wireSettings() {
  const f = L().front;
  const range = $<HTMLInputElement>('sVolume');
  range.oninput = () => {
    setVolume(Number(range.value) / 100);
    $('sVolumeOut').textContent = `${range.value}%`;
  };
  // A short sample so the player hears the new level.
  range.onchange = () => { initAudio(); sfx.build(); };
  $('sKeys').onclick = () => show('keys');
  $('sheetBox').querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
    b.onclick = () => {
      setLocale(b.dataset.lang as (typeof LOCALES)[number]['id']);
      sheetHooks.languageChanged();
      render();
    };
  });
  const form = document.getElementById('sRename') as HTMLFormElement | null;
  if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    renameProfile($<HTMLInputElement>('sName').value);
    sheetHooks.profileChanged();
    render();
  };
  $('sSwitch').onclick = () => show('profiles');
  $('sReset').onclick = () => {
    if (!resetArmed) {
      resetArmed = true;
      $('sReset').textContent = f.resetSure(activeProfile().name);
      return;
    }
    resetProfile();
    sheetHooks.profileChanged();
    render();
  };
}

// ---------- profiles ----------

function profilesHtml() {
  const f = L().front, active = activeProfile().id;
  const rows = profiles().map((p) => {
    const sum = profileSummary(p.id), on = p.id === active;
    return `<button class="prow${on ? ' on' : ''}" data-profile="${p.id}" ${on ? 'aria-current="true"' : ''}>
      <img src="${heroPortrait(sum.equip, 96)}" alt="">
      <span><b>${esc(sum.name)}</b><small>${f.watchLevel(sum.level)}${on ? ` · ${f.playingNow}` : ''}</small></span>
    </button>`;
  }).join('');
  return `<div class="plist">${rows}</div>
    <form class="rename" id="sNew"><input id="sNewName" maxlength="24" placeholder="${esc(f.yourName)}" aria-label="${esc(f.yourName)}" autocomplete="off"><button class="go small" type="submit">${f.newWatcher}</button></form>`;
}

function wireProfiles() {
  $('sheetBox').querySelectorAll<HTMLButtonElement>('[data-profile]').forEach((b) => {
    b.onclick = () => {
      switchProfile(b.dataset.profile!);
      sheetHooks.profileChanged();
      closeSheet();
    };
  });
  $<HTMLFormElement>('sNew').onsubmit = (e) => {
    e.preventDefault();
    newProfile($<HTMLInputElement>('sNewName').value);
    sheetHooks.profileChanged();
    closeSheet();
  };
}

// ---------- how to play and shortcuts ----------

function howToHtml() {
  const f = L().front, portraits = towerPortraits();
  const pictures = [
    `<img src="${portraits.spark}" alt="">`,
    `<span class="pic-icon">${ICONS.horn}</span>`,
    `<img src="${portraits.frost}" alt=""><span class="badge-plus">${FRONT_ICONS.plus}</span>`,
    `<img src="${heroPortrait({ ...(sheetHooks.game()?.loadout ?? profileSummary(activeProfile().id).equip) }, 128)}" alt="">`,
  ];
  return `<div class="howto-cards">${f.cards.map((c, i) => `
      <article class="hcard" style="--accent:${i === 2 ? TOWERS.frost.color : i === 0 ? TOWERS.spark.color : 'var(--brass)'}">
        <div class="pic">${pictures[i]}</div>
        <b>${c.title}</b><p class="fine">${c.text}</p>
      </article>`).join('')}</div>
    <div class="btnrow center"><button class="go" id="sGotIt">${f.gotIt}</button></div>`;
}

function keysHtml() {
  return `<dl class="keys">${L().front.keys.map(([k, what]) => `<dt><kbd>${k}</kbd></dt><dd>${what}</dd>`).join('')}</dl>`;
}

// ---------- keyboard ----------

// While a sheet is open it owns the keyboard: Esc closes it and the game's shortcuts rest.
// '?' opens the shortcuts list during a run.
window.addEventListener('keydown', (e) => {
  if (open) {
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
    e.stopPropagation();
    return;
  }
  if (e.key === '?' && sheetHooks.inRun() && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    e.stopPropagation();
    openShortcuts();
  }
}, { capture: true });

$('sheet').addEventListener('pointerdown', (e) => { if (e.target === $('sheet')) closeSheet(); });
