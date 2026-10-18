import test from "node:test";
import assert from "node:assert/strict";
import { ownerPosition, cowPosition, focusViewport } from "./network-layout.ts";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test("isolated cow is centered with bounded zoom regardless of its original position", () => {
  const point = { x: 125, y: 575 },
    camera = focusViewport([point], 2.5);
  assert.equal(camera.zoom, 2.5);
  near(500 + camera.pan.x + camera.zoom * (point.x - 500), 500);
  near(340 + camera.pan.y + camera.zoom * (point.y - 340), 340);
});
test("owner focus frames its complete branch without clipping the outer animals", () => {
  const root = ownerPosition(0, 4, "radial", true);
  const points = [
    root,
    ...Array.from({ length: 30 }, (_, i) =>
      cowPosition(i, 30, root, 0, "radial", true),
    ),
  ];
  const camera = focusViewport(points);
  for (const p of points) {
    const x = 500 + camera.pan.x + camera.zoom * (p.x - 500),
      y = 340 + camera.pan.y + camera.zoom * (p.y - 340);
    assert.ok(x >= 40 && x <= 960);
    assert.ok(y >= 60 && y <= 620);
  }
});
test("top-down arranges owners horizontally and their animals below them", () => {
  const first = ownerPosition(0, 4, "top-down"),
    last = ownerPosition(3, 4, "top-down");
  assert.ok(first.x < last.x);
  assert.equal(first.y, last.y);
  const positions = Array.from({ length: 30 }, (_, i) =>
    cowPosition(i, 30, first, 0, "top-down"),
  );
  assert.ok(positions.every((p) => p.y > first.y));
  assert.ok(positions[5].y > positions[0].y);
});
test("reset viewport is neutral and isolated owner layouts do not depend on other owners", () => {
  assert.deepEqual(focusViewport([]), { zoom: 1, pan: { x: 0, y: 0 } });
  for (const view of ["radial", "top-down"] as const)
    assert.deepEqual(
      ownerPosition(0, 4, view, true),
      ownerPosition(3, 4, view, true),
    );
});
