// MapLibre 6 loads its worker from a separate file that Turbopack does not bundle.
// Copy it into public/ so the app can serve it at /maplibre/maplibre-gl-worker.mjs.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const to = join(root, "public", "maplibre", "maplibre-gl-worker.mjs");

mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log("Copied MapLibre worker to public/maplibre/");
