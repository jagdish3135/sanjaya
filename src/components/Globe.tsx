"use client";

import { useEffect, useRef } from "react";
import { Map as MLMap, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Served from public/ (copied there by scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
import { buildStyle, PALETTE } from "./mapStyle";
import type { Quake } from "@/lib/quakes";

export interface FlyTarget {
  lon: number;
  lat: number;
  zoom: number;
  key: number; // changes on every request so the same place can be revisited
}

interface Props {
  quakes: Quake[];
  visible: boolean;
  selectedId: string | null;
  flyTarget: FlyTarget | null;
  onSelect: (id: string | null) => void;
  onBearing: (deg: number) => void;
}

export const INDIA_VIEW = { lon: 79, lat: 21.5 };

const RECENT_MS = 60 * 60_000;
const QUAKE_LAYERS = ["quakes-glow", "quakes", "quakes-pulse", "quakes-selected", "quakes-label"];

// Radius by magnitude, then scaled up a little as you zoom in.
const MAG_RADIUS = [
  "interpolate", ["exponential", 1.6], ["get", "mag"],
  2.5, 2.4, 4, 4.5, 5, 7.5, 6, 12, 7, 19, 8, 28,
] as const;
const radius = (k: number, add = 0) => [
  "interpolate", ["linear"], ["zoom"],
  1, ["+", add, ["*", 0.85 * k, MAG_RADIUS]],
  6, ["+", add, ["*", 1.5 * k, MAG_RADIUS]],
];
const DEPTH_COLOR = [
  "step", ["get", "depth"],
  PALETTE.shallow, 70, PALETTE.intermediate, 300, PALETTE.deep,
] as const;

function toGeoJSON(quakes: Quake[], now: number): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: quakes.map((q) => ({
      type: "Feature",
      id: q.id,
      properties: {
        id: q.id,
        mag: q.mag,
        depth: q.depth,
        recent: now - q.time < RECENT_MS,
        label: q.mag >= 5 ? q.mag.toFixed(1) : "",
      },
      geometry: { type: "Point", coordinates: [q.lon, q.lat] },
    })),
  };
}

export default function Globe({ quakes, visible, selectedId, flyTarget, onSelect, onBearing }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const latest = useRef({ quakes, visible, selectedId, onSelect, onBearing });
  latest.current = { quakes, visible, selectedId, onSelect, onBearing };

  // Create the map once.
  useEffect(() => {
    if (!box.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.innerWidth < 820;

    const map = new MLMap({
      container: box.current,
      style: buildStyle(),
      center: reduceMotion ? [INDIA_VIEW.lon, INDIA_VIEW.lat] : [INDIA_VIEW.lon - 70, 12],
      zoom: narrow ? 1.15 : 1.75,
      attributionControl: { compact: true, customAttribution: "Quakes: USGS · EMSC" },
      maxPitch: 60,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");

    map.on("load", () => {
      map.addSource("quakes", { type: "geojson", data: toGeoJSON([], Date.now()) });
      map.addLayer({
        id: "quakes-glow",
        type: "circle",
        source: "quakes",
        paint: {
          "circle-radius": radius(2.4) as never,
          "circle-color": DEPTH_COLOR as never,
          "circle-blur": 1,
          "circle-opacity": 0.22,
        },
      });
      map.addLayer({
        id: "quakes",
        type: "circle",
        source: "quakes",
        paint: {
          "circle-radius": radius(1) as never,
          "circle-color": DEPTH_COLOR as never,
          "circle-opacity": 0.9,
          "circle-stroke-color": "rgba(239, 230, 210, 0.55)",
          "circle-stroke-width": 0.6,
        },
      });
      map.addLayer({
        id: "quakes-pulse",
        type: "circle",
        source: "quakes",
        filter: ["==", ["get", "recent"], true],
        paint: {
          "circle-radius": radius(1) as never,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": DEPTH_COLOR as never,
          "circle-stroke-width": 1.4,
          "circle-stroke-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "quakes-selected",
        type: "circle",
        source: "quakes",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": radius(1, 7) as never,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#e9c46a",
          "circle-stroke-width": 1.6,
        },
      });
      map.addLayer({
        id: "quakes-label",
        type: "symbol",
        source: "quakes",
        minzoom: 2.2,
        filter: ["!=", ["get", "label"], ""],
        layout: {
          "text-field": ["concat", "M", ["get", "label"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-offset": [0, 1.6],
          "text-letter-spacing": 0.08,
        },
        paint: { "text-color": "#efe6d2", "text-halo-color": "rgba(8,9,18,0.9)", "text-halo-width": 1.2 },
      });

      ready.current = true;
      syncData();
      syncSelection();

      if (!reduceMotion) {
        map.easeTo({ center: [INDIA_VIEW.lon, INDIA_VIEW.lat], duration: 2800, easing: (t) => 1 - (1 - t) ** 3 });
      }
    });

    map.on("click", "quakes", (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") latest.current.onSelect(id);
    });
    map.on("click", (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ["quakes"] });
      if (hits.length === 0) latest.current.onSelect(null);
    });
    map.on("mouseenter", "quakes", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "quakes", () => (map.getCanvas().style.cursor = ""));
    map.on("rotate", () => latest.current.onBearing(map.getBearing()));

    // Pulse the rings of quakes from the last hour.
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!ready.current || t - last < 40) return;
      last = t;
      const p = (t % 2200) / 2200;
      map.setPaintProperty("quakes-pulse", "circle-radius", ["*", 1 + p * 2.6, MAG_RADIUS] as never);
      map.setPaintProperty("quakes-pulse", "circle-stroke-opacity", 0.85 * (1 - p));
    };
    if (!reduceMotion) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ready.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function syncData() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("quakes") as GeoJSONSource).setData(toGeoJSON(latest.current.quakes, Date.now()));
    for (const id of QUAKE_LAYERS) {
      map.setLayoutProperty(id, "visibility", latest.current.visible ? "visible" : "none");
    }
  }

  function syncSelection() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    map.setFilter("quakes-selected", ["==", ["get", "id"], latest.current.selectedId ?? ""]);
  }

  useEffect(syncData, [quakes, visible]);
  useEffect(syncSelection, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: flyTarget.zoom,
      speed: 0.9,
      curve: 1.5,
      animate: !reduceMotion,
      essential: false,
    });
  }, [flyTarget]);

  return <div ref={box} className="globe" role="region" aria-label="Interactive globe showing live earthquakes" />;
}
