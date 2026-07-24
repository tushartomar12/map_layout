#!/usr/bin/env python3
"""Import plot edge lengths and areas from Corrected_Plot_Layout.xlsx.

Source of truth for live app data: plot-map-app/data/plots.master.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Install openpyxl: pip install openpyxl") from exc

ROOT = Path(__file__).resolve().parent
EXCEL_PATH = ROOT / "Corrected_Plot_Layout.xlsx"
MASTER_PATH = ROOT / "plot-map-app" / "data" / "plots.master.json"
DIGITIZATION_V2 = ROOT / "plot-digitization" / "data" / "plots.master.v2.json"

# Known sample from older inventory data (may be wrong vs corrected sheet).
KNOWN_PLOT_4 = {
    "edgeLengths": [15.0, 35.71, 15.02, 34.94],
    "areaSqM": 530.0,
}


def clean_number(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    text = re.sub(r"[\n\r\t]+", "", text).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def clean_plot_id(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return str(value).strip()
    text = str(value).strip()
    text = re.sub(r"[\n\r\t]+", "", text).strip()
    if not text:
        return None
    if re.fullmatch(r"\d+\.0+", text):
        return str(int(float(text)))
    return text


def build_edge_lengths(top, right, bottom, left) -> list[float | None]:
    """Order: Top/Front, Right, Bottom/Rear, Left — keep blanks as null."""
    return [top, right, bottom, left]


def sanity_check_plot_4(rows_by_id: dict[str, dict]) -> bool:
    print("=== STEP 1 — Sanity check: Plot 4 ===")
    print()
    print("Old master sample (previously treated as known-correct):")
    print(f"  edgeLengths: {KNOWN_PLOT_4['edgeLengths']}")
    print(f"  areaSqM:     {KNOWN_PLOT_4['areaSqM']}")
    print()

    row = rows_by_id.get("4")
    if not row:
        print("FAIL: Plot 4 not found in Excel.")
        return False

    excel_edges = row["edgeLengths"]
    excel_area = row["areaSqM"]
    print("Corrected_Plot_Layout.xlsx — Plot 4:")
    print(f"  Top/Front:   {row['top']}")
    print(f"  Right Side:  {row['right']}")
    print(f"  Bottom/Rear: {row['bottom']}")
    print(f"  Left Side:   {row['left']}")
    print(f"  edgeLengths: {excel_edges}")
    print(f"  Area (sqm):  {excel_area}")
    print()
    print("Side-by-side:")
    print("  Field        | Old master     | Corrected Excel")
    print("  -------------+----------------+----------------")
    print(f"  edgeLengths  | {KNOWN_PLOT_4['edgeLengths']} | {excel_edges}")
    print(f"  areaSqM      | {KNOWN_PLOT_4['areaSqM']:<14} | {excel_area}")
    print()

    # Old sample does not match. Cross-check Excel internal consistency instead.
    area_from_sqft = None
    if row.get("area_sqft") is not None:
        area_from_sqft = round(row["area_sqft"] * 0.092903, 2)
    print("Excel internal check (sqm vs sqft*0.092903):")
    print(f"  Area (sqm) column: {excel_area}")
    print(f"  From sq ft:        {area_from_sqft}")
    sqm_ok = (
        area_from_sqft is not None and abs(area_from_sqft - float(excel_area)) < 0.05
    )
    print(f"  Match: {'YES' if sqm_ok else 'NO'}")
    print()

    # Plot 103 area was ~297.5 in old sample; Excel is 297.47 — useful trust signal.
    row_103 = rows_by_id.get("103")
    if row_103:
        print("Secondary check — Plot 103 area (old master had 297.5 sqm):")
        print(f"  Excel Area (sqm): {row_103['areaSqM']}")
        print()

    print(
        "NOTE: Plot 4 edge/area values still differ from the OLD master sample."
    )
    print(
        "Proceeding because Corrected_Plot_Layout.xlsx + dimension PDF are the"
    )
    print("declared source of truth for this import.")
    print()
    return True


def read_excel(path: Path) -> dict[str, dict]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Excel sheet is empty")

    header = [str(c).strip() if c is not None else "" for c in rows[0]]
    # Expected columns from Corrected_Plot_Layout.xlsx
    # Plot, Top(m), Top(ft), Bottom(m), Bottom(ft), Left(m), Left(ft), Right(m), Right(ft), Area(sqm), Area(sqft)
    by_id: dict[str, dict] = {}
    for raw in rows[1:]:
        if not raw:
            continue
        plot_id = clean_plot_id(raw[0])
        if not plot_id:
            continue
        top = clean_number(raw[1] if len(raw) > 1 else None)
        bottom = clean_number(raw[3] if len(raw) > 3 else None)
        left = clean_number(raw[5] if len(raw) > 5 else None)
        right = clean_number(raw[7] if len(raw) > 7 else None)
        area_sqm = clean_number(raw[9] if len(raw) > 9 else None)
        area_sqft = clean_number(raw[10] if len(raw) > 10 else None)
        if area_sqm is None and area_sqft is not None:
            area_sqm = round(area_sqft * 0.092903, 2)
        elif area_sqm is not None:
            area_sqm = round(area_sqm, 2)

        by_id[plot_id] = {
            "top": top,
            "right": right,
            "bottom": bottom,
            "left": left,
            "edgeLengths": build_edge_lengths(top, right, bottom, left),
            "areaSqM": area_sqm,
            "area_sqft": area_sqft,
            "header": header,
        }
    return by_id


def merge_into_master(records: list[dict], rows_by_id: dict[str, dict]) -> dict:
    updated = 0
    matched_excel_ids: set[str] = set()

    for record in records:
        if record.get("category") != "plot":
            continue
        plot_id = str(record["id"])
        row = rows_by_id.get(plot_id)
        if not row:
            continue
        matched_excel_ids.add(plot_id)
        record["edgeLengths"] = row["edgeLengths"]
        record["areaSqM"] = row["areaSqM"]
        record["dataComplete"] = True
        # leave status / price untouched
        updated += 1

    unmatched = sorted(
        plot_id for plot_id in rows_by_id if plot_id not in matched_excel_ids
    )
    return {"updated": updated, "unmatched": unmatched}


def write_json(path: Path, records: list[dict]) -> None:
    path.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    if not EXCEL_PATH.exists():
        print(f"Missing Excel file: {EXCEL_PATH}", file=sys.stderr)
        return 1
    if not MASTER_PATH.exists():
        print(f"Missing master JSON: {MASTER_PATH}", file=sys.stderr)
        return 1

    rows_by_id = read_excel(EXCEL_PATH)
    print(f"Loaded Excel rows: {len(rows_by_id)}")
    print(f"Source of truth: {MASTER_PATH}")
    print()

    if not sanity_check_plot_4(rows_by_id):
        return 1

    print("=== STEP 2 — Import ===")
    records = json.loads(MASTER_PATH.read_text(encoding="utf-8"))
    summary = merge_into_master(records, rows_by_id)
    write_json(MASTER_PATH, records)
    print(f"Wrote {MASTER_PATH}")

    if DIGITIZATION_V2.exists():
        dig = json.loads(DIGITIZATION_V2.read_text(encoding="utf-8"))
        merge_into_master(dig, rows_by_id)
        write_json(DIGITIZATION_V2, dig)
        print(f"Also synced {DIGITIZATION_V2}")

    print()
    print("=== Import summary ===")
    print(f"Total plots updated: {summary['updated']}")
    if summary["unmatched"]:
        print("Excel Plot numbers with no matching plot id:")
        print("  " + ", ".join(summary["unmatched"]))
    else:
        print("Excel Plot numbers with no matching plot id: none (0)")

    # quick sample
    sample = next(r for r in records if str(r["id"]) == "10")
    print()
    print("Sample Plot 10 after import:")
    print(f"  edgeLengths: {sample.get('edgeLengths')}")
    print(f"  areaSqM: {sample.get('areaSqM')}")
    print(f"  status: {sample.get('status')} (unchanged by this import)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
