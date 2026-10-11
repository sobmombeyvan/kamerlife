# Landmarks & NPCs — Phase 1

**Status:** 3D exteriors + basic pedestrians.  
**Not implemented:** mall/supermarket interiors, checkout, TravelPoint booking UI, airport halls, taxi destination UI, NPC dialogue/schedules.

## What works (`/?mode=3d`)

| Landmark | Approx. position | What you see |
| --- | --- | --- |
| **Mfoundi Mall** | (−108, 180) | Multi-wing exterior, glass facade, parking, taxis, storefront modules, entrance marker |
| **Santa Lucia Grand Supermarket** | (36, 36) | Large store exterior, brand boards, cart corral, delivery dock, parking |
| **TravelPoint Cameroon** | (−36, −36) | Centre-ville storefront only |
| **Aéroport Nsimalen** | (216, 1080) | Terminal, tower, runway props, aircraft, taxi queue, drop-off — on grid road `x=216` |

- Procedural lots are cleared around landmark footprints.
- **Pedestrians** walk sidewalks near centre and loop around landmark plazas (LOD cull when far).
- HUD shows landmark name when you are nearby and states that interiors are not ready.

## Honest gaps

- Yellow entrance markers are **visual only** — no enter/teleport.
- Store names on the mall facade are labels, not enterable shops.
- Santa Lucia uses the real brand name with a **fictional game placement** (not a verified branch).
- Airport flights / check-in / customs are not simulated.
- NPCs do not talk, enter buildings, or follow day/night schedules yet.

## How to test

```bash
npm run dev
```

1. Open `http://localhost:5173/?mode=3d`
2. From spawn, walk **east** toward Santa Lucia (~36, 36) — green/white supermarket
3. Walk **northwest** to Mfoundi Mall (~−108, 180) — large glass complex + parking
4. Walk to TravelPoint (~−36, −36)
5. Follow road **x ≈ 216 south** to Nsimalen (~z 1080) — long walk; sprint with Shift
6. Confirm pedestrians on sidewalks and near landmarks
7. Confirm tip text says exteriors only (no false “shop open” claims)

Map editor (`/`) still has landmark pins + business data for these sites.

## Next (Phase 2 of this brief)

- Mfoundi Mall interior modules + Santa Lucia aisles/checkout
- TravelPoint booking save data
- NPC greet prompts
