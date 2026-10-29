import { describe, expect, it } from "vitest";
import { nightPolygon, subsolarPoint, wrapLon } from "./sun";
import { compactOmm, groundTrack, isIsro, satState, toSat } from "./satellites";
import { normalizeGdacs, normalizeOpenMeteo, parseFirmsCsv, windGrid } from "./hazards";

describe("sun", () => {
  it("puts the sun over the Tropic of Cancer at the June solstice, near Greenwich at noon UTC", () => {
    const s = subsolarPoint(new Date("2026-06-21T12:00:00Z"));
    expect(s.lat).toBeCloseTo(23.44, 0);
    expect(Math.abs(s.lon)).toBeLessThan(1.5);
  });

  it("puts the sun over the equator at the March equinox", () => {
    expect(Math.abs(subsolarPoint(new Date("2026-03-20T14:46:00Z")).lat)).toBeLessThan(0.3);
  });

  it("darkens the south pole in June and India at midnight IST", () => {
    const june = nightPolygon(new Date("2026-06-21T18:30:00Z")); // 00:00 IST
    const ring = june.geometry.coordinates[0];
    expect(ring.at(-2)?.[1]).toBe(-90);
    // At India's longitude the terminator is far north, so Delhi (28.6°N) is in the night polygon.
    const near = ring.reduce((a, p) => (Math.abs(p[0] - 77) < Math.abs(a[0] - 77) ? p : a));
    expect(near[1]).toBeGreaterThan(28.6);
  });

  it("wraps longitudes", () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
  });
});

// ISS elements from CelesTrak (2026-10-28)
const ISS = {
  OBJECT_NAME: "ISS (ZARYA)", OBJECT_ID: "1998-067A", EPOCH: "2026-10-28T14:18:15.597504", MEAN_MOTION: 15.49090321,
  ECCENTRICITY: 0.00069949, INCLINATION: 51.6336, RA_OF_ASC_NODE: 359.9178, ARG_OF_PERICENTER: 320.4528,
  MEAN_ANOMALY: 39.5949, EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: "U", NORAD_CAT_ID: 25544, ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 59243, BSTAR: 0.00011161276, MEAN_MOTION_DOT: 5.724e-5, MEAN_MOTION_DDOT: 0,
};

describe("satellites", () => {
  it("keeps only the fields SGP4 needs", () => {
    const c = compactOmm(ISS);
    expect(c).not.toHaveProperty("REV_AT_EPOCH");
    expect(c.NORAD_CAT_ID).toBe(25544);
  });

  it("propagates the ISS to a believable orbit", () => {
    const sat = toSat("stations", compactOmm(ISS))!;
    expect(sat.launchYear).toBe(1998);
    expect(sat.epoch).toBe(Date.parse("2026-10-28T14:18:15.597Z"));
    expect(sat).toMatchObject({ name: "International Space Station", short: "ISS" });
    // A module docked to the station must not be labelled "ISS".
    const nauka = toSat("stations", compactOmm({ ...ISS, OBJECT_NAME: "ISS (NAUKA)", NORAD_CAT_ID: 49044 }))!;
    expect(nauka.short).toBe("ISS (NAUKA)");
    expect(sat.periodMin).toBeCloseTo(92.96, 1);
    const st = satState(sat.rec, new Date("2026-10-29T12:00:00Z"))!;
    expect(st.altKm).toBeGreaterThan(380);
    expect(st.altKm).toBeLessThan(440);
    expect(st.speedKms).toBeCloseTo(7.66, 1);
    expect(Math.abs(st.lat)).toBeLessThanOrEqual(51.7);
  });

  it("splits the ground track at the antimeridian", () => {
    const sat = toSat("stations", compactOmm(ISS))!;
    const parts = groundTrack(sat.rec, new Date("2026-10-29T12:00:00Z"), 93);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    for (const p of parts) for (let i = 1; i < p.length; i++) expect(Math.abs(p[i][0] - p[i - 1][0])).toBeLessThan(180);
  });

  it("recognises ISRO satellites but not Galileo's GSAT names", () => {
    expect(isIsro("CARTOSAT-3")).toBe(true);
    expect(isIsro("GSAT-30")).toBe(true);
    expect(isIsro("IRNSS-1I")).toBe(true);
    expect(isIsro("GSAT0101 (GALILEO-PFM)")).toBe(false);
    expect(isIsro("STARLINK-1007")).toBe(false);
    expect(isIsro("INSAT-1B R/B [PAM-D]")).toBe(false);
  });
});

describe("hazards", () => {
  it("normalizes GDACS and keeps the latest episode of each event", () => {
    const feature = (episode: string, to: string, alert = "Green") => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [88.5, 18.2] },
      properties: {
        eventtype: "TC", eventid: 7, name: "Tropical Cyclone DANA-26", alertlevel: alert, fromdate: "2026-10-20T00:00:00",
        todate: to, country: "India", iscurrent: "true", episodeid: episode,
        severitydata: { severitytext: "Tropical Storm (maximum wind speed of 120 km/h)" }, url: { report: "https://www.gdacs.org/r" },
      },
    });
    const out = normalizeGdacs({ features: [feature("1", "2026-10-22T00:00:00"), feature("2", "2026-10-24T00:00:00", "Orange")] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "TC-7", alert: "Orange", lat: 18.2, country: "India" });
  });

  it("parses the FIRMS CSV", () => {
    const csv = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight\n" +
      "21.1234567,79.0987654,320.1,1,1,2026-10-29,0745,T,82,6.1NRT,290,25.5,D\n" +
      "bad,row\n";
    const fires = parseFirmsCsv(csv);
    expect(fires).toHaveLength(1);
    expect(fires[0]).toEqual([79.099, 21.123, 25.5, 82, Date.parse("2026-10-29T07:45:00Z"), 1]);
  });

  it("builds a wind grid that is denser over India", () => {
    const grid = windGrid();
    const india = grid.filter(([lon, lat]) => lon >= 65 && lon <= 100 && lat >= 5 && lat <= 40);
    expect(india.length).toBeGreaterThan(50);
    expect(new Set(grid.map((p) => p.join())).size).toBe(grid.length);
    const wind = normalizeOpenMeteo([{ current: { wind_speed_10m: 12, wind_direction_10m: 270 } }], grid);
    expect(wind[0]).toEqual([grid[0][0], grid[0][1], 12, 270]);
  });
});
