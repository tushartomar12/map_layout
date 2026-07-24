#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
LAYOUT_PATH = ROOT_DIR / "plot-digitization" / "data" / "full-layout.json"
SAMPLE_PATH = ROOT_DIR / "plot-digitization" / "data" / "plots.sample.json"
OUTPUT_PATH = ROOT_DIR / "plot-digitization" / "data" / "plots.master.v2.json"

BUSINESS_FIELDS = (
    "edgeLengths",
    "areaSqM",
    "zone",
    "typeOfDevelopment",
    "status",
    "price",
    "sellable",
)

PLACEHOLDER = {
    "edgeLengths": None,
    "areaSqM": None,
    "zone": "Unassigned",
    "typeOfDevelopment": "Residential Detached",
    "status": "under-development",
    "price": None,
}

NON_PLOT_DEFAULTS = {
    "edgeLengths": None,
    "areaSqM": None,
    "zone": None,
    "typeOfDevelopment": None,
    "status": None,
    "price": None,
    "sellable": False,
    "dataComplete": True,
}


def load_json(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def index_by_id(records: list[dict]) -> dict[str, dict]:
    indexed: dict[str, dict] = {}
    for record in records:
        indexed[str(record["id"])] = record
    return indexed


def merge_plot_record(shape: dict, sample: dict | None) -> dict:
    shape_id = str(shape["id"])
    points = shape["points"]

    if sample is not None:
        merged = {
            "id": shape_id,
            "category": "plot",
            "points": points,
            "dataComplete": True,
        }
        for field in BUSINESS_FIELDS:
            if field in sample:
                merged[field] = sample[field]
            elif field == "sellable":
                merged[field] = True
            else:
                merged[field] = None
        return merged

    return {
        "id": shape_id,
        "category": "plot",
        "points": points,
        **PLACEHOLDER,
        "sellable": True,
        "dataComplete": False,
    }


def merge_landmark_record(shape: dict, sample: dict | None) -> dict:
    merged = {
        "id": str(shape["id"]),
        "category": "landmark",
        "points": shape["points"],
        **NON_PLOT_DEFAULTS,
    }

    if sample is not None:
        for field in BUSINESS_FIELDS:
            if field in sample:
                merged[field] = sample[field]
        merged["dataComplete"] = True

    merged["sellable"] = False
    return merged


def merge_road_record(shape: dict) -> dict:
    return {
        "id": str(shape["id"]),
        "category": "road",
        "points": shape["points"],
        **NON_PLOT_DEFAULTS,
    }


def main() -> int:
    try:
        layout_records = load_json(LAYOUT_PATH)
        sample_records = load_json(SAMPLE_PATH)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    sample_by_id = index_by_id(sample_records)
    master: list[dict] = []

    complete_plot_ids: list[str] = []
    placeholder_plot_ids: list[str] = []
    road_ids: list[str] = []
    landmark_ids: list[str] = []
    landmark_with_sample_ids: list[str] = []
    unused_sample_ids: list[str] = []

    for shape in layout_records:
        category = shape.get("category")
        shape_id = str(shape["id"])

        if category == "plot":
            merged = merge_plot_record(shape, sample_by_id.get(shape_id))
            master.append(merged)
            if merged["dataComplete"]:
                complete_plot_ids.append(shape_id)
            else:
                placeholder_plot_ids.append(shape_id)
        elif category == "road":
            master.append(merge_road_record(shape))
            road_ids.append(shape_id)
        elif category == "landmark":
            sample = sample_by_id.get(shape_id)
            merged = merge_landmark_record(shape, sample)
            master.append(merged)
            landmark_ids.append(shape_id)
            if sample is not None:
                landmark_with_sample_ids.append(shape_id)
        else:
            print(f"Skipping unknown category for {shape_id!r}: {category!r}", file=sys.stderr)

    layout_ids = {str(item["id"]) for item in layout_records}
    unused_sample_ids = sorted(sid for sid in sample_by_id if sid not in layout_ids)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(master, indent=2), encoding="utf-8")

    print(f"Wrote {len(master)} records to {OUTPUT_PATH}")
    print(f"Plots with complete real data: {len(complete_plot_ids)}")
    print(f"  ids: {', '.join(complete_plot_ids)}")
    print(f"Plots with placeholder data: {len(placeholder_plot_ids)}")
    print(f"Roads: {len(road_ids)}")
    print(f"  ids: {', '.join(road_ids)}")
    print(f"Landmarks: {len(landmark_ids)}")
    print(f"  ids: {', '.join(landmark_ids)}")
    if landmark_with_sample_ids:
        print(f"Landmarks with sample data: {', '.join(landmark_with_sample_ids)}")
    if unused_sample_ids:
        print(f"Sample ids with no layout geometry: {', '.join(unused_sample_ids)}")
    else:
        print("Sample ids with no layout geometry: none")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
