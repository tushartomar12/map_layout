#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
INPUT_PATH = ROOT_DIR / "plot-digitization" / "data" / "traced-points.json"
OUTPUT_PATH = ROOT_DIR / "plot-digitization" / "data" / "plots-aligned.json"

SRC_WIDTH = 1789
SRC_HEIGHT = 2588
DST_WIDTH = 1786
DST_HEIGHT = 2526

SCALE_X = DST_WIDTH / SRC_WIDTH
SCALE_Y = DST_HEIGHT / SRC_HEIGHT


def main() -> int:
    plots = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    corrected = []
    for plot in plots:
        points = [
            [round(x * SCALE_X, 3), round(y * SCALE_Y, 3)]
            for x, y in plot["points"]
        ]
        corrected.append(
            {
                "id": plot["id"],
                "points": points,
                "sellable": plot.get("sellable", True),
            }
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(corrected, indent=2), encoding="utf-8")
    print(f"Scale factors: x={SCALE_X:.6f}, y={SCALE_Y:.6f}")
    print(f"Wrote {len(corrected)} plots to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
