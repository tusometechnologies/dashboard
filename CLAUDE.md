# TABASAM Fellowship Dashboard — instructions for Claude Code

A static website (no build step) showing TABASAM's monthly reach and learning outcomes under the
Mastercard Foundation EdTech Fellowship (Sahara Consult). Owner: TUSOME Technologies Limited.
Hosted on Vercel from this GitHub repository; every push to `main` publishes the site.

## Layout

- `index.html`, `assets/styles.css`, `assets/app.js`: the page. `app.js` holds no figures; it reads `data/`.
- `assets/vendor/d3.v7.9.0.min.js`: charting library, kept in the repo so the site has no CDN dependency.
- `data/monthly.csv`: one row per month (`period` = YYYY-MM). Columns: label, learners, girls, boys, pwd,
  improved, improved_girls, improved_boys, completed, institutions, educators, source, note, highlight,
  priority. `note` is kept empty: the site is public and shows no notes. Record caveats in the commit message instead. `highlight` is one thing that stood out in that
  month's narrative report (purple). `priority` is the main priority for the next month, from the report's
  "Priority Activities for the Next Month" section (blue). Highlights and priorities never flag a month in the charts.
- `data/by_level.csv`: period, level (Pre-primary / Primary / Secondary / Tertiary / Professional), reached, improved.
- `data/regions.csv`: period, region, learners, schools.
- `data/meta.json`: `{"updated": "YYYY-MM-DD"}`, shown in the footer.
- `scripts/add_month.py`: reads a monthly Sahara report (.xlsx) and updates the three CSVs and meta.json.
- `scripts/check_data.py`: checks the data files; run before every publish.
- `reports/`: where the monthly .xlsx reports go. Git-ignored. Never commit them.

## Monthly update (the usual request: "add the November report")

1. Make sure the report is in `reports/` (e.g. `reports/TUSOME_November_2026.xlsx`).
2. Preview: `python3 scripts/add_month.py reports/TUSOME_November_2026.xlsx`
   Show the user the figures and every `!` warning. Ask them to confirm the figures match the report
   they submitted, or to explain any difference, before writing.
3. Write: `python3 scripts/add_month.py reports/TUSOME_November_2026.xlsx --write`
   Add `--highlight "..."` with one thing that stood out in that month's narrative report (the .docx), and
   `--priority "..."` with the main priority for the next month from the same report. Propose both to the user first. Keep it to one factual sentence, with no figures that could disagree with
   the dashboard. Leave out internal matters (audits, finances, contracts) and unsigned partnerships or MoUs.
4. Check: `python3 scripts/check_data.py`. Fix every ERROR. Report every WARNING to the user in plain words.
5. Preview the site: `python3 -m http.server 8000` and open http://localhost:8000. Check the new month
   is selected by default and the charts look right.
6. Commit only the changed files in `data/` with a message like `Add November 2026 report`, then push.
   Vercel publishes automatically within a minute or two.

If `add_month.py` cannot find the learner list or the month (for example the template changed), open the
workbook with openpyxl, look at the sheet names and header rows, and adjust `HEADER_KEYS` or
`classify_sheets()` in the script. Do not type figures into the CSVs by hand unless the user asks; if they
do, set `source` to `entered by hand` and say so in the commit message.

## Rules

- Publish counts only. Never write learner IDs, names, ages, or any row-level record to `data/` or anywhere
  in the repository. The site is public unless password protection is turned on in Vercel.
- Never commit `.xlsx`, `.docx` or other report files. `reports/` is git-ignored for this reason.
- Do not silently change past months. If re-importing an old report changes its figures, show the
  before/after to the user and get their agreement first; the figures may already have been sent to Sahara.
- Keep the page free of hard-coded numbers: every figure must come from `data/`.
- Keep the TUSOME brand colours in `assets/styles.css` (purple #935DFB, blue #1CA8FF, ink #111111,
  light ground #F8F9FC). Public tagline: "Powering African Minds".
- Write in clear international English. No promotional claims on the page. No notes or caveats on the page.
- Each month's learners are different learners (TUSOME confirmed): the all-months view adds every count up,
  including institutions and educators.
- July 2026 institutions (8) were entered by hand because the report's school list was empty. Re-importing
  the July report resets it to 0: re-enter 8, or ask the user.

## Data decisions (keep these on re-import)

- All 19 months (April 2025 to October 2026) are counted from the learner lists, not the summary sheets.
  The summary sheets often differ (for example June 2026: 174 submitted, 168 in the list; several months
  mark every learner improved). The user agreed to use the lists.
- April–December 2025: every learner is "Too early to measure", so improved, improved_girls, improved_boys
  and by-level improved are blank. The page computes improved share only over months with outcomes.
- Count every learner reported (TUSOME's instruction). November 2025's list holds 2,116 records, 150 of them
  dated October 2025: all are counted (imported with `--period 2025-11`, which keeps every record).
  Without `--period`, `add_month.py` drops records dated other months, so re-import November with it.
- Where a summary sheet reports more learners than the list (June 2026 and January, March, April and
  May 2026), learners reached uses the summary figure; `add_month.py` does this automatically. Gender,
  level and region breakdowns come from the list, so they add up to less than learners reached.
- December 2025: one learner has no gender recorded; the user asked to count them as female (girls 863,
  entered by hand). Re-importing December resets this to 862: re-enter 863.
- "nursery" counts as Pre-primary. Region spellings are merged in `region_name()` in `add_month.py`.
- Narrative reports (.docx) in Drive: names with `_2026` and "TUSOME June.docx" are 2026; "April (2)",
  "May (2)", "June (2)", July–Dec are 2025; Jan–May (no suffix) are 2026. April–July 2025 reports have no
  priority section, so those months have no priority.
- Highlights mention Carnegie Mellon University as a research partner (an agreement exists per the October
  2026 report). Do not name partners whose agreements are unsigned (for example Patandi Teachers College).

## Open items

- The header uses a text wordmark in TUSOME brand colours. If an official logo file is supplied, put it at
  `assets/logo.svg` and swap the wordmark span in `index.html`.
- `.vercelignore` keeps README.md, CLAUDE.md, scripts/ and reports/ off the public site. Keep it current.

## Local commands

- Preview: `python3 -m http.server 8000` (opening index.html directly will not load the data files).
- Python needs `openpyxl`: `pip install openpyxl`.
