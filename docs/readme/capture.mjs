// Captures the README media from the running app: desktop and phone screenshots, plus a
// demo video (MP4 + animated WebP + GIF fallback). The data is live, so every run differs.
// Usage: node docs/readme/capture.mjs [shots,video] [baseUrl]   (needs ffmpeg on PATH)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ONLY = (process.argv[2] ?? "shots,video").split(",");
const BASE = (process.argv[3] ?? "https://sanjaya-live.vercel.app").replace(/\/$/, "");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
// Grain is static noise that bloats JPEGs and animations; the media look the same without it.
const NO_GRAIN = ".grain { display: none !important; }";

async function open(size, opts = {}) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, reducedMotion: "no-preference", ...opts });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.addStyleTag({ content: NO_GRAIN });
  await page.waitForFunction(() => Number(document.querySelector(".layer-count")?.textContent) > 0, null, { timeout: 30_000 });
  return { ctx, page };
}

/** Click the strongest quake in the narration feed. */
async function pickStrongest(page) {
  await page.evaluate(() => {
    const items = [...document.querySelectorAll(".feed-item")];
    const best = items.reduce((a, b) => (Number(b.querySelector(".feed-mag").textContent) > Number(a.querySelector(".feed-mag").textContent) ? b : a));
    best.click();
  });
}

const shot = async (page, name) => {
  await page.screenshot({ path: join(here, `${name}.jpg`), type: "jpeg", quality: 82 });
  console.log("✓", name);
};

// ---------- Screenshots
if (ONLY.includes("shots")) {
  const { ctx, page } = await open({ width: 1440, height: 900 });
  await wait(9000); // intro spin + tiles
  await shot(page, "globe-world");

  await page.getByRole("button", { name: "India & neighbours" }).click();
  await wait(5000);
  await pickStrongest(page);
  await wait(5000);
  await shot(page, "globe-india");
  await ctx.close();

  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
  const m = await open(phone.viewport, { isMobile: true, hasTouch: true });
  await wait(9000);
  await shot(m.page, "mobile-globe");
  await m.page.getByRole("button", { name: /Narration/ }).click();
  await wait(1500);
  await shot(m.page, "mobile-narration");
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
  await page.addStyleTag({ content: NO_GRAIN });
  await page.waitForFunction(() => Number(document.querySelector(".layer-count")?.textContent) > 0, null, { timeout: 30_000 });
  const startAt = Math.max(0, (Date.now() - t0) / 1000 - 0.3);
  await wait(6500);
  await page.getByRole("button", { name: "India & neighbours" }).click();
  await wait(4500);
  await pickStrongest(page);
  await wait(5000);
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "7 days" }).click();
  await page.waitForFunction(() => /7 days/.test(document.querySelector(".feed-summary")?.textContent ?? ""), null, { timeout: 30_000 });
  await wait(3500);
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
