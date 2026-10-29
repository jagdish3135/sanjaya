import { connection } from "next/server";
import { parseFirmsCsv } from "@/lib/hazards";
import { cached, cachedJson, fetchUpstream, upstreamError } from "@/lib/server/upstream";

const TTL_MS = 60 * 60_000;
// NASA FIRMS publishes this global 24-hour MODIS file openly; no map key needed.
const URL_FIRMS = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv";

export async function GET() {
  await connection();
  try {
    const fires = await cached("fires", TTL_MS, async () => parseFirmsCsv(await (await fetchUpstream(URL_FIRMS, 25_000)).text()));
    return cachedJson({ generated: Date.now(), fires }, TTL_MS / 1000);
  } catch {
    return upstreamError("NASA FIRMS");
  }
}
