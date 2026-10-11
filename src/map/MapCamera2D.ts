export class MapCamera2D {
  x = 0;
  z = 0;
  /** World meters per screen pixel (higher = zoomed out). */
  scale = 12;
  minScale = 2;
  maxScale = 40;

  screenToWorld(sx: number, sy: number, canvasW: number, canvasH: number): { x: number; z: number } {
    return {
      x: this.x + (sx - canvasW / 2) * this.scale,
      z: this.z + (sy - canvasH / 2) * this.scale,
    };
  }

  worldToScreen(wx: number, wz: number, canvasW: number, canvasH: number): { x: number; y: number } {
    return {
      x: canvasW / 2 + (wx - this.x) / this.scale,
      y: canvasH / 2 + (wz - this.z) / this.scale,
    };
  }

  zoomAt(sx: number, sy: number, canvasW: number, canvasH: number, factor: number): void {
    const before = this.screenToWorld(sx, sy, canvasW, canvasH);
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    const after = this.screenToWorld(sx, sy, canvasW, canvasH);
    this.x += before.x - after.x;
    this.z += before.z - after.z;
  }

  panScreen(dx: number, dy: number): void {
    this.x -= dx * this.scale;
    this.z -= dy * this.scale;
  }
}
