#!/usr/bin/env python3
"""Check the dashboard data files before publishing.

Usage:  python3 scripts/check_data.py

Errors (exit code 1) stop a publish: missing columns, bad numbers, duplicate months.
Warnings are printed for figures that do not add up; they do not block a publish,
but each one should be understood (and, if real, explained with a note on that month).
"""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
NUM_MONTHLY = ["learners", "girls", "boys", "pwd", "improved", "improved_girls", "improved_boys",
               "completed", "institutions", "educators"]
errors, warnings = [], []


def load(name, required):
    path = DATA / name
    if not path.exists():
        errors.append(f"{name} is missing")
        return []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = [c for c in required if c not in (reader.fieldnames or [])]
        if missing:
            errors.append(f"{name}: missing columns {missing}")
            return []
        return list(reader)


def to_int(name, row, col):
    v = (row.get(col) or "").strip()
    if v == "":
        return None
    try:
        n = float(v)
    except ValueError:
        errors.append(f"{name} {row.get('period')}: '{col}' is not a number ({v!r})")
        return None
    if n < 0 or n != int(n):
        errors.append(f"{name} {row.get('period')}: '{col}' must be a whole number ≥ 0 ({v})")
    return int(n)


monthly = load("monthly.csv", ["period", "label"] + NUM_MONTHLY + ["source", "note"])
levels = load("by_level.csv", ["period", "level", "reached", "improved"])
regions = load("regions.csv", ["period", "region", "learners", "schools"])

periods = [r["period"] for r in monthly]
for p in periods:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", p):
        errors.append(f"monthly.csv: period '{p}' should look like 2026-11")
dupes = {p for p in periods if periods.count(p) > 1}
if dupes:
    errors.append(f"monthly.csv: months listed twice: {sorted(dupes)}")

lv_sum = defaultdict(lambda: [0, 0])
for r in levels:
    if r["period"] not in periods:
        errors.append(f"by_level.csv: {r['period']} has no row in monthly.csv")
    a, b = to_int("by_level.csv", r, "reached"), to_int("by_level.csv", r, "improved")
    lv_sum[r["period"]][0] += a or 0
    lv_sum[r["period"]][1] += b or 0
    if a is not None and b is not None and b > a:
        warnings.append(f"by_level.csv {r['period']} {r['level']}: improved ({b}) is more than reached ({a})")

rg_sum = defaultdict(int)
for r in regions:
    if r["period"] not in periods:
        errors.append(f"regions.csv: {r['period']} has no row in monthly.csv")
    rg_sum[r["period"]] += to_int("regions.csv", r, "learners") or 0
    to_int("regions.csv", r, "schools")

for r in monthly:
    p = r["period"]
    n = {c: to_int("monthly.csv", r, c) for c in NUM_MONTHLY}
    L = n["learners"]
    if L is None:
        errors.append(f"monthly.csv {p}: learners is empty")
        continue
    flagged = bool((r.get("note") or "").strip())
    tag = " (month has a note)" if flagged else ""
    if n["girls"] is not None and n["boys"] is not None and n["girls"] + n["boys"] != L:
        warnings.append(f"{p}: girls + boys = {n['girls'] + n['boys']}, learners = {L}{tag}")
    for c in ("pwd", "improved", "completed"):
        if n[c] is not None and n[c] > L:
            warnings.append(f"{p}: {c} ({n[c]}) is more than learners ({L}){tag}")
    if n["improved"] is not None and n["improved"] == L and L > 0:
        warnings.append(f"{p}: every learner is marked improved; check the report{tag}")
    if None not in (n["improved_girls"], n["improved_boys"], n["improved"]) and n["improved_girls"] + n["improved_boys"] != n["improved"]:
        warnings.append(f"{p}: improved girls + boys = {n['improved_girls'] + n['improved_boys']}, improved = {n['improved']}{tag}")
    if p in lv_sum and lv_sum[p][0] != L:
        warnings.append(f"{p}: levels add up to {lv_sum[p][0]}, learners = {L}{tag}")
    if p in lv_sum and n["improved"] is not None and lv_sum[p][1] != n["improved"]:
        warnings.append(f"{p}: improved by level adds up to {lv_sum[p][1]}, improved = {n['improved']}{tag}")
    if p not in lv_sum:
        warnings.append(f"{p}: no level breakdown in by_level.csv")
    if p in rg_sum and rg_sum[p] != L:
        warnings.append(f"{p}: regions add up to {rg_sum[p]}, learners = {L}{tag}")
    if p not in rg_sum:
        warnings.append(f"{p}: no region breakdown yet (the region chart will say so)")
    if n["institutions"] == 0:
        warnings.append(f"{p}: 0 learning institutions reported{tag}")

try:
    meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(meta.get("updated", ""))):
        errors.append("meta.json: 'updated' should be a date like 2026-11-05")
except FileNotFoundError:
    errors.append("meta.json is missing")
except json.JSONDecodeError:
    errors.append("meta.json is not valid JSON")

print(f"Months: {', '.join(periods) or 'none'}")
for w in warnings:
    print(f"WARNING  {w}")
for e in errors:
    print(f"ERROR    {e}")
print(f"\n{len(errors)} error(s), {len(warnings)} warning(s).")
sys.exit(1 if errors else 0)
