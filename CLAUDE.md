# TABASAM Fellowship Dashboard — instructions for Claude Code

A static website (no build step) showing TABASAM's monthly reach and learning outcomes under the
Mastercard Foundation EdTech Fellowship (Sahara Consult). Owner: TUSOME Technologies Limited.
Hosted on Vercel from this GitHub repository; every push to `main` publishes the site.

## Layout

- `index.html`, `assets/styles.css`, `assets/app.js`: the page. `app.js` holds no figures; it reads `data/`.
- `assets/vendor/d3.v7.9.0.min.js`: charting library, kept in the repo so the site has no CDN dependency.
- `data/monthly.csv`: one row per month (`period` = YYYY-MM). Columns: label, learners, girls, boys, pwd,
  improved, improved_girls, improved_boys, completed, institutions, educators, source, note.
- `data/by_level.csv`: period, level (Pre-primary / Primary / Secondary), reached, improved.
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
   Add `--note "..."` when the user wants a note shown for that month (for example a known reporting issue).
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
- Write in clear international English. No promotional claims on the page.

## First-time tasks (once)

- Re-import the June–October 2026 reports from their learner lists:
  `python3 scripts/add_month.py reports/*.xlsx` (preview), then `--write` once the user agrees.
  The current data for those months is copied from each report's summary sheet (`source` =
  `summary sheet (as submitted)`) and has known issues: June's improved and completed figures repeat
  learners reached, and only October has a region breakdown. Re-importing gives every month a region
  breakdown and replaces summary figures with counts from the lists. Expect some figures to change; show
  the user every change before writing.
- Replace the text wordmark in `index.html` with the official TUSOME logo (`assets/logo.svg`).

## Local commands

- Preview: `python3 -m http.server 8000` (opening index.html directly will not load the data files).
- Python needs `openpyxl`: `pip install openpyxl`.
