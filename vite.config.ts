import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Links the installable-app files (manifest, icons, iOS hints) into the page; Pages build only. */
const pwaHead = (base: string): Plugin => ({
  name: 'duskwatch-pwa-head',
  transformIndexHtml: () => [
    { tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'theme-color', content: '#2a1c2c' }, injectTo: 'head' },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: `${base}icons/favicon-48.png` }, injectTo: 'head' },
    { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}icons/apple-touch-icon.png` }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Duskwatch' }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }, injectTo: 'head' },
  ],
});

// Two builds share this config:
// - `npm run build` (default mode): one self-contained dist/index.html, turned into
//   dist/artifact.html for the claude.ai Artifact. No service worker, no manifest.
// - `npm run build:pages` (mode "pages"): a normal multi-file build served from
//   https://sockulags.github.io/tower-defense/, installable, with a service worker
//   (dist/sw.js, written afterwards by scripts/pages-sw.mjs).
export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  const base = pages ? '/tower-defense/' : '/';
  return {
    base,
    plugins: pages ? [pwaHead(base)] : [viteSingleFile()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __PWA__: JSON.stringify(pages),
    },
    server: { port: 5173 },
  };
});
