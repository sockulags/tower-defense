// Turns the single-file Vite build into a page body for publishing as a claude.ai Artifact.
// The Artifact host adds its own doctype, charset and viewport, so those are stripped here.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';

const cleanedHead = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .trim();

writeFileSync('dist/artifact.html', `${cleanedHead}\n${body.trim()}\n`);
console.log('Wrote dist/artifact.html');
