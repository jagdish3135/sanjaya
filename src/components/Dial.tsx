// Brass sighting dial around the globe, after the Jantar Mantar instruments.
// It turns with the map bearing; the outer ring of 27 marks (the nakshatras) drifts slowly.

const DIRECTIONS = [
  { deg: 0, label: "उत्तर", en: "N" },
  { deg: 90, label: "पूर्व", en: "E" },
  { deg: 180, label: "दक्षिण", en: "S" },
  { deg: 270, label: "पश्चिम", en: "W" },
];

const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: +(r * Math.cos(a)).toFixed(2), y: +(r * Math.sin(a)).toFixed(2) };
};

const TICKS = Array.from({ length: 180 }, (_, i) => {
  const deg = i * 2;
  const inner = deg % 30 === 0 ? 446 : deg % 10 === 0 ? 458 : 468;
  return { deg, a: polar(deg, inner), b: polar(deg, 478), major: deg % 30 === 0 };
});

const NAKSHATRAS = Array.from({ length: 27 }, (_, i) => polar((360 / 27) * i, 494));

export default function Dial({ bearing }: { bearing: number }) {
  return (
    <div className="dial" aria-hidden="true">
      <svg viewBox="-520 -520 1040 1040">
        <g className="dial-stars">
          {NAKSHATRAS.map((p, i) => (
            <rect
              key={i}
              x={p.x - 3}
              y={p.y - 3}
              width={6}
              height={6}
              transform={`rotate(45 ${p.x} ${p.y})`}
              className={i % 9 === 0 ? "nak nak-key" : "nak"}
            />
          ))}
        </g>
        <g style={{ transform: `rotate(${-bearing}deg)` }} className="dial-face">
          <circle r={478} className="ring" />
          <circle r={440} className="ring ring-thin" />
          <circle r={404} className="ring ring-dash" />
          {TICKS.map((t) => (
            <line key={t.deg} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} className={t.major ? "tick tick-major" : "tick"} />
          ))}
          {TICKS.filter((t) => t.major && t.deg % 90 !== 0).map((t) => {
            const p = polar(t.deg, 424);
            const upright = t.deg > 90 && t.deg < 270 ? t.deg + 180 : t.deg; // never upside down
            return (
              <text key={t.deg} x={p.x} y={p.y} className="deg" transform={`rotate(${upright} ${p.x} ${p.y})`}>
                {t.deg}°
              </text>
            );
          })}
          {DIRECTIONS.map((d) => {
            const p = polar(d.deg, 420);
            return (
              <g key={d.deg} transform={`rotate(${d.deg === 180 ? 0 : d.deg} ${p.x} ${p.y})`}>
                <text x={p.x} y={p.y} className={d.deg === 0 ? "dir dir-north" : "dir"}>
                  {d.label}
                </text>
                <text x={p.x} y={p.y + 20} className="dir-en">
                  {d.en}
                </text>
              </g>
            );
          })}
          <path d="M0 -500 L7 -484 L-7 -484 Z" className="north-pin" />
        </g>
      </svg>
    </div>
  );
}
