// Small line icons for the panels and cards (the map draws its own canvas versions).
const PATHS: Record<string, React.ReactNode> = {
  TC: (
    <>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M6.4 9.5A6 6 0 0 1 18 12" />
      <path d="M17.6 14.5A6 6 0 0 1 6 12" />
    </>
  ),
  FL: <path d="M4 8c3-3 5 3 8 0s5 3 8 0M4 12c3-3 5 3 8 0s5 3 8 0M4 16c3-3 5 3 8 0s5 3 8 0" />,
  VO: (
    <>
      <path d="M4 19l6-9h4l6 9z" fill="currentColor" stroke="none" />
      <circle cx="11" cy="6" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="4.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  DR: (
    <>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  WF: <path d="M12 3c5 6 7 9 5 13-1.5 3-8.5 3-10 0-1.5-3 1-5.5 2.5-7.5 0 3 1.5 4 2.5 4-1-3-1-6 0-9.5z" fill="currentColor" stroke="none" />,
  SAT: (
    <>
      <rect x="9.5" y="9.5" width="5" height="5" transform="rotate(45 12 12)" fill="currentColor" stroke="none" />
      <path d="M4 7l4 4M16 13l4 4M3 8l3-3M18 21l3-3" />
    </>
  ),
  CABLE: <path d="M3 17c4-8 7 4 10-3s5-6 8-4" />,
  SUN: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" />
    </>
  ),
};

export default function Glyph({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.SAT}
    </svg>
  );
}
