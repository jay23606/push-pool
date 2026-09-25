# P.U.S.H. Pool

Web-based multiplayer pool with points, powers, items, hazards and bonuses layered on standard pool.
Forked from [pool-masters](https://github.com/jay23606/pool-masters) (physics, three.js rendering, Foyer/Supabase multiplayer,
host-authoritative simulation). The original README is kept at `docs/pool-masters-README.md`.

The full design is in [`docs/DESIGN.md`](docs/DESIGN.md).

## Status

Fresh fork. Still pool-masters underneath; nothing P.U.S.H.-specific is built yet.

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
