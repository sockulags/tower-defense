# Gameplay plan: from a working game to a deep one

Status: approved by the user, not built yet. The start of the game (title, storybook,
survival, Lodge, settings, profiles, hover upgrade and upgrade preview) is planned separately in
`front-door.md`; this plan covers what happens on the board.

## What the user asked for

Wanted: a balance tool, game feel, enemies that demand the right tower with a preview of the next
wave, combos between towers, a pick of boons between waves, bosses with their own mechanics, terrain
that matters, a rift that moves on advanced maps, and the storybook campaign. Economy buildings only
if they play well. Also wanted: towers with attributes (strong against certain shadows, able to hit
flyers) so more shadow types can be added over time, and a squad of four towers the player picks
from a small, slowly growing set. Not wanted: dusk or anything built on darkness, weather, active abilities per
tower, veteran badges, a bestiary. Saved for later: a daily challenge.

## The problem this plan solves

Today almost any towers in almost any place win. Every phase below adds a reason to choose: which
tower, where, when to upgrade, what to save for. The balance tool comes first so every later phase
can be tuned with numbers instead of feel.

## Phases

### 1. Balance tool (lab)

- A **Balance** tab in the lab runs whole games headless (no drawing) with simple bot players, many
  runs in a few seconds.
- Bots: one per strategy, for example "spread every tower", "only Spark", "rush Starfall", "Warden
  first", so a dominant strategy shows up as a number.
- Shows per map: win rate, waves cleared, lives lost, and the share of damage and kills per tower
  type and for the Warden. Gold over time as a small line.
- Done when: the current game's numbers are visible and the Warden's oversized share is tuned down.

### 2. Game feel

- Each tower sounds like itself: a crackle for Spark, a glassy chime for Rime, a whoomp for Ember,
  a whistle and thud for Starfall. The Warden's three weapons too.
- Hits land: a short squash on the enemy, a tiny pause on heavy impacts (Starfall, boss kills), and
  a bigger burst when a giant falls. No screen shake and no bright flashes, which the user rejected.
- The Warden's shots leave from the weapon, as the towers' do now.
- Done when: a wave can be followed with eyes closed by sound alone, roughly.

### 3. Enemies that demand the right tower, and the next-wave preview

This phase builds the matching system that later towers and shadows plug into, not one-off rules.

- **Shadow traits** are data on each shadow type: `flying`, `armoured`, `mends`, `splits`,
  `sprints`, and new ones later. A shadow can have more than one.
- **Tower attributes** are data on each tower type (and branch): whether it can hit flyers
  (`air`), whether it can hit ground shadows (`ground`), and damage bonuses against traits, for
  example Starfall +50 % against `armoured`. Armour itself blocks a flat amount per hit, so towers
  with big hits answer it naturally.
- Targeting reads these attributes: a tower never aims at what it cannot hit, and its card and belt
  tooltip list what it is strong against and whether it hits flyers, as small icons.
- Adding a tower or a shadow later means adding a data entry and a model, not new rules.

Each shadow gets one trait that one or two towers answer well. Existing shadows take the traits
first, so the cast stays small and readable:

| Shadow | Trait | Answered by |
|---|---|---|
| Crawler | none, the baseline | anything |
| Flitter | **flies**: Ember's ground pulse and Starfall's impacts miss it | Spark, Rime, the Warden |
| Lump | **armoured**: small hits are mostly blocked | Ember, Starfall (big hits) |
| Shimmer | **mends**: regenerates fast unless burning or frozen | Ember burn, Ice Prison |
| New: Splitter | **splits** into three small ones when it dies | Ember, Starfall splash |
| New: Dasher | **sprints** in bursts | Rime, Fog Bank |

- **Next-wave preview** at the wave horn: small portraits of the coming shadows with counts, and
  the trait shown as a tiny icon. The player can plan before calling the wave.
- Wave lists are rewritten so each map mixes traits on purpose.
- Done when: bot runs with a single tower type lose, and mixed builds win.

### 4. Combos between towers

Three combos to start, each shown with a short word over the enemy when it happens:

- **Shatter:** a frozen or chilled shadow hit by Starfall takes double damage.
- **Steam:** fire on a chilled shadow bursts and damages the shadows around it.
- **Conduct:** a stunned shadow takes extra damage from Spark.

- Done when: the balance tool shows mixed builds near each other scoring better than spread-out
  single types.

### 5. Boons between waves

- Every fifth wave, the run pauses on a choice of one of three boons, shown as cards.
- Examples: "Rime towers reach one tile further", "Upgrades cost 15 % less this run", "The Warden's
  ability recharges twice as fast", "Ember burns last twice as long".
- Boons push a run in a direction, so two runs on the same map play differently.
- Done when: about 20 boons exist and none is picked by the bots far more often than the others.

### 6. Bosses with their own mechanics

Replacing today's giant on boss waves, one boss per story chapter:

- **The Stomper:** every few steps it stomps, knocking towers near the road out for a few seconds.
- **The Thief:** grabs gold from the player's purse and runs back toward the rift; kill it to get the
  gold back.
- **The Mender:** heals every shadow around it, so it must be focused down first.
- A boss gets a name banner and a health bar while it is on the board.
- Done when: each boss is a puzzle the bots lose to unless they adapt.

### 7. A fifth tower and the squad

- A fifth tower type, designed to answer what the first four do poorly, for example a tower that
  specialises in flyers. Its exact design is decided when we get here.
- **The squad:** a run always has four tower types on the belt. Once the fifth tower is unlocked,
  the squad unlocks too, and the player picks which four to bring. The set of tower types stays
  small; this is about choosing, not collecting.
- The squad is chosen in the Lodge, and changed quickly on a storybook page before Begin (see
  `front-door.md`). Story pages show which shadows the map sends, so a squad can be adapted to it.
- Later story maps are designed so that one fixed squad cannot clear them all, for example a map
  heavy with flyers.
- Done when: the balance tool shows that the best squad differs between maps.

### 8. Terrain that matters

New story maps whose ground changes how towers work, which suits free placement:

- **Hills:** towers on a hill reach further.
- **Woods:** trees block straight shots; Starfall arcs over them.
- **Water:** shadows wading through it slow down, and Thunder Pulse hits harder on it.
- Terrain shows clearly in the art, and the placement ghost shows the bonus before building.
- Each new map becomes a new storybook page with its one line of story.

### 9. A rift that moves (advanced maps)

- Later story maps have two or three rifts. Each wave comes from one of them, and the next-wave
  preview shows which, so the player can prepare.
- Done when: one late map uses it and the bots need towers covering both roads.

### 10. Economy buildings (experiment)

- A mill that costs gold and pays a little gold after every wave. A choice between defence now and
  more towers later.
- Built behind a lab switch first. It stays only if the balance tool shows it adds real choices
  without an always-right answer.

## Recommended order

1. The front door (`front-door.md`) first. It is decided and includes the hover upgrade and upgrade
   preview, and everything below will land in the storybook it creates.
   Then the release (`release.md`): GitHub Pages, the installable app, touch controls and feedback,
   so friends and family test every phase below as it lands.
2. Balance tool.
3. Game feel.
4. Enemies with traits and the next-wave preview.
5. Combos.
6. Boons.
7. Bosses.
8. The fifth tower and the squad.
9. Terrain, with new story pages.
10. The moving rift.
11. Economy buildings, as an experiment.

Later, outside this plan: the build-your-own-road mode, head-to-head (local, then AI, then online)
and the daily challenge.

## How each phase is checked

Bot runs in the balance tool before and after, screenshots in the lab gallery and the sandbox,
`npm run typecheck` and `npm run build`, then a publish. Each phase is its own commit.
