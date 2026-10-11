/** Scalable city map schema (meters). Origin = Centre-ville. +X east, +Z south (game-friendly). */

import type { Business } from '../business/types';

export type RoadClass = 'highway' | 'primary' | 'secondary' | 'local' | 'path' | 'rail';

export type MapNodeKind = 'junction' | 'roundabout' | 'deadend' | 'waypoint';

export type MapNode = {
  id: string;
  x: number;
  z: number;
  kind: MapNodeKind;
  name?: string;
};

export type MapEdge = {
  id: string;
  from: string;
  to: string;
  roadClass: RoadClass;
  /** Lane width hint in meters. */
  width: number;
  name?: string;
  oneway?: boolean;
};

export type DistrictPoly = {
  id: string;
  name: string;
  /** Ring polygon in meters (closed implicitly). */
  polygon: Array<{ x: number; z: number }>;
  color: string;
  zone: 'center' | 'residential' | 'commercial' | 'campus' | 'government' | 'mixed' | 'periurban';
};

export type LandmarkDef = {
  id: string;
  name: string;
  x: number;
  z: number;
  category: string;
  districtId?: string;
};

export type ParkDef = {
  id: string;
  name: string;
  polygon: Array<{ x: number; z: number }>;
};

export type RiverDef = {
  id: string;
  name: string;
  /** Polyline centerline. */
  path: Array<{ x: number; z: number }>;
  width: number;
};

export type BuildingStub = {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  districtId?: string;
};

export type MapLayers = {
  roads: boolean;
  districts: boolean;
  buildings: boolean;
  parks: boolean;
  rivers: boolean;
  landmarks: boolean;
  businesses: boolean;
  reference: boolean;
  debug: boolean;
};

export type MapDocument = {
  version: 1;
  name: string;
  units: 'meters';
  /** Inspiration only — not geodetic truth. */
  reference: {
    imageUrl: string;
    /** World meters covered by full reference image width/height. */
    worldWidth: number;
    worldHeight: number;
    opacity: number;
    note: string;
  };
  nodes: MapNode[];
  edges: MapEdge[];
  districts: DistrictPoly[];
  landmarks: LandmarkDef[];
  parks: ParkDef[];
  rivers: RiverDef[];
  buildings: BuildingStub[];
  /** Named shops / services (Phase 1 data — not playable interiors yet). */
  businesses: Business[];
  meta: {
    createdAt: string;
    updatedAt: string;
    source: string;
  };
};

export const DEFAULT_LAYERS: MapLayers = {
  roads: true,
  districts: true,
  buildings: false,
  parks: true,
  rivers: true,
  landmarks: true,
  businesses: true,
  reference: true,
  debug: true,
};

export const ROAD_WIDTH: Record<RoadClass, number> = {
  highway: 18,
  primary: 14,
  secondary: 10,
  local: 7,
  path: 3,
  rail: 4,
};

export const ROAD_COLORS: Record<RoadClass, string> = {
  highway: '#e53935',
  primary: '#fb8c00',
  secondary: '#fdd835',
  local: '#eceff1',
  path: '#a1887f',
  rail: '#212121',
};
