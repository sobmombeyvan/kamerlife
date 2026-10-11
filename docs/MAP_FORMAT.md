# City map format (2D → 3D)

Reference inspiration: [`reference-map.png`](./reference-map.png)

## Coordinate system

- Units: **meters**
- Origin `(0,0)`: Centre-ville
- `+X`: east
- `+Z`: south (matches Three.js ground plane XZ)

## Document shape (`MapDocument`)

Layers:

| Field | Role |
| --- | --- |
| `nodes` / `edges` | Editable road graph |
| `districts` | Polygon boundaries + zone type |
| `landmarks` | POI points |
| `parks` | Green polygons |
| `rivers` | Polylines + width |
| `buildings` | Lightweight stubs for later 3D |
| `businesses` | Named shops/services (`Business` schema) — Phase 1 data only |
| `reference` | Overlay image + world size |

Road classes: `highway` | `primary` | `secondary` | `local` | `path` | `rail`

Businesses: see `src/business/types.ts`. Export via editor → `businesses.json`, or use `public/data/businesses.json`.

## Editor

```bash
npm run dev
```

Open `http://localhost:5173/` (map mode by default).

- **Exporter JSON** → reusable by the future Three.js city builder
- **Valider réseau** → connected-component check
- Debug layer: nodes, intersections, district outlines
- `?mode=3d` → previous 3D playground (not driven by this map yet)

## Next phase

A Three.js `RoadMeshBuilder` / `DistrictLoader` will consume the exported JSON to extrude roads and place districts. Do not hardcode city layout in 3D systems once this map is stable.
