"use client";

// Detail cards for whatever is selected on the globe. They share one frame.
import { useEffect, useState } from "react";
import Glyph from "./Glyph";
import { useNow } from "./Panels";
import { depthBand, type Quake, type QuakeSource } from "@/lib/quakes";
import { DISASTER_TYPES, type Disaster, type Fire } from "@/lib/hazards";
import { SAT_GROUPS, satState, type Sat } from "@/lib/satellites";
import { formatIst, formatUtc, timeAgo } from "@/lib/time";

type Tone = "shallow" | "intermediate" | "deep" | "brass" | "jade";

function Card(p: { tone: Tone; label: string; big: React.ReactNode; kicker: string; title: string; onClose: () => void; children: React.ReactNode }) {
  const { onClose } = p;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside className={`sighting band-${p.tone}`} aria-label={p.label}>
      <button className="sighting-close" onClick={p.onClose} aria-label="Close details">×</button>
      <div className="sighting-mag">{p.big}</div>
      <div className="sighting-body">
        <p className="sighting-kicker">{p.kicker}</p>
        <h3 className="sighting-place">{p.title}</h3>
        {p.children}
      </div>
    </aside>
  );
}

const Row = ({ k, v, className }: { k: string; v: React.ReactNode; className?: string }) => (
  <div>
    <dt>{k}</dt>
    <dd className={className}>{v}</dd>
  </div>
);

const pos = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer">{children} ↗</a>
);

/* ───────── Earthquake ───────── */

const SOURCE_NAMES: Record<QuakeSource, string> = { USGS: "USGS", EMSC: "EMSC" };

export function QuakeCard({ quake, onClose }: { quake: Quake; onClose: () => void }) {
  const now = useNow(15_000);
  const band = depthBand(quake.depth);
  return (
    <Card
      tone={band}
      label={`Earthquake M${quake.mag.toFixed(1)}, ${quake.place}`}
      big={<><span className="sighting-m">M</span>{quake.mag.toFixed(1)}</>}
      kicker={`${now ? timeAgo(quake.time, now) : ""} · ${band} quake`}
      title={quake.place}
      onClose={onClose}
    >
      {quake.tsunami && <p className="sighting-warn">Tsunami bulletin issued. Check official warnings.</p>}
      <dl className="sighting-grid">
        <Row k="Depth" v={`${Math.round(quake.depth)} km`} />
        <Row k="India time" v={formatIst(quake.time)} />
        <Row k="UTC" v={formatUtc(quake.time)} />
        <Row k="Position" v={pos(quake.lat, quake.lon)} />
        {quake.magType && <Row k="Scale" v={quake.magType} />}
        {quake.felt !== null && <Row k="Felt reports" v={quake.felt} />}
        {quake.alert && <Row k="Impact alert" v={quake.alert} className={`alert alert-${quake.alert}`} />}
      </dl>
      <p className="sighting-sources">
        Seen by{" "}
        {quake.sources.map((s, i) => (
          <span key={s}>
            {i > 0 && " + "}
            <Ext href={quake.links[s]!}>{SOURCE_NAMES[s]}</Ext>
          </span>
        ))}
      </p>
    </Card>
  );
}

/* ───────── Satellite ───────── */

export function SatCard({ sat, onClose }: { sat: Sat; onClose: () => void }) {
  const now = useNow(1000);
  const st = now ? satState(sat.rec, new Date(now)) : null;
  const group = SAT_GROUPS.find((g) => g.id === sat.group)!;
  return (
    <Card
      tone={sat.group === "isro" ? "intermediate" : sat.group === "gnss" ? "deep" : sat.group === "weather" ? "jade" : "brass"}
      label={`Satellite ${sat.name}`}
      big={<><span className="sighting-alt">{st ? Math.round(st.altKm).toLocaleString("en-IN") : "—"}</span><span className="sighting-unit">km up</span></>}
      kicker={`${group.name} · NORAD ${sat.norad}`}
      title={sat.name}
      onClose={onClose}
    >
      <dl className="sighting-grid">
        <Row k="Speed" v={st ? `${st.speedKms.toFixed(2)} km/s` : "—"} />
        <Row k="One orbit" v={`${Math.round(sat.periodMin)} min`} />
        <Row k="Inclination" v={`${sat.inclination.toFixed(1)}°`} />
        <Row k="Now over" v={st ? pos(st.lat, st.lon) : "—"} />
        {sat.launchYear && <Row k="Launched" v={sat.launchYear} />}
        <Row k="Orbit data" v={now ? timeAgo(sat.epoch, now) : "—"} />
      </dl>
      <p className="sighting-sources">
        Orbit from <Ext href="https://celestrak.org/">CelesTrak</Ext> · <Ext href={`https://www.n2yo.com/satellite/?s=${sat.norad}`}>Track on N2YO</Ext>
      </p>
    </Card>
  );
}

/* ───────── Disaster ───────── */

const ALERT_TONE = { Red: "shallow", Orange: "intermediate", Green: "jade" } as const;
const typeName = (t: string) => DISASTER_TYPES.find((d) => d.id === t)?.name.replace(/s$/, "") ?? "Event";

export function DisasterCard({ d, onClose }: { d: Disaster; onClose: () => void }) {
  return (
    <Card
      tone={ALERT_TONE[d.alert]}
      label={`${d.name}, ${d.alert} alert`}
      big={<Glyph name={d.type} size={56} />}
      kicker={`${typeName(d.type)} · ${d.alert} alert`}
      title={d.name}
      onClose={onClose}
    >
      <dl className="sighting-grid">
        {d.country && <Row k="Where" v={d.country} />}
        <Row k="Started" v={formatIst(d.from)} />
        <Row k="Last update" v={formatIst(d.to)} />
        {d.severity && <Row k="Severity" v={d.severity} />}
        <Row k="Position" v={pos(d.lat, d.lon)} />
      </dl>
      <p className="sighting-sources">
        Alert from <Ext href={d.url}>GDACS report</Ext> (UN and European Commission)
      </p>
    </Card>
  );
}

/* ───────── Wildfire ───────── */

export function FireCard({ f, onClose }: { f: Fire; onClose: () => void }) {
  const now = useNow(30_000);
  const [lon, lat, frp, conf, t, day] = f;
  return (
    <Card
      tone="shallow"
      label="Wildfire hotspot"
      big={<><span className="sighting-alt">{Math.round(frp)}</span><span className="sighting-unit">MW</span></>}
      kicker={`${now ? timeAgo(t, now) : ""} · seen by satellite at ${day ? "day" : "night"}`}
      title="Active fire hotspot"
      onClose={onClose}
    >
      <dl className="sighting-grid">
        <Row k="Fire power" v={`${frp.toFixed(1)} MW`} />
        <Row k="Confidence" v={`${conf}%`} />
        <Row k="India time" v={formatIst(t)} />
        <Row k="Position" v={pos(lat, lon)} />
      </dl>
      <p className="sighting-sources">
        Detected by NASA MODIS · <Ext href={`https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lon},${lat},9z`}>Open in FIRMS</Ext>
      </p>
    </Card>
  );
}

/* ───────── Undersea cable ───────── */

interface CableDetails {
  name: string;
  length: string | null;
  rfs: string | null;
  owners: string | null;
  url: string | null;
  landings: string[];
}

export function CableCard({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const [c, setC] = useState<CableDetails | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/cables?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setC(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  const shown = c?.landings.slice(0, 6) ?? [];
  const more = (c?.landings.length ?? 0) - shown.length;
  return (
    <Card tone="brass" label={`Undersea cable ${name}`} big={<Glyph name="CABLE" size={56} />} kicker="Undersea internet cable" title={name} onClose={onClose}>
      {!c ? (
        <p className="sighting-sources">Loading details…</p>
      ) : (
        <>
          <dl className="sighting-grid">
            {c.length && <Row k="Length" v={c.length} />}
            {c.rfs && <Row k="In service" v={c.rfs} />}
            <Row k="Landings" v={c.landings.length} />
          </dl>
          {shown.length > 0 && (
            <p className="sighting-list">
              {shown.join(" · ")}
              {more > 0 && ` · and ${more} more`}
            </p>
          )}
          {c.owners && <p className="sighting-list sighting-owners">Owners: {c.owners}</p>}
        </>
      )}
      <p className="sighting-sources">
        Map data © <Ext href={`https://www.submarinecablemap.com/submarine-cable/${id}`}>TeleGeography</Ext>
      </p>
    </Card>
  );
}
