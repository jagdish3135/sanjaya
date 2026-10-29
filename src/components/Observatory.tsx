"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Dial from "./Dial";
import { INDIA_VIEW, type FlyTarget } from "./Globe";
import { LayerPanel, Masthead, Narration, Sighting, type FeedState } from "./Panels";
import { filterQuakes, type Quake, type Region, type TimeWindow } from "@/lib/quakes";

const Globe = dynamic(() => import("./Globe"), { ssr: false });

const POLL_MS = 60_000;
const WINDOW_LABEL: Record<TimeWindow, string> = { hour: "hour", day: "24 hours", week: "7 days" };

interface Payload {
  generated: number;
  quakes: Quake[];
}

export default function Observatory() {
  const [quakesOn, setQuakesOn] = useState(true);
  const [window, setWindow] = useState<TimeWindow>("day");
  const [minMag, setMinMag] = useState(2.5);
  const [region, setRegion] = useState<Region>("world");
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<FeedState>("loading");
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [bearing, setBearing] = useState(0);
  const [sheet, setSheet] = useState<"none" | "layers" | "feed">("none");

  // Fetch now, then every minute. Keep the last good data if a fetch fails.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/earthquakes?window=${window}&min=${minMag}`);
        if (!res.ok) throw new Error(String(res.status));
        const json: Payload = await res.json();
        if (!alive) return;
        setData(json);
        setSyncedAt(Date.now());
        setState("live");
      } catch {
        if (alive) setState((s) => (s === "loading" ? "error" : "stale"));
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [window, minMag]);

  const quakes = useMemo(
    () => (data ? filterQuakes(data.quakes, { minMag, window, region, now: data.generated }) : []),
    [data, minMag, window, region],
  );
  const selected = quakes.find((q) => q.id === selectedId) ?? null;

  const fly = (lon: number, lat: number, zoom: number) => setFlyTarget({ lon, lat, zoom, key: Date.now() });

  const pick = (q: Quake) => {
    setSelectedId(q.id);
    setSheet("none");
    fly(q.lon, q.lat, 4.2);
  };

  const changeRegion = (r: Region) => {
    setRegion(r);
    if (r === "south-asia") fly(INDIA_VIEW.lon, INDIA_VIEW.lat, 3.1);
    else fly(INDIA_VIEW.lon, INDIA_VIEW.lat, 1.75);
  };

  const closeSighting = useCallback(() => setSelectedId(null), []);

  return (
    <main className="observatory" data-sheet={sheet}>
      <div className="sky" aria-hidden="true" />
      <Globe
        quakes={quakes}
        visible={quakesOn}
        selectedId={selectedId}
        flyTarget={flyTarget}
        onSelect={setSelectedId}
        onBearing={setBearing}
      />
      <Dial bearing={bearing} />
      <div className="grain" aria-hidden="true" />

      <Masthead state={state} syncedAt={syncedAt} />

      <LayerPanel
        quakesOn={quakesOn}
        onToggleQuakes={() => setQuakesOn((v) => !v)}
        window={window}
        onWindow={setWindow}
        minMag={minMag}
        onMinMag={setMinMag}
        region={region}
        onRegion={changeRegion}
        count={quakesOn ? quakes.length : 0}
      />

      <Narration
        quakes={quakesOn ? quakes : []}
        selectedId={selectedId}
        onPick={pick}
        state={state}
        windowLabel={WINDOW_LABEL[window]}
      />

      {selected && <Sighting key={selected.id} quake={selected} onClose={closeSighting} />}

      <button className="home-btn" onClick={() => fly(INDIA_VIEW.lon, INDIA_VIEW.lat, region === "world" ? 1.75 : 3.1)}>
        <span aria-hidden="true">◎</span> Back to India
      </button>

      <nav className="sheet-tabs" aria-label="Panels">
        <button aria-pressed={sheet === "layers"} onClick={() => setSheet((s) => (s === "layers" ? "none" : "layers"))}>
          Layers
        </button>
        <button aria-pressed={sheet === "feed"} onClick={() => setSheet((s) => (s === "feed" ? "none" : "feed"))}>
          Narration <span className="tab-count">{quakesOn ? quakes.length : 0}</span>
        </button>
      </nav>
    </main>
  );
}
