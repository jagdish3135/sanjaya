// Every layer Sanjaya shows or will show. Flip `status` to "live" as each phase lands.

export interface LayerInfo {
  id: string;
  name: string;
  hint: string;
  phase: number;
  status: "live" | "soon";
}

export const LAYERS: LayerInfo[] = [
  { id: "earthquakes", name: "Earthquakes", hint: "USGS + EMSC, every minute", phase: 1, status: "live" },
  { id: "satellites", name: "Satellites", hint: "CelesTrak orbits, moving live", phase: 2, status: "live" },
  { id: "daynight", name: "Day & night", hint: "Where the sun is up right now", phase: 2, status: "live" },
  { id: "disasters", name: "Disasters", hint: "GDACS alerts, every 15 minutes", phase: 2, status: "live" },
  { id: "fires", name: "Wildfires", hint: "NASA FIRMS, last 24 hours", phase: 2, status: "live" },
  { id: "weather", name: "Rain & wind", hint: "NASA GPM rain, Open-Meteo wind", phase: 2, status: "live" },
  { id: "cables", name: "Undersea cables", hint: "TeleGeography map", phase: 2, status: "live" },
  { id: "flights", name: "Flights", hint: "adsb.lol", phase: 3, status: "soon" },
  { id: "air", name: "Air quality", hint: "WAQI", phase: 3, status: "soon" },
  { id: "events", name: "World events", hint: "GDELT", phase: 3, status: "soon" },
  { id: "tv", name: "Live TV", hint: "24/7 news channels", phase: 3, status: "soon" },
  { id: "ships", name: "Ships", hint: "aisstream.io", phase: 4, status: "soon" },
  { id: "internet", name: "Internet shutdowns", hint: "IODA", phase: 5, status: "soon" },
];

export const layerInfo = (id: string) => LAYERS.find((l) => l.id === id)!;
