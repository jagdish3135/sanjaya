// Disasters (GDACS), wildfires (NASA FIRMS) and wind (Open-Meteo): parse each feed into a small shape.

/* ───────── Disasters ───────── */

export type DisasterType = "TC" | "FL" | "VO" | "DR" | "WF" | "EQ";
export type AlertLevel = "Green" | "Orange" | "Red";

export const DISASTER_TYPES: { id: DisasterType; name: string }[] = [
  { id: "TC", name: "Cyclones" },
  { id: "FL", name: "Floods" },
  { id: "VO", name: "Volcanoes" },
  { id: "DR", name: "Droughts" },
  { id: "WF", name: "Wildfires" },
];

export interface Disaster {
  id: string;
  type: DisasterType;
  name: string;
  alert: AlertLevel;
  lat: number;
  lon: number;
  from: number;
  to: number;
  country: string;
  severity: string;
  url: string;
}

const ALERT_RANK: Record<AlertLevel, number> = { Green: 0, Orange: 1, Red: 2 };
export const alertRank = (a: AlertLevel) => ALERT_RANK[a] ?? 0;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeGdacs(geojson: any): Disaster[] {
  const byId = new Map<string, Disaster>();
  for (const f of geojson?.features ?? []) {
    const p = f?.properties;
    const c = f?.geometry?.coordinates;
    if (!p || f.geometry?.type !== "Point" || !Array.isArray(c)) continue;
    if (p.iscurrent === "false") continue;
    const alert: AlertLevel = ["Green", "Orange", "Red"].includes(p.alertlevel) ? p.alertlevel : "Green";
    const d: Disaster = {
      id: `${p.eventtype}-${p.eventid}`,
      type: p.eventtype,
      name: p.name || p.eventname || "Unnamed event",
      alert,
      lon: c[0],
      lat: c[1],
      from: Date.parse(p.fromdate + "Z"),
      to: Date.parse(p.todate + "Z"),
      country: p.country || "",
      severity: cleanSeverity(p.severitydata?.severitytext),
      url: p.url?.report ?? "https://www.gdacs.org/",
    };
    const prev = byId.get(d.id);
    if (!prev || d.to >= prev.to) byId.set(d.id, d);
  }
  return [...byId.values()].sort((a, b) => b.to - a.to);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function cleanSeverity(s: unknown): string {
  const t = typeof s === "string" ? s.trim() : "";
  return /^Magnitude 0\b/.test(t) ? "" : t;
}

export function narrateDisaster(d: Disaster): string {
  const where = d.country ? ` over ${d.country}` : "";
  const sev = d.severity ? `: ${d.severity.replace(/\s+$/, "")}` : "";
  return `I see ${d.name}${where}, ${d.alert.toLowerCase()} alert${sev}.`;
}

/* ───────── Wildfires ───────── */

/** [lon, lat, frp (MW), confidence 0–100, time (epoch ms), day 1 / night 0] */
export type Fire = [number, number, number, number, number, number];

export function parseFirmsCsv(csv: string): Fire[] {
  const lines = csv.trim().split(/\r?\n/);
  const head = lines.shift()?.split(",") ?? [];
  const col = (n: string) => head.indexOf(n);
  const [iLat, iLon, iFrp, iConf, iDate, iTime, iDn] = [
    col("latitude"), col("longitude"), col("frp"), col("confidence"), col("acq_date"), col("acq_time"), col("daynight"),
  ];
  if ([iLat, iLon, iDate, iTime].some((i) => i < 0)) return [];
  const out: Fire[] = [];
  for (const line of lines) {
    const v = line.split(",");
    const lat = Number(v[iLat]);
    const lon = Number(v[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const hhmm = (v[iTime] ?? "").padStart(4, "0");
    const t = Date.parse(`${v[iDate]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`);
    out.push([round3(lon), round3(lat), Number(v[iFrp]) || 0, confidence(v[iConf]), t, v[iDn] === "N" ? 0 : 1]);
  }
  return out;
}

// MODIS gives 0–100; VIIRS gives l/n/h.
function confidence(v: string | undefined): number {
  if (v === "l") return 20;
  if (v === "n") return 60;
  if (v === "h") return 90;
  return Number(v) || 0;
}

/* ───────── Wind ───────── */

/** [lon, lat, speed km/h, direction it blows FROM, degrees] */
export type WindPoint = [number, number, number, number];

/** A coarse world grid plus a finer grid over India and its neighbours. */
export function windGrid(): [number, number][] {
  const pts = new Map<string, [number, number]>();
  for (let lat = -60; lat <= 75; lat += 15) for (let lon = -180; lon < 180; lon += 15) pts.set(`${lon},${lat}`, [lon, lat]);
  for (let lat = 5; lat <= 40; lat += 5) for (let lon = 65; lon <= 100; lon += 5) pts.set(`${lon},${lat}`, [lon, lat]);
  return [...pts.values()];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeOpenMeteo(json: any, grid: [number, number][]): WindPoint[] {
  const list = Array.isArray(json) ? json : [json];
  const out: WindPoint[] = [];
  list.forEach((loc, i) => {
    const c = loc?.current;
    if (!c || typeof c.wind_speed_10m !== "number" || !grid[i]) return;
    out.push([grid[i][0], grid[i][1], c.wind_speed_10m, c.wind_direction_10m ?? 0]);
  });
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
