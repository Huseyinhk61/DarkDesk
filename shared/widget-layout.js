// Snap near the requested position and find the closest free rectangle. If the
// display is full we retain the clamped position instead of moving off-screen.
export function placeWidget(bounds, obstacles, displays, gap = 12, grid = 8) {
  const areas = displays.map((d) => d.workArea || d);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const area =
    areas.find(
      (a) =>
        center.x >= a.x && center.x < a.x + a.width && center.y >= a.y && center.y < a.y + a.height,
    ) || areas[0];
  if (!area) return bounds;
  const maxX = area.x + area.width - bounds.width,
    maxY = area.y + area.height - bounds.height;
  const clampX = (x) => Math.round(Math.max(area.x, Math.min(maxX, x)));
  const clampY = (y) => Math.round(Math.max(area.y, Math.min(maxY, y)));
  const requested = {
    ...bounds,
    x: clampX(area.x + Math.round((bounds.x - area.x) / grid) * grid),
    y: clampY(area.y + Math.round((bounds.y - area.y) / grid) * grid),
  };
  const free = (b) =>
    obstacles.every(
      (o) =>
        b.x + b.width + gap <= o.x ||
        o.x + o.width + gap <= b.x ||
        b.y + b.height + gap <= o.y ||
        o.y + o.height + gap <= b.y,
    );
  if (free(requested)) return requested;
  const xs = new Set([area.x, maxX, requested.x]),
    ys = new Set([area.y, maxY, requested.y]);
  for (const o of obstacles) {
    xs.add(clampX(o.x - bounds.width - gap));
    xs.add(clampX(o.x + o.width + gap));
    ys.add(clampY(o.y - bounds.height - gap));
    ys.add(clampY(o.y + o.height + gap));
  }
  let best,
    score = Infinity;
  for (const x of xs)
    for (const y of ys) {
      const candidate = { ...bounds, x, y },
        distance = (x - bounds.x) ** 2 + (y - bounds.y) ** 2;
      if (distance < score && free(candidate)) {
        best = candidate;
        score = distance;
      }
    }
  return best || requested;
}
