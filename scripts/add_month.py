#!/usr/bin/env python3
"""Add (or replace) one month in the dashboard data from a Sahara MCF monthly report.

Usage:
    python3 scripts/add_month.py reports/TUSOME_November_2026.xlsx            # preview only
    python3 scripts/add_month.py reports/TUSOME_November_2026.xlsx --write    # update data/*.csv
    python3 scripts/add_month.py reports/*.xlsx --write                       # several months at once

Options:
    --period YYYY-MM   use this month instead of the one in the learner list
    --note "text"      internal note kept in monthly.csv (not shown on the page)
    --highlight "text" one thing that stood out in that month's narrative report (shown on the dashboard)
    --priority "text"  the main priority for the next month from the narrative report (shown on the dashboard)

What it does
    Reads the learner, educator and school lists in the workbook (not the hand-typed
    summary tables) and counts the dashboard figures from them. It then compares its
    learner and improved totals with the workbook's summary sheet and warns when they
    differ, so the submitted report and the dashboard can be reconciled.

Privacy
    Only counts are written. Learner IDs, names and other row-level details never
    leave the workbook. Keep the workbooks in reports/ (git-ignored), never in data/.
"""
import argparse
import calendar
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is missing. Install it with:  pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

MONTHLY_COLS = ["period", "label", "learners", "girls", "boys", "pwd", "improved", "improved_girls",
                "improved_boys", "completed", "institutions", "educators", "source", "note",
                "highlight", "priority"]
LEVEL_COLS = ["period", "level", "reached", "improved"]
REGION_COLS = ["period", "region", "learners", "schools"]

LEVEL_MAP = {
    "pre primary/early childhood": "Pre-primary", "pre-primary": "Pre-primary", "pre primary": "Pre-primary",
    "early childhood": "Pre-primary", "ecd": "Pre-primary", "nursery": "Pre-primary",
    "primary": "Primary", "secondary": "Secondary",
    "tertiary": "Tertiary", "professional": "Professional", "professsional": "Professional",
}

# Region spellings in the lists vary ("DARESSALAAM", "dar es sallam"). Compare letters only.
REGION_NAMES = ["Dar es Salaam", "Arusha", "Dodoma", "Kilimanjaro", "Morogoro", "Mwanza", "Pwani", "Tanga",
                "Zanzibar", "Zanzibar South", "Mjini Magharibi"]
REGION_KEYS = {re.sub(r"[^a-z]", "", n.lower()): n for n in REGION_NAMES}
REGION_KEYS["daressallam"] = "Dar es Salaam"


def region_name(v):
    text = re.sub(r"\s+", " ", str(v or "")).strip()
    if not text:
        return "Not recorded"
    return REGION_KEYS.get(re.sub(r"[^a-z]", "", text.lower()), text.title())


# Header text (lower-case, spaces collapsed) -> field name. First match wins.
HEADER_KEYS = [
    ("unique id", "id"), ("gender", "gender"), ("disability", "disability"), ("refugee", "refugee"),
    ("education level", "level"), ("geographical", "geo"), ("district", "district"), ("regional", "region"),
    ("region", "region"), ("monthly reached", "month"), ("year", "year"), ("type of solution", "solution"),
    ("status of learning", "status"), ("demonstrate improved", "improved"),
]


def norm(v):
    return re.sub(r"\s+", " ", str(v or "")).strip().lower()


def find_header(ws, max_rows=15):
    """Return (row_index, {field: column_index}) for the list header, or (None, {})."""
    for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=max_rows, values_only=True), start=1):
        cols = {}
        for c_idx, cell in enumerate(row):
            text = norm(cell)
            if not text:
                continue
            for key, field in HEADER_KEYS:
                if key in text and field not in cols:
                    cols[field] = c_idx
                    break
        if "gender" in cols and ("region" in cols or "district" in cols):
            return r_idx, cols
    return None, {}


def read_list(ws):
    header_row, cols = find_header(ws)
    if header_row is None:
        return []
    out = []
    for row in ws.iter_rows(min_row=header_row + 1, values_only=True):
        rec = {f: (row[i] if i < len(row) else None) for f, i in cols.items()}
        if not any(norm(rec.get(f)) for f in ("id", "gender", "level", "region")):
            continue  # blank line
        if norm(rec.get("id")).startswith("sn") or norm(rec.get("gender")) == "gender":
            continue  # repeated header
        out.append(rec)
    return out


def classify_sheets(wb):
    learners = educators = schools = summary = None
    for ws in wb.worksheets:
        title = norm(ws.title)
        header_row, cols = find_header(ws)
        if "summary" in title or (header_row is None and summary is None and _has_text(ws, "learners reached")):
            summary = summary or ws
            continue
        if header_row is None:
            continue
        if "improved" in cols or "status" in cols or "learner" in title:
            learners = learners or ws
        elif "educator" in title or "teacher" in title:
            educators = educators or ws
        elif "school" in title or "institution" in title:
            schools = schools or ws
    return learners, educators, schools, summary


def _has_text(ws, needle, max_rows=60):
    for row in ws.iter_rows(min_row=1, max_row=max_rows, values_only=True):
        if any(needle in norm(c) for c in row):
            return True
    return False


def summary_total(ws, label_start):
    """Grand total under a summary block whose title starts with label_start (e.g. 'learners reached')."""
    if ws is None:
        return None
    rows = list(ws.iter_rows(values_only=True))
    for i, row in enumerate(rows):
        if any(norm(c).startswith(label_start) for c in row[:3]):
            total_col = None
            for j in range(i + 1, min(i + 4, len(rows))):
                for k, c in enumerate(rows[j]):
                    if norm(c) == "total":
                        total_col = k
                if total_col is not None:
                    start = j + 1
                    break
            if total_col is None:
                return None
            for row2 in rows[start:start + 20]:
                cells = list(row2)
                val = cells[total_col] if total_col < len(cells) else None
                others = [c for k, c in enumerate(cells) if k != total_col and str(c or "").strip()]
                if isinstance(val, (int, float)) and not others:
                    return int(val)
            return None
    return None


def yes(v):
    return norm(v) in ("yes", "y", "true", "1")


MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_name) if m}


def record_period(r):
    m = MONTHS.get(norm(r.get("month")))
    try:
        y = int(float(r.get("year")))
    except (TypeError, ValueError):
        y = None
    return f"{y}-{m:02d}" if m and y else None


def month_period(records, override):
    if override:
        if not re.fullmatch(r"\d{4}-\d{2}", override):
            sys.exit("--period must look like 2026-11")
        return override
    found = Counter(p for p in map(record_period, records) if p)
    if not found:
        sys.exit("Could not read the month and year from the learner list. Re-run with --period YYYY-MM.")
    if len(found) > 1:
        print(f"  ! The learner list mixes months: {dict(found)}. Using the most common one;"
              " records dated other months are left out.")
    return found.most_common(1)[0][0]


def label_for(period):
    y, m = period.split("-")
    return f"{calendar.month_name[int(m)]} {y}"


def build(path, period_override=None, note="", highlight="", priority=""):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ls, es, ss, sm = classify_sheets(wb)
    if ls is None:
        sys.exit(f"{path.name}: no learner list found. Sheets: {[w.title for w in wb.worksheets]}")
    learners = read_list(ls)
    educators = read_list(es) if es is not None else []
    schools = read_list(ss) if ss is not None else []
    period = month_period(learners, period_override)
    if not period_override:  # a record dated another month belongs to that month's report
        learners = [r for r in learners if record_period(r) in (period, None)]

    g = lambda r: norm(r.get("gender"))[:1]
    imp = lambda r: norm(r.get("improved")).startswith("improv")
    # Early reports mark every learner "Too early to measure": improvement was not measured, so leave it blank.
    measured = any(norm(r.get("improved")).startswith(("improv", "needs")) for r in learners)
    count = lambda f: sum(map(f, learners)) if measured else ""
    row = {
        "period": period, "label": label_for(period),
        "learners": len(learners),
        "girls": sum(g(r) == "f" for r in learners),
        "boys": sum(g(r) == "m" for r in learners),
        "pwd": sum(yes(r.get("disability")) for r in learners),
        "improved": count(imp),
        "improved_girls": count(lambda r: imp(r) and g(r) == "f"),
        "improved_boys": count(lambda r: imp(r) and g(r) == "m"),
        "completed": sum("complet" in norm(r.get("status")) for r in learners),
        "institutions": len({norm(r.get("id")) or i for i, r in enumerate(schools)}),
        "educators": len(educators),
        "source": "learner records",
        "note": note or "",
        "highlight": highlight or "",
        "priority": priority or "",
    }
    levels = defaultdict(lambda: [0, 0])
    for r in learners:
        lv = LEVEL_MAP.get(norm(r.get("level")), str(r.get("level") or "Not recorded").strip())
        levels[lv][0] += 1
        levels[lv][1] += imp(r)
    regions = defaultdict(lambda: [0, 0])
    for r in learners:
        regions[region_name(r.get("region"))][0] += 1
    for s in schools:
        regions[region_name(s.get("region"))][1] += 1

    warnings = []
    unknown_gender = row["learners"] - row["girls"] - row["boys"]
    if unknown_gender:
        warnings.append(f"{unknown_gender} learners have no F/M gender recorded.")
    if not measured:
        warnings.append("Improvement was not measured this month (too early to measure); left blank.")
    blank_imp = sum(not norm(r.get("improved")) for r in learners)
    if blank_imp:
        warnings.append(f"{blank_imp} learners have no improvement result recorded.")
    ids = [norm(r.get("id")) for r in learners if norm(r.get("id"))]
    dupes = [k for k, v in Counter(ids).items() if v > 1]
    if dupes:
        warnings.append(f"{len(dupes)} learner IDs appear more than once in the month.")
    # TUSOME counts every learner reported: when the summary sheet reports more learners than the list holds,
    # publish the summary figure. Breakdowns (gender, level, region) still come from the list.
    reported = summary_total(sm, "learners reached")
    if reported is not None and reported > row["learners"]:
        warnings.append(f"Learners reached set to the summary sheet's {reported} (the learner list holds {row['learners']}).")
        row["learners"], row["source"] = reported, "learner records; learners reached from summary sheet"
    for label, key, ours in (("learners reached", "learners reached", len(learners)),
                             ("improved", "number of learners who demonstrate improved", row["improved"])):
        theirs = summary_total(sm, key)
        if theirs is not None and ours != "" and theirs != ours:
            warnings.append(f"Summary sheet says {theirs} {label}; the learner list gives {ours}.")
    if row["institutions"] == 0:
        warnings.append("No schools found in the school list.")

    level_rows = [{"period": period, "level": k, "reached": v[0], "improved": v[1] if measured else ""}
                  for k, v in levels.items()]
    region_rows = [{"period": period, "region": k, "learners": v[0], "schools": v[1]} for k, v in regions.items()]
    return row, level_rows, region_rows, warnings, (ls.title, es.title if es else None, ss.title if ss else None)


def read_csv(name):
    p = DATA / name
    if not p.exists():
        return []
    with p.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(name, cols, rows):
    with (DATA / name).open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def upsert(name, cols, new_rows, period, sort_key):
    rows = [r for r in read_csv(name) if r["period"] != period] + new_rows
    rows.sort(key=sort_key)
    write_csv(name, cols, rows)


LEVEL_ORDER = {"Pre-primary": 0, "Primary": 1, "Secondary": 2, "Tertiary": 3, "Professional": 4}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--write", action="store_true", help="update data/*.csv (default: preview only)")
    ap.add_argument("--period", help="YYYY-MM, overrides the month in the learner list (one file only)")
    ap.add_argument("--note", default="", help="internal note kept in monthly.csv (not shown on the page)")
    ap.add_argument("--highlight", default="", help="highlight from the narrative report, shown for this month")
    ap.add_argument("--priority", default="", help="next-month priority from the narrative report, shown for this month")
    a = ap.parse_args()
    if a.period and len(a.files) > 1:
        sys.exit("--period can only be used with one file.")

    for path in a.files:
        row, lv, rg, warnings, sheets = build(path, a.period, a.note, a.highlight, a.priority)
        print(f"\n{path.name} -> {row['label']} ({row['period']})")
        print(f"  sheets used: learners='{sheets[0]}', educators='{sheets[1]}', schools='{sheets[2]}'")
        for k in MONTHLY_COLS[2:12]:
            print(f"  {k:<15} {row[k]}")
        print("  by level:  " + ", ".join(f"{r['level']} {r['reached']} ({r['improved']} improved)" for r in sorted(lv, key=lambda r: LEVEL_ORDER.get(r['level'], 9))))
        print("  by region: " + ", ".join(f"{r['region']} {r['learners']}" for r in sorted(rg, key=lambda r: -r['learners'])))
        for w in warnings:
            print(f"  ! {w}")
        if a.write:
            existing = {r["period"]: r for r in read_csv("monthly.csv")}
            if not row["note"] and row["period"] in existing and existing[row["period"]].get("source") == "learner records":
                row["note"] = existing[row["period"]].get("note", "")  # keep a note added on an earlier import
            for k in ("highlight", "priority"):  # keep text added on an earlier import
                if not row[k] and row["period"] in existing:
                    row[k] = existing[row["period"]].get(k, "")
            upsert("monthly.csv", MONTHLY_COLS, [row], row["period"], lambda r: r["period"])
            upsert("by_level.csv", LEVEL_COLS, lv, row["period"], lambda r: (r["period"], LEVEL_ORDER.get(r["level"], 9)))
            upsert("regions.csv", REGION_COLS, rg, row["period"], lambda r: (r["period"], -int(r["learners"])))
            print("  written to data/")
    if a.write:
        meta_path = DATA / "meta.json"  # keep other settings, such as the fellowship target
        meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
        meta["updated"] = date.today().isoformat()
        meta_path.write_text(json.dumps(meta) + "\n", encoding="utf-8")
        print("\nData updated. Run: python3 scripts/check_data.py")
    else:
        print("\nPreview only. Add --write to update the dashboard data.")


if __name__ == "__main__":
    main()
