import { NextResponse } from "next/server";
import {
  MAG_STEPS,
  WINDOW_MS,
  mergeQuakes,
  normalizeEmsc,
  normalizeUsgs,
  type Quake,
  type TimeWindow,
} from "@/lib/quakes";

const TTL_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 8_000;
const UA = "Sanjaya/0.1 (open-source live world map)";

interface FeedStatus {
  ok: boolean;
  count: number;
}

interface Payload {
  generated: number;
  window: TimeWindow;
  minMag: number;
  quakes: Quake[];
  feeds: { USGS: FeedStatus; EMSC: FeedStatus };
}

// Small in-memory cache so many visitors cost one upstream call per minute.
const cache = new Map<string, { at: number; payload: Payload }>();

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const window = parseWindow(params.get("window"));
  const minMag = parseMag(params.get("min"));
  const key = `${window}:${minMag}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return respond(hit.payload);

  const [usgs, emsc] = await Promise.allSettled([fetchUsgs(window), fetchEmsc(window, minMag)]);
  const usgsQuakes = usgs.status === "fulfilled" ? usgs.value : [];
  const emscQuakes = emsc.status === "fulfilled" ? emsc.value : [];

  if (usgs.status === "rejected" && emsc.status === "rejected") {
    if (hit) return respond(hit.payload); // serve stale rather than nothing
    return NextResponse.json({ error: "Both earthquake feeds are unreachable" }, { status: 502 });
  }

  const payload: Payload = {
    generated: Date.now(),
    window,
    minMag,
    quakes: mergeQuakes(usgsQuakes, emscQuakes).filter((q) => q.mag >= minMag),
    feeds: {
      USGS: { ok: usgs.status === "fulfilled", count: usgsQuakes.length },
      EMSC: { ok: emsc.status === "fulfilled", count: emscQuakes.length },
    },
  };
  cache.set(key, { at: Date.now(), payload });
  return respond(payload);
}

async function fetchUsgs(window: TimeWindow): Promise<Quake[]> {
  const res = await fetch(
    `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_${window}.geojson`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  return normalizeUsgs(await res.json());
}

async function fetchEmsc(window: TimeWindow, minMag: number): Promise<Quake[]> {
  const start = new Date(Date.now() - WINDOW_MS[window]).toISOString().slice(0, 19);
  const url =
    `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&orderby=time` +
    `&limit=2000&minmag=${minMag}&starttime=${start}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 204) return []; // no events
  if (!res.ok) throw new Error(`EMSC ${res.status}`);
  return normalizeEmsc(await res.json());
}

function respond(payload: Payload) {
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}

function parseWindow(v: string | null): TimeWindow {
  return v === "hour" || v === "week" ? v : "day";
}

function parseMag(v: string | null): number {
  const n = Number(v);
  return (MAG_STEPS as readonly number[]).includes(n) ? n : 2.5;
}
