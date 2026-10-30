// Writes dist/sw.js for the Pages build: the service worker from scripts/sw.js with the list of
// every built file to precache and a hash of their contents, so each deploy installs a new worker.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const skip = new Set(['sw.js', 'artifact.html']);
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(DIST)
  .map((p) => relative(DIST, p).split(sep).join('/'))
  .filter((f) => !skip.has(f) && !f.endsWith('.map'))
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(DIST, f)));
const build = hash.digest('hex').slice(0, 12);

const urls = ['./', ...files.map((f) => `./${f}`)];
const sw = readFileSync('scripts/sw.js', 'utf8')
  .replace("'__BUILD__'", JSON.stringify(build))
  .replace('__FILES__', JSON.stringify(urls, null, 2));
writeFileSync(join(DIST, 'sw.js'), sw);
console.log(`Wrote dist/sw.js: ${urls.length} files, build ${build}`);
