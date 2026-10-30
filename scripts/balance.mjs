// Plays whole runs headless with bot players and prints a balance table per map.
//
//   npm run balance                                   every map, every strategy, 10 runs each
//   npm run balance -- --map mill --strategy mixed,spark --runs 40
//   npm run balance -- --weapon sling --charm badge   a different Warden kit
//   npm run balance -- --waves 30 --seed 7            survival wave cap, first seed
//   npm run balance -- --json                         raw reports for scripts
//   npm run balance -- --boons random                 how bots pick boons: greedy (default) or random
//   npm run balance -- --mills all                    economy buildings: compare how bots use mills
//   npm run balance -- --strategy mixed --squad each  the squad: every squad of four, to find the best per map
//
// Strategies: mixed (sensible default), spread (every tower, no upgrades), spark, frost and pulse
// (only that tower), star (rush Starfall), warden (a few towers, then the Warden first).
// Columns are win rate, waves cleared, lives lost, and shares of all damage and kills per tower
// type and for the Warden; the combo:* columns are how often each combo between towers went off per
// run (src/game/combos.ts); the last column is total gold earned over the waves. Runs are seeded:
// the same options give the same numbers.
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const list = (v, all) => (v === 'all' ? all : v.split(',').map((s) => s.trim()).filter(Boolean));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const bots = await server.ssrLoadModule('/src/game/bots.ts');
  const { MAP_ORDER } = await server.ssrLoadModule('/src/data/maps.ts');
  const { DEFAULT_LOADOUT } = await server.ssrLoadModule('/src/data/hero.ts');
  const maps = list(opt('map', 'all'), MAP_ORDER);
  const strategies = list(opt('strategy', 'all'), bots.STRATEGIES);
  for (const m of maps) if (!MAP_ORDER.includes(m)) throw new Error(`Unknown map "${m}". Maps: ${MAP_ORDER.join(', ')}`);
  for (const s of strategies) if (!bots.STRATEGIES.includes(s)) throw new Error(`Unknown strategy "${s}". Strategies: ${bots.STRATEGIES.join(', ')}`);
  const loadout = { ...DEFAULT_LOADOUT, weapon: opt('weapon', DEFAULT_LOADOUT.weapon), charm: opt('charm', DEFAULT_LOADOUT.charm) };
  const o = {
    maps, strategies, loadout,
    runs: Number(opt('runs', '10')),
    seed: Number(opt('seed', '1')),
    survivalWaves: Number(opt('waves', '40')),
    boonPick: opt('boons', 'greedy'),
  };
  // Economy buildings (lab experiment): --mills none,early,greedy,late,safe (or all) compares mill
  // profiles side by side; without the flag no bot builds mills.
  const mills = opt('mills', '');
  if (mills) {
    o.mills = list(mills, bots.MILL_PROFILES);
    for (const m of o.mills) if (!bots.MILL_PROFILES.includes(m)) throw new Error(`Unknown mill profile "${m}". Profiles: ${bots.MILL_PROFILES.join(', ')}`);
  }
  // The squad: --squad auto (each bot picks four for the map), each (every squad of four, its own
  // rows, to find the best squad per map) or a list such as spark,frost,pulse,kite. Without the
  // flag bots bring the first four towers.
  const squad = opt('squad', '');
  if (squad) {
    const { TOWER_ORDER } = await server.ssrLoadModule('/src/data/towers.ts');
    o.squad = squad === 'auto' || squad === 'each' ? squad : list(squad, TOWER_ORDER);
    if (Array.isArray(o.squad)) for (const t of o.squad) if (!TOWER_ORDER.includes(t)) throw new Error(`Unknown tower "${t}". Towers: ${TOWER_ORDER.join(', ')}`);
  }
  const started = performance.now();
  const reports = bots.runBatch(o);
  if (args.includes('--json')) console.log(JSON.stringify(reports, null, 1));
  else {
    console.log(`Warden: ${loadout.weapon} + ${loadout.charm}. Shares are of all damage and kills. Survival maps stop at wave ${o.survivalWaves}.\n`);
    console.log(bots.formatTable(reports));
    console.log(`Boons picked ${o.boonPick}:`);
    console.log(bots.formatBoonTable(reports));
    console.log(`${maps.length * strategies.length * o.runs} runs in ${((performance.now() - started) / 1000).toFixed(1)} s`);
  }
} finally {
  await server.close();
}
