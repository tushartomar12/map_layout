#!/usr/bin/env python3
"""Update plot status from the 'List of Unsold Plots' PDF extract.

Source of truth: plot-map-app/data/plots.master.json
(no Phase 4 / live database is active in this project).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
MASTER_PATH = ROOT_DIR / "plot-map-app" / "data" / "plots.master.json"

# Also keep the digitization master in sync when present.
DIGITIZATION_V2_PATH = (
    ROOT_DIR / "plot-digitization" / "data" / "plots.master.v2.json"
)

UNSOLD_IDS = {
    "21",
    "24",
    "25",
    "28",
    "29",
    "32",
    "33",
    "36",
    "37",
    "40",
    "44",
    "45",
    "46",
    "49",
    "50",
    "55",
    "56",
    "59",
    "60",
    "61",
    "62",
    "114",
    "115",
    "116",
    "119",
    "120",
    "121",
    "124",
    "125",
    "126",
    "129",
    "130",
    "131",
    "134",
    "135",
    "136",
    "139",
    "140",
    "144",
    "145",
    "146",
    "149",
    "150",
    "153",
    "157",
    "160",
    "161",
    "162",
    "163",
    "168",
}

CONFIRMED_AREA_SQM = 193.75


def update_records(records: list[dict]) -> dict:
    available_count = 0
    sold_count = 0
    plot_ids: set[str] = set()

    for record in records:
        if record.get("category") != "plot":
            continue

        plot_id = str(record["id"])
        plot_ids.add(plot_id)

        if plot_id in UNSOLD_IDS:
            record["status"] = "available"
            record["areaSqM"] = CONFIRMED_AREA_SQM
            record["dataComplete"] = True
            available_count += 1
        else:
            record["status"] = "sold"
            sold_count += 1

    missing_unsold = sorted(
        plot_id for plot_id in UNSOLD_IDS if plot_id not in plot_ids
    )

    return {
        "available_count": available_count,
        "sold_count": sold_count,
        "total_sellable": available_count + sold_count,
        "missing_unsold": missing_unsold,
    }


def write_json(path: Path, records: list[dict]) -> None:
    path.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    if not MASTER_PATH.exists():
        print(f"Missing source of truth: {MASTER_PATH}", file=sys.stderr)
        return 1

    print(f"Source of truth: {MASTER_PATH}")
    print("Backend/database: not active — using JSON master file.")

    records = json.loads(MASTER_PATH.read_text(encoding="utf-8"))
    summary = update_records(records)
    write_json(MASTER_PATH, records)
    print(f"Wrote updates to {MASTER_PATH}")

    if DIGITIZATION_V2_PATH.exists():
        digitization_records = json.loads(
            DIGITIZATION_V2_PATH.read_text(encoding="utf-8")
        )
        update_records(digitization_records)
        write_json(DIGITIZATION_V2_PATH, digitization_records)
        print(f"Also synced {DIGITIZATION_V2_PATH}")

    print()
    print("=== Summary ===")
    print(f"Total plots marked available: {summary['available_count']}")
    print(f"Total plots marked sold: {summary['sold_count']}")
    print(f"Total sellable plots: {summary['total_sellable']}")
    print(
        "Expected sold: "
        f"{summary['total_sellable'] - len(UNSOLD_IDS)} "
        f"(total sellable - {len(UNSOLD_IDS)} unsold)"
    )
    if summary["missing_unsold"]:
        print(
            "Unsold ids NOT found among plot records: "
            + ", ".join(summary["missing_unsold"])
        )
    else:
        print("Unsold ids NOT found among plot records: none (0)")

    ok = (
        summary["available_count"] == 50
        and summary["sold_count"] == summary["total_sellable"] - 50
        and not summary["missing_unsold"]
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
