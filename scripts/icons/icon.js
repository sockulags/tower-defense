// Draws the app icons from the game's own 3D art: the heart lantern, cel-shaded and outlined as on
// the board, standing on a parchment disc. Run through scripts/icons.mjs, not by hand.
import * as THREE from 'three';
import { makeHeart } from '/src/three/models.ts';

// Storybook palette, as in src/style.css.
const PARCH = '#f8ecd2', PARCH_2 = '#ecd7ad', INK = '#2a1c2c', BRASS = '#f0bf55', BRASS_D = '#b07d22';

// Same inverted-hull outline as addOutlines in src/three/view.ts, a touch thicker for small sizes.
const OUTLINE = new THREE.ShaderMaterial({
  uniforms: { thickness: { value: 0.018 }, color: { value: new THREE.Color(INK) } },
  vertexShader: 'uniform float thickness; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thickness, 1.0); }',
  fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }',
  side: THREE.BackSide,
});
function addOutlines(root) {
  const targets = [];
  root.traverse((o) => { if (o.isMesh && o.material instanceof THREE.MeshToonMaterial && !o.material.transparent) targets.push(o); });
  for (const m of targets) m.add(new THREE.Mesh(m.geometry, OUTLINE));
}

/** The heart lantern alone on a transparent square, in the portraits' golden-hour light. */
function renderLantern(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#d5e6ff', '#8a6b4c', 1.4));
  const sun = new THREE.DirectionalLight('#ffd7a0', 2.4);
  sun.position.set(-3, 4, 3);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#ffc2d6', 0.9);
  rim.position.set(3, 3, -4);
  scene.add(rim);
  const heart = makeHeart();
  addOutlines(heart);
  scene.add(heart);
  const half = 0.74, centerY = 0.58;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 20);
  cam.position.set(1.5, 1.7 + centerY, 4.6);
  cam.lookAt(0, centerY, 0);
  renderer.render(scene, cam);
  return canvas;
}

const lantern = renderLantern(1024);

/** `full`: an opaque square for maskable and Apple icons. Otherwise a disc on transparency. */
function icon(size, full) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;
  const disc = full ? size * 0.71 : size * 0.47;
  const bg = g.createRadialGradient(mid, mid * 0.86, 0, mid, mid, disc);
  bg.addColorStop(0, '#fff6dc');
  bg.addColorStop(0.55, PARCH);
  bg.addColorStop(1, PARCH_2);
  g.fillStyle = bg;
  if (full) g.fillRect(0, 0, size, size);
  else {
    g.beginPath(); g.arc(mid, mid, disc, 0, Math.PI * 2); g.fill();
    // Brass ring and chunky ink outline, like the UI's medallions.
    g.lineWidth = size * 0.022; g.strokeStyle = BRASS;
    g.beginPath(); g.arc(mid, mid, disc - size * 0.04, 0, Math.PI * 2); g.stroke();
    g.lineWidth = size * 0.008; g.strokeStyle = BRASS_D;
    g.beginPath(); g.arc(mid, mid, disc - size * 0.054, 0, Math.PI * 2); g.stroke();
    g.lineWidth = size * 0.034; g.strokeStyle = INK;
    g.beginPath(); g.arc(mid, mid, disc - size * 0.017, 0, Math.PI * 2); g.stroke();
  }
  // A soft warm halo behind the lamp, kept modest like the board's glow.
  const lampY = mid - size * 0.07;
  const halo = g.createRadialGradient(mid, lampY, 0, mid, lampY, size * 0.3);
  halo.addColorStop(0, 'rgba(255, 205, 110, 0.55)');
  halo.addColorStop(1, 'rgba(255, 205, 110, 0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  // Maskable icons keep everything inside the central 80% safe circle.
  const art = full ? size * 0.78 : size * 0.9;
  g.imageSmoothingQuality = 'high';
  g.drawImage(lantern, mid - art / 2, mid - art / 2 + size * 0.01, art, art);
  return c.toDataURL('image/png');
}

document.getElementById('out').textContent = JSON.stringify({
  'icon-192.png': icon(192, false),
  'icon-512.png': icon(512, false),
  'icon-maskable-512.png': icon(512, true),
  'apple-touch-icon.png': icon(180, true),
  'favicon-48.png': icon(48, false),
});
