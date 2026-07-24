#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

try:
    from svgelements import Matrix
    from svgelements import Path as SVGPath
    from svgelements import SVG
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "This script requires the 'svgelements' package.\n"
        "Install it with: pip install svgelements"
    ) from exc


ROOT_DIR = Path(__file__).resolve().parent
SVG_PATH = ROOT_DIR / "plot-digitization" / "assets" / "full-layout.svg"
OUTPUT_PATH = ROOT_DIR / "plot-digitization" / "data" / "full-layout.json"
EXPECTED_PLOT_IDS = {str(i) for i in range(1, 183)}
SKIP_SHAPE_IDS = {"page-16-hires 1"}
ID_ALIASES = {
    "Aminity Area": "amenity-area",
}


def strip_namespace(tag: str) -> str:
    return tag.split("}", 1)[-1]


def parse_number(value: str | None, default: float = 0.0) -> float:
    if value is None:
        return default

    cleaned = value.strip()
    for suffix in ("px", "pt", "pc", "cm", "mm", "in"):
        if cleaned.endswith(suffix):
            cleaned = cleaned[: -len(suffix)]
            break
    return float(cleaned)


def round_point(x: float, y: float, precision: int = 3) -> list[float]:
    return [round(x, precision), round(y, precision)]


def dedupe_consecutive(points: Iterable[list[float]]) -> list[list[float]]:
    result: list[list[float]] = []
    for point in points:
        if not result or result[-1] != point:
            result.append(point)
    if len(result) > 1 and result[0] == result[-1]:
        result.pop()
    return result


def build_parent_map(root: ET.Element) -> dict[ET.Element, ET.Element]:
    parents: dict[ET.Element, ET.Element] = {}
    for parent in root.iter():
        for child in parent:
            parents[child] = parent
    return parents


def transform_from_style(style_attr: str | None) -> str | None:
    if not style_attr:
        return None
    for part in style_attr.split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        if key.strip().lower() == "transform":
            cleaned = value.strip()
            return cleaned or None
    return None


def element_local_matrix(element: ET.Element) -> Matrix:
    transform_attr = element.get("transform") or transform_from_style(element.get("style"))
    if not transform_attr:
        return Matrix()
    return Matrix(transform_attr)


def absolute_matrix(
    element: ET.Element,
    parents: dict[ET.Element, ET.Element],
) -> Matrix:
    """CTM from the SVG root down through this element's own transform."""
    chain: list[ET.Element] = []
    current: ET.Element | None = element
    while current is not None:
        chain.append(current)
        current = parents.get(current)

    matrix = Matrix()
    for node in reversed(chain):
        if strip_namespace(node.tag) == "svg":
            continue
        matrix *= element_local_matrix(node)
    return matrix


def apply_matrix(points: list[list[float]], matrix: Matrix) -> list[list[float]]:
    transformed: list[list[float]] = []
    for x, y in points:
        px = matrix.a * x + matrix.c * y + matrix.e
        py = matrix.b * x + matrix.d * y + matrix.f
        transformed.append(round_point(px, py))
    return dedupe_consecutive(transformed)


def parse_points_attribute(points_attr: str) -> list[list[float]]:
    raw_tokens = points_attr.replace(",", " ").split()
    if len(raw_tokens) % 2 != 0:
        raise ValueError(f"Invalid points attribute: {points_attr!r}")

    points = []
    for i in range(0, len(raw_tokens), 2):
        x = float(raw_tokens[i])
        y = float(raw_tokens[i + 1])
        points.append([x, y])
    return dedupe_consecutive(points)


def rect_to_points(element: ET.Element) -> list[list[float]]:
    x = parse_number(element.get("x"), 0.0)
    y = parse_number(element.get("y"), 0.0)
    width = parse_number(element.get("width"), 0.0)
    height = parse_number(element.get("height"), 0.0)

    points = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
    ]
    return dedupe_consecutive(points)


def path_to_points(d_attr: str) -> list[list[float]]:
    path = SVGPath(d_attr)
    if path.segments() == 0:
        return []

    total_length = float(path.length(error=1e-4))
    sample_count = max(4, min(400, int(math.ceil(total_length / 12.0))))

    points = []
    for index in range(sample_count):
        position = index / sample_count
        point = path.point(position)
        points.append([point.real, point.imag])

    first_point = path.point(0)
    points.insert(0, [first_point.real, first_point.imag])
    return dedupe_consecutive(points)


def normalize_shape_id(raw_id: str) -> str | None:
    if raw_id in SKIP_SHAPE_IDS:
        return None
    return ID_ALIASES.get(raw_id, raw_id)


def categorize_shape(shape_id: str) -> str:
    if shape_id.isdigit():
        return "plot"
    if shape_id.lower().startswith("road"):
        return "road"
    return "landmark"


def extract_local_points(element: ET.Element) -> list[list[float]]:
    tag = strip_namespace(element.tag)

    if tag in {"polygon", "polyline"}:
        points_attr = element.get("points")
        if not points_attr:
            raise ValueError("Missing points attribute")
        return parse_points_attribute(points_attr)

    if tag == "rect":
        return rect_to_points(element)

    if tag == "path":
        d_attr = element.get("d")
        if not d_attr:
            raise ValueError("Missing path data")
        return path_to_points(d_attr)

    raise ValueError(f"Unsupported shape tag: <{tag}>")


def extract_absolute_points(
    element: ET.Element,
    parents: dict[ET.Element, ET.Element],
) -> list[list[float]]:
    local_points = extract_local_points(element)
    return apply_matrix(local_points, absolute_matrix(element, parents))


def pick_preferred_geometry(
    candidates: list[tuple[ET.Element, list[list[float]]]],
) -> list[list[float]]:
    """Prefer a filled shape over stroke-only duplicates when present."""
    for element, points in candidates:
        fill = (element.get("fill") or "").strip().lower()
        if fill and fill not in {"none", "transparent"}:
            return points
    return candidates[0][1]


def extract_group_points(
    group_element: ET.Element,
    parents: dict[ET.Element, ET.Element],
) -> list[list[float]]:
    unique_candidates: list[tuple[ET.Element, list[list[float]]]] = []
    seen_signatures: set[str] = set()

    for descendant in group_element.iter():
        if descendant is group_element:
            continue

        tag = strip_namespace(descendant.tag)
        if tag not in {"path", "polygon", "polyline", "rect"}:
            continue

        # Absolute points include this shape's transform plus every ancestor
        # (the group itself and any parent groups).
        points = extract_absolute_points(descendant, parents)
        if not points:
            continue

        signature = json.dumps(points, separators=(",", ":"))
        if signature in seen_signatures:
            continue

        seen_signatures.add(signature)
        unique_candidates.append((descendant, points))

    if not unique_candidates:
        raise ValueError("Group contains no supported geometry")

    return pick_preferred_geometry(unique_candidates)


def get_svg_space(root: ET.Element) -> str:
    view_box = root.get("viewBox")
    if view_box:
        return f"viewBox={view_box}"

    width = root.get("width")
    height = root.get("height")
    if width or height:
        return f"width={width}, height={height}"

    return "No viewBox/width/height found"


def iter_named_shapes(root: ET.Element) -> list[ET.Element]:
    """Collect named shapes, descending through container groups like plots/roads."""
    shapes: list[ET.Element] = []

    for element in root.iter():
        raw_id = element.get("id")
        if not raw_id:
            continue

        tag = strip_namespace(element.tag)
        if tag in {"path", "polygon", "polyline", "rect"}:
            shapes.append(element)
            continue

        if tag != "g":
            continue

        child_shapes = [
            child
            for child in element
            if strip_namespace(child.tag) in {"path", "polygon", "polyline", "rect", "g"}
        ]
        named_child_shapes = [child for child in child_shapes if child.get("id")]
        if named_child_shapes:
            # Container group (e.g. plots, roads, Canal) — children are parsed individually.
            continue

        shapes.append(element)

    return shapes


def main() -> int:
    if not SVG_PATH.exists():
        print(f"SVG file not found: {SVG_PATH}", file=sys.stderr)
        return 1

    tree = ET.parse(SVG_PATH)
    root = tree.getroot()
    parents = build_parent_map(root)

    # Parse with svgelements once up front to validate the document is supported.
    SVG.parse(str(SVG_PATH))

    print(f"SVG coordinate space: {get_svg_space(root)}")

    results = []
    seen_source_ids: list[str] = []
    skipped: list[str] = []

    for element in iter_named_shapes(root):
        raw_id = element.get("id")
        if not raw_id:
            continue

        shape_id = normalize_shape_id(raw_id)
        if shape_id is None:
            skipped.append(f"{raw_id} (background reference)")
            continue

        tag = strip_namespace(element.tag)
        try:
            if tag == "g":
                points = extract_group_points(element, parents)
            elif tag in {"path", "polygon", "polyline", "rect"}:
                points = extract_absolute_points(element, parents)
            else:
                skipped.append(f"{raw_id} (<{tag}>)")
                continue
        except ValueError as exc:
            skipped.append(f"{raw_id} ({exc})")
            continue

        if not points:
            skipped.append(f"{raw_id} (empty geometry)")
            continue

        results.append(
            {
                "id": shape_id,
                "points": points,
                "category": categorize_shape(shape_id),
            }
        )
        seen_source_ids.append(shape_id)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")

    category_counts = Counter(item["category"] for item in results)
    road_ids = sorted(
        [item["id"] for item in results if item["category"] == "road"],
        key=lambda value: (not value[4:].isdigit() if value.startswith("road") else True, value),
    )
    landmark_ids = sorted(
        [item["id"] for item in results if item["category"] == "landmark"],
        key=lambda value: (value.lower(), value),
    )
    plot_ids = {item["id"] for item in results if item["category"] == "plot"}

    counts = Counter(seen_source_ids)
    duplicate_ids = sorted([shape_id for shape_id, count in counts.items() if count > 1])
    missing_plot_ids = sorted(EXPECTED_PLOT_IDS - plot_ids, key=lambda value: int(value))

    unnamed_paths = sum(
        1 for element in root.iter() if strip_namespace(element.tag) == "path" and not element.get("id")
    )

    print(f"Output written to: {OUTPUT_PATH}")
    print(f"Total shapes parsed: {len(results)}")
    print(
        "By category: "
        + ", ".join(f"{category}={category_counts.get(category, 0)}" for category in ("plot", "road", "landmark"))
    )

    if road_ids:
        print(f"Road ids ({len(road_ids)}): {', '.join(road_ids)}")
    else:
        print("Road ids: none")

    if landmark_ids:
        print(f"Landmark ids ({len(landmark_ids)}): {', '.join(landmark_ids)}")
    else:
        print("Landmark ids: none")

    if duplicate_ids:
        print(f"DUPLICATE IDS: {', '.join(duplicate_ids)}")
    else:
        print("Duplicate ids: none")

    if missing_plot_ids:
        print(f"MISSING EXPECTED PLOT IDS (1-182): {', '.join(missing_plot_ids)}")
    else:
        print("Missing expected plot ids (1-182): none")

    if unnamed_paths:
        print(
            f"WARNING: {unnamed_paths} <path> elements have no id attribute. "
            "Re-export the SVG from Figma with 'Include id attribute' enabled."
        )

    if skipped:
        print(f"Skipped elements: {', '.join(skipped)}")
    else:
        print("Skipped elements: none")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
