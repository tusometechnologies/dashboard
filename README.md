# TABASAM Fellowship Dashboard

TUSOME Technologies' public dashboard for TABASAM under the Mastercard Foundation EdTech Fellowship
(Sahara Consult). It shows learners reached, learning outcomes, institutions and educators from each
monthly report to Sahara. A static website: HTML, CSS, JavaScript and three CSV data files, with no build
step. Every push to `main` publishes the site through Vercel.

## Current status

| Item | Status |
|---|---|
| Data | 19 monthly reports, April 2025 to October 2026, counted from each report's learner, educator and school lists. Where a summary sheet reports more learners than its list, the summary figure is used |
| Learning outcomes | Assessed from January 2026. Earlier reports mark learners "Too early to measure", so those months have no improved share |
| Highlights | One highlight and one next-month priority per month, taken from the narrative reports (.docx). April–July 2025 reports have no priority |
| Branding | Text wordmark in TUSOME colours. No official logo file has been added yet |
| Repository | `tusometechnologies/dashboard`, branch `main` |
| Hosting | Vercel, domain `dashboard.tusome.africa` (see setup below if not yet connected) |
| Source reports | TUSOME Google Drive, TABASAM reports folder. Copies go in `reports/`, which is never uploaded |

## What is on the page

- **All months** (the opening view): learners, institutions and educators added up across all reports, and
  the improved share in months when outcomes were assessed.
- **Progress to the MCF EdTech Fellowship target** of 8,000 beneficiaries (learners plus educators), with
  the percentage reached and the month the target was passed. The target is set in `data/meta.json`.
- **One month** (pick from the menu, or click a bar or point): that month's figures with the change from
  the previous month, its highlight and its priority for the next month. Each month has its own link,
  for example `dashboard.tusome.africa/#2026-10`.
- Learners reached each month by education level (pre-primary to professional), and by region.
- Share marked as improved by month, and by level and gender.
- Learners identified for support (marked "Needs Support") by month, and improved share by region.
- Inclusion: learners with disability by month, and the female/male split of learners and educators.
- Milestones from the narrative reports, filterable by type (product, implementation, training, research,
  events, partnerships), and the partners TUSOME works with on TABASAM.
- Downloadable CSVs (counts only, no learner records) and definitions.

The page shows no notes or caveats. Data decisions are recorded in `CLAUDE.md` and the commit history.

## Every month

1. Put the new Sahara report (.xlsx) and narrative report (.docx) in the Google Drive folder, or save the
   workbook in `reports/` (for example `reports/TUSOME_November_2026.xlsx`).
2. In Claude Code, ask: *"Add the November 2026 report to the dashboard."*
3. Claude Code previews the figures, any warnings, and a proposed highlight and priority. Check them
   against the report you submitted.
4. Confirm. Claude Code updates the data, runs the checks and pushes. Vercel publishes within minutes.

## By hand (without Claude Code)

```bash
pip install openpyxl
python3 scripts/add_month.py reports/TUSOME_November_2026.xlsx           # preview
python3 scripts/add_month.py reports/TUSOME_November_2026.xlsx --write \
  --highlight "One sentence from the narrative report." \
  --priority "The main priority for next month."                         # update data/
python3 scripts/check_data.py                                            # check before publishing
python3 -m http.server 8000                                              # preview at http://localhost:8000
git add data && git commit -m "Add November 2026 report" && git push
```

## Hosting setup (once)

1. **Connect Vercel.** Add New → Project → import `tusometechnologies/dashboard`. Framework preset:
   **Other**. Leave the build command and output directory empty. Deploy.
2. **Add the domain.** Settings → Domains → add `dashboard.tusome.africa`, then add the DNS record Vercel
   shows (usually a CNAME) at the domain provider.
3. **Optional: restrict access.** The site is public. To require a password, turn on Password Protection
   (Settings → Deployment Protection; a paid add-on on Pro).

`.vercelignore` keeps this README, `CLAUDE.md`, `scripts/` and `reports/` off the public site.

## Project layout

| Path | Contents |
|---|---|
| `index.html`, `assets/` | The page, styles, script and charting library (d3, kept locally) |
| `data/monthly.csv` | One row per month: headline counts, highlight, priority |
| `data/by_level.csv`, `data/regions.csv` | Learners (and improved, schools) by level and by region |
| `data/milestones.csv`, `data/partners.csv` | Milestones and partners, written from the narrative reports |
| `scripts/add_month.py` | Reads a monthly report and updates `data/` |
| `scripts/check_data.py` | Checks the data before publishing |
| `CLAUDE.md` | Instructions and data decisions for Claude Code |
