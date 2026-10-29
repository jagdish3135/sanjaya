# Sanjaya · संजय

**See the world live.** A 3D globe of what is happening on Earth right now, India-first, built only on free and open data.

In the Mahabharata, Sanjaya watched the whole battlefield live and narrated it to the king. This app watches public data feeds and narrates the world the same way.

> Phase 1 of 7: the globe, the layer panel and a live earthquakes layer. See [PROJECT.md](PROJECT.md) for the full plan and the free API list.

## What works today

- **3D globe** with a night-observatory basemap (OpenFreeMap tiles), the Tropic of Cancer and the equator marked
- **Live earthquakes** from USGS and EMSC, merged so one quake seen by both shows once, refreshed every minute
- **Filters:** World or India & neighbours, last hour / 24 hours / 7 days, magnitude 2.5+ to 6+
- **Sanjaya narrates:** a live feed describing each tremor in plain sentences; click one to fly there
- **Details card:** magnitude, depth, India and UTC time, position, felt reports, impact alert, links to the source
- **Brass dial** that turns with the map, IST and UTC clocks, phone layout with bottom sheets

## Run it

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3110. No API keys are needed for phase 1.

| Script | Does |
|---|---|
| `npm run dev` | Dev server on port 3110 |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |

## How it works

```
Browser: MapLibre GL globe + panels      (polls every 60 s)
   ▼
/api/earthquakes   fetch USGS + EMSC → normalize → merge duplicates → cache 60 s
   ▼
USGS GeoJSON feed · EMSC SeismicPortal FDSN
```

- `src/lib/quakes.ts`: feed normalizing, merging, filtering and narration (tested in `quakes.test.ts`)
- `src/app/api/earthquakes/route.ts`: the API route with an in-memory cache and CDN cache headers
- `src/components/`: `Globe` (map), `mapStyle` (basemap), `Dial`, `Panels`, `Observatory` (page shell)
- MapLibre 6 loads its worker from a separate file; `scripts/copy-maplibre-worker.mjs` copies it to `public/maplibre/` on install, dev and build.

Disputed boundary lines are not drawn on the basemap.

## Data and credits

Earthquakes: [USGS](https://earthquake.usgs.gov/earthquakes/feed/) and [EMSC](https://www.seismicportal.eu/). Map: [OpenFreeMap](https://openfreemap.org/), © [OpenMapTiles](https://openmaptiles.org/), data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

Data comes from public sources and can be delayed, incomplete or wrong. Do not use Sanjaya for navigation, emergencies or official decisions.
