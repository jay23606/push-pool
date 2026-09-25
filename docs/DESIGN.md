# P.U.S.H. Pool — design

Web-based multiplayer pool with points, powers, items, hazards, and bonuses as additional mechanics on top of standard pool. The goal is a more chaotic and unpredictable game with more strategy and depth than standard pool.

## Items and powers

Items for pickup, and gems (which represent point values), are collected when a player's cue ball passes over them. They can also be earned by completing actions (sinking two balls in one shot) or momentary challenges (contact 5 balls in one shot).

**Powers** are gained when a player sinks one of their own game balls, like leveling up: the player picks from several options. Powers are used during a turn by spending accrued points, which are subtracted from the total score. Powers can be leveled up for stronger and more expensive versions; the player chooses which level to use.

## Spawns

Between turns, hazards, bonuses and items can spawn randomly. Objects persist for a type-dependent number of turns (a bonus pocket may last one turn, a volcano 4).

Objects can also be generated mid-shot, e.g. a special ball turns into a barrier when hit by the cue ball, or a bonus object drops items when another ball hits it.

## Strategy

Points decide the winner, so spending them on powers is a strategic choice. Items can be used at will during a turn (including the turn they were acquired) but must be picked up first and are lost on use.

## Gameplay

- The break is entirely standard: no hazards or items on the table.
- Direct cue-ball-caused drops (e.g. colliding with one of their game balls) are collected by the player immediately.
- Powers and items can be used before or after the shot. Some are restricted: trail is pre-shot, rewind is post-shot. No limit on how many per turn, given points or the item.
- Some powers/items create **dummy balls**: normal-physics balls, flat grey, worth fewer points. The table can fill with them. For rules (own vs. opponent ball hits/sinks), dummy balls are benign; rules and penalties apply only to real game balls.
- Games run longer than standard pool, potentially indefinitely because sunken balls can return, but can still end abruptly on a mistake.
- **Alternate mode:** no solids/stripes. Each game ball is worth a set number of points, and turns are one shot even when sinking a ball. Allows any number of players and teams.
- Standard pool cue interaction for shots.
- **Toss mechanic:** drag for direction and force, always somewhat inaccurate. Tossed items clear objects during the initial arc, may bounce again depending on force, and always interact with objects on collision. A tossed item barely moves a ball unless it adds force (explosion).
- **Placing mechanic:** place instead of toss. Range limited around the cue ball or full table. The item visually rotates about Z (top-down) while positioning, to set orientation of directional objects.

## Items

| Item | Behaviour |
|---|---|
| Landmine | Place an explosive obstacle, medium range |
| Barrier (wall / cube / cylinder) | Place an immovable object, short range. Flat or rounded collisions |
| Block (cannon ball / pingpong ball / cylinder) | Place a movable object, short range. Cannon ball is large and heavy, pingpong small and light; the cylinder rolls and ideally spins when struck off-center |
| Hole | Place a shallow hole, medium range. Captures a slow ball, which can be knocked free with enough force; a fast ball skips over |
| Fan | Place a directional repelling force, medium range. One shot |
| Bomb | Toss; explodes when at rest |
| Mortar | Toss; explodes on first impact |
| Smokebomb | Toss; detonates at rest, obscures an area for 1-3 shots |
| Piggybank | Toss; spawns gems when collided with (including the toss). Limited gems dispensed in random amounts, then despawns |
| Mulligan (after shot) | Rewind your last shot. No change to consumed items or spent points. Open question: rewinding someone else's shot without complications |
| Pop powder | All collisions produce small explosions for the next shot |
| Rutabaga | Toss; collision physics becomes unstable (random slightly offset angles). Stays until pocketed |
| Cluster | Toss a cluster of pingpong balls; breaks into five when collided with, including the toss |
| Cannon (rare) | Fire a cannon ball with the standard shooting mechanic at max power. Goal: break with a cannon at some point |

## Powers

| Power | Behaviour (level scales the noted quantity) |
|---|---|
| Tilt | Briefly lift the table on any side, shifting all balls the opposite way slightly (severity) |
| Trail | Cue ball leaves a persistent effect-zone trail through the following shot (length). Ice (frictionless), Electric (add speed), Sand (reduce speed), Plasma (soft wall, expensive), Stone (true barrier, more expensive) |
| Guide | Shot guide (length). Cheap |
| Pop | Cue ball explodes on collisions (force) |
| Jump | Cue ball jumps over nearby objects (height). Cheap |
| Spin | Put spin on the shot (severity). Cheap |
| Stink | Cue ball slightly repels other balls, so a direct hit is needed (force) |
| Cute | Cue ball slightly attracts other balls (force) |
| Nudge | Small tap of the cue ball, like the lowest power shot, same aiming minus force level. Can swing a game, so not cheap |

## Hazards

| Hazard | Behaviour |
|---|---|
| Wormhole | Random entry and exit portals; balls and objects continue out the other side |
| Volcano | Erupts, moving balls/objects away and leaving a barrier, then spews dummy balls, fewer each turn. Expires after 3-5 turns |
| Black Hole | Gravity well pulls in nearby balls/objects and slingshots them; can capture them in the center. 3-5 turns |
| Slicks | Area effect, 1-3 turns. Ice, Electric, Sand, Plasma (soft wall, balls can get stuck) |
| Hurricane | Dummy balls rain across the table at random positions |
| Barf | A random pocket returns the last 1-5 balls/objects that went into it |

## Bonuses

| Bonus | Behaviour |
|---|---|
| Gem drop (common) | Gems of varying value rain onto random spots |
| Item drop (common) | A random item spawns at a random location; rarity-weighted |
| Bonus Hole | Appears on the table edge like a side pocket. Shows a random reward (gems or an item) above it, gained by sinking any ball or object in it, including the cue ball. Lasts the whole turn, reusable |
| P Switch | Small object at a random spot; when hit directly by the cue ball it turns all dummy balls into high-value gems, causes a collision, and disappears |

## Inherited from pool-masters (reuse map)

| Need | Existing code |
|---|---|
| Barriers, wormholes | `src/obstacles.js` (bumper, wall, portal via `railBounce`) |
| Bonus pocket, bomb, gravity well | `src/chaos.js` |
| No-solids scoring mode | scored games (`src/rules.js`) |
| Rewind groundwork | `src/replay.js` |
| Physics / 3D / multiplayer | `src/physics.js`, `src/pool.js`, `src/render3d.js`, Foyer + Supabase |

## Suggested first slice

Points economy and level-up power picker, plus 3-4 items (Landmine, Barrier, Bomb, Gem drop) and the dummy ball, on the existing scored-game mode. Then toss/placing input, then the spawn scheduler, then hazards, then Mulligan (needs full deterministic state snapshots).
