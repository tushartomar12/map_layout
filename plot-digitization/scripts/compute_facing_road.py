#!/usr/bin/env python3
"""Precompute facingRoad for each plot polygon in plots.master.json."""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
MASTER_PATH = ROOT_DIR / "plot-map-app" / "data" / "plots.master.json"

# Max gap between plot edge and road edge to count as "facing" (layout user units).
MAX_FACING_DISTANCE = 12.0


def to_title_case(value: str) -> str:
    def repl(match: re.Match[str]) -> str:
        return match.group(1).upper() + match.group(2).lower()

    return re.sub(r"\b([a-z])([a-z]*)\b", repl, value, flags=re.IGNORECASE)


def format_road_label(road_id: str) -> str:
    cleaned = re.sub(r"^road-", "", road_id, flags=re.IGNORECASE)
    cleaned = re.sub(r"([A-Za-z])(\d+)", r"\1 \2", cleaned)
    cleaned = cleaned.replace("_", " ").strip()
    cleaned = to_title_case(cleaned)

    suffix_match = re.match(r"^(.*\D)\s+(\d+)$", cleaned)
    if suffix_match and re.match(r"^\d", suffix_match.group(1).strip()):
        return f"{suffix_match.group(1).strip()} Road {suffix_match.group(2)}"

    if re.match(r"^\d", cleaned) and not re.search(r"Road$", cleaned, re.IGNORECASE):
        return f"{cleaned} Road"

    return cleaned


Point = tuple[float, float]
Segment = tuple[Point, Point]


def polygon_edges(points: list[list[float]]) -> list[Segment]:
    if len(points) < 2:
        return []
    edges: list[Segment] = []
    for index, start in enumerate(points):
        end = points[(index + 1) % len(points)]
        edges.append(((float(start[0]), float(start[1])), (float(end[0]), float(end[1]))))
    return edges


def dot(a: Point, b: Point) -> float:
    return a[0] * b[0] + a[1] * b[1]


def sub(a: Point, b: Point) -> Point:
    return (a[0] - b[0], a[1] - b[1])


def add(a: Point, b: Point) -> Point:
    return (a[0] + b[0], a[1] + b[1])


def scale(a: Point, factor: float) -> Point:
    return (a[0] * factor, a[1] * factor)


def length(a: Point) -> float:
    return math.hypot(a[0], a[1])


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def segment_distance(seg_a: Segment, seg_b: Segment) -> float:
    """Minimum distance between two line segments."""
    a1, a2 = seg_a
    b1, b2 = seg_b
    u = sub(a2, a1)
    v = sub(b2, b1)
    w = sub(a1, b1)

    uu = dot(u, u)
    vv = dot(v, v)
    eps = 1e-9

    if uu <= eps and vv <= eps:
        return length(sub(a1, b1))
    if uu <= eps:
        return point_segment_distance(a1, seg_b)
    if vv <= eps:
        return point_segment_distance(b1, seg_a)

    a = dot(u, v)
    b = dot(u, w)
    c = dot(v, w)
    denom = a * a - uu * vv

    sc = 0.0
    tc = 0.0
    if abs(denom) <= eps:
        sc = 0.0
        tc = clamp(c / vv, 0.0, 1.0) if vv > eps else 0.0
    else:
        sc = clamp((a * c - b * vv) / denom, 0.0, 1.0)
        tc = clamp((a * b - c * uu) / denom, 0.0, 1.0)

    closest_a = add(a1, scale(u, sc))
    closest_b = add(b1, scale(v, tc))
    return length(sub(closest_a, closest_b))


def point_segment_distance(point: Point, segment: Segment) -> float:
    start, end = segment
    axis = sub(end, start)
    axis_len_sq = dot(axis, axis)
    if axis_len_sq <= 1e-9:
        return length(sub(point, start))
    t = clamp(dot(sub(point, start), axis) / axis_len_sq, 0.0, 1.0)
    projection = add(start, scale(axis, t))
    return length(sub(point, projection))


def find_facing_road(
    plot_edges_list: list[Segment],
    roads: list[dict[str, object]],
) -> tuple[str | None, float]:
    best_label: str | None = None
    best_distance = float("inf")

    for road in roads:
        road_id = str(road["id"])
        road_label = format_road_label(road_id)
        road_points = road["points"]
        if not isinstance(road_points, list):
            continue
        road_edges = polygon_edges(road_points)

        for plot_edge in plot_edges_list:
            for road_edge in road_edges:
                distance = segment_distance(plot_edge, road_edge)
                if distance < best_distance:
                    best_distance = distance
                    best_label = road_label

    if best_label is None or best_distance > MAX_FACING_DISTANCE:
        return None, best_distance
    return best_label, best_distance


def main() -> int:
    if not MASTER_PATH.exists():
        print(f"Missing master data: {MASTER_PATH}", file=sys.stderr)
        return 1

    records = json.loads(MASTER_PATH.read_text(encoding="utf-8"))
    roads = [record for record in records if record.get("category") == "road"]
    plots = [record for record in records if record.get("category") == "plot"]

    assigned = 0
    unassigned: list[str] = []

    for plot in plots:
        plot_id = str(plot["id"])
        points = plot.get("points")
        if not isinstance(points, list) or len(points) < 3:
            plot["facingRoad"] = None
            unassigned.append(plot_id)
            continue

        facing, distance = find_facing_road(polygon_edges(points), roads)
        if facing:
            plot["facingRoad"] = facing
            assigned += 1
        else:
            plot["facingRoad"] = None
            unassigned.append(plot_id)
            print(
                f"  [review] plot {plot_id}: nearest road {distance:.2f} units "
                f"(threshold {MAX_FACING_DISTANCE})",
                file=sys.stderr,
            )

    MASTER_PATH.write_text(
        json.dumps(records, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print("Facing road assignment summary")
    print(f"  Total plot records: {len(plots)}")
    print(f"  Assigned facingRoad: {assigned}")
    print(f"  Unassigned (needs review): {len(unassigned)}")
    if unassigned:
        print(f"  Unassigned plot ids: {', '.join(unassigned)}")
    else:
        print("  All plots assigned.")

    sample_ids = ["75", "96", "178", "180"]
    print("\nSample assignments:")
    by_id = {str(plot["id"]): plot for plot in plots}
    for sample_id in sample_ids:
        sample = by_id.get(sample_id)
        if sample:
            print(f"  Plot {sample_id}: {sample.get('facingRoad')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
