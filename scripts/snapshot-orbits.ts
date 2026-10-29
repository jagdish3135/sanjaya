// Saves a backup copy of the smaller satellite groups to public/orbits/, used when CelesTrak
// refuses a download (it allows one per address per 2-hour update). Runs before each build;
// if a download fails, the copy already in the repo is kept, so the build never breaks.
// Usage: node scripts/snapshot-orbits.ts   (Node 24 runs TypeScript directly)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SAT_GROUPS, downloadGroup } from "../src/lib/satellites.ts";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "orbits");
mkdirSync(out, { recursive: true });

const get = async (url: string) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (res.status === 404) return null; // a name search with no matches
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text.startsWith("[") ? JSON.parse(text) : null;
};

for (const g of SAT_GROUPS.filter((x) => x.id !== "starlink")) {
  try {
    const sats = await downloadGroup(g, get);
    if (sats.length === 0) throw new Error("no orbits");
    writeFileSync(join(out, `${g.id}.json`), JSON.stringify({ group: g.id, generated: Date.now(), sats }));
    console.log(`✓ ${g.id}: ${sats.length} satellites`);
  } catch (err) {
    console.log(`· ${g.id}: kept the existing copy (${(err as Error).message})`);
  }
}
