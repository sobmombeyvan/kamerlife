import type { CollisionSystem } from '../world/CollisionSystem';
import type { CityPlan } from './CityPlan';

/**
 * While the city is generated, hand-placed buildings (landmark anchors, hubs, POIs) are
 * routed into the chunked kit renderer instead of becoming individual meshes.
 */
let sink: { plan: CityPlan; collisions: CollisionSystem } | null = null;

export function setKitSink(s: { plan: CityPlan; collisions: CollisionSystem } | null): void {
  sink = s;
}

export function kitSink(): { plan: CityPlan; collisions: CollisionSystem } | null {
  return sink;
}
