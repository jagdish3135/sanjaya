# Sanjaya

> **See the world live.** Flights, ships, satellites, earthquakes, disasters and news on one 3D globe. Free and open source.

In the Mahabharata, Sanjaya was given divine sight to watch the whole Kurukshetra battlefield live and narrate it to King Dhritarashtra. This app does the same for today's world: it watches public data feeds and shows everything happening right now on a single screen.

---

## What it is

Sanjaya brings 20+ public data feeds onto one interactive globe. Watch planes cross the sky, ships move through the Indian Ocean, satellites orbit overhead, and earthquakes, wildfires and cyclones appear as they happen. Ask the built-in AI anything in plain English, and it takes you there. Everything comes from free, open data, with no login and no tracking.

**India-first, whole-world coverage:** Indian Ocean shipping, ISRO satellites, Indian city air quality and Indian internet shutdowns get extra attention, but every layer works worldwide.

## Highlights

- **One screen, the whole world:** 20+ layers you can switch on and off
- **Live:** most layers update every few seconds to minutes
- **Ask in plain English:** an AI assistant flies the map and turns on the right layers
- **Open data only:** every point links back to its public source
- **Free and open source:** no account, no paywall, no tracking

## Who it's for

Students, journalists, researchers, disaster volunteers, aviation and ship-tracking fans, and anyone curious about what is happening right now.

---

## Data layers

| Layer | What users see | How fresh | Source |
|---|---|---|---|
| ✈️ Flights | Every tracked plane: callsign, altitude, speed, heading. Military filter. | ~10–30 sec | adsb.lol, airplanes.live, adsb.fi, OpenSky |
| 🚢 Ships | Cargo ships, tankers, passenger ships: name, flag, speed, destination | Live (patchy far out at sea) | aisstream.io |
| 🎣 Fishing / dark vessels | Fishing activity, ships that switched off tracking | Daily | Global Fishing Watch |
| 🛰️ Satellites | Thousands of satellites in orbit, ISS, ISRO satellites | Real-time (calculated in browser) | CelesTrak + satellite.js, wheretheiss.at |
| 🚀 Launches | Upcoming rocket launches with countdowns | Hourly | Launch Library 2 |
| ☀️ Space weather | Solar flares, geomagnetic storms, aurora zones | ~5 min | NOAA SWPC, NASA DONKI |
| 🌍 Earthquakes | Magnitude, depth, location, pulsing circles | ~1 min / instant push | USGS, EMSC SeismicPortal |
| 🔥 Wildfires | Fire hotspots from NASA satellites | ~3 hours | NASA FIRMS |
| 🌀 Disasters | Cyclones, floods, volcanoes, droughts with alert levels | ~15 min | GDACS, NASA EONET, tsunami.gov |
| 🌧️ Weather | Wind flow, rain, temperature, waves | Hourly | Open-Meteo, NASA GIBS |
| 🌫️ Air quality | City AQI, colored good → hazardous | Hourly | WAQI, OpenAQ |
| ☢️ Radiation | Citizen sensor readings | Varies | Safecast |
| 📰 World events | Geocoded protests, conflicts, disasters | 15 min | GDELT |
| 📺 Live TV | 24/7 news channels in a side panel | Live | YouTube embeds |
| 💬 Social signals | Public posts placed on the map | Live | Telegram public channels, Bluesky Jetstream |
| 📷 Traffic cameras | Public traffic camera snapshots | ~1–5 min | TfL, Caltrans, WSDOT, NZTA, HK |
| 🌐 Internet shutdowns | Countries and states where the internet dropped | ~5 min | IODA, Cloudflare Radar |
| 🛡️ Cyber threats | Malware servers, botnet servers, new vulnerabilities | ~15 min | abuse.ch, NVD |
| 🌊 Undersea cables | Internet cables across the oceans | Static | TeleGeography |
| 🌗 Day / night | Live day/night shadow line | Real-time | Calculated in browser |
| 📈 Markets | Exchange rates, crypto, prediction-market odds | ~1 min | Frankfurter, CoinGecko, Polymarket |

**AI assistant:** type "show me earthquakes near Nepal today" or "which ships are near Mumbai port?" and the map flies there, turns on the right layers, and summarizes what it finds.

---

## Free APIs

🟢 no key · 🔑 free signup key · **NC** = non-commercial use only

### Air and space
| API | Gives | Access |
|---|---|---|
| adsb.lol | Live aircraft, military endpoint `/v2/mil` | 🟢 |
| airplanes.live | Live aircraft without filtering | 🟢 1 req/s, NC |
| adsb.fi | Live aircraft | 🟢 1 req/s, NC, attribution required |
| OpenSky Network | Live aircraft | 🟢 400 credits/day · 🔑 OAuth2 for more |
| CelesTrak | Satellite orbit data | 🟢 |
| N2YO | Satellite passes | 🔑 |
| wheretheiss.at | ISS position | 🟢 |
| Launch Library 2 | Rocket launches | 🟢 small hourly limit |
| Spaceflight News API | Space news | 🟢 |
| NASA api.nasa.gov | Asteroids, solar flares, photo of the day | 🔑 (DEMO_KEY for testing) |
| NOAA SWPC | Solar storms, aurora | 🟢 |

### Sea
| API | Gives | Access |
|---|---|---|
| aisstream.io | Live ships (WebSocket) | 🔑 |
| Global Fishing Watch | Vessel activity, dark vessels | 🔑 NC |
| Open-Meteo Marine | Waves, swell, sea temperature | 🟢 NC |
| NOAA Tides & Currents | Tide stations | 🟢 |

### Earthquakes and disasters
| API | Gives | Access |
|---|---|---|
| USGS Earthquakes | Worldwide quakes (GeoJSON) | 🟢 |
| EMSC SeismicPortal | Quakes with live WebSocket push | 🟢 |
| GDACS | Cyclone, flood, drought, volcano alerts | 🟢 |
| NASA EONET | Natural events | 🟢 |
| NASA FIRMS | Wildfire hotspots | 🔑 |
| tsunami.gov / PTWC | Tsunami bulletins | 🟢 |
| USGS Volcano (HANS) | Volcano alert levels | 🟢 |
| ReliefWeb | Disaster reports | 🔑 approved app name required |

### Weather, air and radiation
| API | Gives | Access |
|---|---|---|
| Open-Meteo | Forecast, wind, rain, air quality, flood, elevation | 🟢 NC |
| NASA GIBS | Daily satellite imagery tiles | 🟢 |
| MET Norway | Global forecast | 🟢 (User-Agent header) |
| NOAA NWS / NHC | US alerts, hurricane tracks | 🟢 |
| WAQI | City air quality | 🔑 |
| OpenAQ | Air quality stations | 🔑 |
| Safecast | Radiation | 🟢 |

### Events, internet and cyber
| API | Gives | Access |
|---|---|---|
| GDELT 2.0 | Geocoded world events | 🟢 |
| Wikipedia / Wikidata | Current events, place info | 🟢 |
| Polymarket (Gamma) | Prediction-market odds | 🟢 |
| ACLED | Conflict events | 🔑 registration, limited API |
| IODA | Internet shutdowns | 🟢 |
| Cloudflare Radar | Traffic, outages, attacks | 🔑 free token, NC |
| abuse.ch (URLhaus, Feodo) | Malware and botnet servers | 🟢 |
| NVD | Vulnerabilities (CVEs) | 🟢 |
| RIPE Stat | BGP / routing | 🟢 |

### News, social, cameras, transport
| API | Gives | Access |
|---|---|---|
| RSS (BBC, Reuters, The Hindu, PIB) | Headlines | 🟢 |
| Bluesky Jetstream | Live public posts | 🟢 |
| Mastodon public timelines | Public posts | 🟢 |
| Telegram `t.me/s/<channel>` | Public channel posts | 🟢 (scraping) |
| YouTube live embeds | 24/7 news channels | 🟢 |
| Government traffic cameras | Camera snapshots | 🟢 |
| GTFS-Realtime (Delhi OTD etc.) | Live buses, metros | 🟢 / 🔑 |

### Maps, money, India
| API | Gives | Access |
|---|---|---|
| OpenFreeMap | Vector basemap tiles | 🟢 |
| Overpass (OpenStreetMap) | Ports, airports, power plants | 🟢 |
| Nominatim / Photon | Place search | 🟢 1 req/s |
| Natural Earth | Borders, coastlines | 🟢 |
| TeleGeography | Undersea cables | 🟢 NC |
| Frankfurter | Exchange rates | 🟢 |
| CoinGecko | Crypto prices | 🔑 demo key |
| World Bank / REST Countries | Country data | 🟢 |
| OpenSanctions | Sanctions lists | 🟢 NC |
| data.gov.in | Indian government datasets | 🔑 |
| ISRO Bhuvan | Indian map layers (WMS) | 🟢 / 🔑 |

### Not used (not really free)
- **RainViewer:** since Jan 2026, zoom 7 max, no forecast or satellite, personal use only. Use Open-Meteo / NASA GIBS.
- **NewsAPI.org:** localhost only.
- **MarineTraffic, FlightAware, Shodan, Windy Webcams, Planet:** paid.
- **NCS (India earthquakes):** no open API. Use USGS + EMSC.

---

## How it works

```
Browser: MapLibre GL globe + layer toggles + side panels + AI assistant
   │  polls every 30–60s, only for the visible area
   ▼
Next.js API routes  /api/earthquakes, /api/flights, /api/ships ...
   │  each: fetch upstream → normalize to one shape → cache (45s to 24h)
   ▼
Free public feeds (USGS, adsb.lol, CelesTrak, GDELT, NASA ...)

+ a small always-on worker for live ships (aisstream WebSocket)
```

| Part | Choice |
|---|---|
| Framework | Next.js + TypeScript |
| Map / globe | MapLibre GL JS (globe view), deck.gl for heavy point layers |
| Satellites | satellite.js (orbit math in the browser) |
| Basemap | OpenFreeMap |
| AI | Claude API (tool calls that move the map and toggle layers) |
| Ship worker | Small Node service on Railway / Fly |
| Hosting | Vercel |
| Database | None (in-memory / edge cache) |

## Build order

1. **Base:** globe, dark theme, layer panel, earthquakes layer end to end
2. **Easy layers:** satellites, day/night, disasters, fires, weather, cables
3. **Harder layers:** flights, air quality, world events, live TV, cameras
4. **Ships:** aisstream worker
5. **Online signals:** internet shutdowns, cyber threats, social posts
6. **AI assistant:** plain-English questions that drive the map
7. **Ship it:** deploy to Vercel, README with media, launch post

---

## About the data (show this in the app)

- Data comes from public sources and **can be delayed, incomplete or wrong**. Do not use it for navigation, emergencies or official decisions.
- Ship coverage is strong near coasts and weak far out at sea (it relies on volunteer receivers).
- Traffic cameras are snapshots, not video.
- Some sources allow **non-commercial use only**, so Sanjaya stays free.
- No personal data is collected, and only public information is shown.
