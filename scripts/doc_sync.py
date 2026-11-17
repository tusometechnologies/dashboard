#!/usr/bin/env python3
"""Build the Google Docs batchUpdate that replaces the Ask TUSOME Doc's body with the current facts document.

Usage:
    python3 scripts/doc_sync.py --end END_INDEX --revision REVISION_ID > requests.json

END_INDEX is the body's last endIndex and REVISION_ID the revisionId, both from a fresh read_doc of the Doc
"Ask TUSOME — TABASAM Figures (live)". Send the output's "requests" and "writeControl" in one update_doc call:
the body is deleted, the text is inserted with headings and bullets, and each table is rebuilt from the bottom
up so earlier positions stay valid. The Doc keeps its id and link.
"""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import facts  # noqa: E402


def u16(s):
    return len(s.encode("utf-16-le")) // 2


def build_requests(end, revision):
    doc = facts.build()
    paras, styles, tables = [], [], []  # styles: (para index, kind); tables: (after para index, head, body)
    for kind, v in doc:
        if kind == "h":
            styles.append((len(paras), f"HEADING_{v[0]}"))
            paras.append(v[1])
        elif kind == "p":
            paras.append(v)
        elif kind == "ul":
            for item in v:
                styles.append((len(paras), "BULLET"))
                paras.append(item)
        elif kind == "table":
            tables.append((len(paras) - 1, v[0], v[1]))

    # Paragraph ranges once the text is inserted at index 1 (the kept final newline closes the last one).
    starts, i = [], 1
    for p in paras:
        starts.append(i)
        i += u16(p) + 1
    total_end = i  # end of the last paragraph
    rng = lambda a, b: {"startIndex": a, "endIndex": b}
    para_rng = lambda k: rng(starts[k], starts[k] + u16(paras[k]) + 1)

    req = []
    if end - 1 > 1:
        req.append({"deleteContentRange": {"range": rng(1, end - 1)}})
    req.append({"insertText": {"location": {"index": 1}, "text": "\n".join(paras)}})
    whole = rng(1, total_end)
    req += [
        {"deleteParagraphBullets": {"range": whole}},
        {"updateParagraphStyle": {"range": whole, "paragraphStyle": {"namedStyleType": "NORMAL_TEXT"},
                                  "fields": "namedStyleType"}},
        {"updateTextStyle": {"range": rng(1, total_end - 1), "textStyle": {}, "fields": "bold,italic"}},
    ]
    for k, kind in styles:
        if kind.startswith("HEADING"):
            req.append({"updateParagraphStyle": {"range": para_rng(k), "paragraphStyle": {"namedStyleType": kind},
                                                 "fields": "namedStyleType"}})
    # Bullets: one request per run of consecutive bullet paragraphs.
    bullets = [k for k, kind in styles if kind == "BULLET"]
    runs = []
    for k in bullets:
        if runs and runs[-1][1] == k - 1:
            runs[-1][1] = k
        else:
            runs.append([k, k])
    for a, b in runs:
        req.append({"createParagraphBullets": {"range": rng(starts[a], starts[b] + u16(paras[b]) + 1),
                                               "bulletPreset": "BULLET_DISC_CIRCLE_SQUARE"}})

    # Tables, last first: insertTable at the end of the paragraph before it, then fill cells last to first.
    for after, head, body in reversed(tables):
        at = starts[after] + u16(paras[after])
        rows = [head] + body
        R, C = len(rows), len(head)
        req.append({"insertTable": {"rows": R, "columns": C, "location": {"index": at}}})
        req.append({"updateParagraphStyle": {"range": rng(at + 3 + R * (2 * C + 1), at + 4 + R * (2 * C + 1)),
                                             "paragraphStyle": {"namedStyleType": "NORMAL_TEXT"},
                                             "fields": "namedStyleType"}})
        for r in reversed(range(R)):
            for c in reversed(range(C)):
                text = str(rows[r][c])
                if text:
                    req.append({"insertText": {"location": {"index": at + 4 + r * (2 * C + 1) + 2 * c}, "text": text}})
        pos = at + 4  # bold the header row: header cells hold their text now, in order
        for c in range(C):
            n = u16(str(head[c]))
            if n:
                req.append({"updateTextStyle": {"range": rng(pos, pos + n), "textStyle": {"bold": True}, "fields": "bold"}})
            pos += n + 2
    return {"requests": req, "writeControl": {"requiredRevisionId": revision}}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--end", type=int, required=True, help="body endIndex of the last element (from read_doc)")
    ap.add_argument("--revision", required=True, help="revisionId from the same read_doc")
    a = ap.parse_args()
    print(json.dumps(build_requests(a.end, a.revision), ensure_ascii=False))
