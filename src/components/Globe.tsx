"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MLMap, NavigationControl, setWorkerUrl, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildStyle } from "./mapStyle";
import {
  CLICK_TARGETS, MAG_RADIUS, SELECTED_LAYER, STYLE_LAYERS,
  addDataLayers, disastersGeo, firesGeo, quakesGeo, setDayNight, setSource, windGeo,
  type LayerId, type Selection, type SelectionKind,
} from "./mapLayers";
import type { Quake } from "@/lib/quakes";
import type { Disaster, Fire, WindPoint } from "@/lib/hazards";
import { groundTrack, satState, type Sat } from "@/lib/satellites";

// Served from public/ (copied there by scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export interface FlyTarget {
  lon: number;
  lat: number;
  zoom: number;
  key: number; // changes on every request so the same place can be revisited
}

export interface CableData {
  cables: GeoJSON.FeatureCollection;
  landings: GeoJSON.FeatureCollection;
}

export interface GlobeData {
  quakes: Quake[];
  disasters: Disaster[];
  fires: Fire[];
  wind: WindPoint[];
  cables: CableData | null;
  sats: Sat[];
}

interface Props {
  data: GlobeData;
  visible: Record<LayerId, boolean>;
  weather: { rain: boolean; wind: boolean };
  selection: Selection | null;
  flyTarget: FlyTarget | null;
  onSelect: (sel: Selection | null) => void;
  onBearing: (deg: number) => void;
}

export const INDIA_VIEW = { lon: 79, lat: 21.5 };

export default function Globe({ data, visible, weather, selection, flyTarget, onSelect, onBearing }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  // Turns 1 once the map has loaded, so the data effects below run again then.
  const [readyTick, setReadyTick] = useState(0);
  const latest = useRef({ data, visible, selection, onSelect, onBearing });
  latest.current = { data, visible, selection, onSelect, onBearing };

  // Create the map once.
  useEffect(() => {
    if (!box.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.innerWidth < 820;
    let ready = false;

    const map = new MLMap({
      container: box.current,
      style: buildStyle(),
      center: reduceMotion ? [INDIA_VIEW.lon, INDIA_VIEW.lat] : [INDIA_VIEW.lon - 70, 12],
      zoom: narrow ? 1.15 : 1.75,
      attributionControl: {
        compact: true,
        customAttribution: "Quakes: USGS · EMSC | Orbits: CelesTrak | Disasters: GDACS | Fires: NASA FIRMS | Wind: Open-Meteo | Cables: TeleGeography | India boundary: DataMeet (Survey of India)",
      },
      maxPitch: 60,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    // Lets browser tests find features on the map; left out of production builds.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __sanjayaMap: MLMap }).__sanjayaMap = map;

    map.on("load", () => {
      addDataLayers(map);
      ready = true;
      setReadyTick(1);
      if (narrow) map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      if (!reduceMotion) {
        map.easeTo({ center: [INDIA_VIEW.lon, INDIA_VIEW.lat], duration: 2800, easing: (t) => 1 - (1 - t) ** 3 });
      }
    });

    // Clicks pick the top-most thing under the pointer; empty space clears the selection.
    // Exactly under the pointer first, then a few pixels around it (small dots are hard to hit).
    const hitAt = (e: MapMouseEvent) => {
      for (const pad of [0, 6]) {
        const bbox: [[number, number], [number, number]] = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
        for (const t of CLICK_TARGETS) {
          if (!map.getLayer(t.layer)) continue;
          const hits = map.queryRenderedFeatures(bbox, { layers: [t.layer] });
          // Docked capsules and modules sit on the station; pick the station itself.
          const hit = hits.find((h) => h.properties?.short === "ISS" || h.properties?.short === "CSS") ?? hits[0];
          const id = hit?.properties?.id;
          if (id !== undefined) return { kind: t.kind, id: String(id) };
        }
      }
      return null;
    };
    map.on("click", (e) => ready && latest.current.onSelect(hitAt(e)));
    map.on("mousemove", (e) => {
      if (ready) map.getCanvas().style.cursor = hitAt(e) ? "pointer" : "";
    });
    map.on("rotate", () => latest.current.onBearing(map.getBearing()));

    // One animation loop: pulse recent quakes, and move satellites a chunk at a time
    // so thousands of orbits never freeze the page.
    let raf = 0;
    let lastPulse = 0;
    let satList: Sat[] = [];
    let satFeatures: (GeoJSON.Feature | null)[] = [];
    let satIdx = 0;
    let lastPush = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!ready) return;
      const { visible: vis, data: d } = latest.current;

      if (!reduceMotion && vis.earthquakes && t - lastPulse > 40) {
        lastPulse = t;
        const p = (t % 2200) / 2200;
        map.setPaintProperty("quakes-pulse", "circle-radius", ["*", 1 + p * 2.6, MAG_RADIUS]);
        map.setPaintProperty("quakes-pulse", "circle-stroke-opacity", 0.85 * (1 - p));
      }

      if (d.sats !== satList) {
        satList = d.sats;
        satFeatures = new Array(satList.length).fill(null);
        satIdx = 0;
        lastPush = 0;
        if (satList.length === 0) setSource(map, "sats", { type: "FeatureCollection", features: [] });
      }
      if (vis.satellites && satList.length) {
        const now = new Date();
        const end = Math.min(satList.length, satIdx + 1200);
        for (; satIdx < end; satIdx++) {
          const s = satList[satIdx];
          const st = satState(s.rec, now);
          satFeatures[satIdx] = st && {
            type: "Feature",
            properties: { id: s.id, group: s.group, short: s.short },
            geometry: { type: "Point", coordinates: [st.lon, st.lat] },
          };
        }
        if (satIdx >= satList.length) {
          satIdx = 0;
          const every = satList.length > 3000 ? 2000 : 1000;
          if (t - lastPush > every) {
            lastPush = t;
            // Draw the ISS and Tiangong last, on top of the capsules docked to them, so a click picks the station.
            const features = satFeatures.filter((f): f is GeoJSON.Feature => !!f);
            const isStation = (f: GeoJSON.Feature) => f.properties?.short === "ISS" || f.properties?.short === "CSS";
            setSource(map, "sats", { type: "FeatureCollection", features: [...features.filter((f) => !isStation(f)), ...features.filter(isStation)] });
          }
        }
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const mapIfReady = () => (readyTick ? mapRef.current : null);

  useEffect(() => {
    const m = mapIfReady();
    if (m) setSource(m, "quakes", quakesGeo(data.quakes, Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.quakes, readyTick]);
  useEffect(() => {
    const m = mapIfReady();
    if (m) setSource(m, "disasters", disastersGeo(data.disasters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.disasters, readyTick]);
  useEffect(() => {
    const m = mapIfReady();
    if (m) setSource(m, "fires", firesGeo(data.fires));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.fires, readyTick]);
  useEffect(() => {
    const m = mapIfReady();
    if (m) setSource(m, "wind", windGeo(data.wind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.wind, readyTick]);
  useEffect(() => {
    const m = mapIfReady();
    if (!m || !data.cables) return;
    setSource(m, "cables", data.cables.cables);
    setSource(m, "cable-landings", data.cables.landings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.cables, readyTick]);

  // Layer visibility (weather has two parts).
  useEffect(() => {
    const m = mapIfReady();
    if (!m) return;
    for (const [layer, ids] of Object.entries(STYLE_LAYERS) as [LayerId, string[]][]) {
      for (const id of ids) {
        let on = visible[layer];
        if (id === "rain") on &&= weather.rain;
        if (id.startsWith("wind")) on &&= weather.wind;
        m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, weather.rain, weather.wind, readyTick]);

  // Day and night: redraw now and every minute.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyTick || !visible.daynight) return;
    setDayNight(map, new Date());
    const t = setInterval(() => setDayNight(map, new Date()), 60_000);
    return () => clearInterval(t);
  }, [visible.daynight, readyTick]);

  // Selection rings, plus the ground track of a selected satellite.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyTick) return;
    for (const [kind, layer] of Object.entries(SELECTED_LAYER) as [SelectionKind, string][]) {
      map.setFilter(layer, ["==", ["get", "id"], selection?.kind === kind ? selection.id : ""]);
    }
    const sat = selection?.kind === "sat" ? data.sats.find((s) => s.id === selection.id) : undefined;
    const drawTrack = () =>
      setSource(map, "sat-track", {
        type: "Feature",
        properties: {},
        geometry: { type: "MultiLineString", coordinates: sat ? groundTrack(sat.rec, new Date(), Math.min(sat.periodMin, 200)) : [] },
      });
    drawTrack();
    if (!sat) return;
    const t = setInterval(drawTrack, 60_000);
    return () => clearInterval(t);
  }, [selection, data.sats, readyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo({ center: [flyTarget.lon, flyTarget.lat], zoom: flyTarget.zoom, speed: 0.9, curve: 1.5, animate: !reduceMotion, essential: false });
  }, [flyTarget]);

  return <div ref={box} className="globe" role="region" aria-label="Interactive globe of live world events" />;
}
