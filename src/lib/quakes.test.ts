import { describe, expect, it } from "vitest";
import {
  depthBand,
  filterQuakes,
  inSouthAsia,
  isSameEvent,
  mergeQuakes,
  narrate,
  normalizeEmsc,
  normalizeUsgs,
  type Quake,
} from "./quakes";

const T = Date.parse("2026-10-29T10:00:00Z");

const usgsFeed = {
  features: [
    {
      id: "us7000abcd",
      properties: {
        mag: 5.34, magType: "mww", place: "40 km S of Kathmandu, Nepal", time: T,
        tsunami: 0, felt: 120, alert: "green", url: "https://earthquake.usgs.gov/x",
      },
      geometry: { coordinates: [85.3, 27.35, 12.4] },
    },
    { id: "broken", properties: { mag: null }, geometry: { coordinates: [0, 0, 0] } },
  ],
};

const emscFeed = {
  features: [
    {
      id: "20261029_1",
      properties: { unid: "20261029_1", mag: 5.1, magtype: "MB", flynn_region: "NEPAL", time: new Date(T + 20_000).toISOString(), lat: 27.4, lon: 85.4, depth: 10 },
    },
    {
      id: "20261029_2",
      properties: { unid: "20261029_2", mag: 3.0, magtype: "ml", flynn_region: "CENTRAL ITALY", time: new Date(T - 600_000).toISOString(), lat: 42.5, lon: 13.1, depth: 8 },
    },
  ],
};

describe("normalize", () => {
  it("reads USGS features and skips broken ones", () => {
    const qs = normalizeUsgs(usgsFeed);
    expect(qs).toHaveLength(1);
    expect(qs[0]).toMatchObject({ id: "usgs:us7000abcd", mag: 5.3, lat: 27.35, lon: 85.3, depth: 12.4, felt: 120, alert: "green" });
  });

  it("reads EMSC features and title-cases the region", () => {
    const qs = normalizeEmsc(emscFeed);
    expect(qs.map((q) => q.place)).toEqual(["Nepal", "Central Italy"]);
    expect(qs[0].magType).toBe("mb");
    expect(qs[0].links.EMSC).toContain("unid=20261029_1");
  });

  it("survives empty or missing input", () => {
    expect(normalizeUsgs(null)).toEqual([]);
    expect(normalizeEmsc({})).toEqual([]);
  });
});

describe("merge", () => {
  it("joins the same event seen by both feeds and keeps the rest", () => {
    const merged = mergeQuakes(normalizeUsgs(usgsFeed), normalizeEmsc(emscFeed));
    expect(merged).toHaveLength(2);
    const nepal = merged.find((q) => q.id.startsWith("usgs:"))!;
    expect(nepal.sources).toEqual(["USGS", "EMSC"]);
    expect(nepal.links.EMSC).toBeDefined();
    expect(merged[0].time).toBeGreaterThan(merged[1].time); // newest first
  });

  it("does not join events far apart in time or space", () => {
    const base = normalizeUsgs(usgsFeed)[0];
    expect(isSameEvent(base, { ...base, time: base.time + 5 * 60_000 })).toBe(false);
    expect(isSameEvent(base, { ...base, lat: base.lat + 5 })).toBe(false);
  });
});

describe("filter and labels", () => {
  const qs: Quake[] = mergeQuakes(normalizeUsgs(usgsFeed), normalizeEmsc(emscFeed));

  it("filters by magnitude, time and region", () => {
    const now = T + 60_000;
    expect(filterQuakes(qs, { minMag: 2.5, window: "day", region: "world", now })).toHaveLength(2);
    expect(filterQuakes(qs, { minMag: 4, window: "day", region: "world", now })).toHaveLength(1);
    expect(filterQuakes(qs, { minMag: 2.5, window: "day", region: "south-asia", now })).toHaveLength(1);
    expect(filterQuakes(qs, { minMag: 2.5, window: "hour", region: "world", now: T + 2 * 3_600_000 })).toHaveLength(0);
  });

  it("knows South Asia", () => {
    expect(inSouthAsia({ lat: 28.6, lon: 77.2 })).toBe(true); // Delhi
    expect(inSouthAsia({ lat: 35.7, lon: 139.7 })).toBe(false); // Tokyo
  });

  it("bands depth and narrates in first person", () => {
    expect([depthBand(10), depthBand(150), depthBand(550)]).toEqual(["shallow", "intermediate", "deep"]);
    expect(narrate(qs[0])).toBe("I see a moderate tremor, M5.3, 40 km S of Kathmandu, Nepal, 12 km below the surface.");
  });
});
