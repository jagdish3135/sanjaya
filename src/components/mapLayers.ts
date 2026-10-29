// Every data layer on the globe: sources, style layers, and GeoJSON builders.
// Added in stacking order: rain, night, cables, fires, wind, disasters, quakes, satellites.
import type { ExpressionSpecification, GeoJSONSource, Map as MLMap } from "maplibre-gl";
import { PALETTE } from "./mapStyle";
import { addIcons } from "./icons";
import type { Quake } from "@/lib/quakes";
import type { Disaster, Fire, WindPoint } from "@/lib/hazards";
import { nightPolygon, subsolarPoint, terminatorLine } from "@/lib/sun";

export type LayerId = "earthquakes" | "satellites" | "daynight" | "disasters" | "fires" | "weather" | "cables";
export type SelectionKind = "quake" | "sat" | "disaster" | "fire" | "cable";
export interface Selection {
  kind: SelectionKind;
  id: string;
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT = ["Noto Sans Regular"];
const BEFORE_LABELS = "label-country"; // raster and night shade sit under place names

/** Style layers belonging to each toggle. */
export const STYLE_LAYERS: Record<LayerId, string[]> = {
  weather: ["rain", "wind-arrows", "wind-labels"],
  daynight: ["day", "night", "terminator", "sun-glow", "sun"],
  cables: ["cables", "cable-landings", "cable-selected"],
  fires: ["fires-heat", "fires", "fires-selected"],
  disasters: ["disasters-disc", "disasters-icon", "disasters-selected"],
  earthquakes: ["quakes-glow", "quakes", "quakes-pulse", "quakes-selected", "quakes-label"],
  satellites: ["sat-track", "sats", "sat-labels", "sat-selected"],
};

/** Clickable layers, first match wins. */
export const CLICK_TARGETS: { layer: string; kind: SelectionKind }[] = [
  { layer: "sats", kind: "sat" },
  { layer: "quakes", kind: "quake" },
  { layer: "disasters-disc", kind: "disaster" },
  { layer: "fires", kind: "fire" },
  { layer: "cables", kind: "cable" },
];

/** Which selection layer highlights which kind. */
export const SELECTED_LAYER: Record<SelectionKind, string> = {
  quake: "quakes-selected",
  sat: "sat-selected",
  disaster: "disasters-selected",
  fire: "fires-selected",
  cable: "cable-selected",
};

/* ───────── Shared expressions ───────── */

export const MAG_RADIUS: ExpressionSpecification = [
  "interpolate", ["exponential", 1.6], ["get", "mag"],
  2.5, 2.4, 4, 4.5, 5, 7.5, 6, 12, 7, 19, 8, 28,
];
const quakeRadius = (k: number, add = 0): ExpressionSpecification => [
  "interpolate", ["linear"], ["zoom"],
  1, ["+", add, ["*", 0.85 * k, MAG_RADIUS]],
  6, ["+", add, ["*", 1.5 * k, MAG_RADIUS]],
];
const DEPTH_COLOR: ExpressionSpecification = [
  "step", ["get", "depth"], PALETTE.shallow, 70, PALETTE.intermediate, 300, PALETTE.deep,
];
export const ALERT_COLOR: ExpressionSpecification = [
  "match", ["get", "alert"], "Red", PALETTE.shallow, "Orange", PALETTE.intermediate, PALETTE.jade,
];
export const SAT_COLOR: ExpressionSpecification = [
  "match", ["get", "group"],
  "stations", "#fff4d6", "isro", PALETTE.intermediate, "gnss", PALETTE.deep, "weather", PALETTE.jade,
  "rgba(239, 230, 210, 0.6)",
];

/* ───────── Setup ───────── */

export function addDataLayers(map: MLMap) {
  addIcons(map);
  const src = (id: string, extra: object = {}) => map.addSource(id, { type: "geojson", data: EMPTY, ...extra });

  // Rain: NASA GIBS, GPM IMERG precipitation rate, latest 30-minute image.
  map.addSource("rain", {
    type: "raster",
    tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png"],
    tileSize: 256,
    maxzoom: 6,
    attribution: "Rain: NASA GIBS · GPM IMERG",
  });
  map.addLayer({ id: "rain", type: "raster", source: "rain", paint: { "raster-opacity": 0.72, "raster-fade-duration": 300 } }, BEFORE_LABELS);

  // Day and night
  src("day");
  src("night");
  map.addLayer({ id: "day", type: "fill", source: "day", paint: { "fill-color": "#f2c14e", "fill-opacity": 0.07 } }, BEFORE_LABELS);
  src("terminator");
  src("sun");
  map.addLayer({ id: "night", type: "fill", source: "night", paint: { "fill-color": "#02030a", "fill-opacity": 0.55 } }, BEFORE_LABELS);
  map.addLayer({
    id: "terminator", type: "line", source: "terminator",
    paint: { "line-color": "rgba(233, 196, 106, 0.22)", "line-width": 16, "line-blur": 14 },
  }, BEFORE_LABELS);
  map.addLayer({ id: "sun-glow", type: "circle", source: "sun", paint: { "circle-radius": 22, "circle-color": "#f2c14e", "circle-opacity": 0.25, "circle-blur": 1 } });
  map.addLayer({
    id: "sun", type: "circle", source: "sun",
    paint: { "circle-radius": 6, "circle-color": "#f6d27a", "circle-stroke-color": "#fff4d6", "circle-stroke-width": 1 },
  });

  // Undersea cables
  src("cables", { promoteId: "id" });
  src("cable-landings");
  map.addLayer({
    id: "cables", type: "line", source: "cables",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": PALETTE.cable, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.7, 6, 1.6] },
  });
  map.addLayer({
    id: "cable-selected", type: "line", source: "cables", filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#efe6d2", "line-width": 2.6 },
  });
  map.addLayer({
    id: "cable-landings", type: "circle", source: "cable-landings", minzoom: 2.5,
    paint: { "circle-radius": 2, "circle-color": PALETTE.brass, "circle-opacity": 0.8 },
  });

  // Wildfires: a heatmap far out, single hotspots up close.
  src("fires");
  map.addLayer({
    id: "fires-heat", type: "heatmap", source: "fires", maxzoom: 5,
    paint: {
      "heatmap-weight": ["interpolate", ["linear"], ["get", "frp"], 0, 0.15, 50, 0.6, 300, 1],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 5, 2],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 3, 5, 14],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 3.5, 0.9, 5, 0],
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(0,0,0,0)", 0.2, "rgba(242, 163, 58, 0.35)", 0.5, "rgba(242, 120, 40, 0.75)", 0.8, "#e8432a", 1, "#ffe9b0",
      ],
    },
  });
  map.addLayer({
    id: "fires", type: "circle", source: "fires", minzoom: 3.5,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 0, 2.5, 100, 5, 500, 9],
      "circle-color": ["interpolate", ["linear"], ["get", "frp"], 0, "#f2a33a", 80, "#e8432a", 400, "#ffe9b0"],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3.5, 0, 4.5, 0.9],
    },
  });
  map.addLayer({
    id: "fires-selected", type: "circle", source: "fires", filter: ["==", ["get", "id"], ""],
    paint: { "circle-radius": 11, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#e9c46a", "circle-stroke-width": 1.6 },
  });

  // Wind
  src("wind");
  map.addLayer({
    id: "wind-arrows", type: "symbol", source: "wind",
    layout: {
      "icon-image": "ico-arrow",
      "icon-rotate": ["+", ["get", "dir"], 180], // direction is where wind comes from
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-size": ["interpolate", ["linear"], ["get", "speed"], 0, 0.45, 30, 0.75, 80, 1.1],
    },
    paint: {
      "icon-color": ["interpolate", ["linear"], ["get", "speed"], 0, PALETTE.deep, 15, PALETTE.jade, 30, PALETTE.intermediate, 60, PALETTE.shallow],
      "icon-opacity": 0.85,
    },
  });
  map.addLayer({
    id: "wind-labels", type: "symbol", source: "wind", minzoom: 3.2,
    layout: { "text-field": ["concat", ["to-string", ["round", ["get", "speed"]]], " km/h"], "text-font": FONT, "text-size": 9, "text-offset": [0, 1.6] },
    paint: { "text-color": "rgba(239,230,210,0.7)", "text-halo-color": PALETTE.halo, "text-halo-width": 1 },
  });

  // Disasters (GDACS)
  src("disasters");
  map.addLayer({
    id: "disasters-disc", type: "circle", source: "disasters",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["match", ["get", "alert"], "Red", 11, "Orange", 9, 7], 6, ["match", ["get", "alert"], "Red", 17, "Orange", 15, 12]],
      "circle-color": ALERT_COLOR,
      "circle-opacity": 0.92,
      "circle-stroke-color": "rgba(7, 8, 15, 0.9)",
      "circle-stroke-width": 1.5,
    },
  });
  map.addLayer({
    id: "disasters-icon", type: "symbol", source: "disasters",
    layout: {
      "icon-image": ["concat", "ico-", ["get", "type"]],
      "icon-allow-overlap": true,
      "icon-size": ["interpolate", ["linear"], ["zoom"], 1, ["match", ["get", "alert"], "Red", 0.75, "Orange", 0.62, 0.5], 6, 1],
    },
    paint: { "icon-color": "#07080f" },
  });
  map.addLayer({
    id: "disasters-selected", type: "circle", source: "disasters", filter: ["==", ["get", "id"], ""],
    paint: { "circle-radius": 22, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#e9c46a", "circle-stroke-width": 1.6 },
  });

  // Earthquakes
  src("quakes");
  map.addLayer({
    id: "quakes-glow", type: "circle", source: "quakes",
    paint: { "circle-radius": quakeRadius(2.4), "circle-color": DEPTH_COLOR, "circle-blur": 1, "circle-opacity": 0.22 },
  });
  map.addLayer({
    id: "quakes", type: "circle", source: "quakes",
    paint: {
      "circle-radius": quakeRadius(1), "circle-color": DEPTH_COLOR, "circle-opacity": 0.9,
      "circle-stroke-color": "rgba(239, 230, 210, 0.55)", "circle-stroke-width": 0.6,
    },
  });
  map.addLayer({
    id: "quakes-pulse", type: "circle", source: "quakes", filter: ["==", ["get", "recent"], true],
    paint: {
      "circle-radius": quakeRadius(1), "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": DEPTH_COLOR, "circle-stroke-width": 1.4, "circle-stroke-opacity": 0.8,
    },
  });
  map.addLayer({
    id: "quakes-selected", type: "circle", source: "quakes", filter: ["==", ["get", "id"], ""],
    paint: { "circle-radius": quakeRadius(1, 7), "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#e9c46a", "circle-stroke-width": 1.6 },
  });
  map.addLayer({
    id: "quakes-label", type: "symbol", source: "quakes", minzoom: 2.2, filter: ["!=", ["get", "label"], ""],
    layout: { "text-field": ["concat", "M", ["get", "label"]], "text-font": FONT, "text-size": 10, "text-offset": [0, 1.6], "text-letter-spacing": 0.08 },
    paint: { "text-color": "#efe6d2", "text-halo-color": "rgba(8,9,18,0.9)", "text-halo-width": 1.2 },
  });

  // Satellites (positions are pushed in by Globe every second or two)
  src("sats");
  src("sat-track");
  map.addLayer({
    id: "sat-track", type: "line", source: "sat-track",
    paint: { "line-color": "rgba(239, 230, 210, 0.55)", "line-width": 1.2, "line-dasharray": [3, 3] },
  });
  map.addLayer({
    id: "sats", type: "circle", source: "sats",
    paint: {
      "circle-radius": ["match", ["get", "group"], "stations", 4.5, "starlink", 1.4, 2.6],
      "circle-color": SAT_COLOR,
      "circle-stroke-color": "rgba(7, 8, 15, 0.8)",
      "circle-stroke-width": ["match", ["get", "group"], "starlink", 0, 0.8],
    },
  });
  map.addLayer({
    id: "sat-labels", type: "symbol", source: "sats",
    // ISS and Tiangong always; other stations and ISRO satellites once zoomed in.
    filter: ["any", ["in", ["get", "short"], ["literal", ["ISS", "CSS"]]], ["all", ["in", ["get", "group"], ["literal", ["stations", "isro"]]], [">=", ["zoom"], 3.2]]],
    layout: { "text-field": ["get", "short"], "text-font": FONT, "text-size": 9.5, "text-offset": [0, 1.2], "text-anchor": "top", "text-letter-spacing": 0.06 },
    paint: { "text-color": SAT_COLOR, "text-halo-color": PALETTE.halo, "text-halo-width": 1.2 },
  });
  map.addLayer({
    id: "sat-selected", type: "circle", source: "sats", filter: ["==", ["get", "id"], ""],
    paint: { "circle-radius": 9, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#e9c46a", "circle-stroke-width": 1.6 },
  });
}

/* ───────── Data → GeoJSON ───────── */

export function setSource(map: MLMap, id: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

const point = (lon: number, lat: number, properties: Record<string, unknown>, id?: string | number): GeoJSON.Feature => ({
  type: "Feature", id, properties, geometry: { type: "Point", coordinates: [lon, lat] },
});
const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

export function quakesGeo(quakes: Quake[], now: number) {
  return collection(quakes.map((q) => point(q.lon, q.lat, {
    id: q.id, mag: q.mag, depth: q.depth, recent: now - q.time < 3_600_000, label: q.mag >= 5 ? q.mag.toFixed(1) : "",
  })));
}

export function disastersGeo(list: Disaster[]) {
  return collection(list.map((d) => point(d.lon, d.lat, { id: d.id, type: d.type, alert: d.alert })));
}

export const fireId = (f: Fire) => `${f[0]},${f[1]},${f[4]}`;
export function firesGeo(list: Fire[]) {
  return collection(list.map((f, i) => point(f[0], f[1], { id: fireId(f), frp: f[2] }, i)));
}

export function windGeo(list: WindPoint[]) {
  return collection(list.map(([lon, lat, speed, dir]) => point(lon, lat, { speed, dir })));
}

export function setDayNight(map: MLMap, date: Date) {
  setSource(map, "day", nightPolygon(date, 2, true));
  setSource(map, "night", nightPolygon(date));
  setSource(map, "terminator", terminatorLine(date));
  const sun = subsolarPoint(date);
  setSource(map, "sun", point(sun.lon, sun.lat, {}));
}
