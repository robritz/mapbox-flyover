export type LngLat = [number, number];

const EARTH_RADIUS_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Central angle between two points, in radians (haversine). */
function centralAngle([lon1, lat1]: LngLat, [lon2, lat2]: LngLat): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceKm(a: LngLat, b: LngLat): number {
  return centralAngle(a, b) * EARTH_RADIUS_KM;
}

/**
 * Points along the great circle from `a` to `b` — the shortest path over the
 * globe, i.e. how a plane flies. Longitudes are "unwrapped" so the line stays
 * continuous across the antimeridian instead of jumping from +180 to -180.
 */
export function greatCircle(a: LngLat, b: LngLat, steps = 256): LngLat[] {
  const d = centralAngle(a, b);
  if (d < 1e-9) return [a, b];

  const [lon1, lat1] = [toRad(a[0]), toRad(a[1])];
  const [lon2, lat2] = [toRad(b[0]), toRad(b[1])];
  const points: LngLat[] = [];

  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    let lon = toDeg(Math.atan2(y, x));
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));

    if (points.length) {
      const prev = points[points.length - 1][0];
      while (lon - prev > 180) lon -= 360;
      while (lon - prev < -180) lon += 360;
    }
    points.push([lon, lat]);
  }
  return points;
}

/** Initial compass bearing from `a` to `b`, in degrees clockwise from north. */
export function bearing([lon1, lat1]: LngLat, [lon2, lat2]: LngLat): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
