import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

// Night-observatory basemap: indigo ocean, warm charcoal land, brass borders,
// faint ivory labels. Built on OpenFreeMap vector tiles (OpenMapTiles schema).

export const PALETTE = {
  ocean: "#0b0f22",
  land: "#1e1b22",
  india: "#2a2219", // warmer and a touch brighter, so India stands out
  indiaLine: "#f2a33a",
  indiaStates: "rgba(242, 193, 120, 0.4)",
  border: "rgba(201, 162, 74, 0.5)",
  borderState: "rgba(201, 162, 74, 0.16)",
  label: "rgba(239, 230, 210, 0.62)",
  labelDim: "rgba(239, 230, 210, 0.38)",
  halo: "rgba(8, 9, 18, 0.85)",
  grid: "rgba(201, 162, 74, 0.10)",
  gridKey: "rgba(226, 69, 43, 0.38)",
  shallow: "#e8432a",
  intermediate: "#f2a33a",
  deep: "#8fb3e8",
  jade: "#7fd1b9",
  brass: "#c9a24a",
  cable: "rgba(201, 162, 74, 0.5)",
};

const FONT = ["Noto Sans Regular"];
const NAME: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name"]];

/** Graticule every 15°, plus the equator and the Tropic of Cancer (it runs through India). */
function graticule(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const line = (coords: number[][], props: Record<string, unknown>) =>
    features.push({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: coords } });

  for (let lon = -180; lon < 180; lon += 15) {
    const coords: number[][] = [];
    for (let lat = -80; lat <= 80; lat += 2) coords.push([lon, lat]);
    line(coords, { kind: "grid" });
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    if (lat === 0) continue;
    const coords: number[][] = [];
    for (let lon = -180; lon <= 180; lon += 2) coords.push([lon, lat]);
    line(coords, { kind: "grid" });
  }
  const keyLine = (lat: number, label: string) => {
    const coords: number[][] = [];
    for (let lon = -180; lon <= 180; lon += 2) coords.push([lon, lat]);
    line(coords, { kind: "key", label });
  };
  keyLine(0, "EQUATOR  ·  VISHUVAT REKHA");
  keyLine(23.44, "TROPIC OF CANCER  ·  KARKA REKHA");
  return { type: "FeatureCollection", features };
}

export function buildStyle(): StyleSpecification {
  return {
    version: 8,
    projection: { type: "globe" },
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sky: {
      "sky-color": "#06070f",
      "horizon-color": "#2a2440",
      "fog-color": "#0b0f22",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.4,
      "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 5, 0.3, 8, 0],
    },
    sources: {
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
      graticule: { type: "geojson", data: graticule() },
      india: { type: "geojson", data: "/geo/india.geojson" },
      "india-states": { type: "geojson", data: "/geo/india-states.geojson" },
      "india-state-labels": { type: "geojson", data: "/geo/india-state-labels.geojson" },
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": PALETTE.land } },
      {
        id: "ocean",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-color": PALETTE.ocean, "fill-antialias": false },
      },
      {
        id: "border-state",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        minzoom: 3.5,
        filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": PALETTE.borderState, "line-width": 0.7, "line-dasharray": [3, 2] },
      },
      {
        // Disputed lines are left out so no de facto line is drawn through a claimed region.
        id: "border-country",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: [
          "all",
          ["==", ["get", "admin_level"], 2],
          ["!=", ["get", "maritime"], 1],
          ["!=", ["get", "disputed"], 1],
          ["!", ["has", "claimed_by"]],
        ],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": PALETTE.border,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 6, 1.4],
        },
      },

      // India with its official boundary (Survey of India, via DataMeet). The solid fill
      // covers other countries' lines inside India's outline; India's own states go on top.
      { id: "india", type: "fill", source: "india", paint: { "fill-color": PALETTE.india } },
      {
        id: "india-water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-color": PALETTE.ocean, "fill-antialias": false },
      },
      {
        id: "india-states",
        type: "line",
        source: "india-states",
        minzoom: 2.4,
        paint: {
          "line-color": PALETTE.indiaStates,
          "line-width": ["interpolate", ["linear"], ["zoom"], 2.4, 0.4, 6, 1.1],
          "line-dasharray": [3, 2],
        },
      },
      {
        id: "india-glow",
        type: "line",
        source: "india",
        layout: { "line-join": "round" },
        paint: { "line-color": PALETTE.indiaLine, "line-opacity": 0.28, "line-width": 7, "line-blur": 6 },
      },
      {
        id: "india-line",
        type: "line",
        source: "india",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": PALETTE.indiaLine, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1, 6, 1.8] },
      },

      {
        id: "grid",
        type: "line",
        source: "graticule",
        filter: ["==", ["get", "kind"], "grid"],
        paint: { "line-color": PALETTE.grid, "line-width": 0.6 },
      },
      {
        id: "grid-key",
        type: "line",
        source: "graticule",
        filter: ["==", ["get", "kind"], "key"],
        paint: { "line-color": PALETTE.gridKey, "line-width": 0.8, "line-dasharray": [6, 4] },
      },
      {
        id: "grid-key-label",
        type: "symbol",
        source: "graticule",
        filter: ["==", ["get", "kind"], "key"],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 900,
          "text-field": ["get", "label"],
          "text-font": FONT,
          "text-size": 9,
          "text-letter-spacing": 0.3,
          "text-offset": [0, -0.8],
        },
        paint: { "text-color": "rgba(226, 69, 43, 0.6)", "text-halo-color": PALETTE.halo, "text-halo-width": 1 },
      },
      {
        id: "india-state-labels",
        type: "symbol",
        source: "india-state-labels",
        minzoom: 3.6,
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 3.6, 9, 7, 13],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.12,
          "text-max-width": 7,
        },
        paint: { "text-color": "rgba(242, 193, 120, 0.55)", "text-halo-color": PALETTE.halo, "text-halo-width": 1 },
      },
      {
        id: "label-country",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        maxzoom: 7,
        filter: ["==", ["get", "class"], "country"],
        layout: {
          "text-field": NAME,
          "text-font": FONT,
          "text-transform": "uppercase",
          "text-letter-spacing": 0.22,
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 9, 5, 13],
          "text-max-width": 8,
        },
        paint: { "text-color": PALETTE.label, "text-halo-color": PALETTE.halo, "text-halo-width": 1.2 },
      },
      {
        id: "label-city",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 3.2,
        filter: ["all", ["==", ["get", "class"], "city"], ["<=", ["get", "rank"], 6]],
        layout: {
          "text-field": NAME,
          "text-font": FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 9, 8, 13],
          "text-letter-spacing": 0.05,
        },
        paint: { "text-color": PALETTE.labelDim, "text-halo-color": PALETTE.halo, "text-halo-width": 1 },
      },
    ],
  };
}
