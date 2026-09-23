import { zones } from "./geography";
export type Camera = { x: number; y: number; width: number };
export const CITY_CAMERA: Camera = { x: -25, y: 0, width: 1250 };
/** Ray casting also handles drops on decorative buildings above district polygons. */
export function districtAtPoint(x: number, y: number): string | null {
  for (const zone of zones) {
    const points = zone.polygon.split(" ").map(point => point.split(",").map(Number));
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return zone.id;
  }
  return null;
}
export function districtCamera(id: string): Camera {
  const zone = zones.find(z => z.id === id);
  if (!zone) return CITY_CAMERA;
  const points = zone.polygon.split(" ").map(point => point.split(",").map(Number));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = Math.max(maxX - minX + 60, (maxY - minY + 60) / 0.68);
  return { x: (minX + maxX - width) / 2, y: (minY + maxY - width * 0.68) / 2, width };
}
