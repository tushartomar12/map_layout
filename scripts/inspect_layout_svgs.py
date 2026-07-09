from __future__ import annotations

import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(r"C:\Users\Tushar Tomar\plot-map")
ASSETS = ROOT / "plot-digitization" / "assets"
PLOTS = ROOT / "plot-map-app" / "data" / "plots.master.json"


def strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1]


def sample_d(d: str | None, n: int = 80) -> str:
    if not d:
        return ""
    return d[:n]


def summarize(path: Path) -> None:
    print("=" * 60)
    print(path.name, "bytes", path.stat().st_size)
    # Avoid loading huge base64 into ElementTree if possible by stripping image hrefs
    text = path.read_text(encoding="utf-8", errors="ignore")
    text = re.sub(r'xlink:href="data:image[^"]*"', 'xlink:href=""', text)
    text = re.sub(r'href="data:image[^"]*"', 'href=""', text)
    root = ET.fromstring(text)
    print("viewBox", root.get("viewBox"), "width", root.get("width"), "height", root.get("height"))

    groups = {}
    for el in root.iter():
        if strip_ns(el.tag) == "g" and el.get("id"):
            groups[el.get("id")] = el
    print("groups:", list(groups)[:30])

    for gid in ("road", "Road", "park", "Canals"):
        g = groups.get(gid)
        if g is None:
            continue
        children = []
        for child in g.iter():
            tag = strip_ns(child.tag)
            if tag in {"path", "polygon", "polyline", "rect"} and child is not g:
                children.append((tag, child.get("id"), sample_d(child.get("d") or child.get("points"))))
        print(f"  group {gid}: {len(children)} shapes")
        for row in children[:20]:
            print("   ", row)

    # Compare AmenityArea if present
    plots = json.loads(PLOTS.read_text(encoding="utf-8"))
    amenity = next(p for p in plots if p["id"] == "amenity-area")
    print("plots amenity first point", amenity["points"][0])
    for el in root.iter():
        if el.get("id") in {"AmenityArea", "amenity-area"}:
            print("svg AmenityArea d sample", sample_d(el.get("d"), 120))


for name in ("road.svg", "park.svg", "Canals.svg"):
    summarize(ASSETS / name)
