import type { Strings } from './en';

export const sv: Strings = {
  tagline: 'Skuggorna kryper fram när solen går ner. Tänd lyktor längs vägen och låt dem växa sig starka innan skuggorna når hjärtat.',
  language: 'Språk',

  menu: {
    watchLevel: 'Vaktnivå',
    stardust: 'Stjärnstoft',
    toLevel: (cur, need, level) => `${cur} / ${need} till nivå ${level}`,
    unlocksAt: (name, level) => `${name} låses upp på nivå ${level}`,
    chooseEvening: 'Välj kväll',
    workshop: 'Verkstaden',
    workshopIntro: 'Stjärnstoft samlar du i varje omgång. Uppgraderingarna här gäller i alla kommande omgångar.',
    towers: 'Tornen',
    towersIntro: 'Uppgradera tornen med guld under omgången. På nivå 3 väljer du en av två grenar med nästa uppgradering, och tornet får ett namn.',
    waves: (n) => `${n} vågor`,
    survival: 'Survival',
    cleared: 'Klarad',
    best: (n) => `Bästa: ${n} ${n === 1 ? 'våg' : 'vågor'}`,
    play: 'Spela',
    locked: 'Låst',
    comingLater: 'Kommer senare',
    soon: [
      { name: 'Head-to-head', desc: 'Två vakter, en skärm. Skuggorna du fäller skickas över till motståndaren.' },
      { name: 'Bygg vägen själv', desc: 'Fri byggyta där tornen blir labyrinten och skuggorna tvingas ta omvägar.' },
    ],
    buyFor: (cost) => `Köp för ${cost} stoft`,
    maxed: 'Fullt uppgraderad',
    goldCost: (cost) => `${cost} guld`,
    unlockAtLevel: (level) => `Låses upp på vaktnivå ${level}`,
    branches: (a, b) => `Grenar: ${a} eller ${b}`,
  },

  hud: {
    lives: 'Liv',
    gold: 'Guld',
    wave: 'Våg',
    startWave: 'Starta våg',
    waveRunning: (left) => `Våg pågår (${left})`,
    auto: 'Auto',
    autoTitle: 'Starta nästa våg automatiskt',
    pause: 'Paus',
    resume: 'Fortsätt',
    soundOn: 'Ljud på',
    soundOff: 'Ljud av',
    giveUp: 'Ge upp',
    sure: 'Säker? Klicka igen',
    resetView: 'Återställ vy',
    keys: 'Tangenter: 1–4 väljer torn, mellanslag startar våg, Esc avbryter. Dra med höger musknapp för att vrida vyn och scrolla för att zooma.',
  },

  info: {
    level: (n) => `Nivå ${n}`,
    damage: 'Skada',
    range: 'Räckvidd',
    tiles: (n) => `${n} rutor`,
    rate: 'Takt',
    perSecond: (n) => `${n} per sekund`,
    slows: 'Saktar',
    record: (kills, dealt) => `${kills} fällda · ${dealt} skada`,
    chooseBranch: 'Nästa uppgradering: välj gren',
    upgrade: (cost) => `Uppgradera (${cost} guld)`,
    maxLevel: 'Max nivå',
    sell: (value) => `Sälj (+${value})`,
    buildHint: 'Klicka på gräset för att bygga. Uppgradera tornet med guld, och på nivå 3 väljer du gren med nästa uppgradering:',
    or: 'eller',
    idleTitle: 'Kvällens vakt',
    idleHint: 'Välj ett torn ovan och klicka på gräset för att bygga. Klicka på ett byggt torn för att uppgradera eller sälja det.',
    idleHint2: 'Guldet från fällda skuggor betalar uppgraderingarna. Välj själv: många torn eller några få starka.',
  },

  fx: {
    wave: (n) => `Våg ${n}`,
    giantWave: (n) => `Våg ${n}: en skuggjätte närmar sig`,
    waveCleared: (n, bonus) => `Våg ${n} klar  +${bonus} guld`,
    lifeLost: (n) => `−${n} liv`,
    level: (n) => `Nivå ${n}`,
  },

  end: {
    win: 'Gryningen kom',
    gaveUp: 'Vakten lämnade posten',
    lose: 'Hjärtat slocknade',
    survived: (n) => `Du höll ut i ${n} vågor.`,
    clearedOf: (cleared, total) => `${cleared} av ${total} vågor klarade.`,
    record: 'Nytt rekord!',
    dust: (n) => `+${n} stjärnstoft`,
    hero: (who, level, kills) => `Kvällens hjälte: ${who} på nivå ${level}, med ${kills} fällda skuggor.`,
    newLevel: (n) => `Vaktnivå ${n}!`,
    newTower: (name) => `Nytt torn: ${name}`,
    newMap: (name) => `Ny karta: ${name}`,
    again: 'Spela igen',
    menu: 'Till menyn',
  },

  maps: {
    mill: { name: 'Kvarnbacken', blurb: 'Lång slingrande väg förbi den gamla kvarnen. Bra första kväll.' },
    marsh: { name: 'Träskdiket', blurb: 'Kortare väg och segare skuggor. Låses upp när du klarat Kvarnbacken.' },
    ring: { name: 'Ringvallen', blurb: 'Survival. Spiralen leder in mot hjärtat och vågorna tar aldrig slut.' },
  },

  towers: {
    spark: { name: 'Gnista', desc: 'Snabba gnistor mot en fiende i taget.', branches: [
      { name: 'Tvillinggnista', desc: 'Skjuter mot två fiender samtidigt.' },
      { name: 'Prickskytt', desc: 'Mycket längre räckvidd och dubbel skada, men långsammare.' },
    ] },
    frost: { name: 'Rimfrost', desc: 'Kalla kulor som saktar ner fienden.', branches: [
      { name: 'Isfängsel', desc: '20 % chans att frysa fienden helt i 1,2 sekunder.' },
      { name: 'Dimbank', desc: 'Saktar ner alla fiender inom räckhåll på en gång.' },
    ] },
    pulse: { name: 'Glödpuls', desc: 'Värmevåg som träffar allt runt tornet.', branches: [
      { name: 'Värmebölja', desc: 'Fienderna fortsätter brinna i 3 sekunder.' },
      { name: 'Åskpuls', desc: 'Snabbare pulser med 25 % chans att bedöva.' },
    ] },
    star: { name: 'Stjärnfall', desc: 'Långsamt nedslag som skadar en hel klunga.', branches: [
      { name: 'Meteor', desc: 'Större och tyngre nedslag.' },
      { name: 'Splitter', desc: 'Nedslaget skickar fem splitter till fiender i närheten.' },
    ] },
  },

  upgrades: {
    gold: { name: 'Fickpengar', desc: '+30 startguld per nivå' },
    lives: { name: 'Tjockare murar', desc: '+3 liv per nivå' },
    dmg: { name: 'Slipade linser', desc: '+6 % skada för alla torn per nivå' },
    craft: { name: 'Skickliga hantverkare', desc: '−6 % kostnad för tornuppgraderingar per nivå' },
  },

  nicknames: ['Gamle Sven', 'Lilla My', 'Bertil', 'Fröken Frost', 'Kapten Glöd', 'Tant Gnistra', 'Morbror Bo', 'Stina',
    'Vaktis', 'Doris', 'Lyktan Lasse', 'Elsa', 'Gubben Grön', 'Majken', 'Knut'],
};
