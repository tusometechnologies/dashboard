#!/usr/bin/env python3
"""Build the "Ask TUSOME" knowledge document: TABASAM figures from the dashboard data, with counting rules.

Usage:
    python3 scripts/facts.py          # writes ask-tusome/TABASAM_facts.md and ask-tusome/TABASAM_facts.html

The document is for TUSOME staff (Claude Project "Ask TUSOME"), so it states the counting rules and known
data issues that the public dashboard does not show. Every figure is computed from data/; nothing is typed in.
Regenerate it after every monthly update and replace the Google Doc's content with the HTML file.
"""
import csv
import html
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "ask-tusome"
SITE = "https://mcf.tusome.ac.tz"


def rows(name):
    with (DATA / name).open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def n(v):
    v = (v or "").strip()
    return int(float(v)) if v else None


def fmt(v):
    return "—" if v is None else f"{v:,}"


def pct(a, b):
    return f"{round(100 * a / b)}%" if a is not None and b else "—"


def total(ms, k):
    vals = [n(m[k]) for m in ms if n(m.get(k)) is not None]
    return sum(vals) if vals else None


def build():
    M = sorted(rows("monthly.csv"), key=lambda r: r["period"])
    L, R = rows("by_level.csv"), rows("regions.csv")
    P, MS = rows("partners.csv"), rows("milestones.csv")
    meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))
    target = (meta.get("target") or {}).get("beneficiaries")
    first, last = M[0]["label"], M[-1]["label"]
    assessed = [m for m in M if n(m["improved"]) is not None]
    t = {k: total(M, k) for k in ("learners", "girls", "boys", "pwd", "institutions", "educators", "needs_support",
                                    "educators_female", "educators_male", "learners_urban", "learners_semi_urban",
                                    "learners_rural")}
    imp, assessed_learners = total(assessed, "improved"), total(assessed, "learners")
    with_outcome = imp + (total(assessed, "needs_support") or 0)
    PR = rows("programmes.csv") if (DATA / "programmes.csv").exists() else []
    prog_at = lambda period: sum((n(p["learners"]) or 0) + (n(p["educators"]) or 0) for p in PR if p["start"] <= period)
    tab_benef = t["learners"] + t["educators"]
    prog_benef = prog_at("9999-12")
    pl = sum(n(p["learners"]) or 0 for p in PR)
    pe = sum(n(p["educators"]) or 0 for p in PR)
    ps = sum(1 for p in PR if n(p["learners"]))
    benef = tab_benef + prog_benef
    run, reached_in = 0, None
    for m in M:
        run += (n(m["learners"]) or 0) + (n(m["educators"]) or 0)
        if target and reached_in is None and run + prog_at(m["period"]) >= target:
            reached_in = m["label"]

    doc = []  # list of (kind, payload)
    H = lambda level, text: doc.append(("h", (level, text)))
    Pp = lambda text: doc.append(("p", text))
    UL = lambda items: doc.append(("ul", items))
    TB = lambda head, body: doc.append(("table", (head, body)))

    H(1, "TABASAM figures — MCF EdTech Fellowship (live)")
    Pp(f"Source: the TABASAM Fellowship Dashboard ({SITE}), built from TUSOME's monthly reports to Sahara Consult. "
       f"Data: {first} – {last}. Last updated {meta.get('updated', '—')}. This document is regenerated from the "
       "dashboard data after every monthly update; quote figures from the latest version only.")

    H(2, "Headline figures (all months)")
    UL([
        f"Beneficiaries (learners + educators): {fmt(benef)} against the MCF EdTech Fellowship target of "
        f"{fmt(target)} ({pct(benef, target)}); target reached in {reached_in or '—'}. "
        + (f"Made up of TABASAM {fmt(tab_benef)} and AI for Schools {fmt(prog_benef)}." if prog_benef else ""),
        f"Learners reached: {fmt(t['learners'] + pl)} across {len(M)} months ({first} – {last}): TABASAM "
        f"{fmt(t['learners'])}" + (f", AI for Schools {fmt(pl)}." if pl else "."),
        f"Learners demonstrating improved learning outcomes: {pct(imp, assessed_learners)} of learners assessed "
        f"({fmt(imp)} of {fmt(assessed_learners)} learners reached in months with outcomes, "
        f"{assessed[0]['label']} – {assessed[-1]['label']}).",
        f"Learners identified for support (marked “Needs Support”): {fmt(t['needs_support'])} "
        f"({pct(t['needs_support'], with_outcome)} of {fmt(with_outcome)} learners with an outcome recorded).",
        f"Educators reached: {fmt(t['educators'] + pe)}: TABASAM {fmt(t['educators'])} (female {fmt(t['educators_female'])}, "
        f"male {fmt(t['educators_male'])})" + (f", AI for Schools {fmt(pe)}." if pe else "."),
        f"Learning institutions: {fmt(t['institutions'] + ps)} (monthly figures added up"
        + (f"; includes {ps} AI for Schools schools)." if ps else ")."),
        f"Learners with disability: {fmt(t['pwd'])}.",
        f"Girls {fmt(t['girls'])}, boys {fmt(t['boys'])} (from the learner lists).",
        f"Urban {fmt(t['learners_urban'])}, rural {fmt((t['learners_semi_urban'] or 0) + (t['learners_rural'] or 0))} "
        "(semi-urban counted as rural).",
    ])

    if PR:
        H(2, "AI for Schools (included in TUSOME totals; no TABASAM outcomes)")
        Pp(f"{PR[0]['description']} Partners: {PR[0]['partners'].replace(';', ',')}. Region: {PR[0]['region']}. "
           f"Started {min(p['start'] for p in PR)}. Not yet reported to Sahara/MCF as of this update. These learners are "
           "different from those in the TABASAM monthly reports (confirmed by TUSOME).")
        TB(["School / group", "Learners", "Teachers"],
           [[p["school"], fmt(n(p["learners"])), fmt(n(p["educators"]))] for p in PR])

    H(2, "By fellowship period")
    body = []
    for label, ms in ((M[0]["label"].split()[0] + "–December 2025", [m for m in M if m["period"] < "2026-01"]),
                      ("January–" + last, [m for m in M if m["period"] >= "2026-01"])):
        a = [m for m in ms if n(m["improved"]) is not None]
        body.append([label, fmt(total(ms, "learners")), fmt(total(ms, "educators")),
                     pct(total(a, "improved"), total(a, "learners")) if a else "not assessed",
                     fmt(total(ms, "needs_support")), fmt(total(ms, "pwd"))])
    TB(["Period", "Learners", "Educators", "Improved", "Identified for support", "With disability"], body)

    H(2, "Month by month (TABASAM monthly reports; AI for Schools is counted in its start month on the dashboard)")
    body = [[m["label"], fmt(n(m["learners"])), fmt(n(m["girls"])), fmt(n(m["boys"])), fmt(n(m["educators"])),
             fmt(n(m["institutions"])), pct(n(m["improved"]), n(m["learners"])) if n(m["improved"]) is not None else "—",
             fmt(n(m["needs_support"])), fmt(n(m["pwd"]))] for m in M]
    TB(["Month", "Learners", "Girls", "Boys", "Educators", "Institutions", "Improved", "For support", "Disability"], body)

    H(2, "By region (learners, all months, TABASAM and AI for Schools)")
    reg = defaultdict(int)
    for r in R:
        reg[r["region"]] += n(r["learners"]) or 0
    for p in PR:
        reg[p["region"]] += n(p["learners"]) or 0
    TB(["Region", "Learners"], [[k, fmt(v)] for k, v in sorted(reg.items(), key=lambda kv: -kv[1]) if v])
    sch = [p for p in P if (p.get("schools") or "").strip()]
    if sch:
        Pp("Schools per region supplied by TUSOME: " + "; ".join(f"{p['name'].replace('Schools in ', '')} {p['schools']}" for p in sch) + ".")

    H(2, "By education level (learners, all months, TABASAM and AI for Schools)")
    lv = defaultdict(int)
    for r in L:
        lv[r["level"]] += n(r["reached"]) or 0
    lv["Secondary"] += pl  # AI for Schools runs in secondary schools
    order = ["Pre-primary", "Primary", "Secondary", "Tertiary", "Professional"]
    TB(["Level", "Learners"], [[k, fmt(lv[k])] for k in order if lv.get(k)])

    H(2, "Partners")
    for status, title in (("agreement", "Signed agreements"), ("programme", "Fellowship programme"),
                          ("collaboration", "Working with (joint work described in reports)"),
                          ("exploring", "Exploring (talks, plans or named only; do not describe as signed)")):
        ps = [p for p in P if p["status"] == status]
        if ps:
            Pp(f"{title}: " + "; ".join(p["name"] for p in ps) + ".")

    H(2, f"Milestones ({len(MS)}, newest first)")
    UL([f"{m['period']} · {m['category']}: {m['text']}" for m in sorted(MS, key=lambda m: m["period"], reverse=True)])

    SB = rows("sandbox.csv") if (DATA / "sandbox.csv").exists() else []
    if SB:
        H(2, "TUSOME Sandbox (other products in development)")
        UL([f"{p['name']} ({p['area']}, {p['status']}): {p['description']}" for p in SB])

    act = ROOT / "ask-tusome" / "activities.csv"  # internal record from email and Drive; not published on the site
    if act.exists():
        with act.open(newline="", encoding="utf-8") as f:
            AC = list(csv.DictReader(f))
        H(2, "Other activities and events (internal record, not on the public dashboard)")
        UL([f"{a['date']} · {a['area']}: {a['activity']} ({a['status']})" for a in AC])

    H(2, "How the figures are counted (read before quoting)")
    UL([
        "Learners, gender, level and region come from each report's learner list, not the summary sheet. Where a "
        "summary sheet reports more learners than its list (June 2026; January, March, April and May 2026), "
        "learners reached uses the summary figure, so breakdowns add up to slightly less than the total.",
        "Each month's learners are treated as different learners (TUSOME's instruction); all-months totals add the "
        "months up. Institutions and educators are also added up, so the same school or teacher can be counted once "
        "per month they appear.",
        "Learning outcomes were not measured March–December 2025 (all learners “Too early to measure”); improved "
        "share uses only months with outcomes.",
        "November 2025 counts all 2,116 list records, including 150 dated October 2025.",
        "Entered by hand on TUSOME's instruction: July 2026 institutions (8); December 2025 one learner without "
        "gender counted as female; May 2026 ten educators without gender split equally.",
        "Learners with no region are counted in Dar es Salaam; semi-urban is counted as rural.",
        "March 2025 (entered by hand, TUSOME's instruction): 532 beneficiaries reached before the first monthly "
        "report, recorded as 343 learners and 189 educators, 53% female (182 girls, 161 boys; 100 female, 89 male "
        "educators). No region, level, disability, institution or outcome breakdown.",
        "Public figures elsewhere may differ: screen.tusome.ac.tz shows 8,673 learners, 670 teachers and 75 partner "
        "schools (period not stated). Use this document's figures for MCF/Sahara reporting and say which period "
        "they cover.",
    ])
    return doc


def to_md(doc):
    out = []
    for kind, v in doc:
        if kind == "h":
            out.append("#" * v[0] + " " + v[1])
        elif kind == "p":
            out.append(v)
        elif kind == "ul":
            out.append("\n".join(f"- {x}" for x in v))
        elif kind == "table":
            head, body = v
            out.append("\n".join(["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
                                 + ["| " + " | ".join(r) + " |" for r in body]))
    return "\n\n".join(out) + "\n"


def to_html(doc):
    e = html.escape
    out = ["<html><body>"]
    for kind, v in doc:
        if kind == "h":
            out.append(f"<h{v[0]}>{e(v[1])}</h{v[0]}>")
        elif kind == "p":
            out.append(f"<p>{e(v)}</p>")
        elif kind == "ul":
            out.append("<ul>" + "".join(f"<li>{e(x)}</li>" for x in v) + "</ul>")
        elif kind == "table":
            head, body = v
            out.append("<table border='1'><tr>" + "".join(f"<th>{e(h)}</th>" for h in head) + "</tr>"
                       + "".join("<tr>" + "".join(f"<td>{e(c)}</td>" for c in r) + "</tr>" for r in body) + "</table>")
    out.append("</body></html>")
    return "\n".join(out)


if __name__ == "__main__":
    d = build()
    OUT.mkdir(exist_ok=True)
    (OUT / "TABASAM_facts.md").write_text(to_md(d), encoding="utf-8")
    (OUT / "TABASAM_facts.html").write_text(to_html(d), encoding="utf-8")
    print(f"Wrote {OUT / 'TABASAM_facts.md'} and {OUT / 'TABASAM_facts.html'}")
