/**
 * Lightweight SVG path helpers for plot sketches.
 * Supports the absolute M / L / H / V / Z commands used in full-layout.svg.
 */

export type Point = [number, number];

export type PathSegment = {
  start: Point;
  end: Point;
  mid: Point;
  dx: number;
  dy: number;
  length: number;
};

export type PathBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

/** Tokenize an SVG path `d` string into command letters and numeric args. */
function tokenizePath(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const re = /([MmLlHhVvZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    if (match[1]) {
      tokens.push(match[1]);
    } else if (match[2]) {
      tokens.push(Number(match[2]));
    }
  }
  return tokens;
}

/**
 * Convert a plot path `d` into ordered corner points (Z closes without
 * duplicating the first point at the end).
 */
export function pathToPoints(d: string): Point[] {
  const tokens = tokenizePath(d);
  const points: Point[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;

  const push = (x: number, y: number) => {
    const last = points[points.length - 1];
    if (last && Math.abs(last[0] - x) < 1e-6 && Math.abs(last[1] - y) < 1e-6) {
      return;
    }
    points.push([x, y]);
    cx = x;
    cy = y;
  };

  while (i < tokens.length) {
    const token = tokens[i];
    if (typeof token !== "string") {
      i += 1;
      continue;
    }

    const cmd = token;
    i += 1;

    if (cmd === "Z" || cmd === "z") {
      cx = startX;
      cy = startY;
      continue;
    }

    if (cmd === "M" || cmd === "L") {
      while (i + 1 < tokens.length && typeof tokens[i] === "number") {
        const x = tokens[i] as number;
        const y = tokens[i + 1] as number;
        i += 2;
        if (cmd === "M" && points.length === 0) {
          startX = x;
          startY = y;
        }
        push(x, y);
        // After first M pair, subsequent pairs are treated as L (SVG rules).
        if (cmd === "M") {
          // continue reading as implicit LineTos
        }
      }
      continue;
    }

    if (cmd === "H") {
      while (i < tokens.length && typeof tokens[i] === "number") {
        const x = tokens[i] as number;
        i += 1;
        push(x, cy);
      }
      continue;
    }

    if (cmd === "V") {
      while (i < tokens.length && typeof tokens[i] === "number") {
        const y = tokens[i] as number;
        i += 1;
        push(cx, y);
      }
      continue;
    }
  }

  // Drop closing duplicate if present.
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
      points.pop();
    }
  }

  return points;
}

export function boundsFromPoints(points: Point[]): PathBounds {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

export function centroidOfPoints(points: Point[]): Point {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  const n = points.length || 1;
  return [sx / n, sy / n];
}

/** Rotate points 90° counter-clockwise around a center (SVG Y-down). */
export function rotatePointsCcw90(points: Point[], center: Point): Point[] {
  const [cx, cy] = center;
  return points.map(([x, y]) => [cx - (y - cy), cy + (x - cx)]);
}

/** Rotate points 90° clockwise around a center (SVG Y-down). */
export function rotatePointsCw90(points: Point[], center: Point): Point[] {
  const [cx, cy] = center;
  return points.map(([x, y]) => [cx + (y - cy), cy - (x - cx)]);
}

/** Build edge segments between consecutive corner points (closed ring). */
export function segmentsFromPoints(points: Point[]): PathSegment[] {
  const n = points.length;
  if (n < 2) return [];

  const segments: PathSegment[] = [];
  for (let i = 0; i < n; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % n];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;
    segments.push({
      start,
      end,
      mid: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
      dx,
      dy,
      length,
    });
  }
  return segments;
}

export type SideRole = "top" | "right" | "bottom" | "left";

/** Classify a segment by where its midpoint sits relative to the shape centroid. */
export function segmentSideRole(
  segment: PathSegment,
  centroid: Point,
): SideRole {
  const dx = segment.mid[0] - centroid[0];
  const dy = segment.mid[1] - centroid[1];
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  // SVG Y grows downward.
  return dy > 0 ? "bottom" : "top";
}

/**
 * True when the segment's run direction fits the named side.
 * Rejects notch/step edges (e.g. a short horizontal jog on the right)
 * so Excel Top/Right/Bottom/Left only land on real outer sides.
 */
export function segmentFitsSideRole(
  segment: PathSegment,
  role: SideRole,
): boolean {
  const ax = Math.abs(segment.dx);
  const ay = Math.abs(segment.dy);
  if (role === "top" || role === "bottom") {
    // Prefer horizontal / diagonal; reject strongly vertical jogs.
    return ax >= ay * 0.35;
  }
  // left / right: prefer vertical / diagonal; reject strongly horizontal jogs.
  return ay >= ax * 0.35;
}

/**
 * Pick the best edge for an Excel side label: correct screen role, fitting
 * orientation, and longest among those (ignores unmentioned cut edges).
 */
export function pickLabelSegmentForRole(
  segments: PathSegment[],
  role: SideRole,
  centroid: Point,
  minLength: number,
): PathSegment | null {
  const onRole = segments.filter(
    (segment) =>
      segment.length >= minLength &&
      segmentSideRole(segment, centroid) === role,
  );
  if (onRole.length === 0) return null;

  const oriented = onRole.filter((segment) =>
    segmentFitsSideRole(segment, role),
  );
  const pool = oriented.length > 0 ? oriented : onRole;
  return pool.reduce((best, segment) =>
    segment.length > best.length ? segment : best,
  );
}

/**
 * Place a label at the segment midpoint, offset outward along the normal
 * that points away from the shape centroid.
 */
export function labelTransformForSegment(
  segment: PathSegment,
  centroid: Point,
  offset: number,
): { x: number; y: number; angle: number } {
  const { mid, dx, dy, length } = segment;

  // Unit tangent along the edge.
  const tx = dx / length;
  const ty = dy / length;

  // Two possible normals; pick the one pointing away from centroid.
  let nx = -ty;
  let ny = tx;
  const fromCentroidX = mid[0] - centroid[0];
  const fromCentroidY = mid[1] - centroid[1];
  if (nx * fromCentroidX + ny * fromCentroidY < 0) {
    nx = -nx;
    ny = -ny;
  }

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  // Keep text readable (never upside-down).
  if (angle > 90 || angle < -90) {
    angle += 180;
  }

  return {
    x: mid[0] + nx * offset,
    y: mid[1] + ny * offset,
    angle,
  };
}
