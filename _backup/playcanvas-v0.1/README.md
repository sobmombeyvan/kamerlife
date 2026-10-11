# LIFE CITY: YAOUNDÉ

Prototype Phase 1 — jeu web 3D de simulation de vie urbaine inspiré de Yaoundé (PlayCanvas + TypeScript + Vite).

## Lancer

```bash
npm install
npm run dev
```

Ouvrir l’URL affichée (souvent `http://localhost:5173`).

## Contrôles

| Action | Clavier | Mobile |
| --- | --- | --- |
| Marcher | ZQSD / WASD | Joystick gauche |
| Caméra | Souris (clic pour verrouiller) | Zone droite |
| Courir | Shift | Bouton Courir |
| Sauter | Espace | Bouton Sauter |
| Interagir | E | Bouton E |
| Menu | Échap | — |

## Phase 1 livrée

- Scène 3D PlayCanvas (WebGPU avec repli WebGL2)
- Personnage humain GLB animé (`Soldier.glb` Mixamo via Three.js examples)
- Caméra 3e personne avec anti-pénétration des bâtiments
- Marche, course, saut, collisions AABB
- Zone test type carrefour (route, marquages, trottoirs, bâtiments, végétation)
- HUD + contrôles tactiles
- Solde affiché en FCFA (économie complète = phases suivantes)

## Remplacer le personnage

Voir `public/assets/licenses/ATTRIBUTION.md`. Placer un GLB compatible à `public/assets/characters/player.glb`.
