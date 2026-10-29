// Small glyph icons drawn on a canvas and registered as SDF images, so the map can tint them.
import type { Map as MLMap } from "maplibre-gl";

const S = 48;
type Draw = (c: CanvasRenderingContext2D) => void;

const GLYPHS: Record<string, Draw> = {
  // Cyclone: a spiral
  "ico-TC": (c) => {
    c.beginPath();
    c.arc(24, 24, 5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(24, 24, 12, Math.PI * 1.1, Math.PI * 2.4);
    c.stroke();
    c.beginPath();
    c.arc(24, 24, 12, Math.PI * 0.1, Math.PI * 1.4);
    c.stroke();
  },
  // Flood: three waves
  "ico-FL": (c) => {
    for (const y of [15, 24, 33]) {
      c.beginPath();
      c.moveTo(9, y);
      c.bezierCurveTo(15, y - 6, 18, y + 6, 24, y);
      c.bezierCurveTo(30, y - 6, 33, y + 6, 39, y);
      c.stroke();
    }
  },
  // Volcano: mountain with a plume
  "ico-VO": (c) => {
    c.beginPath();
    c.moveTo(8, 38);
    c.lineTo(20, 20);
    c.lineTo(28, 20);
    c.lineTo(40, 38);
    c.closePath();
    c.fill();
    c.beginPath();
    c.arc(22, 12, 4, 0, Math.PI * 2);
    c.arc(29, 9, 3.5, 0, Math.PI * 2);
    c.fill();
  },
  // Drought: a blazing sun
  "ico-DR": (c) => {
    c.beginPath();
    c.arc(24, 24, 7, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      c.beginPath();
      c.moveTo(24 + Math.cos(a) * 11, 24 + Math.sin(a) * 11);
      c.lineTo(24 + Math.cos(a) * 17, 24 + Math.sin(a) * 17);
      c.stroke();
    }
  },
  // Wildfire: a flame
  "ico-WF": (c) => {
    c.beginPath();
    c.moveTo(24, 6);
    c.bezierCurveTo(34, 18, 38, 26, 34, 34);
    c.bezierCurveTo(31, 41, 17, 41, 14, 34);
    c.bezierCurveTo(11, 27, 16, 22, 19, 18);
    c.bezierCurveTo(19, 24, 22, 26, 24, 26);
    c.bezierCurveTo(22, 20, 22, 12, 24, 6);
    c.fill();
  },
  // Wind arrow pointing up (north); the map rotates it.
  "ico-arrow": (c) => {
    c.beginPath();
    c.moveTo(24, 40);
    c.lineTo(24, 12);
    c.stroke();
    c.beginPath();
    c.moveTo(24, 4);
    c.lineTo(33, 17);
    c.lineTo(15, 17);
    c.closePath();
    c.fill();
  },
};

export function addIcons(map: MLMap) {
  for (const [id, draw] of Object.entries(GLYPHS)) {
    if (map.hasImage(id)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = S;
    const c = canvas.getContext("2d")!;
    c.fillStyle = c.strokeStyle = "#fff";
    c.lineWidth = 4;
    c.lineCap = "round";
    draw(c);
    map.addImage(id, c.getImageData(0, 0, S, S), { sdf: true, pixelRatio: 2 });
  }
}
