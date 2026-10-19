import test from "node:test";
import assert from "node:assert/strict";
import {
  ownerPosition,
  cowPosition,
  focusViewport,
  readableViewport,
  zoomAt,
} from "./network-layout.ts";
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

test("radial layouts give a large genealogy distinct positions beyond the original thirty-node budget", () => {
  const positions = Array.from({ length: 90 }, (_, i) =>
    cowPosition(i, 90, { x: 500, y: 340 }, 0, "radial", true),
  );
  assert.equal(
    new Set(positions.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)).size,
    90,
  );
  assert.ok(positions[89].tier > positions[29].tier);
  assert.ok(
    positions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  );
});

test("readable framing never shrinks a large tree below the readability floor", () => {
  const points = [
    { x: -5000, y: 200 },
    { x: 5000, y: 2000 },
  ];
  const camera = readableViewport(points, 0.95, 1.6);
  assert.equal(camera.zoom, 0.95);
  near(340 + camera.pan.y + camera.zoom * (200 - 340), 100);
  const single = readableViewport([{ x: 500, y: 340 }], 0.95, 1.6);
  assert.equal(single.zoom, 1.6);
});
test("wheel zoom keeps the world point beneath the cursor fixed, at any pan", () => {
  const camera = { zoom: 0.75, pan: { x: 120, y: -40 } },
    cursor = { x: 730, y: 225 };
  const world = {
    x: 500 + (cursor.x - 500 - camera.pan.x) / camera.zoom,
    y: 340 + (cursor.y - 340 - camera.pan.y) / camera.zoom,
  };
  const next = zoomAt(camera, 1.5, cursor);
  near(500 + next.pan.x + next.zoom * (world.x - 500), cursor.x);
  near(340 + next.pan.y + next.zoom * (world.y - 340), cursor.y);
  assert.equal(zoomAt(camera, 999, cursor).zoom, 8);
  assert.equal(zoomAt(camera, 0.001, cursor).zoom, 0.05);
});
