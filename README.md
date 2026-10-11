# LIFE CITY: YAOUNDÉ

Open-world life-sim inspired by Yaoundé (Vite + TypeScript + Three.js).

**Current milestones**

1. **Map Phase 1** — 2D editor, 20 districts, business data ([`docs/PHASE1.md`](docs/PHASE1.md))
2. **Landmarks Phase 1** — Mfoundi Mall / Santa Lucia / Nsimalen exteriors + basic pedestrians ([`docs/LANDMARKS_PHASE1.md`](docs/LANDMARKS_PHASE1.md))

Shop interiors, payments, booking UI, and map-driven 3D regeneration are **not** implemented yet.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173/` → **2D map / road / business editor**.

| Mode | URL |
| --- | --- |
| Map editor (default) | `/` |
| 3D city + landmarks | `/?mode=3d` |

## Phase 1 features

- Connected road graph + district polygons (game-world layout)
- All 20 playable districts from the brief
- Business layer: place, select, drag, edit name/category, export `businesses.json`
- Prices in **FCFA** (catalog data only — no checkout)
- Layers: roads, districts, parks, rivers, landmarks, buildings, commerces, reference overlay
- Validate connectivity · Undo · Export / import map JSON · localStorage save

## Docs

- [`docs/PHASE1.md`](docs/PHASE1.md) — what works, how to test, honest gaps
- [`docs/MAP_FORMAT.md`](docs/MAP_FORMAT.md) — `MapDocument` schema
- `docs/reference-map.png` — visual inspiration (not GPS truth)
- `public/data/businesses.json` — seed business snapshot

## Stack

Vite · TypeScript · Three.js (3D later consumes map JSON).
