# Maintenance — LIFE CITY: YAOUNDÉ

## Current focus

**2D map + road editor** is the foundation. The procedural 3D megacity remains available as `?mode=3d` but is **not** yet driven by the vector map.

## Commands

```bash
npm install
npm run dev      # default = map editor
npm run build
npm run preview
```

- Map editor: `http://localhost:5173/`
- 3D playground: `http://localhost:5173/?mode=3d`

## Map modules

```
src/map/
  types.ts           # schema
  seedYaoundeMap.ts  # inspired layout from docs/reference-map.png
  MapGraph.ts        # connectivity
  MapCamera2D.ts
  MapRenderer2D.ts
  MapEditor.ts       # tools
  MapEditorApp.ts    # UI shell
  MapIO.ts           # JSON import/export/localStorage
```

See `docs/MAP_FORMAT.md`.

## How to add a district (2D)

1. Edit `createDistricts()` in `src/map/seedYaoundeMap.ts` **or**
2. Export JSON, edit `districts[]`, re-import in the editor

## How to add a road

1. In the editor: **+ Nœud** → place points → **Connecter** → set road class
2. Or edit `edges` / `nodes` in exported JSON

## Reference image

- `docs/reference-map.png`
- Served as `/maps/reference-map.png`

Treat as **inspiration only**, not GPS truth.

## Backup

Previous PlayCanvas prototype: `_backup/playcanvas-v0.1/`
