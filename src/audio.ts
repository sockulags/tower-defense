import type { TowerType } from './types';
import type { WeaponId } from './data/hero';

let ac: AudioContext | null = null;
/** Every sound goes through one soft compressor so many towers firing at once never clip or turn harsh. */
let bus: AudioNode | null = null;
let noiseBuf: AudioBuffer | null = null;
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
  try {
    ac = new AudioContext();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    // A gentle top cut keeps noise-based sounds (crackle, whoosh) soft rather than hissy.
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    lp.connect(comp).connect(ac.destination);
    bus = lp;
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ac = null; bus = null; }
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

const audible = () => !!(volume && !quiet && ac && bus);
/** Scales a designed loudness by the player's volume (0.8 is the designed level). */
const amp = (v: number) => v * volume / 0.8;

/** A soft envelope on a gain node: quick rise to `vol`, then an exponential fall to silence. */
function envelope(g: GainNode, t: number, vol: number, dur: number, attack: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp(vol)), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

export function tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.05, slide = 0, at = 0, attack = 0.004) {
  if (!audible()) return;
  const t = ac!.currentTime + at;
  const o = ac!.createOscillator();
  const g = ac!.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  envelope(g, t, vol, dur, Math.min(attack, dur * 0.5));
  o.connect(g).connect(bus!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Filtered noise: crackles, whooshes and thuds. The filter can sweep through `sweep` (pairs of [seconds, Hz]). */
function noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, opts: { q?: number; at?: number; attack?: number; sweep?: [number, number][] } = {}) {
  if (!audible() || !noiseBuf) return;
  const t = ac!.currentTime + (opts.at ?? 0);
  const src = ac!.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac!.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  f.Q.value = opts.q ?? 1;
  for (const [s, hz] of opts.sweep ?? []) f.frequency.exponentialRampToValueAtTime(hz, t + s);
  const g = ac!.createGain();
  envelope(g, t, vol, dur, Math.min(opts.attack ?? 0.003, dur * 0.5));
  src.connect(f).connect(g).connect(bus!);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** Drops a sound if the same one played less than `ms` ago, so a row of towers does not pile up. */
const lastPlayed = new Map<string, number>();
function gate(key: string, ms: number) {
  const n = performance.now();
  if (n - (lastPlayed.get(key) ?? -1e9) < ms) return false;
  lastPlayed.set(key, n);
  return true;
}
const jitter = (f: number, amount = 0.04) => f * (1 + (Math.random() - 0.5) * 2 * amount);

/** A struck bell or glass: a few inharmonic sine partials that ring out at different rates. */
function bell(f: number, dur: number, vol: number, partials: [number, number, number][]) {
  tone(f, dur, 'sine', vol, 0, 0, 0.003);
  for (const [ratio, d, v] of partials) tone(f * ratio, dur * d, 'sine', vol * v, 0, 0, 0.002);
}

/** Pentatonic notes for Rime's chime, so a crowd of frost towers sounds like wind chimes, not noise. */
const CHIME = [1319, 1480, 1661, 1976, 2217];

// The tower voices. Each is quiet and short; together they let a wave be followed by ear.
const towerVoice: Record<TowerType, () => void> = {
  // Spark: a dry electric crackle, three tiny ticks and a small zap.
  spark() {
    if (!gate('spark', 55)) return;
    for (const at of [0, 0.02 + Math.random() * 0.01, 0.045 + Math.random() * 0.015]) {
      noise(0.018, 0.045, 'bandpass', jitter(3800, 0.2), { q: 2.5, at });
    }
    tone(jitter(1500), 0.05, 'triangle', 0.01, -600);
  },
  // Rime: a glassy chime.
  frost() {
    if (!gate('frost', 70)) return;
    bell(CHIME[Math.floor(Math.random() * CHIME.length)], 0.45, 0.02, [[2.76, 0.5, 0.35], [5.4, 0.2, 0.15]]);
  },
  // Ember: a soft whoomp of air and flame.
  pulse() {
    if (!gate('pulse', 90)) return;
    noise(0.34, 0.07, 'lowpass', 180, { q: 0.8, attack: 0.03, sweep: [[0.07, 1100], [0.34, 220]] });
    tone(jitter(95), 0.3, 'sine', 0.04, -45, 0, 0.025);
  },
  // Starfall: a falling whistle as the star leaves; the thud comes on impact.
  star() {
    if (!gate('star', 120)) return;
    tone(jitter(1500, 0.06), 0.55, 'sine', 0.011, -700, 0, 0.06);
  },
};

const weaponVoice: Record<WeaponId, () => void> = {
  // Lantern staff: a warm little fwip of light.
  staff() {
    if (!gate('staff', 60)) return;
    tone(jitter(620), 0.09, 'triangle', 0.018, 320);
    tone(jitter(1240), 0.05, 'sine', 0.006, 0, 0.01);
  },
  // Bell: one clear ring.
  bell() {
    if (!gate('bell', 120)) return;
    bell(jitter(523, 0.01), 0.7, 0.024, [[2, 0.6, 0.4], [3.01, 0.35, 0.22]]);
  },
  // Sling: a snap and a whoosh.
  sling() {
    if (!gate('sling', 60)) return;
    tone(320, 0.035, 'triangle', 0.012, -100);
    noise(0.1, 0.04, 'bandpass', 1900, { q: 1.4, sweep: [[0.1, 600]] });
  },
};

/** The heavy landing of a star: a low thump with a puff of soil. */
function thud(vol = 1) {
  tone(jitter(120), 0.3, 'sine', 0.06 * vol, -78);
  noise(0.13, 0.05 * vol, 'lowpass', 420, { q: 0.7 });
}

const castVoice: Record<WeaponId, () => void> = {
  // Flare: lantern light swelling out.
  staff() {
    noise(0.5, 0.05, 'lowpass', 300, { attack: 0.05, sweep: [[0.18, 2400], [0.5, 500]] });
    tone(440, 0.35, 'triangle', 0.02, 440, 0, 0.03);
    tone(880, 0.4, 'sine', 0.012, 0, 0.12, 0.02);
  },
  // Toll: one deep ring across the board.
  bell() {
    bell(262, 1.6, 0.04, [[2, 0.65, 0.38], [2.76, 0.4, 0.2], [5.4, 0.2, 0.08]]);
  },
  // Shooting Star: a fast whistle and a heavy landing.
  sling() {
    tone(2000, 0.32, 'sine', 0.014, -1300, 0, 0.03);
    setTimeout(() => thud(1.2), 300);
  },
};

export const sfx = {
  /** A tower attacks, in its own voice. */
  fire(type: TowerType) { towerVoice[type](); },
  /** The Warden attacks with this weapon. */
  weapon(w: WeaponId) { weaponVoice[w](); },
  /** The Warden casts this weapon's ability. */
  cast(w: WeaponId) { castVoice[w](); },
  /** A Starfall star lands. */
  thud() { if (gate('thud', 60)) thud(); },
  /** A shadow pops; a giant falls with a deep, soft plop. */
  kill(big = false) {
    if (big) {
      tone(170, 0.5, 'sine', 0.06, -115);
      noise(0.42, 0.05, 'lowpass', 600, { q: 0.7, sweep: [[0.42, 150]] });
      tone(330, 0.25, 'triangle', 0.015, -180, 0.05);
      return;
    }
    if (!gate('kill', 35)) return;
    tone(320 + Math.random() * 80, 0.12, 'sine', 0.035, -180);
  },
  shot() {
    const n = performance.now();
    if (n - lastShot < 60) return;
    lastShot = n;
    tone(880 + Math.random() * 200, 0.06, 'triangle', 0.018);
  },
  shell() { tone(300, 0.12, 'triangle', 0.025, 200); },
  boom() { tone(140, 0.3, 'sawtooth', 0.035, -90); },
  pulse() { tone(220, 0.18, 'sine', 0.03, 120); },
  level() { tone(660, 0.1, 'triangle', 0.05); setTimeout(() => tone(990, 0.16, 'triangle', 0.05), 90); },
  build() { tone(520, 0.08, 'square', 0.025); },
  leak() { tone(110, 0.4, 'square', 0.05, -50); },
  wave() { tone(392, 0.15, 'triangle', 0.04); setTimeout(() => tone(523, 0.2, 'triangle', 0.04), 120); },
};
