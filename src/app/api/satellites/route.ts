import { connection } from "next/server";
import { SAT_GROUPS, downloadGroup, isSatGroup } from "@/lib/satellites";
import { cached, cachedJson, fetchUpstream, upstreamError } from "@/lib/server/upstream";

// CelesTrak updates orbits every 2 hours and refuses repeat downloads before that,
// so keep a copy for 6 hours (and let the CDN keep it too). The page falls back to
// a copy saved at build time (public/orbits/) if this route fails.
const TTL_MS = 6 * 3_600_000;

export async function GET(req: Request) {
  await connection();
  const id = new URL(req.url).searchParams.get("group");
  if (!isSatGroup(id)) return Response.json({ error: "Unknown group" }, { status: 400 });
  const group = SAT_GROUPS.find((g) => g.id === id)!;
  const many = group.queries.length > 1;

  try {
    const sats = await cached(`sats:${id}`, TTL_MS, async () => {
      const list = await downloadGroup(group, async (url) => {
        try {
          const text = await (await fetchUpstream(url, 20_000, 0)).text();
          return text.startsWith("[") ? JSON.parse(text) : null;
        } catch (err) {
          if (many) return null; // one failed name search shouldn't sink the rest
          throw err;
        }
      });
      if (list.length === 0) throw new Error("No orbits");
      return list;
    });
    return cachedJson({ group: id, generated: Date.now(), sats }, TTL_MS / 1000);
  } catch {
    return upstreamError("CelesTrak");
  }
}
