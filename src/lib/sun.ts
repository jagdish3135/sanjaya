// Where the sun is overhead, and the night side of the Earth, for the day/night layer.
// Low-precision solar formulas (good to about 0.1°), plenty for a map.

const RAD = Math.PI / 180;

export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const n = date.getTime() / 86_400_000 + 2440587.5 - 2451545.0; // days since J2000
  const L = mod(280.46 + 0.9856474 * n, 360);
  const g = mod(357.528 + 0.9856003 * n, 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / RAD;
  const gmst = mod(280.46061837 + 360.98564736629 * n, 360);
  return { lat: decl / RAD, lon: wrapLon(ra - gmst) };
}

/** Polygon covering the night side (sun below the horizon), or the day side with `day`. */
export function nightPolygon(date: Date, stepDeg = 2, day = false): GeoJSON.Feature<GeoJSON.Polygon> {
  const sun = subsolarPoint(date);
  // Avoid dividing by zero at the exact equinox.
  const decl = (Math.abs(sun.lat) < 0.01 ? 0.01 : sun.lat) * RAD;
  const ring: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += stepDeg) {
    const h = (lon - sun.lon) * RAD;
    ring.push([lon, Math.atan(-Math.cos(h) / Math.tan(decl)) / RAD]);
  }
  const darkPole = decl > 0 ? -90 : 90;
  const pole = day ? -darkPole : darkPole;
  ring.push([180, pole], [-180, pole], ring[0]);
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/** The terminator line itself (for a soft glow along the edge). */
export function terminatorLine(date: Date): GeoJSON.Feature<GeoJSON.LineString> {
  const ring = nightPolygon(date).geometry.coordinates[0];
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring.slice(0, -3) } };
}

export function wrapLon(lon: number): number {
  return mod(lon + 180, 360) - 180;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
