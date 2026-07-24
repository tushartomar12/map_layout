#!/usr/bin/env python3
"""Extract exact plot path `d` attributes from full-layout.svg."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SVG_PATH = ROOT / "plot-digitization" / "assets" / "full-layout.svg"
OUT_PATH = ROOT / "plot-map-app" / "data" / "plot-paths.json"

PATTERN = re.compile(r'<path[^>]*\bid="(\d+)"[^>]*\bd="([^"]+)"')


def main() -> None:
    svg = SVG_PATH.read_text(encoding="utf-8")
    paths = {match.group(1): match.group(2) for match in PATTERN.finditer(svg)}
    OUT_PATH.write_text(
        json.dumps(paths, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Extracted {len(paths)} plot paths -> {OUT_PATH}")
    print("sample 10:", paths.get("10"))


if __name__ == "__main__":
    main()
