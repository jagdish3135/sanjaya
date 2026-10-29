import { connection } from "next/server";
import { normalizeOpenMeteo, windGrid } from "@/lib/hazards";
import { cached, cachedJson, fetchUpstream, upstreamError } from "@/lib/server/upstream";

// Each grid point counts against Open-Meteo's free daily quota, so refresh every 3 hours.
const TTL_MS = 3 * 3_600_000;

export async function GET() {
  await connection();
  const grid = windGrid();
  try {
    const wind = await cached("wind", TTL_MS, async () => {
      const lats = grid.map((p) => p[1]).join(",");
      const lons = grid.map((p) => p[0]).join(",");
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_direction_10m`;
      return normalizeOpenMeteo(await (await fetchUpstream(url, 20_000)).json(), grid);
    });
    return cachedJson({ generated: Date.now(), wind }, TTL_MS / 1000);
  } catch {
    return upstreamError("Open-Meteo");
  }
}
