import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server.js";
export function signSession(expires: number) {
  return `${expires}.${createHmac("sha256", process.env.APP_PASSWORD!).update(String(expires)).digest("hex")}`;
}
export function authorized(req: NextRequest) {
  const value = req.cookies.get("fazenda-session")?.value;
  if (!value || !process.env.APP_PASSWORD) return false;
  const expires = Number(value.split(".")[0]);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = signSession(expires);
  const suppliedBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}
