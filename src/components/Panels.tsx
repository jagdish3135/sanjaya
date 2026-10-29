"use client";

import { useEffect, useState } from "react";
import { LAYERS } from "@/lib/layers";
import {
  MAG_STEPS,
  depthBand,
  narrate,
  type Quake,
  type QuakeSource,
  type Region,
  type TimeWindow,
} from "@/lib/quakes";
import { clockIst, clockUtc, formatIst, formatUtc, timeAgo } from "@/lib/time";

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
  const label =
    state === "loading" ? "Opening the eye" :
    state === "error" ? "Feeds unreachable" :
    state === "stale" ? `Last sight ${syncedAt ? timeAgo(syncedAt, now) : ""}` :
    `Live · synced ${syncedAt ? timeAgo(syncedAt, now) : ""}`;
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

/* ───────────── Layer panel ───────────── */

interface LayerPanelProps {
  quakesOn: boolean;
  onToggleQuakes: () => void;
  window: TimeWindow;
  onWindow: (w: TimeWindow) => void;
  minMag: number;
  onMinMag: (m: number) => void;
  region: Region;
  onRegion: (r: Region) => void;
  count: number;
}

const WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: "hour", label: "1 hour" },
  { id: "day", label: "24 hours" },
  { id: "week", label: "7 days" },
];

export function LayerPanel(p: LayerPanelProps) {
  const soon = LAYERS.filter((l) => l.status === "soon");
  return (
    <section className="panel panel-layers" aria-labelledby="layers-title">
      <h2 id="layers-title" className="panel-title">
        <span className="panel-title-deva" lang="sa">दृष्टि</span> Layers
      </h2>

      <div className={`layer-card ${p.quakesOn ? "is-on" : ""}`}>
        <button className="layer-toggle" aria-pressed={p.quakesOn} onClick={p.onToggleQuakes}>
          <span className="layer-switch" aria-hidden="true" />
          <span className="layer-name">Earthquakes</span>
          <span className="layer-count">{p.count}</span>
        </button>

        <fieldset className="seg" disabled={!p.quakesOn}>
          <legend>Region</legend>
          <div className="seg-row">
            <button aria-pressed={p.region === "world"} onClick={() => p.onRegion("world")}>World</button>
            <button aria-pressed={p.region === "south-asia"} onClick={() => p.onRegion("south-asia")}>
              India &amp; neighbours
            </button>
          </div>
        </fieldset>

        <fieldset className="seg" disabled={!p.quakesOn}>
          <legend>Time</legend>
          <div className="seg-row">
            {WINDOWS.map((w) => (
              <button key={w.id} aria-pressed={p.window === w.id} onClick={() => p.onWindow(w.id)}>
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="seg" disabled={!p.quakesOn}>
          <legend>Magnitude</legend>
          <div className="seg-row">
            {MAG_STEPS.map((m) => (
              <button key={m} aria-pressed={p.minMag === m} onClick={() => p.onMinMag(m)}>
                {m}+
              </button>
            ))}
          </div>
        </fieldset>

        <Legend />
      </div>

      <div className="soon">
        <h3 className="soon-title">Arriving next</h3>
        <ul>
          {soon.map((l) => (
            <li key={l.id} title={l.hint}>
              <span>{l.name}</span>
              <span className="soon-phase">P{l.phase}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="legend" aria-label="Map legend">
      <div className="legend-row">
        <span className="swatch swatch-shallow" /> Shallow <small>&lt;70 km</small>
      </div>
      <div className="legend-row">
        <span className="swatch swatch-intermediate" /> Intermediate <small>70–300</small>
      </div>
      <div className="legend-row">
        <span className="swatch swatch-deep" /> Deep <small>300+ km</small>
      </div>
      <div className="legend-sizes" aria-hidden="true">
        {[3, 5, 7].map((m) => (
          <span key={m} className="size-dot" style={{ width: m * 2.6, height: m * 2.6 }} />
        ))}
        <small>size = magnitude · ring = last hour</small>
      </div>
    </div>
  );
}

/* ───────────── Narration feed ───────────── */

interface NarrationProps {
  quakes: Quake[];
  selectedId: string | null;
  onPick: (q: Quake) => void;
  state: FeedState;
  windowLabel: string;
}

export function Narration({ quakes, selectedId, onPick, state, windowLabel }: NarrationProps) {
  const now = useNow(15_000);
  const strongest = quakes.reduce<Quake | null>((a, q) => (!a || q.mag > a.mag ? q : a), null);
  return (
    <section className="panel panel-feed" aria-labelledby="feed-title">
      <h2 id="feed-title" className="panel-title">
        <span className="panel-title-deva" lang="sa">वाचन</span> Sanjaya narrates
      </h2>
      <p className="feed-summary">
        {state === "loading" && quakes.length === 0 ? (
          "Looking across the world…"
        ) : quakes.length === 0 ? (
          `No tremors match these filters in the last ${windowLabel}.`
        ) : (
          <>
            <strong>{quakes.length}</strong> tremors in the last {windowLabel}.
            {strongest && (
              <>
                {" "}Strongest: <strong>M{strongest.mag.toFixed(1)}</strong>, {strongest.place}.
              </>
            )}
          </>
        )}
      </p>
      <ol className="feed-list">
        {quakes.slice(0, 120).map((q) => (
          <li key={q.id}>
            <button
              className={`feed-item band-${depthBand(q.depth)} ${q.id === selectedId ? "is-selected" : ""}`}
              onClick={() => onPick(q)}
            >
              <span className="feed-mag">{q.mag.toFixed(1)}</span>
              <span className="feed-text">
                <span className="feed-time">{timeAgo(q.time, now)}</span>
                {narrate(q)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ───────────── Sighting card (selected quake) ───────────── */

const SOURCE_NAMES: Record<QuakeSource, string> = { USGS: "USGS", EMSC: "EMSC" };

export function Sighting({ quake, onClose }: { quake: Quake; onClose: () => void }) {
  const now = useNow(15_000);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const band = depthBand(quake.depth);
  return (
    <aside className={`sighting band-${band}`} aria-label={`Earthquake M${quake.mag.toFixed(1)}, ${quake.place}`}>
      <button className="sighting-close" onClick={onClose} aria-label="Close details">×</button>
      <div className="sighting-mag">
        <span className="sighting-m">M</span>
        {quake.mag.toFixed(1)}
      </div>
      <div className="sighting-body">
        <p className="sighting-kicker">{timeAgo(quake.time, now)} · {band} quake</p>
        <h3 className="sighting-place">{quake.place}</h3>
        {quake.tsunami && <p className="sighting-warn">Tsunami bulletin issued. Check official warnings.</p>}
        <dl className="sighting-grid">
          <div><dt>Depth</dt><dd>{Math.round(quake.depth)} km</dd></div>
          <div><dt>India time</dt><dd>{formatIst(quake.time)}</dd></div>
          <div><dt>UTC</dt><dd>{formatUtc(quake.time)}</dd></div>
          <div>
            <dt>Position</dt>
            <dd>{Math.abs(quake.lat).toFixed(2)}°{quake.lat >= 0 ? "N" : "S"} {Math.abs(quake.lon).toFixed(2)}°{quake.lon >= 0 ? "E" : "W"}</dd>
          </div>
          {quake.magType && <div><dt>Scale</dt><dd>{quake.magType}</dd></div>}
          {quake.felt !== null && <div><dt>Felt reports</dt><dd>{quake.felt}</dd></div>}
          {quake.alert && <div><dt>Impact alert</dt><dd className={`alert alert-${quake.alert}`}>{quake.alert}</dd></div>}
        </dl>
        <p className="sighting-sources">
          Seen by{" "}
          {quake.sources.map((s, i) => (
            <span key={s}>
              {i > 0 && " + "}
              <a href={quake.links[s]} target="_blank" rel="noreferrer">{SOURCE_NAMES[s]} ↗</a>
            </span>
          ))}
        </p>
      </div>
    </aside>
  );
}
