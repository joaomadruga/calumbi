import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { authorized, signSession } from "./session.ts";
import { proxy } from "../proxy.ts";
const initial = process.env.APP_PASSWORD;
beforeEach(() => {
  process.env.APP_PASSWORD = "test-password-private";
});
afterEach(() => {
  if (initial === undefined) delete process.env.APP_PASSWORD;
  else process.env.APP_PASSWORD = initial;
});
const request = (path = "/", cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie: `fazenda-session=${cookie}` } : {},
  });

test("pages redirect to login and API requests are denied before accessing data", () => {
  assert.equal(
    proxy(request()).headers.get("location"),
    "http://localhost:3000/login",
  );
  assert.equal(proxy(request("/private")).status, 307);
  assert.equal(proxy(request("/api/farm")).status, 401);
  assert.equal(proxy(request("/login")).headers.get("x-middleware-next"), "1");
  assert.equal(
    proxy(request("/api/session")).headers.get("x-middleware-next"),
    "1",
  );
});
test("valid session grants access and sends logged-in visitors away from login", () => {
  const cookie = signSession(Date.now() + 60000);
  assert.equal(authorized(request("/", cookie)), true);
  assert.equal(
    proxy(request("/", cookie)).headers.get("x-middleware-next"),
    "1",
  );
  assert.equal(
    proxy(request("/login", cookie)).headers.get("location"),
    "http://localhost:3000/",
  );
});
test("missing password fails closed even with a previously signed cookie", () => {
  const cookie = signSession(Date.now() + 60000);
  delete process.env.APP_PASSWORD;
  assert.equal(authorized(request("/", cookie)), false);
  assert.equal(proxy(request("/api/farm", cookie)).status, 401);
  assert.equal(proxy(request("/", cookie)).status, 307);
});
test("expired, modified and malformed session cookies cannot authenticate", () => {
  assert.equal(
    authorized(request("/", signSession(Date.now() - 60000))),
    false,
  );
  const cookie = signSession(Date.now() + 60000);
  assert.equal(
    authorized(
      request("/", cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a")),
    ),
    false,
  );
  assert.equal(authorized(request("/", "invalid")), false);
  assert.equal(
    authorized(request("/", `${Date.now() + 60000}.${"é".repeat(64)}`)),
    false,
  );
});
test("changing the environment password invalidates existing sessions", () => {
  const cookie = signSession(Date.now() + 60000);
  process.env.APP_PASSWORD = "changed-password";
  assert.equal(authorized(request("/", cookie)), false);
});
