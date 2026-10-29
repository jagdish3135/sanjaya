"use client";

import { useEffect, useState } from "react";
import Glyph from "./Glyph";
import { LAYERS, layerInfo } from "@/lib/layers";
import { MAG_STEPS, type Region, type TimeWindow } from "@/lib/quakes";
import { DISASTER_TYPES, type AlertLevel, type DisasterType } from "@/lib/hazards";
import { SAT_GROUPS, type SatGroupId } from "@/lib/satellites";
import { clockIst, clockUtc, timeAgo } from "@/lib/time";
import type { LayerId } from "./mapLayers";

export type FeedState = "loading" | "live" | "stale" | "error";

/**
 * Re-render every `ms` so "time ago" labels stay fresh. Starts at 0 so the server
 * render and the first browser render match; the real time arrives on the next frame.
 */
export function useNow(ms: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = requestAnimationFrame(tick);
    const t = setInterval(tick, ms);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(t);
    };
  }, [ms]);
  return now;
}

const CLOCK_BLANK = "--:--:--";

/* ───────────── Masthead ───────────── */

export function Masthead({ state, syncedAt }: { state: FeedState; syncedAt: number | null }) {
  const now = useNow(1000);
  const ago = syncedAt && now ? timeAgo(syncedAt, now) : "";
  const label =
    state === "loading" ? "Opening the eye" :
    state === "error" ? "Feeds unreachable" :
    state === "stale" ? `Last sight ${ago}` :
    `Live · synced ${ago}`;
  return (
    <header className="masthead">
      <div className="brand">
        <span className="brand-deva" lang="sa">संजय</span>
        <span className="brand-latin">Sanjaya</span>
        <span className="brand-tag">the world, seen live</span>
      </div>
      <div className="clocks">
        <div className="clock">
          <span className="clock-zone">IST</span>
          <span className="clock-time">{now ? clockIst(now) : CLOCK_BLANK}</span>
        </div>
        <div className="clock clock-utc">
          <span className="clock-zone">UTC</span>
          <span className="clock-time">{now ? clockUtc(now) : CLOCK_BLANK}</span>
        </div>
        <div className={`status status-${state}`} role="status">
          <span className="status-dot" />
          {label}
        </div>
      </div>
    </header>
  );
}

/* ───────────── Building blocks ───────────── */

function Seg<T extends string | number>(p: {
  legend: string;
  options: { id: T; label: string }[];
  isOn: (id: T) => boolean;
  onPick: (id: T) => void;
}) {
  return (
    <fieldset className="seg">
      <legend>{p.legend}</legend>
      <div className="seg-row">
        {p.options.map((o) => (
          <button key={String(o.id)} aria-pressed={p.isOn(o.id)} onClick={() => p.onPick(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function LayerCard(p: { id: LayerId; on: boolean; onToggle: () => void; count?: number | null; children?: React.ReactNode }) {
  const info = layerInfo(p.id);
  return (
    <div className={`layer-card ${p.on ? "is-on" : ""}`}>
      <button className="layer-toggle" aria-pressed={p.on} aria-expanded={p.children ? p.on : undefined} onClick={p.onToggle}>
        <span className="layer-switch" aria-hidden="true" />
        <span className="layer-text">
          <span className="layer-name">{info.name}</span>
          <span className="layer-hint">{info.hint}</span>
        </span>
        {p.on && p.count != null && <span className="layer-count">{p.count.toLocaleString("en-IN")}</span>}
      </button>
      {p.on && p.children && <div className="layer-body">{p.children}</div>}
    </div>
  );
}

const Key = ({ color, label, note }: { color: string; label: string; note?: string }) => (
  <div className="legend-row">
    <span className="swatch" style={{ background: color, color }} /> {label} {note && <small>{note}</small>}
  </div>
);

/* ───────────── Layer panel ───────────── */

export interface Filters {
  region: Region;
  quakeWindow: TimeWindow;
  minMag: number;
  satGroups: SatGroupId[];
  disasterTypes: DisasterType[];
  minAlert: AlertLevel;
  fireConf: number;
  rain: boolean;
  wind: boolean;
}

interface LayerPanelProps {
  on: Record<LayerId, boolean>;
  toggle: (id: LayerId) => void;
  filters: Filters;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  counts: Partial<Record<LayerId, number | null>>;
  sunText: string;
}

const WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: "hour", label: "1 hour" },
  { id: "day", label: "24 hours" },
  { id: "week", label: "7 days" },
];
const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function LayerPanel({ on, toggle, filters: f, setFilter, counts, sunText }: LayerPanelProps) {
  const soon = LAYERS.filter((l) => l.status === "soon");
  return (
    <section className="panel panel-layers" aria-labelledby="layers-title">
      <h2 id="layers-title" className="panel-title">
        <span className="panel-title-deva" lang="sa">दृष्टि</span> Layers
      </h2>

      <Seg
        legend="Focus"
        options={[{ id: "world" as Region, label: "World" }, { id: "south-asia" as Region, label: "India & neighbours" }]}
        isOn={(id) => f.region === id}
        onPick={(id) => setFilter("region", id)}
      />

      <LayerCard id="earthquakes" on={on.earthquakes} onToggle={() => toggle("earthquakes")} count={counts.earthquakes}>
        <Seg legend="Time" options={WINDOWS} isOn={(id) => f.quakeWindow === id} onPick={(id) => setFilter("quakeWindow", id)} />
        <Seg
          legend="Magnitude"
          options={MAG_STEPS.map((m) => ({ id: m as number, label: `${m}+` }))}
          isOn={(id) => f.minMag === id}
          onPick={(id) => setFilter("minMag", id)}
        />
        <div className="legend">
          <Key color="var(--sindoor)" label="Shallow" note="<70 km" />
          <Key color="var(--saffron)" label="Intermediate" note="70–300" />
          <Key color="var(--nila)" label="Deep" note="300+ km" />
          <div className="legend-sizes" aria-hidden="true">
            {[3, 5, 7].map((m) => (
              <span key={m} className="size-dot" style={{ width: m * 2.6, height: m * 2.6 }} />
            ))}
            <small>size = magnitude · ring = last hour</small>
          </div>
        </div>
      </LayerCard>

      <LayerCard id="satellites" on={on.satellites} onToggle={() => toggle("satellites")} count={counts.satellites}>
        <Seg
          legend="Show"
          options={SAT_GROUPS.map((g) => ({ id: g.id, label: g.name }))}
          isOn={(id) => f.satGroups.includes(id)}
          onPick={(id) => setFilter("satGroups", toggleIn(f.satGroups, id))}
        />
        <div className="legend legend-inline">
          <Key color="#fff4d6" label="Stations" />
          <Key color="var(--saffron)" label="ISRO" />
          <Key color="var(--nila)" label="Navigation" />
          <Key color="var(--jade)" label="Weather" />
        </div>
        <p className="layer-note">Click a satellite to see its next orbit.</p>
      </LayerCard>

      <LayerCard id="daynight" on={on.daynight} onToggle={() => toggle("daynight")}>
        <p className="layer-note"><Glyph name="SUN" size={14} /> {sunText}</p>
      </LayerCard>

      <LayerCard id="disasters" on={on.disasters} onToggle={() => toggle("disasters")} count={counts.disasters}>
        <Seg
          legend="Type"
          options={DISASTER_TYPES.map((t) => ({ id: t.id, label: t.name }))}
          isOn={(id) => f.disasterTypes.includes(id)}
          onPick={(id) => setFilter("disasterTypes", toggleIn(f.disasterTypes, id))}
        />
        <Seg
          legend="Alert level"
          options={[{ id: "Green" as AlertLevel, label: "All" }, { id: "Orange" as AlertLevel, label: "Orange+" }, { id: "Red" as AlertLevel, label: "Red only" }]}
          isOn={(id) => f.minAlert === id}
          onPick={(id) => setFilter("minAlert", id)}
        />
      </LayerCard>

      <LayerCard id="fires" on={on.fires} onToggle={() => toggle("fires")} count={counts.fires}>
        <Seg
          legend="Confidence"
          options={[{ id: 0, label: "All" }, { id: 50, label: "Likely 50%+" }, { id: 80, label: "Sure 80%+" }]}
          isOn={(id) => f.fireConf === id}
          onPick={(id) => setFilter("fireConf", id)}
        />
        <p className="layer-note">A glow from far away; zoom in to see single hotspots.</p>
      </LayerCard>

      <LayerCard id="weather" on={on.weather} onToggle={() => toggle("weather")}>
        <Seg
          legend="Show"
          options={[{ id: "rain", label: "Rain" }, { id: "wind", label: "Wind" }]}
          isOn={(id) => (id === "rain" ? f.rain : f.wind)}
          onPick={(id) => setFilter(id as "rain" | "wind", !(id === "rain" ? f.rain : f.wind))}
        />
        <div className="legend legend-inline">
          <Key color="var(--nila)" label="Calm" />
          <Key color="var(--jade)" label="15+" />
          <Key color="var(--saffron)" label="30+" />
          <Key color="var(--sindoor)" label="60+ km/h" />
        </div>
        <p className="layer-note">Rain: NASA GPM, last 30 minutes. Wind arrows point where it blows.</p>
      </LayerCard>

      <LayerCard id="cables" on={on.cables} onToggle={() => toggle("cables")} count={counts.cables}>
        <p className="layer-note">The internet travels under the sea. Click a cable for its route.</p>
      </LayerCard>

      <div className="soon">
        <h3 className="soon-title">Coming soon</h3>
        <p className="soon-note">Not built yet. These arrive in later phases.</p>
        <ul>
          {soon.map((l) => (
            <li key={l.id} title={l.hint}>
              <span>{l.name}</span>
              <span className="soon-phase">Phase {l.phase}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────────── Narration feed ───────────── */

export interface FeedEvent {
  id: string;
  kind: "quake" | "disaster";
  time: number;
  badge: React.ReactNode;
  tone: string; // band-* class
  text: string;
  lat: number;
  lon: number;
}

interface NarrationProps {
  events: FeedEvent[];
  summary: React.ReactNode;
  selectedId: string | null;
  onPick: (e: FeedEvent) => void;
}

export function Narration({ events, summary, selectedId, onPick }: NarrationProps) {
  const now = useNow(15_000);
  return (
    <section className="panel panel-feed" aria-labelledby="feed-title">
      <h2 id="feed-title" className="panel-title">
        <span className="panel-title-deva" lang="sa">वाचन</span> Sanjaya narrates
      </h2>
      <p className="feed-summary">{summary}</p>
      <ol className="feed-list">
        {events.slice(0, 150).map((e) => (
          <li key={e.id}>
            <button className={`feed-item band-${e.tone} ${e.id === selectedId ? "is-selected" : ""}`} onClick={() => onPick(e)}>
              <span className="feed-mag">{e.badge}</span>
              <span className="feed-text">
                <span className="feed-time">{now ? timeAgo(e.time, now) : ""}</span>
                {e.text}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
