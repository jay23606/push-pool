# P.U.S.H. Pool

Web-based multiplayer pool with points, powers, items, hazards and bonuses layered on standard pool.
Forked from [pool-masters](https://github.com/jay23606/pool-masters) (physics, three.js rendering, Foyer/Supabase multiplayer,
host-authoritative simulation). The original README is kept at `docs/pool-masters-README.md`.

The full design is in [`docs/DESIGN.md`](docs/DESIGN.md).

## Status

A playable slice in the lobby as **P.U.S.H. Pool** (practice vs the AI, hot-seat, or online). Built so far:

- **Points** are the score (10 per real ball, 1 per dummy, foul -5, first to 100) and also what powers cost.
- **Level-ups:** sinking a real ball offers three powers; a pick you have not taken waits for your next turn.
- **Powers:** Jump, and Pop / Stink / Cute (armed from the panel at a level you choose, paid for on the shot).
- **Pickups:** gems (points) and items drop between turns and are collected by the cue ball.
- **Items:** Wall, Cube, Pillar, Landmine (placing mechanic: range ring, ghost, Q/E or wheel to turn) and Bomb, Mortar, Smoke bomb (toss mechanic: drag out and let go, it always strays a little).
- **Dummy balls** are in the rules and on the wire (grey, ignored by fouls) but nothing spawns them yet.

Not built yet: the other powers, items and hazards in `docs/DESIGN.md`, Mulligan/rewind, and the no-solids/stripes multi-player mode.

## Sharing pool-masters' Supabase project

Both games use the same Supabase project (and the same `jay23606.github.io` origin), so they are kept apart like this:

- **Tables:** ours are `pp_profiles`, `pp_matches`, `pp_result_reports` (pool-masters uses `pm_`). See `supabase/migrations/20260925120000_pp_tables.sql`.
- **Rooms:** Foyer's `foyer_rooms` is shared. Our rooms carry `metadata.game = 'push'` and the lobby only lists those, so the two games never see each other's tables.
- **Room resume:** `20260925120100_keep_push_rooms_open.sql` widens the shared `foyer_close_empty_room` / `foyer_reap_rooms` functions to `('pool','push')`. Apply it before relying on rooms surviving a host leaving; until then a push room closes when empty.
- **localStorage:** keys are `push-pool:*` (pool-masters uses `pool-masters:*`).

**The two migrations have not been applied to Supabase yet.** Without `pp_tables`, profile/league calls fail.

## Still to do

- Elo/league, career, rogue, daily shot and the practice-drill code are inherited and likely to be removed.
- Copy still says "Pool Masters" in places (e.g. the daily-shot share text).
