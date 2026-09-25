# P.U.S.H. Pool

Web-based multiplayer pool with points, powers, items, hazards and bonuses layered on standard pool.
Forked from [pool-masters](https://github.com/jay23606/pool-masters) (physics, three.js rendering, Foyer/Supabase multiplayer,
host-authoritative simulation). The original README is kept at `docs/pool-masters-README.md`.

The full design is in [`docs/DESIGN.md`](docs/DESIGN.md).

## Status

Fresh fork. Still pool-masters underneath; nothing P.U.S.H.-specific is built yet.

## Known carry-overs to fix

- `src/main.js` still points at the pool-masters Supabase project. Create a separate project before shipping.
- localStorage keys are still `pool-masters*`; GitHub Pages shares one origin per user, so rename them to avoid colliding with pool-masters.
- Elo/league, career, rogue, daily shot and the practice-drill code are inherited and likely to be removed.
