// Shared helpers for API routes: one cached upstream call per TTL, and CDN cache headers.
import { NextResponse } from "next/server";

export const UA = "Sanjaya/0.2 (open-source live world map; github.com/jagdish3135/sanjaya)";

const store = new Map<string, { at: number; value: unknown }>();

/** Return a cached value if fresh; otherwise load it. If loading fails, serve stale data. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  try {
    const value = await load();
    store.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (hit) return hit.value as T;
    throw err;
  }
}

/** Fetch with a timeout, retrying once on a failed or non-OK response. */
export async function fetchUpstream(url: string, timeoutMs = 10_000, retries = 1): Promise<Response> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}`);
    return res;
  } catch (err) {
    if (retries > 0) return fetchUpstream(url, timeoutMs, retries - 1);
    throw err;
  }
}

/** JSON with CDN caching, so most visitors never reach the function. */
export function cachedJson(data: unknown, sMaxAge: number) {
  return NextResponse.json(data, {
    headers: { "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 4}` },
  });
}

export function upstreamError(what: string) {
  return NextResponse.json({ error: `${what} is unreachable right now` }, { status: 502 });
}
