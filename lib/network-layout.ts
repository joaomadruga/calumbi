export type NetworkView = "radial" | "top-down";
export type Point = { x: number; y: number };
export const NETWORK_CENTER: Point = { x: 500, y: 340 };
export function ownerPosition(
  index: number,
  total: number,
  view: NetworkView,
  focused = false,
): Point {
  if (focused) return { x: 500, y: view === "top-down" ? 200 : 340 };
  if (view === "top-down")
    return { x: total <= 1 ? 500 : 110 + (index * 780) / (total - 1), y: 245 };
  const angle =
    total === 1 ? -0.55 : -Math.PI * 0.75 + (index * Math.PI * 2) / total;
  return { x: 500 + Math.cos(angle) * 248, y: 340 + Math.sin(angle) * 160 };
}
export function cowPosition(
  index: number,
  total: number,
  branch: Point,
  angle: number,
  view: NetworkView,
  focused = false,
): Point & { tier: number } {
  if (view === "top-down") {
    const columns = focused
      ? 5
      : Math.max(2, Math.min(5, Math.ceil(Math.sqrt(total))));
    const columnGap = focused ? 64 : 32,
      row = Math.floor(index / columns),
      rowCount = Math.min(columns, total - row * columns);
    return {
      x: branch.x + ((index % columns) - (rowCount - 1) / 2) * columnGap,
      y: branch.y + 110 + row * (focused ? 47 : 42),
      tier: row,
    };
  }
  const tier =
      index < 6
        ? 0
        : index < 16
          ? 1
          : index < 30
            ? 2
            : 3 + Math.floor((index - 30) / 20),
    offset =
      tier === 0 ? 0 : tier === 1 ? 6 : tier === 2 ? 16 : 30 + (tier - 3) * 20;
  const inTier = Math.min(
    tier === 0 ? 6 : tier === 1 ? 10 : tier === 2 ? 14 : 20,
    total - offset,
  );
  const a = focused
    ? -Math.PI / 2 + ((index - offset) * Math.PI * 2) / Math.max(1, inTier)
    : angle +
      (inTier === 1 ? 0 : ((index - offset) / (inTier - 1) - 0.5) * 2.45);
  const radius =
    (tier < 3 ? [80, 122, 156][tier] : 206 + (tier - 3) * 55) +
    Math.sin(index * 2.4) * 3;
  return {
    x: branch.x + Math.cos(a) * radius,
    y: branch.y + Math.sin(a) * radius,
    tier,
  };
}
export function focusViewport(
  points: Point[],
  maxZoom = 1.8,
): { zoom: number; pan: Point } {
  if (!points.length) return { zoom: 1, pan: { x: 0, y: 0 } };
  const minX = Math.min(...points.map((p) => p.x)) - 42,
    maxX = Math.max(...points.map((p) => p.x)) + 42;
  const minY = Math.min(...points.map((p) => p.y)) - 60,
    maxY = Math.max(...points.map((p) => p.y)) + 60;
  const zoom = Math.min(
    maxZoom,
    880 / Math.max(1, maxX - minX),
    500 / Math.max(1, maxY - minY),
  );
  return {
    zoom,
    pan: {
      x: zoom * (500 - (minX + maxX) / 2),
      y: zoom * (340 - (minY + maxY) / 2),
    },
  };
}

export function readableViewport(
  points: Point[],
  minZoom = 0.9,
  maxZoom = 1.8,
) {
  const fit = focusViewport(points, Math.max(minZoom, maxZoom));
  if (!points.length || fit.zoom >= minZoom) return fit;
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  return {
    zoom: minZoom,
    pan: {
      x: minZoom * (500 - (minX + maxX) / 2),
      y: 100 - 340 - minZoom * (minY - 340),
    },
  };
}
export function zoomAt(
  camera: { zoom: number; pan: Point },
  requested: number,
  anchor: Point,
) {
  const zoom = Math.max(0.05, Math.min(8, requested));
  const ratio = zoom / camera.zoom;
  return {
    zoom,
    pan: {
      x: anchor.x - 500 - ratio * (anchor.x - 500 - camera.pan.x),
      y: anchor.y - 340 - ratio * (anchor.y - 340 - camera.pan.y),
    },
  };
}
