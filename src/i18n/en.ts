export const en = {
  tagline: 'Shadows creep out when the sun goes down. Light lanterns along the road and let them grow strong before the shadows reach the heart.',
  language: 'Language',

  menu: {
    watchLevel: 'Watch level',
    stardust: 'Stardust',
    toLevel: (cur: number, need: number, level: number) => `${cur} / ${need} to level ${level}`,
    unlocksAt: (name: string, level: number) => `${name} unlocks at level ${level}`,
    chooseEvening: 'Choose your evening',
    workshop: 'The Workshop',
    workshopIntro: 'You earn stardust every run. Upgrades bought here apply to all future runs.',
    towers: 'The Towers',
    towersIntro: 'Towers level up from the damage they deal. At level 3 you pick one of two branches, and at level 4 the tower earns a name.',
    waves: (n: number) => `${n} waves`,
    survival: 'Survival',
    cleared: 'Cleared',
    best: (n: number) => `Best: ${n} ${n === 1 ? 'wave' : 'waves'}`,
    play: 'Play',
    locked: 'Locked',
    comingLater: 'Coming later',
    soon: [
      { name: 'Head-to-head', desc: 'Two watchers, one screen. Shadows you defeat are sent over to your opponent.' },
      { name: 'Build your own road', desc: 'An open field where your towers form the maze and the shadows are forced into detours.' },
    ],
    buyFor: (cost: number) => `Buy for ${cost} dust`,
    maxed: 'Fully upgraded',
    goldCost: (cost: number) => `${cost} gold`,
    unlockAtLevel: (level: number) => `Unlocks at watch level ${level}`,
    branches: (a: string, b: string) => `Branches: ${a} or ${b}`,
  },

  hud: {
    lives: 'Lives',
    gold: 'Gold',
    wave: 'Wave',
    startWave: 'Start wave',
    waveRunning: (left: number) => `Wave running (${left})`,
    auto: 'Auto',
    autoTitle: 'Start the next wave automatically',
    pause: 'Pause',
    resume: 'Resume',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    giveUp: 'Give up',
    sure: 'Sure? Click again',
    keys: 'Keys: 1–4 pick a tower, space starts a wave, Esc cancels.',
  },

  info: {
    level: (n: number) => `Level ${n}`,
    damage: 'Damage',
    range: 'Range',
    tiles: (n: string) => `${n} tiles`,
    rate: 'Rate',
    perSecond: (n: string) => `${n} per second`,
    slows: 'Slows',
    record: (kills: number, dealt: string) => `${kills} defeated · ${dealt} damage`,
    chooseBranch: 'Choose a branch to keep levelling',
    train: (cost: number) => `Train (${cost} gold)`,
    maxLevel: 'Max level',
    sell: (value: number) => `Sell (+${value})`,
    buildHint: 'Click the grass to build. The tower levels up from the damage it deals, and at level 3 you choose a branch:',
    or: 'or',
    idleTitle: "Tonight's watch",
    idleHint: 'Pick a tower above and click the grass to build. Click a built tower to train it, choose a branch or sell it.',
    idleHint2: 'Towers grow stronger from the damage they deal. The tower in the hottest corner becomes your veteran.',
  },

  fx: {
    wave: (n: number) => `Wave ${n}`,
    giantWave: (n: number) => `Wave ${n}: a shadow giant approaches`,
    waveCleared: (n: number, bonus: number) => `Wave ${n} cleared  +${bonus} gold`,
    lifeLost: (n: number) => `−${n} ${n === 1 ? 'life' : 'lives'}`,
    level: (n: number) => `Level ${n}`,
  },

  end: {
    win: 'Dawn has come',
    gaveUp: 'The watcher left the post',
    lose: 'The heart went dark',
    survived: (n: number) => `You held out for ${n} waves.`,
    clearedOf: (cleared: number, total: number) => `${cleared} of ${total} waves cleared.`,
    record: 'New record!',
    dust: (n: number) => `+${n} stardust`,
    hero: (who: string, level: number, kills: number) => `Hero of the night: ${who} at level ${level}, with ${kills} shadows defeated.`,
    newLevel: (n: number) => `Watch level ${n}!`,
    newTower: (name: string) => `New tower: ${name}`,
    newMap: (name: string) => `New map: ${name}`,
    again: 'Play again',
    menu: 'Back to menu',
  },

  maps: {
    mill: { name: 'Mill Hill', blurb: 'A long winding road past the old mill. A good first evening.' },
    marsh: { name: 'Marsh Ditch', blurb: 'A shorter road and tougher shadows. Unlocks when you clear Mill Hill.' },
    ring: { name: 'Ring Rampart', blurb: 'Survival. The spiral leads in toward the heart and the waves never end.' },
  },

  towers: {
    spark: { name: 'Spark', desc: 'Quick sparks at one enemy at a time.', branches: [
      { name: 'Twin Spark', desc: 'Fires at two enemies at once.' },
      { name: 'Marksman', desc: 'Much longer range and double damage, but slower.' },
    ] },
    frost: { name: 'Rime', desc: 'Cold bolts that slow the enemy down.', branches: [
      { name: 'Ice Prison', desc: '20% chance to freeze the enemy solid for 1.2 seconds.' },
      { name: 'Fog Bank', desc: 'Slows every enemy in range at once.' },
    ] },
    pulse: { name: 'Ember Pulse', desc: 'A heatwave that hits everything around the tower.', branches: [
      { name: 'Heatwave', desc: 'Enemies keep burning for 3 seconds.' },
      { name: 'Thunder Pulse', desc: 'Faster pulses with a 25% chance to stun.' },
    ] },
    star: { name: 'Starfall', desc: 'A slow impact that damages a whole cluster.', branches: [
      { name: 'Meteor', desc: 'Bigger and heavier impacts.' },
      { name: 'Shrapnel', desc: 'The impact sends five shards to nearby enemies.' },
    ] },
  },

  upgrades: {
    gold: { name: 'Pocket Money', desc: '+30 starting gold per level' },
    lives: { name: 'Thicker Walls', desc: '+3 lives per level' },
    dmg: { name: 'Polished Lenses', desc: '+6% damage for all towers per level' },
    xp: { name: 'Quick Learners', desc: '+15% tower XP per level' },
  },

  nicknames: ['Old Sven', 'Little My', 'Bertil', 'Miss Frost', 'Captain Glow', 'Aunt Sparkle', 'Uncle Bo', 'Stina',
    'Watchy', 'Doris', 'Lantern Larry', 'Elsa', 'Old Green', 'Majken', 'Knut'],
};

export type Strings = typeof en;
