import { connection } from "next/server";
import { normalizeGdacs } from "@/lib/hazards";
import { cached, cachedJson, fetchUpstream, upstreamError } from "@/lib/server/upstream";

const TTL_MS = 15 * 60_000;
// Earthquakes have their own layer, so they are left out here (GDACS returns at most 100 events).
const URL_GDACS =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;FL;VO;DR;WF&alertlevel=Green;Orange;Red";

export async function GET() {
  await connection();
  try {
    const disasters = await cached("disasters", TTL_MS, async () =>
      normalizeGdacs(await (await fetchUpstream(URL_GDACS, 15_000)).json()),
    );
    return cachedJson({ generated: Date.now(), disasters }, TTL_MS / 1000);
  } catch {
    return upstreamError("GDACS");
  }
}
