export function timeAgo(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const istFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const clockFmt = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

const istClock = clockFmt("Asia/Kolkata");
const utcClock = clockFmt("UTC");

export const formatIst = (t: number) => `${istFmt.format(t)} IST`;
export const formatUtc = (t: number) => `${new Date(t).toISOString().slice(0, 16).replace("T", " ")} UTC`;
export const clockIst = (t: number) => istClock.format(t);
export const clockUtc = (t: number) => utcClock.format(t);
