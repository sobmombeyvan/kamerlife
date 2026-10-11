# Phase 1 — 2D map, districts, business data

**Status:** implemented (map + data layer).  
**Not implemented yet:** shop interiors, payments, NPCs, Rapier, playable economy, map-driven 3D city.

## What works

1. **2D map editor** (default URL `/`)
   - Pan, zoom, select, add nodes, connect roads, delete
   - Road classes: highway / primary / secondary / local / path / rail
   - Undo (Ctrl+Z), local save (Ctrl+S), import/export JSON
   - Connectivity validation

2. **20 playable districts** (game-world layout, not GPS-accurate)
   Centre-ville, Bastos, Mokolo, Mendong, Biyem-Assi, Mvan, Essos, Nlongkak, Ngousso, Etoudi, Ngoa-Ekellé, Mvog-Ada, Melen, Simbock, Odza, Ekounou, Nsam, Emana, Nkolbisson, Awaé

3. **Business database (data only)**
   - Schema: `src/business/types.ts`
   - Seed: `src/business/seedBusinesses.ts` (~80 named businesses)
   - Static export: `public/data/businesses.json`
   - Each entry: id, name, category, districtId, world x/z, hours, products (FCFA), interaction hint, fictional/landmark flags
   - Editor: place (+ Commerce), select, drag, rename, change category, delete, export `businesses.json`

4. **Layers**
   Reference image, districts, roads, parks, rivers, buildings stubs, landmarks, **commerces**, debug network

## How to test

```bash
npm install
npm run dev
```

1. Open `http://localhost:5173/`
2. Confirm HUD shows **20 quartiers** and many **commerces**
3. Toggle calque **Commerces** — colored squares with names
4. Tool **Select** → click a commerce → inspector shows name, district, prices FCFA
5. Tool **+ Commerce** → click map → new business appears (district auto-assigned)
6. Drag a commerce → position and district update
7. **Exporter businesses.json** → download; compare with `public/data/businesses.json`
8. **Valider réseau** → expect connected graph
9. **Reset seed** if localStorage has an old map without businesses

Optional: `/?mode=3d` opens the older procedural 3D playground (**not** driven by this map JSON yet).

## Honest gaps (later phases)

| Claim | Reality in Phase 1 |
| --- | --- |
| Enter shops / interiors | Not built — interaction is data field only |
| Buy / pay / inventory | Catalog prices exist; no purchase loop |
| 3D district from map | Map JSON ready; 3D generator not wired |
| Physics (Rapier) | Not integrated |
| Multiplayer / Supabase | Out of scope until single-player systems exist |

## Files

| Path | Role |
| --- | --- |
| `src/map/*` | Editor, renderer, seed map, I/O |
| `src/business/*` | Business schema + seed |
| `public/data/businesses.json` | Static business DB snapshot |
| `public/maps/reference-map.png` | Visual inspiration overlay |
| `docs/MAP_FORMAT.md` | MapDocument schema notes |
