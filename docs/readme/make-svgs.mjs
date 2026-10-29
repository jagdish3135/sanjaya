// Generates the README banner and "how it works" diagram in dark and light versions.
// Fonts are subset from Google Fonts and embedded, so the SVGs render the same on GitHub.
// Usage: node docs/readme/make-svgs.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function font(family, weight, text) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
  const src = css.match(/url\((https:[^)]+)\)/)?.[1];
  if (!src) throw new Error(`No font file for ${family}`);
  const b64 = Buffer.from(await (await fetch(src)).arrayBuffer()).toString("base64");
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}

const ASCII = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,·'-–()?:/+×&→↓";
const fonts = [
  await font("Rozha One", 400, ASCII + "संजयउत्तरपूर्वदक्षिणपश्चिम"),
  await font("Mukta", 400, ASCII),
  await font("Mukta", 500, ASCII),
  await font("Martian Mono", 400, ASCII),
].join("");

const THEMES = {
  dark: {
    bg: "#07080f", glow: "#17183a", ink: "#efe6d2", muted: "rgba(239,230,210,0.66)", faint: "rgba(239,230,210,0.4)",
    brass: "#c9a24a", brassHi: "#e9c46a", line: "rgba(201,162,74,0.35)", card: "#0f1020", land: "#1a181d", ocean: "#0b0f22",
    sindoor: "#e8432a", saffron: "#f2a33a", nila: "#8fb3e8", star: "rgba(239,230,210,0.6)",
  },
  light: {
    bg: "#f6f0e2", glow: "#efe3c6", ink: "#1b1712", muted: "rgba(27,23,18,0.72)", faint: "rgba(27,23,18,0.45)",
    brass: "#8a6a1f", brassHi: "#7a5a12", line: "rgba(138,106,31,0.4)", card: "#fbf7ee", land: "#e7dcc4", ocean: "#d4dbe8",
    sindoor: "#c7321c", saffron: "#c97a12", nila: "#3f6db3", star: "rgba(138,106,31,0.35)",
  },
};
const D = "font-family=\"'Rozha One'\"";
const B = "font-family=\"'Mukta'\"";
const M = "font-family=\"'Martian Mono'\"";

const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [+(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1)];
};

function dial(cx, cy, r, t) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.brass}" stroke-opacity="0.55"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r - 22}" fill="none" stroke="${t.brass}" stroke-opacity="0.25" stroke-dasharray="2 6"/>`;
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    const [x1, y1] = polar(cx, cy, r - (major ? 12 : 6), d);
    const [x2, y2] = polar(cx, cy, r, d);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${t.brass}" stroke-opacity="${major ? 0.9 : 0.45}" stroke-width="${major ? 1.6 : 1}"/>`;
  }
  for (let i = 0; i < 27; i++) {
    const [x, y] = polar(cx, cy, r + 12, (360 / 27) * i);
    s += `<rect x="${x - 2.5}" y="${y - 2.5}" width="5" height="5" transform="rotate(45 ${x} ${y})" fill="${i % 9 === 0 ? t.brass : "none"}" stroke="${t.brass}" stroke-opacity="0.6"/>`;
  }
  const [nx, ny] = polar(cx, cy, r + 26, 0);
  s += `<path d="M${nx} ${ny - 4} l6 12 h-12z" fill="${t.sindoor}"/>`;
  s += `<text x="${cx}" y="${cy - r + 34}" ${D} font-size="20" fill="${t.sindoor}" text-anchor="middle">उत्तर</text>`;
  s += `<text x="${cx + r - 34}" y="${cy + 7}" ${D} font-size="18" fill="${t.ink}" fill-opacity="0.8" text-anchor="middle">पूर्व</text>`;
  s += `<text x="${cx - r + 38}" y="${cy + 7}" ${D} font-size="18" fill="${t.ink}" fill-opacity="0.8" text-anchor="middle">पश्चिम</text>`;
  return s;
}

// A stylised globe: graticule, the Tropic of Cancer, and quake dots clustered on real fault zones.
function globe(cx, cy, r, t) {
  let s = `<defs><clipPath id="g"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <radialGradient id="shade" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${t.ocean}" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${t.bg === "#07080f" ? 0.55 : 0.18}"/></radialGradient></defs>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.ocean}"/>`;
  s += `<g clip-path="url(#g)" fill="none" stroke="${t.brass}" stroke-opacity="0.18">`;
  for (let k = -2; k <= 2; k++) s += `<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(k) * r * 0.42 || 1}" ry="${r}"/>`;
  for (let k = -2; k <= 2; k++) {
    const y = cy + k * r * 0.36;
    const w = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
    s += `<line x1="${cx - w}" y1="${y}" x2="${cx + w}" y2="${y}"/>`;
  }
  s += `</g>`;
  const tropicY = cy - r * 0.3;
  const tw = Math.sqrt(r * r - (tropicY - cy) ** 2);
  s += `<line x1="${cx - tw}" y1="${tropicY}" x2="${cx + tw}" y2="${tropicY}" stroke="${t.sindoor}" stroke-opacity="0.55" stroke-dasharray="6 4"/>`;
  const dots = [
    [-0.55, -0.42, 5, "s"], [-0.4, -0.3, 3, "s"], [-0.28, -0.35, 4, "i"], [-0.05, -0.38, 6, "s"], [0.1, -0.15, 3, "s"],
    [0.22, -0.05, 9, "s"], [0.32, 0.12, 4, "i"], [0.45, 0.22, 7, "d"], [0.55, 0.05, 5, "s"], [0.62, -0.25, 6, "i"],
    [0.38, 0.38, 4, "s"], [0.5, 0.45, 3, "s"], [-0.15, 0.1, 3, "s"], [0.05, 0.3, 5, "i"], [-0.62, 0.15, 3, "s"],
  ];
  const col = { s: t.sindoor, i: t.saffron, d: t.nila };
  for (const [dx, dy, rr, band] of dots) {
    const x = cx + dx * r, y = cy + dy * r;
    s += `<circle cx="${x}" cy="${y}" r="${rr * 2.4}" fill="${col[band]}" fill-opacity="0.18"/>`;
    s += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${col[band]}" fill-opacity="0.95" stroke="${t.ink}" stroke-opacity="0.5" stroke-width="0.6"/>`;
  }
  const [px, py] = [cx + 0.22 * r, cy - 0.05 * r];
  s += `<circle cx="${px}" cy="${py}" r="18" fill="none" stroke="${t.sindoor}" stroke-opacity="0.6"/><circle cx="${px}" cy="${py}" r="28" fill="none" stroke="${t.sindoor}" stroke-opacity="0.25"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#shade)"/>`;
  return s;
}

function stars(w, h, t, n = 60, seed = 7) {
  let x = seed, s = "";
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) s += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h).toFixed(0)}" r="${(rnd() * 1.1 + 0.3).toFixed(1)}" fill="${t.star}"/>`;
  return s;
}

function banner(t) {
  const W = 1280, H = 420;
  const chips = ["7 live layers", "Quakes to satellites", "India-first", "Free & open data"];
  let cx = 92;
  const chipSvg = chips.map((c) => {
    const w = c.length * 8.6 + 30;
    const label = c.toUpperCase().replace(/&/g, "&amp;");
    const s = `<rect x="${cx}" y="318" width="${w}" height="32" fill="none" stroke="${t.line}"/><text x="${cx + w / 2}" y="339" ${M} font-size="11.5" fill="${t.muted}" text-anchor="middle" letter-spacing="0.6">${label}</text>`;
    cx += w + 10;
    return s;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${fonts}</style>
<defs><radialGradient id="bg" cx="72%" cy="50%" r="70%"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${t.bg}"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${stars(W, H, t)}
${globe(930, 212, 150, t)}
${dial(930, 212, 176, t)}
<path d="M24 24 h22 M24 24 v22 M${W - 24} ${H - 24} h-22 M${W - 24} ${H - 24} v-22" stroke="${t.brass}" stroke-width="2"/>
<text x="88" y="168" ${D} font-size="104" fill="${t.ink}">संजय</text>
<text x="372" y="122" ${D} font-size="26" fill="${t.brassHi}" letter-spacing="10">SANJAYA</text>
<text x="374" y="160" ${M} font-size="12" fill="${t.faint}" letter-spacing="3">THE WORLD, SEEN LIVE</text>
<text x="92" y="232" ${B} font-weight="500" font-size="25" fill="${t.ink}">A 3D globe of what is happening on Earth right now.</text>
<text x="92" y="264" ${B} font-size="19" fill="${t.muted}">Sanjaya watched the Kurukshetra battlefield live and narrated it.</text>
<text x="92" y="290" ${B} font-size="19" fill="${t.muted}">This app does the same for the whole world.</text>
${chipSvg}
</svg>`;
}

function flow(t) {
  const W = 1280, H = 300;
  const box = (x, kicker, title, lines, accent) => `
<rect x="${x}" y="70" width="340" height="170" fill="${t.card}" stroke="${t.line}"/>
<path d="M${x} 84 v-14 h14 M${x + 340} 226 v14 h-14" stroke="${t.brass}" stroke-width="2" fill="none"/>
<rect x="${x}" y="70" width="340" height="3" fill="${accent}"/>
<text x="${x + 22}" y="106" ${M} font-size="11" fill="${t.brass}" letter-spacing="2">${kicker}</text>
<text x="${x + 22}" y="140" ${D} font-size="26" fill="${t.ink}">${title}</text>
${lines.map((l, i) => `<text x="${x + 22}" y="${174 + i * 25}" ${B} font-size="17" fill="${t.muted}">${l}</text>`).join("")}`;
  const arrow = (x) => `<line x1="${x}" y1="155" x2="${x + 58}" y2="155" stroke="${t.brass}" stroke-width="1.5" stroke-dasharray="5 4"/><path d="M${x + 58} 149 l10 6 l-10 6z" fill="${t.brass}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${fonts}</style>
<rect width="${W}" height="${H}" fill="${t.bg}"/>
${stars(W, H, t, 30, 3)}
<text x="40" y="40" ${M} font-size="12" fill="${t.faint}" letter-spacing="3">HOW IT WORKS</text>
${box(40, "1 · FREE PUBLIC FEEDS", "Open data", ["USGS, CelesTrak, GDACS, NASA,", "Open-Meteo, TeleGeography"], t.saffron)}
${arrow(392)}
${box(470, "2 · ONE API ROUTE PER FEED", "Clean and cache", ["One small shape per feed", "Retries · cached 1 min to 24 h"], t.sindoor)}
${arrow(822)}
${box(900, "3 · YOUR BROWSER", "The globe", ["7 layers, orbits worked out live", "Narrated, filtered, India-first"], t.nila)}
</svg>`;
}

for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(join(here, `banner-${name}.svg`), banner(t));
  writeFileSync(join(here, `how-it-works-${name}.svg`), flow(t));
  console.log("✓", name);
}
