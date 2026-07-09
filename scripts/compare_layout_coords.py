from __future__ import annotations

import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

try:
    from svgelements import Matrix, Path as SVGPath
except ImportError as exc:
    raise SystemExit("pip install svgelements") from exc

ROOT = Path(r"C:\Users\Tushar Tomar\plot-map")
ASSETS = ROOT / "plot-digitization" / "assets"
PLOTS = json.loads((ROOT / "plot-map-app" / "data" / "plots.master.json").read_text(encoding="utf-8"))
TRACED = json.loads((ROOT / "plot-digitization" / "data" / "traced-points.json").read_text(encoding="utf-8"))


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
    chain = []
    cur: ET.Element | None = el
    while cur is not None:
        chain.append(cur)
        cur = parents.get(cur)
    m = Matrix()
    for node in reversed(chain):
        m *= local_matrix(node)
    return m


def apply_matrix(points: list[list[float]], m: Matrix) -> list[list[float]]:
    out = []
    for x, y in points:
        # Matrix applies as [[a c e],[b d f]]
        px = m.a * x + m.c * y + m.e
        py = m.b * x + m.d * y + m.f
        out.append([round(px, 3), round(py, 3)])
    return out


def path_points(d: str, samples: int = 80) -> list[list[float]]:
    path = SVGPath(d)
    if path.length() == 0:
        # fallback gather commands end points
        pts = []
        for seg in path.segments():
            if hasattr(seg, "end"):
                pts.append([float(seg.end.real), float(seg.end.imag)])
        return pts
    length = path.length()
    pts = []
    for i in range(samples):
        p = path.point(i / (samples - 1))
        pts.append([float(p.real), float(p.imag)])
    # also include explicit polyline-like commands if few segments
    return pts


def find_by_id(root: ET.Element, eid: str) -> ET.Element | None:
    for el in root.iter():
        if el.get("id") == eid:
            return el
    return None


def compare(label: str, master_id: str, svg_id: str) -> None:
    master = next(p for p in PLOTS if p["id"] == master_id)
    traced = next(p for p in TRACED if p["id"] == master_id)
    svg_root = load_svg(ASSETS / "road.svg")
    parents = parents_map(svg_root)
    el = find_by_id(svg_root, svg_id)
    assert el is not None
    local = path_points(el.get("d") or "", 20)
    abs_pts = apply_matrix(local, abs_matrix(el, parents))
    print(label)
    print("  master[0]", master["points"][0], "n", len(master["points"]))
    print("  traced[0]", traced["points"][0])
    print("  road.svg local[0]", local[0] if local else None)
    print("  road.svg abs[0]", abs_pts[0] if abs_pts else None)
    if local and master["points"]:
        dx = master["points"][0][0] - abs_pts[0][0]
        dy = master["points"][0][1] - abs_pts[0][1]
        print("  delta master-svgabs", [round(dx, 3), round(dy, 3)])


compare("Amenity", "amenity-area", "AmenityArea")
compare("PlayArea", "PlayArea", "PlayArea")
compare("canal1", "canal1", "Canal1")
compare("canal2", "canal2", "Canal2")

# Also check plots-group.svg amenity for reference
print("\nplots-group amenity?")
pg = ROOT / "plot-digitization" / "plots-group.svg"
if pg.exists():
    text = pg.read_text(encoding="utf-8", errors="ignore")
    text = re.sub(r'xlink:href="data:image[^"]*"', 'xlink:href=""', text)
    root = ET.fromstring(text)
    el = find_by_id(root, "AmenityArea")
    if el is not None:
        print("  d", (el.get("d") or "")[:120])
        parents = parents_map(root)
        pts = apply_matrix(path_points(el.get("d") or "", 5), abs_matrix(el, parents))
        print("  abs[0]", pts[0] if pts else None)
