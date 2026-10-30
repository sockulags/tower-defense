const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

/** Inline SVG icons for the in-game HUD, drawn in the storybook ink-and-fill style. */
export const ICONS = {
  heart: svg('<path d="M12 21s-7.5-4.6-9.4-9.3C1.2 8.2 3.4 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.6 0 5.8 3.7 4.4 7.2C19.5 16.4 12 21 12 21z" fill="#e8484f" stroke="#2a1c2c" stroke-width="2" stroke-linejoin="round"/><path d="M7.5 8.2c-1 .3-1.6 1.2-1.6 2.2" stroke="#ffc2c2" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  coin: svg('<circle cx="12" cy="12" r="9" fill="#f2c14e" stroke="#2a1c2c" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#b07d22" stroke-width="1.6"/><path d="M9 8.5c.8-.9 1.9-1.4 3-1.4" stroke="#fff1c2" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/>'),
  play: svg('<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  mute: svg('<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M16 9l5 6m0-6l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  menu: svg('<path d="M4.5 7h15M4.5 12h15M4.5 17h15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  close: svg('<path d="M6.5 6.5l11 11m0-11l-11 11" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.2" fill="none"/>'),
  star: svg('<path d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.4l-5.4 3 1.2-6.1-4.5-4.2 6.1-.7z" fill="#b48cff" stroke="#2a1c2c" stroke-width="1.8" stroke-linejoin="round"/>'),
  horn: svg('<path d="M3.5 10v4l3 .5 9.5 5V4.5L6.5 9.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M18.5 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M6 14.5l1.5 5h2.5l-1-4.5" fill="currentColor"/>'),
};

