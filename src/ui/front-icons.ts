const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

/** Icons for the front door views and overlays, in the same ink-and-fill style as the HUD icons. */
export const FRONT_ICONS = {
  gear: svg('<path d="M10.3 2.5h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.4" fill="var(--parch)"/>'),
  left: svg('<path d="M15 4.5L7.5 12 15 19.5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  right: svg('<path d="M9 4.5l7.5 7.5L9 19.5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  book: svg('<path d="M12 6.5C9.8 5 7 4.6 3.5 5v13.5c3.5-.4 6.3 0 8.5 1.5 2.2-1.5 5-1.9 8.5-1.5V5c-3.5-.4-6.3 0-8.5 1.5z" fill="var(--parch)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 6.5V20" stroke="currentColor" stroke-width="2"/>'),
  plus: svg('<circle cx="12" cy="12" r="9" fill="var(--brass)" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v9M7.5 12h9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  keys: svg('<rect x="2.5" y="6" width="19" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 10h1M9.5 10h1M13 10h1M16.5 10h1M7.5 14h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
};
