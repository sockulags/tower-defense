# Release plan: GitHub Pages and an installable app for friends and family

Status: built and live at https://sockulags.github.io/tower-defense/. Goal: friends and family open a link on
their phone, add the game to the home screen, play it like an app, and tell the user what they
think in person. There is no feedback form; the user collects opinions privately.

## What is needed

### 1. A home on GitHub

- A public repository named `tower-defense` (the name does not matter to the user and can change
  with the game's real name). Public, so GitHub Pages is free. `main` is pushed to it.

### 2. Automatic publishing

- A GitHub Actions workflow builds the game on every push to `main` and deploys `dist/` to GitHub
  Pages, so the friends' link always has the latest version.
- Vite's `base` is set to the repository path (`/tower-defense/`) for the Pages build. The
  single-file build for the claude.ai Artifact stays as it is.

### 3. An installable web app (PWA)

- A web app manifest: name, short name, colours from the storybook palette, portrait and landscape,
  `display: standalone` so it opens without browser bars.
- App icons in the needed sizes (192, 512 and a maskable one), drawn from the game's own art, for
  example the heart lantern on a parchment disc. Rendered from the 3D models, like the portraits.
- A service worker that caches the game, so it starts instantly and plays offline after the first
  visit. The Google Fonts are bundled locally so offline text looks right.
- An update prompt: when a new version is deployed, a small "New version, tap to update" note
  appears instead of silently keeping the old one.
- Saves stay in the browser's local storage, per device, with the local profiles from
  `front-door.md`.

### 4. Phones and touch

The game is built for mouse and keyboard today. Before friends test on phones:

- Touch replaces hover: tapping a tower shows its "+" button (or the two branch buttons); a long
  press opens the full card. Hover still works with a mouse.
- Building works with a tap: pick a tower on the belt, then the ghost follows the finger and a
  second tap places it, so a finger never hides the spot.
- The board and HUD fit a phone in landscape. In portrait, a "turn your phone" note, unless the
  board can be made to work upright (to be tested).
- Buttons are at least finger-sized, and nothing important depends on keyboard shortcuts.
- Tested on a real iPhone and Android phone through the Pages link.

### 5. Version number

- The version is shown small in settings, so when a tester mentions a problem the user can tell
  which build they had.

## Order

Recommended right after the front door, before the gameplay phases: the front door gives testers a
clear start, and every gameplay phase after that reaches them automatically and gets their opinions.

1. GitHub repository and Pages workflow.
2. Manifest, icons, service worker, local fonts, update prompt.
3. Touch and phone layout.
4. Version number in settings.

## Decisions

1. Public repository, so GitHub Pages is free.
2. No feedback form; testers tell the user in person.
3. Repository name `tower-defense` for now.
