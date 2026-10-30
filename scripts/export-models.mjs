// Exports every model in src/three/models.ts as a .glb file in exports/models/,
// for viewing in ArtCraft (3D Stage > Upload 3D Model) or any glTF viewer.
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

// GLTFExporter reads its binary output through FileReader, which Node lacks.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { this.#done(blob.arrayBuffer()); }
  readAsDataURL(blob) {
    this.#done(blob.arrayBuffer().then((b) => `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`));
  }
  #done(promise) {
    promise.then((result) => { this.result = result; this.onload?.({ target: this }); this.onloadend?.({ target: this }); });
  }
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const m = await server.ssrLoadModule('/src/three/models.ts');
  const { MAPS } = await server.ssrLoadModule('/src/data/maps.ts');
  const THREE = await import('three');
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

  const rnd = () => Math.random();
  const models = {};
  for (const type of ['spark', 'frost', 'pulse', 'star']) {
    models[`tower-${type}`] = m.makeTower(type, 1, null);
    models[`tower-${type}-level6-branch-a`] = m.makeTower(type, 6, 0);
    models[`tower-${type}-level6-branch-b`] = m.makeTower(type, 6, 1);
  }
  for (const type of ['crawler', 'flitter', 'lump', 'shimmer', 'giant']) models[`enemy-${type}`] = m.makeEnemy(type);
  models['warden-default'] = m.makeHero({ weapon: 'staff', charm: 'none', hat: 'hood', cloak: 'moss' });
  models['warden-bell-wizard'] = m.makeHero({ weapon: 'bell', charm: 'badge', hat: 'wizard', cloak: 'midnight' });
  models['warden-sling-tricorn'] = m.makeHero({ weapon: 'sling', charm: 'jar', hat: 'tricorn', cloak: 'crimson' });
  models['warden-staff-leaves'] = m.makeHero({ weapon: 'staff', charm: 'ember', hat: 'leaves', cloak: 'saffron' });
  Object.assign(models, {
    heart: m.makeHeart(), portal: m.makePortal(), windmill: m.makeWindmill(),
    tree: m.makeTree(rnd), rock: m.makeRock(rnd), mushrooms: m.makeMushrooms(rnd),
    'dead-tree': m.makeDeadTree(rnd), grave: m.makeGrave(rnd), 'lamp-post': m.makeLampPost(),
    'board-mill': m.makeBoard(MAPS.mill),
  });

  await mkdir('exports/models', { recursive: true });
  for (const [name, obj] of Object.entries(models)) {
    // Status effects and the branch badge are hidden in game until needed; leave them out.
    obj.traverse((o) => { if (['slow', 'burn', 'stun', 'badge'].includes(o.name)) o.visible = false; });
    const scene = new THREE.Scene();
    scene.add(obj);
    const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true });
    await writeFile(`exports/models/${name}.glb`, Buffer.from(glb));
    console.log(`exports/models/${name}.glb`);
  }
} finally {
  await server.close();
}
