"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dial from "./Dial";
import Glyph from "./Glyph";
import { INDIA_VIEW, type CableData, type FlyTarget, type GlobeData } from "./Globe";
import { CableCard, DisasterCard, FireCard, QuakeCard, SatCard } from "./Cards";
import { LayerPanel, Masthead, Narration, type FeedEvent, type FeedState, type Filters } from "./Panels";
import { fireId, type LayerId, type Selection } from "./mapLayers";
import { WINDOW_MS, depthBand, filterQuakes, inSouthAsia, narrate, type Quake, type TimeWindow } from "@/lib/quakes";
import { alertRank, narrateDisaster, type Disaster, type Fire, type WindPoint } from "@/lib/hazards";
import { toSat, type Omm, type Sat, type SatGroupId } from "@/lib/satellites";
import { subsolarPoint } from "@/lib/sun";

const Globe = dynamic(() => import("./Globe"), { ssr: false });

const WINDOW_LABEL: Record<TimeWindow, string> = { hour: "hour", day: "24 hours", week: "7 days" };
/** While a new window loads, the list can only cover the narrower of the two windows. */
const shownWindow = (asked: TimeWindow, loaded: TimeWindow | undefined): TimeWindow =>
  loaded && WINDOW_MS[loaded] < WINDOW_MS[asked] ? loaded : asked;

/** Fetch a JSON feed now and every `everyMs` while `url` is set. Keeps the last good data on failure. */
function useFeed<T>(url: string | null, everyMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<FeedState>("loading");
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as T;
        if (!alive) return;
        setData(json);
        setSyncedAt(Date.now());
        setState("live");
      } catch {
        if (alive) setState((s) => (s === "loading" ? "error" : "stale"));
      }
    };
    load();
    const t = Number.isFinite(everyMs) ? setInterval(load, everyMs) : undefined;
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, everyMs]);
  return { data, state, syncedAt };
}

/** Load orbit data for the chosen groups once each, and keep the parsed orbits. */
function useSatellites(groups: SatGroupId[], on: boolean) {
  const requested = useRef(new Set<SatGroupId>());
  const [loaded, setLoaded] = useState<Partial<Record<SatGroupId, Sat[]>>>({});
  useEffect(() => {
    if (!on) return;
    for (const g of groups) {
      if (requested.current.has(g)) continue;
      requested.current.add(g);
      // Live orbits first; if CelesTrak is unavailable, the copy saved at build time.
      const get = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject()));
      get(`/api/satellites?group=${g}`)
        .catch(() => get(`/orbits/${g}.json`))
        .then((j: { sats: Omm[] }) => {
          const list = j.sats.map((o) => toSat(g, o)).filter((s): s is Sat => !!s);
          setLoaded((prev) => ({ ...prev, [g]: list }));
        })
        .catch(() => requested.current.delete(g));
    }
  }, [groups, on]);
  return useMemo(() => (on ? groups.flatMap((g) => loaded[g] ?? []) : []), [groups, on, loaded]);
}

const DEFAULT_ON: Record<LayerId, boolean> = {
  earthquakes: true, satellites: true, daynight: true, disasters: false, fires: false, weather: false, cables: false,
};

const DEFAULT_FILTERS: Filters = {
  region: "world", quakeWindow: "day", minMag: 2.5, satGroups: ["stations", "isro"],
  disasterTypes: ["TC", "FL", "VO", "DR", "WF"], minAlert: "Green", fireConf: 0, rain: true, wind: true,
};

const EMPTY: never[] = [];

export default function Observatory() {
  const [on, setOn] = useState(DEFAULT_ON);
  const [f, setF] = useState(DEFAULT_FILTERS);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [bearing, setBearing] = useState(0);
  const [sheet, setSheet] = useState<"none" | "layers" | "feed">("none");
  const [sunNow, setSunNow] = useState<number>(0);

  const fly = (lon: number, lat: number, zoom: number) => setFlyTarget({ lon, lat, zoom, key: Date.now() });
  const toggle = (id: LayerId) => setOn((o) => ({ ...o, [id]: !o[id] }));
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    if (k === "region") fly(INDIA_VIEW.lon, INDIA_VIEW.lat, v === "south-asia" ? 3.1 : 1.75);
  };

  /* ───── Feeds (each only runs while its layer is on) ───── */
  const quakeFeed = useFeed<{ generated: number; window: TimeWindow; quakes: Quake[] }>(
    on.earthquakes ? `/api/earthquakes?window=${f.quakeWindow}&min=${f.minMag}` : null, 60_000);
  const disasterFeed = useFeed<{ disasters: Disaster[] }>(on.disasters ? "/api/disasters" : null, 15 * 60_000);
  const fireFeed = useFeed<{ fires: Fire[] }>(on.fires ? "/api/fires" : null, 30 * 60_000);
  const windFeed = useFeed<{ wind: WindPoint[] }>(on.weather && f.wind ? "/api/wind" : null, 60 * 60_000);
  const cableFeed = useFeed<CableData>(on.cables ? "/api/cables" : null, Infinity);
  const sats = useSatellites(f.satGroups, on.satellites);

  /* ───── Filtered data ───── */
  const near = useCallback((p: { lat: number; lon: number }) => f.region === "world" || inSouthAsia(p), [f.region]);
  const qd = quakeFeed.data;
  const quakes = useMemo(
    () => (qd ? filterQuakes(qd.quakes, { minMag: f.minMag, window: f.quakeWindow, region: f.region, now: qd.generated }) : EMPTY),
    [qd, f.minMag, f.quakeWindow, f.region],
  );
  const disasters = useMemo(
    () => (disasterFeed.data?.disasters ?? EMPTY).filter((d) => f.disasterTypes.includes(d.type) && alertRank(d.alert) >= alertRank(f.minAlert) && near(d)),
    [disasterFeed.data, f.disasterTypes, f.minAlert, near],
  );
  const fires = useMemo(
    () => (fireFeed.data?.fires ?? EMPTY).filter((x) => x[3] >= f.fireConf && near({ lon: x[0], lat: x[1] })),
    [fireFeed.data, f.fireConf, near],
  );

  const globeData: GlobeData = useMemo(
    () => ({ quakes, disasters, fires, wind: windFeed.data?.wind ?? EMPTY, cables: cableFeed.data, sats }),
    [quakes, disasters, fires, windFeed.data, cableFeed.data, sats],
  );

  /* ───── Narration: earthquakes and disasters, newest first ───── */
  const events: FeedEvent[] = useMemo(() => {
    const list: FeedEvent[] = [];
    if (on.earthquakes) for (const q of quakes) list.push({ id: q.id, kind: "quake", time: q.time, badge: q.mag.toFixed(1), tone: depthBand(q.depth), text: narrate(q), lat: q.lat, lon: q.lon });
    if (on.disasters) for (const d of disasters) list.push({ id: d.id, kind: "disaster", time: d.to, badge: <Glyph name={d.type} size={22} />, tone: d.alert === "Red" ? "shallow" : d.alert === "Orange" ? "intermediate" : "jade", text: narrateDisaster(d), lat: d.lat, lon: d.lon });
    return list.sort((a, b) => b.time - a.time);
  }, [on.earthquakes, on.disasters, quakes, disasters]);

  const strongest = quakes.reduce<Quake | null>((a, q) => (!a || q.mag > a.mag ? q : a), null);
  const red = disasters.filter((d) => d.alert === "Red").length;
  const windowLabel = WINDOW_LABEL[shownWindow(f.quakeWindow, qd?.window)];
  const summary =
    !on.earthquakes && !on.disasters ? (
      "Turn on Earthquakes or Disasters to hear what Sanjaya sees."
    ) : quakeFeed.state === "loading" && on.earthquakes && !qd ? (
      "Looking across the world…"
    ) : (
      <>
        {on.earthquakes && (
          <>
            <strong>{quakes.length}</strong> tremors in the last {windowLabel}.
            {strongest && <> Strongest: <strong>M{strongest.mag.toFixed(1)}</strong>, {strongest.place}.</>}{" "}
          </>
        )}
        {on.disasters && disasterFeed.data && (
          <>
            <strong>{disasters.length}</strong> active disaster alerts{red > 0 && <>, <strong className="text-red">{red} red</strong></>}.
          </>
        )}
      </>
    );

  /* ───── Day and night note ───── */
  useEffect(() => {
    const tick = () => setSunNow(Date.now());
    const first = requestAnimationFrame(tick);
    const t = setInterval(tick, 60_000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(t);
    };
  }, []);
  const sunText = useMemo(() => {
    if (!sunNow) return "Finding the sun…";
    const s = subsolarPoint(new Date(sunNow));
    // Angle from the sun's overhead point to New Delhi decides day or night there.
    const r = Math.PI / 180;
    const cos = Math.sin(s.lat * r) * Math.sin(28.61 * r) + Math.cos(s.lat * r) * Math.cos(28.61 * r) * Math.cos((s.lon - 77.21) * r);
    const where = `${Math.abs(s.lat).toFixed(1)}°${s.lat >= 0 ? "N" : "S"}, ${Math.abs(s.lon).toFixed(1)}°${s.lon >= 0 ? "E" : "W"}`;
    return `Sun overhead at ${where}. It is ${cos > 0 ? "daytime" : "night"} in New Delhi.`;
  }, [sunNow]);

  /* ───── Selection ───── */
  const close = useCallback(() => setSelection(null), []);
  const pick = (e: FeedEvent) => {
    setSelection({ kind: e.kind, id: e.id });
    setSheet("none");
    fly(e.lon, e.lat, 4.2);
  };
  let card: React.ReactNode = null;
  if (selection?.kind === "quake") {
    const q = quakes.find((x) => x.id === selection.id);
    if (q) card = <QuakeCard key={q.id} quake={q} onClose={close} />;
  } else if (selection?.kind === "sat") {
    const s = sats.find((x) => x.id === selection.id);
    if (s) card = <SatCard key={s.id} sat={s} onClose={close} />;
  } else if (selection?.kind === "disaster") {
    const d = disasters.find((x) => x.id === selection.id);
    if (d) card = <DisasterCard key={d.id} d={d} onClose={close} />;
  } else if (selection?.kind === "fire") {
    const x = fires.find((y) => fireId(y) === selection.id);
    if (x) card = <FireCard key={selection.id} f={x} onClose={close} />;
  } else if (selection?.kind === "cable") {
    const feat = cableFeed.data?.cables.features.find((c) => c.properties?.id === selection.id);
    if (feat) card = <CableCard key={selection.id} id={selection.id} name={String(feat.properties?.name)} onClose={close} />;
  }

  const status = on.earthquakes ? quakeFeed : { state: "live" as FeedState, syncedAt: quakeFeed.syncedAt };
  const counts = {
    earthquakes: qd ? quakes.length : null,
    satellites: sats.length || null,
    disasters: disasterFeed.data ? disasters.length : null,
    fires: fireFeed.data ? fires.length : null,
    cables: cableFeed.data?.cables.features.length ?? null,
  };

  return (
    <main className="observatory" data-sheet={sheet}>
      <div className="sky" aria-hidden="true" />
      <Globe
        data={globeData}
        visible={on}
        weather={{ rain: f.rain, wind: f.wind }}
        selection={selection}
        flyTarget={flyTarget}
        onSelect={setSelection}
        onBearing={setBearing}
      />
      <Dial bearing={bearing} />
      <div className="grain" aria-hidden="true" />

      <Masthead state={status.state} syncedAt={status.syncedAt} />

      <LayerPanel on={on} toggle={toggle} filters={f} setFilter={setFilter} counts={counts} sunText={sunText} />

      <Narration events={events} summary={summary} selectedId={selection?.id ?? null} onPick={pick} />

      {card}

      <button className="home-btn" onClick={() => fly(INDIA_VIEW.lon, INDIA_VIEW.lat, f.region === "world" ? 1.75 : 3.1)}>
        <span aria-hidden="true">◎</span> Back to India
      </button>

      <nav className="sheet-tabs" aria-label="Panels">
        <button aria-pressed={sheet === "layers"} onClick={() => setSheet((s) => (s === "layers" ? "none" : "layers"))}>
          Layers
        </button>
        <button aria-pressed={sheet === "feed"} onClick={() => setSheet((s) => (s === "feed" ? "none" : "feed"))}>
          Narration <span className="tab-count">{events.length}</span>
        </button>
      </nav>
    </main>
  );
}
