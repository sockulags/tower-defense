# Balance notes

Final pass after the four build waves. Numbers from `npm run balance` (10 runs per row, staff
Warden, greedy boon picks, the starting four towers unless a squad is named).

| Map | Mixed: win, lives lost | Spread | Warden first | Best single tower | Warden's share of damage (mixed) | Best squad (mixed) |
|---|---|---|---|---|---|---|
| Mill Hill (Thief) | 100%, 0.8 | 100%, 0.4 | 100%, 4.8 | Spark 10% | 17% | starting four |
| Marsh Ditch (Stomper) | 100%, 1.8 | 70%, 14.8 | 60%, 17.3 | all 0% | 10% | starting four |
| Willow Ford (Thief) | 100%, 3.5 | 90%, 11.5 | 100%, 9.6 | all 0% | 14% | no Spark, with Skyhook (2.0) |
| Bramble Wood (Stomper) | 100%, 6.6 | 100%, 12.0 | 100%, 9.6 | all 0% | 8% | no Spark, with Skyhook (2.2) |
| The Forked Road (Mender) | 100%, 5.4 | 80%, 15.0 | 60%, 20.1 | all 0% | 8% | starting four |
| Ring Rampart (survival, stops at 40) | wave 40, 4.0 | wave 40, 9.0 | wave 40, 15.7 | Spark reaches 39.4 | 1% | starting four |

Story maps get harder in order for the mixed bot, except that The Forked Road loses slightly fewer
lives than Bramble Wood; it is the hardest map for every other strategy (Spread 80%, Warden first 60%).
Most of Bramble Wood's lost lives come from leaked Stompers (6 lives each), which knock out the
bunched towers the woods force.

## Changes in this pass

- Skyhook: cost 90 to 95, damage 22 to 16, range 3.2 to 3.0, bonus against flyers +100% to +150%
  (Kite Flock +200%). Before, a squad without Spark was best on every map but Marsh and Fork; now
  the best squad depends on how many flyers a map sends.
- Map toughness (`hard`): Marsh Ditch 1.2 to 1.25, Willow Ford 1.3 to 1.34. Stomper health 1150 to 1100.
- Boons: Creeping Frost also shoots 15% faster, Kindling burns harder (0.35 to 0.5), Pitch and Tar
  leaves a bigger burn (0.12 to 0.2). Pick rates now run 13% (Pitch and Tar) to 53% (Village Tithe);
  even is about 33%.

## Known gaps

- Health is very sensitive: a 6% change in a map's `hard` can move the mixed bot from 3 to 10 lives lost.
- Ring Rampart's Warden numbers say little: the bot places the Warden where nothing reaches it.
- Pick rates rank boons by the greedy bot's own estimate, so they are only a proxy for strength.
