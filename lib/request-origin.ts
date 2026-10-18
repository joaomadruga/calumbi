import type { NextRequest } from "next/server.js";

// Next may normalize the internal URL to localhost even when the browser uses
// 127.0.0.1, a LAN address, or a reverse proxy's public hostname.
export function requestOrigin(req: NextRequest): string | null {
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const protocol =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    req.nextUrl.protocol.replace(":", "");
  if (!host || !["http", "https"].includes(protocol)) return null;
  try {
    const url = new URL(`${protocol}://${host}`);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isSameOrigin(req: NextRequest): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && parsed.origin === requestOrigin(req);
  } catch {
    return false;
  }
}
