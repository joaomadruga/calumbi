import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { isSameOrigin, requestOrigin } from "./request-origin.ts";
import { proxy } from "../proxy.ts";
const request = (headers: Record<string, string>) =>
  new NextRequest("http://localhost:3000/api/session", {
    method: "POST",
    headers,
  });

test("local login accepts the browser host even when Next uses an internal hostname", () => {
  for (const host of [
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.1.20:3000",
    "[::1]:3000",
    "localhost:3001",
  ]) {
    assert.equal(
      isSameOrigin(request({ host, origin: `http://${host}` })),
      true,
      host,
    );
  }
});
test("reverse proxy keeps the public origin and HTTPS scheme", () => {
  const req = request({
    host: "localhost:3000",
    "x-forwarded-host": "calumbi.example.com",
    "x-forwarded-proto": "https",
    origin: "https://calumbi.example.com",
  });
  assert.equal(requestOrigin(req), "https://calumbi.example.com");
  assert.equal(isSameOrigin(req), true);
  const page = new NextRequest("http://localhost:3000/curral", {
    headers: {
      host: "localhost:3000",
      "x-forwarded-host": "calumbi.example.com",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(
    proxy(page).headers.get("location"),
    "https://calumbi.example.com/login",
  );
});
test("cross-origin, missing, malformed and null origins remain blocked", () => {
  for (const origin of [
    "https://attacker.example",
    "http://localhost:3001",
    "null",
    "invalid",
    "http://localhost:3000/path",
    "http://user@localhost:3000",
  ]) {
    assert.equal(
      isSameOrigin(request({ host: "localhost:3000", origin })),
      false,
      origin,
    );
  }
  assert.equal(isSameOrigin(request({ host: "localhost:3000" })), false);
  assert.equal(
    isSameOrigin(
      request({
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "cross-site",
      }),
    ),
    false,
  );
});
test("invalid forwarded hosts and schemes cannot become trusted origins", () => {
  for (const host of [
    "user@calumbi.example.com",
    "calumbi.example.com/path",
    "calumbi.example.com?query=yes",
  ]) {
    assert.equal(requestOrigin(request({ "x-forwarded-host": host })), null);
  }
  assert.equal(
    requestOrigin(request({ "x-forwarded-proto": "javascript" })),
    null,
  );
});
