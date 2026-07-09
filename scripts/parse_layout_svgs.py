from __future__ import annotations

import json
import math
import re
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

from svgelements import Matrix, Path as SVGPath

ROOT = Path(r"C:\Users\Tushar Tomar\plot-map")
ASSETS = ROOT / "plot-digitization" / "assets"
PLOTS = json.loads((ROOT / "plot-map-app" / "data" / "plots.master.json").read_text(encoding="utf-8"))
OUT = ROOT / "plot-map-app" / "data" / "layout.master.json"

FILE_SPECS = [
    {
        "file": "road.svg",
        "type": "road",
        "group_ids": {"road", "Road"},
        "id_prefix": "road",
    },
    {
        "file": "park.svg",
        "type": "park",
        "group_ids": {"park"},
        "id_prefix": "park",
    },
    {
        "file": "Canals.svg",
        "type": "water",
        "group_ids": {"Canals"},
        "id_prefix": "canal",
    },
]


def strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1]


def load_svg(path: Path) -> ET.Element:
    text = path.read_text(encoding="utf-8", errors="ignore")
    text = re.sub(r'xlink:href="data:image[^"]*"', 'xlink:href=""', text)
    text = re.sub(r'href="data:image[^"]*"', 'href=""', text)
    return ET.fromstring(text)


def parents_map(root: ET.Element) -> dict[ET.Element, ET.Element]:
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
            return value.strip() or None
    return None


def local_matrix(el: ET.Element) -> Matrix:
    t = el.get("transform") or transform_from_style(el.get("style"))
    return Matrix(t) if t else Matrix()


def abs_matrix(el: ET.Element, parents: dict[ET.Element, ET.Element]) -> Matrix:
    chain: list[ET.Element] = []
    cur: ET.Element | None = el
    while cur is not None:
        chain.append(cur)
        cur = parents.get(cur)
    m = Matrix()
    for node in reversed(chain):
        m *= local_matrix(node)
    return m


def apply_m(points: list[list[float]], m: Matrix) -> list[list[float]]:
    out: list[list[float]] = []
    for x, y in points:
        out.append([m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f])
    return out


def round_pts(points: list[list[float]], precision: int = 3) -> list[list[float]]:
    result: list[list[float]] = []
    for x, y in points:
        pt = [round(x, precision), round(y, precision)]
        if not result or result[-1] != pt:
            result.append(pt)
    if len(result) > 1 and result[0] == result[-1]:
        result.pop()
    return result


def extract_local_points(el: ET.Element) -> list[list[float]]:
    tag = strip_ns(el.tag)
    if tag == "path":
        d = el.get("d")
        if not d:
            return []
        path = SVGPath(d)
        pts: list[list[float]] = []
        # Prefer denser sampling for filled infrastructure shapes
        length = path.length(error=1e-3)
        if length and length > 0:
            steps = max(24, min(180, int(length / 8) + 1))
            for i in range(steps):
                p = path.point(i / (steps - 1))
                pts.append([float(p.real), float(p.imag)])
        else:
            for seg in path.segments():
                end = getattr(seg, "end", None)
                if end is not None:
                    pts.append([float(end.real), float(end.imag)])
        return pts
    if tag == "polygon" or tag == "polyline":
        raw = (el.get("points") or "").replace(",", " ").split()
        nums = [float(v) for v in raw]
        return [[nums[i], nums[i + 1]] for i in range(0, len(nums) - 1, 2)]
    if tag == "rect":
        x = float(el.get("x") or 0)
        y = float(el.get("y") or 0)
        w = float(el.get("width") or 0)
        h = float(el.get("height") or 0)
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
    return []


def shape_signature(points: list[list[float]]) -> tuple:
    if not points:
        return ()
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (
        round(min(xs), 1),
        round(min(ys), 1),
        round(max(xs), 1),
        round(max(ys), 1),
        len(points),
    )


def find_group(root: ET.Element, group_ids: set[str]) -> ET.Element | None:
    for el in root.iter():
        if strip_ns(el.tag) == "g" and el.get("id") in group_ids:
            return el
    return None


def is_descendant(el: ET.Element, ancestor: ET.Element, parents: dict[ET.Element, ET.Element]) -> bool:
    cur: ET.Element | None = el
    while cur is not None:
        if cur is ancestor:
            return True
        cur = parents.get(cur)
    return False


def extract_group_shapes(
    root: ET.Element,
    group_ids: set[str],
) -> list[tuple[str | None, list[list[float]]]]:
    parents = parents_map(root)
    group = find_group(root, group_ids)
    if group is None:
        return []

    # Prefer leaf shapes under the group. For road.svg, prefer the outer "road"
    # group and take unique geometries.
    shapes: list[tuple[str | None, list[list[float]]]] = []
    seen: set[tuple] = set()
    for el in group.iter():
        tag = strip_ns(el.tag)
        if tag not in {"path", "polygon", "polyline", "rect"}:
            continue
        if not is_descendant(el, group, parents):
            continue
        # Skip pure stroke duplicates without fill? keep all unique geometry
        local = extract_local_points(el)
        if len(local) < 3:
            continue
        abs_pts = round_pts(apply_m(local, abs_matrix(el, parents)))
        sig = shape_signature(abs_pts)
        if sig in seen:
            continue
        seen.add(sig)
        shapes.append((el.get("id"), abs_pts))
    return shapes


def centroid(points: list[list[float]]) -> list[float]:
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    n = max(len(points), 1)
    return [sx / n, sy / n]


def find_element_points(root: ET.Element, eid: str) -> list[list[float]] | None:
    parents = parents_map(root)
    for el in root.iter():
        if el.get("id") != eid:
            continue
        local = extract_local_points(el)
        if len(local) < 3:
            # grouped shape
            if strip_ns(el.tag) == "g":
                pts: list[list[float]] = []
                for child in el.iter():
                    if strip_ns(child.tag) in {"path", "polygon", "polyline", "rect"} and child is not el:
                        local_child = extract_local_points(child)
                        if len(local_child) >= 3:
                            pts.extend(apply_m(local_child, abs_matrix(child, parents)))
                if len(pts) >= 3:
                    return round_pts(pts)
            continue
        return round_pts(apply_m(local, abs_matrix(el, parents)))
    return None


def plot_points(pid: str) -> list[list[float]]:
    return next(p["points"] for p in PLOTS if p["id"] == pid)


def similarity_from_pairs(
    src_pairs: list[tuple[list[float], list[float]]],
) -> tuple[float, float, float, float]:
    """Estimate uniform scale + rotation + translation from point pairs.
    Returns (scale, angle, tx, ty) mapping src -> dst.
    """
    if len(src_pairs) < 2:
        raise ValueError("Need at least 2 pairs")

    sx = sum(a[0] for a, _ in src_pairs) / len(src_pairs)
    sy = sum(a[1] for a, _ in src_pairs) / len(src_pairs)
    dx = sum(b[0] for _, b in src_pairs) / len(src_pairs)
    dy = sum(b[1] for _, b in src_pairs) / len(src_pairs)

    num = 0.0
    den = 0.0
    for (ax, ay), (bx, by) in src_pairs:
        ax0, ay0 = ax - sx, ay - sy
        bx0, by0 = bx - dx, by - dy
        num += ax0 * by0 - ay0 * bx0
        den += ax0 * bx0 + ay0 * by0
    angle = math.atan2(num, den)
    # Scale from rms ratio after best rotation is awkward; use distance ratios
    ratios: list[float] = []
    for i in range(len(src_pairs)):
        for j in range(i + 1, len(src_pairs)):
            (a1x, a1y), (b1x, b1y) = src_pairs[i]
            (a2x, a2y), (b2x, b2y) = src_pairs[j]
            sa = math.hypot(a2x - a1x, a2y - a1y)
            sb = math.hypot(b2x - b1x, b2y - b1y)
            if sa > 1e-6:
                ratios.append(sb / sa)
    scale = sum(ratios) / len(ratios) if ratios else 1.0
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    # Recompute translation with known scale/rotation around src centroid
    # R*(p - src_c)*s + dst_c
    # verify
    tx = dx - scale * (cos_a * sx - sin_a * sy)
    ty = dy - scale * (sin_a * sx + cos_a * sy)
    # Wait: formula for transform p' = s*R*p + t
    # Using Procrustes: p' = s*R*(p - mean_src) + mean_dst
    # => t_effective for s*R*p + t : t = mean_dst - s*R*mean_src
    rx = scale * (cos_a * sx - sin_a * sy)
    ry = scale * (sin_a * sx + cos_a * sy)
    tx = dx - rx
    ty = dy - ry
    return scale, angle, tx, ty


def apply_similarity(
    points: list[list[float]],
    scale: float,
    angle: float,
    tx: float,
    ty: float,
) -> list[list[float]]:
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    out: list[list[float]] = []
    for x, y in points:
        xr = scale * (cos_a * x - sin_a * y) + tx
        yr = scale * (sin_a * x + cos_a * y) + ty
        out.append([xr, yr])
    return round_pts(out)


def collect_alignment_pairs(root: ET.Element) -> list[tuple[list[float], list[float]]]:
    """Match known plot/landmark IDs between this SVG and plots.master."""
    id_map = {
        "AmenityArea": "amenity-area",
        "PlayArea": "PlayArea",
        "Canal1": "canal1",
        "Canal2": "canal2",
        "clubhouse": "clubhouse",
    }
    pairs: list[tuple[list[float], list[float]]] = []
    # Include numbered plots if present
    for n in range(1, 183):
        id_map[str(n)] = str(n)

    for svg_id, master_id in id_map.items():
        svg_pts = find_element_points(root, svg_id)
        if not svg_pts:
            continue
        try:
            master_pts = plot_points(master_id)
        except StopIteration:
            continue
        pairs.append((centroid(svg_pts), centroid(master_pts)))
    return pairs


def estimate_file_transform(path: Path) -> tuple[float, float, float, float]:
    root = load_svg(path)
    pairs = collect_alignment_pairs(root)
    print(f"{path.name}: {len(pairs)} landmark pairs for alignment")
    if len(pairs) >= 2:
        scale, angle, tx, ty = similarity_from_pairs(pairs)
        # residual check
        errs = []
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        for (sx, sy), (dx, dy) in pairs:
            px = scale * (cos_a * sx - sin_a * sy) + tx
            py = scale * (sin_a * sx + cos_a * sy) + ty
            errs.append(math.hypot(px - dx, py - dy))
        print(
            f"  transform scale={scale:.5f} angle_deg={math.degrees(angle):.3f} "
            f"tx={tx:.2f} ty={ty:.2f} mean_err={sum(errs)/len(errs):.2f}"
        )
        return scale, angle, tx, ty
    if len(pairs) == 1:
        (sx, sy), (dx, dy) = pairs[0]
        return 1.0, 0.0, dx - sx, dy - sy
    print("  WARNING: no landmarks; identity transform")
    return 1.0, 0.0, 0.0, 0.0


def main() -> None:
    records: list[dict] = []
    type_counts: Counter[str] = Counter()

    for spec in FILE_SPECS:
        path = ASSETS / spec["file"]
        root = load_svg(path)
        transform = estimate_file_transform(path)
        shapes = extract_group_shapes(root, set(spec["group_ids"]))
        print(f"{path.name}: extracted {len(shapes)} unique {spec['type']} shapes")
        for index, (sid, points) in enumerate(shapes, start=1):
            aligned = apply_similarity(points, *transform)
            if len(aligned) < 3:
                continue
            rec_id = sid or f"{spec['id_prefix']}-{index}"
            # normalize id casing/spaces
            safe = re.sub(r"[^A-Za-z0-9_-]+", "-", rec_id).strip("-").lower()
            if not safe.startswith(spec["id_prefix"]):
                safe = f"{spec['id_prefix']}-{safe}" if safe else f"{spec['id_prefix']}-{index}"
            # ensure unique
            base = safe
            n = 2
            existing = {r["id"] for r in records}
            while safe in existing:
                safe = f"{base}-{n}"
                n += 1
            records.append(
                {
                    "id": safe,
                    "type": spec["type"],
                    "points": aligned,
                }
            )
            type_counts[spec["type"]] += 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print("\nWrote", OUT)
    print("counts", dict(type_counts))
    print("total", len(records))


if __name__ == "__main__":
    main()
