export const GameConfig = {
  title: 'LIFE CITY',
  subtitle: 'YAOUNDÉ · VIE EN LIBERTÉ',
  version: '0.2.0',

  playerModelUrl: '/assets/characters/player.glb',

  walkSpeed: 4.5,
  runSpeed: 8.1,
  jumpSpeed: 7.1,
  gravity: 17,
  playerRadius: 0.4,
  playerHeight: 1.85,

  cameraDistance: 7.3,
  cameraHeight: 1.45,
  cameraMinPitch: -0.05,
  cameraMaxPitch: 0.65,
  cameraSensitivity: 0.0026,
  cameraTouchSensitivity: 0.005,
  cameraCollisionPadding: 0.35,
  cameraLerp: 12,

  clearColor: { r: 0.608, g: 0.796, b: 0.863 },
  fogColor: { r: 0.608, g: 0.796, b: 0.863 },
  sunColor: { r: 1, g: 0.88, b: 0.67 },
  ambientColor: { r: 0.55, g: 0.62, b: 0.58 },

  startingBalanceFcfa: 12_500,
  saveKeyMoney: 'lifecity-money',
  saveKeyFurniture: 'lifecity-home-furniture',
  saveKeyPending: 'lifecity-pending-furniture',
} as const;

export const FurnitureCatalog = {
  canape: { name: 'Canapé', price: 2500 },
  lit: { name: 'Lit', price: 3000 },
  tv: { name: 'Télévision', price: 2200 },
  table: { name: 'Table', price: 1000 },
  plante: { name: 'Plante décorative', price: 500 },
  chaise: { name: 'Chaise', price: 700 },
} as const;

export type FurnitureType = keyof typeof FurnitureCatalog;
