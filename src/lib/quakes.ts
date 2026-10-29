// Earthquake data: normalize USGS + EMSC feeds into one shape and merge duplicates.

export type QuakeSource = "USGS" | "EMSC";
export type TimeWindow = "hour" | "day" | "week";
export type Region = "world" | "south-asia";
export type DepthBand = "shallow" | "intermediate" | "deep";

export interface Quake {
  id: string;
  mag: number;
  magType: string;
  place: string;
  time: number; // epoch ms, UTC
  lat: number;
  lon: number;
  depth: number; // km, positive down
  tsunami: boolean;
  felt: number | null;
  alert: string | null; // USGS PAGER level: green | yellow | orange | red
  sources: QuakeSource[];
  links: Partial<Record<QuakeSource, string>>;
}

export const WINDOW_MS: Record<TimeWindow, number> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
};

export const MAG_STEPS = [2.5, 4, 5, 6] as const;

// Rough box around India and its neighbours (Pakistan to Myanmar, Tibet to Sri Lanka).
export const SOUTH_ASIA_BOUNDS = { west: 60, east: 100, south: 0, north: 40 };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeUsgs(geojson: any): Quake[] {
  const out: Quake[] = [];
  for (const f of geojson?.features ?? []) {
    const p = f?.properties;
    const c = f?.geometry?.coordinates;
    if (!p || !Array.isArray(c) || typeof p.mag !== "number") continue;
    out.push({
      id: `usgs:${f.id}`,
      mag: round1(p.mag),
      magType: p.magType ?? "",
      place: p.place || p.title || "Unknown location",
      time: p.time,
      lon: c[0],
      lat: c[1],
      depth: Math.max(0, round1(c[2] ?? 0)),
      tsunami: p.tsunami === 1,
      felt: typeof p.felt === "number" ? p.felt : null,
      alert: p.alert ?? null,
      sources: ["USGS"],
      links: { USGS: p.url },
    });
  }
  return out;
}

export function normalizeEmsc(geojson: any): Quake[] {
  const out: Quake[] = [];
  for (const f of geojson?.features ?? []) {
    const p = f?.properties;
    if (!p || typeof p.mag !== "number" || typeof p.lat !== "number") continue;
    const unid = p.unid ?? f.id;
    out.push({
      id: `emsc:${unid}`,
      mag: round1(p.mag),
      magType: (p.magtype ?? "").toLowerCase(),
      place: titleCase(p.flynn_region ?? "Unknown region"),
      time: Date.parse(p.time),
      lat: p.lat,
      lon: p.lon,
      depth: Math.max(0, round1(Math.abs(p.depth ?? 0))),
      tsunami: false,
      felt: null,
      alert: null,
      sources: ["EMSC"],
      links: { EMSC: `https://www.seismicportal.eu/eventdetails.html?unid=${unid}` },
    });
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Same event if within 90 s, 150 km and 1 magnitude unit. USGS details win. */
export function isSameEvent(a: Quake, b: Quake): boolean {
  return (
    Math.abs(a.time - b.time) <= 90_000 &&
    Math.abs(a.mag - b.mag) <= 1 &&
    distanceKm(a.lat, a.lon, b.lat, b.lon) <= 150
  );
}

export function mergeQuakes(usgs: Quake[], emsc: Quake[]): Quake[] {
  const merged = usgs.map((q) => ({ ...q, sources: [...q.sources], links: { ...q.links } }));
  for (const e of emsc) {
    const twin = merged.find((u) => u.sources.includes("USGS") && isSameEvent(u, e));
    if (twin) {
      if (!twin.sources.includes("EMSC")) twin.sources.push("EMSC");
      twin.links.EMSC = e.links.EMSC;
    } else {
      merged.push(e);
    }
  }
  return merged.sort((a, b) => b.time - a.time);
}

export function filterQuakes(
  quakes: Quake[],
  opts: { minMag: number; window: TimeWindow; region: Region; now: number },
): Quake[] {
  const since = opts.now - WINDOW_MS[opts.window];
  return quakes.filter(
    (q) => q.mag >= opts.minMag && q.time >= since && (opts.region === "world" || inSouthAsia(q)),
  );
}

export function inSouthAsia(q: Pick<Quake, "lat" | "lon">): boolean {
  const b = SOUTH_ASIA_BOUNDS;
  return q.lon >= b.west && q.lon <= b.east && q.lat >= b.south && q.lat <= b.north;
}

export function depthBand(depthKm: number): DepthBand {
  if (depthKm < 70) return "shallow";
  if (depthKm < 300) return "intermediate";
  return "deep";
}

export function strength(mag: number): string {
  if (mag >= 7) return "a major";
  if (mag >= 6) return "a strong";
  if (mag >= 5) return "a moderate";
  if (mag >= 4) return "a light";
  return "a minor";
}

/** Sanjaya's first-person line for the narration feed. */
export function narrate(q: Quake): string {
  const tsunami = q.tsunami ? " A tsunami bulletin was issued." : "";
  return `I see ${strength(q.mag)} tremor, M${q.mag.toFixed(1)}, ${q.place}, ${Math.round(q.depth)} km below the surface.${tsunami}`;
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}
