import { connection } from "next/server";
import { cached, cachedJson, fetchUpstream, upstreamError } from "@/lib/server/upstream";

// Submarine cable data © TeleGeography (CC BY-NC-SA). It changes rarely.
const TTL_MS = 24 * 3_600_000;
const BASE = "https://www.submarinecablemap.com/api/v3";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  await connection();
  const id = new URL(req.url).searchParams.get("id");

  try {
    if (id) {
      if (!/^[a-z0-9-]{1,80}$/.test(id)) return Response.json({ error: "Bad cable id" }, { status: 400 });
      const cable = await cached(`cable:${id}`, TTL_MS, async () => {
        const c: any = await (await fetchUpstream(`${BASE}/cable/${id}.json`)).json();
        return {
          id,
          name: c.name,
          length: c.length ?? null,
          rfs: c.rfs ?? null,
          owners: c.owners ?? null,
          url: c.url ?? null,
          landings: (c.landing_points ?? []).map((l: any) => l.name),
        };
      });
      return cachedJson(cable, TTL_MS / 1000);
    }

    const data = await cached("cables", TTL_MS, async () => {
      const [cables, points]: any[] = await Promise.all([
        fetchUpstream(`${BASE}/cable/cable-geo.json`, 20_000).then((r) => r.json()),
        fetchUpstream(`${BASE}/landing-point/landing-point-geo.json`, 20_000).then((r) => r.json()),
      ]);
      return {
        cables: {
          type: "FeatureCollection",
          features: cables.features.map((f: any) => ({
            type: "Feature",
            properties: { id: f.properties.id, name: f.properties.name, color: f.properties.color },
            geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
          })),
        },
        landings: {
          type: "FeatureCollection",
          features: points.features.map((f: any) => ({
            type: "Feature",
            properties: { name: f.properties.name },
            geometry: { type: "Point", coordinates: roundCoords(f.geometry.coordinates) },
          })),
        },
      };
    });
    return cachedJson(data, TTL_MS / 1000);
  } catch {
    return upstreamError("The submarine cable map");
  }
}

function roundCoords(c: any): any {
  return typeof c === "number" ? Math.round(c * 1000) / 1000 : c.map(roundCoords);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
