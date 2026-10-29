// Captures the README media from the running app: desktop and phone screenshots, plus a
// demo video (MP4 + animated WebP + GIF fallback). The data is live, so every run differs.
// Run it against the dev server: clicking a satellite needs the map handle that only
// development builds expose.
// Usage: node docs/readme/capture.mjs [shots,video] [baseUrl]   (needs ffmpeg on PATH)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ONLY = (process.argv[2] ?? "shots,video").split(",");
const BASE = (process.argv[3] ?? "http://127.0.0.1:3110").replace(/\/$/, "");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
// Grain bloats JPEGs and animations; the dev-tools badge is not part of the app.
const CLEAN = ".grain { display: none !important; } nextjs-portal { display: none !important; }";

async function open(ctxOpts) {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, reducedMotion: "no-preference", ...ctxOpts });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.addStyleTag({ content: CLEAN });
  await page.waitForFunction(() => Number(document.querySelector(".layer-count")?.textContent) > 0, null, { timeout: 30_000 });
  return { ctx, page };
}

const layerOn = (page, name) => page.locator(".layer-toggle", { hasText: name }).click();

/** Click the strongest quake in the narration feed. */
const pickStrongest = (page) =>
  page.evaluate(() => {
    const items = [...document.querySelectorAll(".feed-item")].filter((i) => /^\d/.test(i.querySelector(".feed-mag").textContent));
    items.reduce((a, b) => (Number(b.querySelector(".feed-mag").textContent) > Number(a.querySelector(".feed-mag").textContent) ? b : a)).click();
  });

/** Click the ISS where it is on screen right now. */
async function clickIss(page) {
  // The map only lists features in loaded tiles, so turn the globe until the ISS shows up.
  let found = false;
  for (const lon of [80, 170, -100, -10]) {
    found = await page.evaluate((lon) => {
      const m = window.__sanjayaMap;
      if (!m) return false;
      const f = m.querySourceFeatures("sats").find((x) => x.properties.short === "ISS");
      if (f) {
        m.jumpTo({ center: f.geometry.coordinates, zoom: 2.4 });
        return true;
      }
      m.jumpTo({ center: [lon, 10], zoom: 1.2 });
      return false;
    }, lon);
    if (found) break;
    await wait(2500);
  }
  if (!found) return false;
  await wait(1500);
  const xy = await page.evaluate(() => {
    const m = window.__sanjayaMap;
    const f = m.querySourceFeatures("sats").find((x) => x.properties.short === "ISS");
    const p = m.project(f.geometry.coordinates);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(xy.x, xy.y);
  return true;
}

const shot = async (page, name) => {
  await page.screenshot({ path: join(here, `${name}.jpg`), type: "jpeg", quality: 82 });
  console.log("✓", name);
};

// ---------- Screenshots
if (ONLY.includes("shots")) {
  const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
  await wait(9000); // intro spin + tiles
  await shot(page, "globe-world");

  await page.getByRole("button", { name: "India & neighbours" }).click();
  await wait(5000);
  await pickStrongest(page);
  await wait(4000);
  // Pull back so the whole of India and its official outline are in view, card still open.
  await page.evaluate(() => window.__sanjayaMap?.jumpTo({ center: [82, 22.5], zoom: 3.25 }));
  await wait(4000);
  await shot(page, "globe-india");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "World" }).click();
  for (const name of ["Disasters", "Wildfires", "Rain & wind", "Undersea cables"]) await layerOn(page, name);
  await wait(12000);
  await shot(page, "globe-hazards");

  for (const name of ["Disasters", "Wildfires", "Rain & wind", "Undersea cables"]) await layerOn(page, name);
  if (await clickIss(page)) {
    await wait(3000);
    await shot(page, "globe-iss");
  }
  await ctx.close();

  const m = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await wait(9000);
  await shot(m.page, "mobile-globe");
  await m.page.getByRole("button", { name: "Layers", exact: true }).click();
  await wait(1500);
  await shot(m.page, "mobile-layers");
  await m.ctx.close();
}

// ---------- Demo video
if (ONLY.includes("video")) {
  const size = { width: 1280, height: 800 };
  const tmp = mkdtempSync(join(tmpdir(), "sanjaya-video-"));
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: tmp, size }, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(BASE);
  await page.addStyleTag({ content: CLEAN });
  await page.waitForFunction(() => Number(document.querySelector(".layer-count")?.textContent) > 0, null, { timeout: 30_000 });
  // Start once the map tiles are in, so the video does not open on a blank globe.
  await page.waitForFunction(() => window.__sanjayaMap?.isSourceLoaded("omt") && window.__sanjayaMap.areTilesLoaded(), null, { timeout: 30_000 });
  await wait(4000);
  const startAt = (Date.now() - t0) / 1000;
  await wait(1500);
  await layerOn(page, "Disasters");
  await wait(1200);
  await layerOn(page, "Wildfires");
  await wait(4000);
  await page.getByRole("button", { name: "India & neighbours" }).click();
  await wait(4500);
  await pickStrongest(page);
  await wait(4500);
  await page.getByRole("button", { name: "Close details" }).click();
  await clickIss(page);
  await wait(5500);
  await ctx.close();

  const webm = join(tmp, readdirSync(tmp).find((f) => f.endsWith(".webm")));
  const out = (ext) => join(here, `demo.${ext}`);
  ffmpeg("-ss", startAt.toFixed(2), "-i", webm, "-vf", "fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", out("mp4"));
  ffmpeg("-i", out("mp4"), "-vf", "fps=12,scale=960:-2:flags=lanczos", "-c:v", "libwebp_anim", "-loop", "0", "-q:v", "68", "-an", out("webp"));
  ffmpeg("-i", out("mp4"), "-vf", "fps=8,scale=720:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0", out("gif"));
  rmSync(tmp, { recursive: true, force: true });
  console.log("✓ demo (mp4, webp, gif)");
}

await browser.close();
