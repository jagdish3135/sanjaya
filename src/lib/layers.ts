// Every layer Sanjaya will show. Phase 1 ships earthquakes; the rest are listed so the
// panel shows what is coming. Flip `status` to "live" as each phase lands.

export interface LayerInfo {
  id: string;
  name: string;
  hint: string;
  phase: number;
  status: "live" | "soon";
}

export const LAYERS: LayerInfo[] = [
  { id: "earthquakes", name: "Earthquakes", hint: "USGS + EMSC, every minute", phase: 1, status: "live" },
  { id: "satellites", name: "Satellites", hint: "CelesTrak orbits", phase: 2, status: "soon" },
  { id: "daynight", name: "Day & night", hint: "Live terminator", phase: 2, status: "soon" },
  { id: "disasters", name: "Disasters", hint: "GDACS alerts", phase: 2, status: "soon" },
  { id: "fires", name: "Wildfires", hint: "NASA FIRMS", phase: 2, status: "soon" },
  { id: "weather", name: "Wind & rain", hint: "Open-Meteo", phase: 2, status: "soon" },
  { id: "cables", name: "Undersea cables", hint: "TeleGeography", phase: 2, status: "soon" },
  { id: "flights", name: "Flights", hint: "adsb.lol", phase: 3, status: "soon" },
  { id: "air", name: "Air quality", hint: "WAQI", phase: 3, status: "soon" },
  { id: "events", name: "World events", hint: "GDELT", phase: 3, status: "soon" },
  { id: "ships", name: "Ships", hint: "aisstream.io", phase: 4, status: "soon" },
  { id: "internet", name: "Internet shutdowns", hint: "IODA", phase: 5, status: "soon" },
];
