let ac: AudioContext | null = null;
/** Sound effects volume from 0 to 1, chosen in settings. The default 0.8 plays each sound at its designed loudness. */
const VOLUME_KEY = 'duskwatch-volume';
let volume = (() => {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    if (localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(v)) return Math.min(1, Math.max(0, v));
  } catch { /* ignore */ }
  return 0.8;
})();
/** The volume to return to when the sound button unmutes. */
let lastAudible = volume > 0 ? volume : 0.8;
/** Silences game sounds without touching the player's volume, e.g. for the menu's background demo. */
let quiet = false;
let lastShot = 0;

/** Browsers only allow audio after a user gesture, so call this from input handlers. */
export function initAudio() {
  if (ac) return;
  try { ac = new AudioContext(); } catch { /* no audio */ }
}

export const getVolume = () => volume;
export function setVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  if (volume > 0) lastAudible = volume;
  try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* ignore */ }
}
/** The in-game sound button: a quick mute that remembers the volume. */
export const isMuted = () => volume === 0;
export const setMuted = (m: boolean) => setVolume(m ? 0 : lastAudible);
export const setQuiet = (q: boolean) => { quiet = q; };

export function tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.05, slide = 0) {
  if (!volume || quiet || !ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  g.gain.setValueAtTime(vol * volume / 0.8, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  shot() {
    const n = performance.now();
    if (n - lastShot < 60) return;
    lastShot = n;
    tone(880 + Math.random() * 200, 0.06, 'triangle', 0.018);
  },
  shell() { tone(300, 0.12, 'triangle', 0.025, 200); },
  kill() { tone(320 + Math.random() * 80, 0.12, 'sine', 0.04, -180); },
  boom() { tone(140, 0.3, 'sawtooth', 0.035, -90); },
  pulse() { tone(220, 0.18, 'sine', 0.03, 120); },
  level() { tone(660, 0.1, 'triangle', 0.05); setTimeout(() => tone(990, 0.16, 'triangle', 0.05), 90); },
  build() { tone(520, 0.08, 'square', 0.025); },
  leak() { tone(110, 0.4, 'square', 0.05, -50); },
  wave() { tone(392, 0.15, 'triangle', 0.04); setTimeout(() => tone(523, 0.2, 'triangle', 0.04), 120); },
};
