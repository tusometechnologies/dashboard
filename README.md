# TABASAM Fellowship Dashboard

TUSOME Technologies' public dashboard for its work under the Mastercard Foundation (MCF) EdTech Fellowship,
run by Sahara Consult. It shows learners and educators reached, learning outcomes from TABASAM assessments,
progress to the fellowship target, milestones and partners. A static website (HTML, CSS, JavaScript and CSV
data files) with no build step. Every push to `main` publishes the site through Vercel.

Live at **https://mcf.tusome.ac.tz**

## Current status (17 November 2026)

| Item | Status |
|---|---|
| Period covered | March 2025 to November 2026 (21 months). November 2026 is to date; re-import the final report when it is ready |
| Headline (all months) | 13,492 learners, 805 educators, 140 learning institutions; 14,297 of 8,000 beneficiaries (179%), target reached in January 2026 |
| Sources | Monthly Sahara reports (learner, educator and school lists), narrative reports (.docx), and figures supplied by TUSOME: March 2025 opening figures, AI for Schools, schools per region, quotes |
| AI for Schools | TUSOME's programme in Zanzibar (July 2026 to date): 1,704 learners and 32 teachers in two secondary schools, counted in July 2026 with TABASAM as TUSOME reach. Not yet reported to Sahara |
| Learning outcomes | TABASAM assessments only, recorded from January 2026 (earlier reports mark learners "Too early to measure"): 60% of learners assessed improved; 2,372 identified for support |
| Narrative content | One highlight and next-month priority per month, 55 milestones and 32 partners, written from the narrative reports |
| Ask TUSOME | The Google Doc "Ask TUSOME — TABASAM Figures (live)" in the TUSOME shared drive holds the same figures, with the counting rules, for the Ask TUSOME Claude Project. It is refreshed after every monthly update |
| Branding | Text wordmark in TUSOME colours; no official logo file yet |
| Repository | `tusometechnologies/dashboard`, branch `main` |

## What is on the page

- **Headline and month menu.** The page opens on **All months**. Pick a month, or click a bar or point, to
  see that month with its change from the previous month, its highlight and its priority. Each month has its
  own link, for example `mcf.tusome.ac.tz/#2026-10`.
- **MCF EdTech Fellowship target.** Beneficiaries (learners plus educators) added up to the selected month
  against 8,000, with the percentage and the month the target was passed.
- **Six figures.** Learners reached, improved learning outcomes, learning institutions, educators reached,
  learners with disability, identified for support.
- **How TABASAM works.** Assess, analyse, generate a learning plan, support and track, in line with
  screen.tusome.ac.tz.
- **Reach.** Beneficiaries over time, learners by month and education level, a map and chart of learners by
  region, and a line explaining that figures combine TABASAM and AI for Schools.
- **Learning outcomes.** Improved share by month, by level and gender, and by region; from screening to
  support; learners identified for support by month. Months before January 2026 show that outcomes were not
  yet assessed.
- **Inclusion.** Learners with disability by month; girls and boys, female and male educators; urban and
  rural learners (semi-urban counted as rural).
- **Milestones and partners.** Milestones by month, filterable by type; partners grouped as agreements and
  fellowship programme, and working with.
- **Voices.** Quotes from two teachers and a school head, confirmed by TUSOME.
- **Data and definitions.** Downloadable CSVs (counts only, no learner records) and definitions.

The page shows no notes or caveats. Counting rules and data decisions are in `CLAUDE.md`, in the Ask TUSOME
Doc and in the commit history.

## Every month

1. Put the new Sahara report (.xlsx) and narrative report (.docx) in the Google Drive folder, or save the
   workbook in `reports/` (for example `reports/TUSOME_December_2026.xlsx`).
2. In Claude Code, ask: *"Add the December 2026 report to the dashboard."*
3. Claude Code previews the figures and any warnings, and proposes a highlight, a priority and milestones
   from the narrative report. Check them against what you submitted to Sahara.
4. Confirm. Claude Code updates the data, runs the checks, pushes (Vercel publishes within minutes) and
   refreshes the Ask TUSOME Doc in place, so its link stays the same.

## By hand (without Claude Code)

```bash
pip install openpyxl
python3 scripts/add_month.py reports/TUSOME_December_2026.xlsx           # preview
python3 scripts/add_month.py reports/TUSOME_December_2026.xlsx --write \
  --highlight "One sentence from the narrative report." \
  --priority "The main priority for next month."                         # update data/
python3 scripts/check_data.py                                            # check before publishing
python3 scripts/facts.py                                                 # rebuild the Ask TUSOME document
python3 -m http.server 8000                                              # preview at http://localhost:8000
git add data ask-tusome && git commit -m "Add December 2026 report" && git push
```

Then refresh the Ask TUSOME Doc as described in step 7 of `CLAUDE.md` (it needs the Google Docs connector).

## Hosting

- **Vercel** project connected to `tusometechnologies/dashboard` (framework preset **Other**, no build
  command), with the domain `mcf.tusome.ac.tz`.
- The site is public. To require a password, turn on Password Protection in Vercel (Settings → Deployment
  Protection; a paid add-on on Pro).
- `.vercelignore` keeps this README, `CLAUDE.md`, `scripts/`, `reports/` and `ask-tusome/` off the public site.

## Project layout

| Path | Contents |
|---|---|
| `index.html`, `assets/` | The page, styles, script, charting library (d3, kept locally) and Tanzania region boundaries for the map (geoBoundaries / OpenStreetMap, ODbL) |
| `data/monthly.csv` | One row per month: headline counts, highlight, priority, support, educators by gender, location |
| `data/by_level.csv`, `data/regions.csv` | Learners (and improved, schools) by level and by region |
| `data/programmes.csv` | Other TUSOME programmes counted with TABASAM (AI for Schools) |
| `data/milestones.csv`, `data/partners.csv`, `data/voices.csv` | Milestones, partners and quotes |
| `data/meta.json` | Last-updated date and the 8,000 beneficiary target |
| `scripts/add_month.py` | Reads a monthly report and updates `data/` |
| `scripts/check_data.py` | Checks the data before publishing |
| `scripts/facts.py`, `scripts/doc_sync.py` | Build the Ask TUSOME document and the batch that refreshes the Google Doc |
| `ask-tusome/` | The generated Ask TUSOME document (Markdown and HTML) |
| `reports/` | Monthly report workbooks; git-ignored, never uploaded |
| `CLAUDE.md` | Instructions and data decisions for Claude Code |

## Open items

- Report AI for Schools to Sahara (it is in the public figures but not yet in a Sahara report).
- Re-import November 2026 when the final report is ready, and add its next-month priority.
- Add the official TUSOME logo (`assets/logo.svg`) when available.
