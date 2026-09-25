# P.U.S.H. Pool

Web-based multiplayer pool with points, powers, items, hazards and bonuses layered on standard pool.
Forked from [pool-masters](https://github.com/jay23606/pool-masters) (physics, three.js rendering, Foyer/Supabase multiplayer,
host-authoritative simulation). The original README is kept at `docs/pool-masters-README.md`, and the full design is in
[`docs/DESIGN.md`](docs/DESIGN.md).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # node --test
npm run lint
```

## Two modes (lobby → game picker)

- **P.U.S.H. Pool** – any ball may be hit, a real ball is worth 10, a dummy 1, a foul costs 5, first to 250. Sinking a real ball
  keeps your turn. Games run long: the table is re-racked when one ball is left.
- **P.U.S.H. 8-ball** – standard 8-ball rules (groups, called 8, fouls) with the same points on top: your own group's balls are 10
  and a level-up, an opponent's ball you sink gifts 5 to its owner. The 8, or reaching 250, ends the game.

Points are the score **and** what powers cost.

## What is built

| | |
|---|---|
| **Level-ups** | Sinking a real ball offers three powers; a pick you have not taken waits for your next turn. |
| **Powers** | All nine: Guide (more bounces on the aiming line), Spin (stronger spin), Jump, Pop, Stink, Cute, Nudge (a tap that is not a shot), Tilt (roll every ball a chosen way), Trail (ice / electric / sand / plasma / stone). Armed from the panel at a level you choose, paid for on the shot. |
| **Pickups** | Gems (points) and items drop between turns; the cue ball collects them. Feats (a double, a triple, five balls touched) pay bonuses. |
| **Placing** | Wall, Cube, Pillar, Landmine, Fan, Hole, Ping-pong ball (light), Cannon ball (heavy): range ring, ghost, Q/E or wheel to turn, click to place. |
| **Tossing** | Bomb, Mortar, Smoke bomb, Cluster, Piggy bank, Rutabaga: drag out from the cue ball and let go; it always strays a little. |
| **Other items** | Pop powder, Mulligan (rewinds the last shot, for either player), Cannon (the cue ball goes out heavy, at the hardest shot there is). A house rule gives everyone a cannon at the start of each rack, to break with. |
| **Hazards** | Wormhole, Slicks (ice / electric / sand / plasma), Black hole, Hurricane, Volcano, Barf. |
| **Bonuses** | Gem drop, item drop, Bonus hole (an extra pocket with a shown reward), P switch (dummies become gems). |
| **Dummy balls** | Grey, normal physics, invisible to the rules. Rutabagas are dummies that make collisions unstable. |
| **AI** | The practice opponent throws bombs at clusters, lights powder, and arms pop or cute. |

Not built yet: the Roller (a movable cylinder; it is in the catalogue but never dropped) and the no-solids multi-player / team mode
(more than two players, one shot per turn).

## How it fits together

- `src/push/*.js` – the game as pure functions (catalogues, economy, spawns, hazards, placing, toss, AI planning, wire validation),
  covered by `test/push.test.js`. `src/pool.js` applies them to a running table (`test/push-game.test.js`).
- Everything hazard-like is an obstacle-style record with a `ttl` in `game.push.obstacles`, so it travels in the snapshot and ages
  with the turns. The host judges everything; a guest sends `pick`, `place`, `toss`, `use` or a `shot` carrying its armed powers.
- In dev, `window.__game` is the running game, handy for giving yourself items from the console.

## Sharing pool-masters' Supabase project

Both games use the same Supabase project (and the same `jay23606.github.io` origin), so they are kept apart like this:

- **Tables:** ours are `pp_profiles`, `pp_matches`, `pp_result_reports` (pool-masters uses `pm_`). See `supabase/migrations/`.
- **Rooms:** Foyer's `foyer_rooms` is shared. Our rooms carry `metadata.game = 'push'` and the lobby only lists those.
- **Room resume:** `20260925120100_keep_push_rooms_open.sql` widens the shared `foyer_close_empty_room` / `foyer_reap_rooms`
  functions to `('pool','push')`. Both migrations are applied.
- **localStorage:** keys are `push-pool:*`.

## Still inherited from pool-masters

Elo/league, career, rogue, daily shot, drills, radio and the trophy system are still in the code and reachable from the lobby.
They work but are not part of the P.U.S.H. design and are likely to be removed.
