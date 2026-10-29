// Satellite groups, orbit data shape, and live position math (SGP4 via satellite.js).
import { degreesLat, degreesLong, eciToGeodetic, gstime, json2satrec, propagate, type OMMJsonObject, type SatRec } from "satellite.js";

export type SatGroupId = "stations" | "isro" | "gnss" | "weather" | "starlink";

export interface SatGroup {
  id: SatGroupId;
  name: string;
  hint: string;
  queries: string[]; // CelesTrak gp.php queries, merged
}

// Name prefixes of Indian satellites. Galileo's "GSAT0101" style names are excluded.
const ISRO_PREFIXES = [
  "CARTOSAT", "RISAT", "GSAT", "INSAT", "IRNSS", "NVS-", "OCEANSAT", "RESOURCESAT", "EOS-", "SCATSAT", "ASTROSAT",
  "MICROSAT", "HYSIS", "EMISAT", "SARAL", "MEGHA-TROPIQUES", "GISAT", "XPOSAT", "ADITYA", "IRS-", "CMS-", "TDS-", "SPADEX",
];
const ISRO_NAME = new RegExp(`^(${ISRO_PREFIXES.map((p) => (p === "GSAT" ? "GSAT[- ]" : p)).join("|")})`);
// Rocket stages and debris share the payload names; leave them out.
export const isIsro = (name: string) => ISRO_NAME.test(name) && !/\bR\/B\b|\bDEB\b/.test(name);

export const SAT_GROUPS: SatGroup[] = [
  { id: "stations", name: "Space stations", hint: "ISS, Tiangong", queries: ["GROUP=stations"] },
  // Small name searches instead of the 7 MB "active" list.
  { id: "isro", name: "ISRO", hint: "Cartosat, GSAT, NavIC, RISAT…", queries: ISRO_PREFIXES.map((p) => `NAME=${encodeURIComponent(p)}`) },
  { id: "gnss", name: "Navigation", hint: "GPS, GLONASS, Galileo, BeiDou", queries: ["GROUP=gnss"] },
  { id: "weather", name: "Weather", hint: "INSAT-3D, GOES, Meteosat…", queries: ["GROUP=weather"] },
  { id: "starlink", name: "Starlink", hint: "Thousands, heavier to draw", queries: ["GROUP=starlink"] },
];

export const isSatGroup = (v: string | null): v is SatGroupId => SAT_GROUPS.some((g) => g.id === v);

/** Download a group from CelesTrak: run its queries, merge, drop duplicates, keep ISRO names for ISRO. */
export async function downloadGroup(group: SatGroup, get: (url: string) => Promise<unknown>): Promise<Omm[]> {
  const lists = await Promise.all(
    group.queries.map((q) => get(`https://celestrak.org/NORAD/elements/gp.php?${q}&FORMAT=json`)),
  );
  const byId = new Map<number, Omm>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue; // CelesTrak answers "No GP data found" as text for empty searches
    for (const o of list as Record<string, unknown>[]) {
      if (group.id === "isro" && !isIsro(String(o.OBJECT_NAME))) continue;
      byId.set(Number(o.NORAD_CAT_ID), compactOmm(o));
    }
  }
  return [...byId.values()];
}

/** Only the orbital elements SGP4 needs, plus the name and launch id. */
export interface Omm {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

const OMM_KEYS: (keyof Omm)[] = [
  "OBJECT_NAME", "OBJECT_ID", "EPOCH", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE",
  "ARG_OF_PERICENTER", "MEAN_ANOMALY", "NORAD_CAT_ID", "ELEMENT_SET_NO", "BSTAR", "MEAN_MOTION_DOT", "MEAN_MOTION_DDOT",
];

export function compactOmm(o: Record<string, unknown>): Omm {
  const out = {} as Record<string, unknown>;
  for (const k of OMM_KEYS) out[k] = o[k];
  return out as unknown as Omm;
}

export interface Sat {
  id: string; // `${group}:${norad}`
  group: SatGroupId;
  name: string;
  short: string; // map label
  norad: number;
  launchYear: number | null;
  epoch: number; // when these orbital elements were measured
  inclination: number;
  periodMin: number;
  rec: SatRec;
}

// The two crewed stations, by catalogue number. Their modules and docked capsules
// share names like "ISS (NAUKA)", so the name alone can't pick them out.
const STATIONS: Record<number, { short: string; name: string }> = {
  25544: { short: "ISS", name: "International Space Station" },
  48274: { short: "CSS", name: "Tiangong space station" },
};

export function toSat(group: SatGroupId, o: Omm): Sat | null {
  try {
    const rec = json2satrec(o as unknown as OMMJsonObject);
    if (rec.error) return null;
    const year = Number(o.OBJECT_ID?.slice(0, 4));
    const station = STATIONS[o.NORAD_CAT_ID];
    // "CARTOSAT-2A" stays; "IRS-P5 (CARTOSAT-1)" becomes "IRS-P5"; "ISS (NAUKA)" keeps its full name.
    const bare = o.OBJECT_NAME.replace(/\s*\(.*\)\s*$/, "");
    return {
      id: `${group}:${o.NORAD_CAT_ID}`,
      group,
      name: station?.name ?? o.OBJECT_NAME,
      short: station?.short ?? (bare === "ISS" || bare === "CSS" ? o.OBJECT_NAME : bare),
      norad: o.NORAD_CAT_ID,
      launchYear: Number.isFinite(year) && year > 1950 ? year : null,
      epoch: Date.parse(o.EPOCH + "Z"),
      inclination: o.INCLINATION,
      periodMin: 1440 / o.MEAN_MOTION,
      rec,
    };
  } catch {
    return null;
  }
}

export interface SatState {
  lat: number;
  lon: number;
  altKm: number;
  speedKms: number;
}

export function satState(rec: SatRec, date: Date): SatState | null {
  const pv = propagate(rec, date);
  if (!pv || typeof pv.position === "boolean" || !pv.position) return null;
  const geo = eciToGeodetic(pv.position, gstime(date));
  const v = pv.velocity as { x: number; y: number; z: number };
  const lat = degreesLat(geo.latitude);
  const lon = degreesLong(geo.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, altKm: geo.height, speedKms: Math.hypot(v.x, v.y, v.z) };
}

/** Ground track for the next `minutes`, split where it crosses the antimeridian. */
export function groundTrack(rec: SatRec, from: Date, minutes: number, stepSec = 60): number[][][] {
  const parts: number[][][] = [[]];
  let prevLon: number | null = null;
  for (let s = 0; s <= minutes * 60; s += stepSec) {
    const st = satState(rec, new Date(from.getTime() + s * 1000));
    if (!st) continue;
    if (prevLon !== null && Math.abs(st.lon - prevLon) > 180) parts.push([]);
    parts[parts.length - 1].push([st.lon, st.lat]);
    prevLon = st.lon;
  }
  return parts.filter((p) => p.length > 1);
}
