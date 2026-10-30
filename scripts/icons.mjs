// Renders the app icons in public/icons/ from the game's 3D heart lantern (scripts/icons/icon.js).
// WebGL needs a browser, so a Vite server hosts the page and headless Chrome or Edge renders it.
// Usage: npm run icons   (set CHROME=path/to/chrome to pick the browser)
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { createServer } from 'vite';

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) throw new Error('No Chrome or Edge found; set CHROME to its path.');

const server = await createServer({ logLevel: 'error', server: { port: 5199, strictPort: false } });
try {
  await server.listen();
  const url = `${server.resolvedUrls.local[0]}scripts/icons/icon.html`;
  const { stdout } = await promisify(execFile)(browser, [
    '--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--virtual-time-budget=20000', '--dump-dom', url,
  ], { maxBuffer: 64 * 1024 * 1024 });
  const json = stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/)?.[1];
  if (!json) throw new Error('The icon page rendered nothing.');
  const icons = JSON.parse(json.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  await mkdir('public/icons', { recursive: true });
  for (const [name, dataUrl] of Object.entries(icons)) {
    await writeFile(`public/icons/${name}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`public/icons/${name}`);
  }
} finally {
  await server.close();
}
