# TABASAM Fellowship Dashboard

TUSOME Technologies' public dashboard for TABASAM under the Mastercard Foundation EdTech Fellowship
(Sahara Consult). A static website: HTML, CSS, JavaScript and three CSV data files. No build step.

## One-time setup

You need: a GitHub account, a Vercel account (Pro plan for company use), Claude Code, Python 3, and
access to the DNS settings for tusome.africa.

1. **Open the project in Claude Code.** Unzip this folder, open a terminal in it and run `claude`.
   Claude Code reads `CLAUDE.md` and knows how the project works.
2. **Put it on GitHub.** Ask Claude Code: *"Create a private GitHub repository called tabasam-dashboard
   and push this project to it."* (It needs the GitHub CLI, `gh`, signed in to your account.)
3. **Connect Vercel.** In Vercel: Add New → Project → import the `tabasam-dashboard` repository.
   Framework preset: **Other**. Leave build command and output directory empty. Deploy.
4. **Add your domain.** In the Vercel project: Settings → Domains → add `dashboard.tusome.africa`.
   Vercel shows a DNS record (usually a CNAME pointing to Vercel). Add that record at your domain
   provider. The site is live on your domain once the record takes effect, often within an hour.
5. **Optional: restrict access.** The site is public by default. To require a password, turn on Password
   Protection in Vercel (Settings → Deployment Protection; a paid add-on on Pro).

## Every month

1. Save the new Sahara report in the `reports/` folder (for example `reports/TUSOME_November_2026.xlsx`).
2. In Claude Code, ask: *"Add the November 2026 report to the dashboard."*
3. Claude Code previews the figures and any warnings. Check them against the report you submitted.
4. Confirm. Claude Code updates the data, runs the checks, and pushes. Vercel publishes within minutes.

The `reports/` folder is never uploaded to GitHub, so learner-level records stay on your computer.

## By hand (without Claude Code)

```bash
pip install openpyxl
python3 scripts/add_month.py reports/TUSOME_November_2026.xlsx          # preview
python3 scripts/add_month.py reports/TUSOME_November_2026.xlsx --write  # update data/
python3 scripts/check_data.py                                           # check before publishing
python3 -m http.server 8000                                             # preview at http://localhost:8000
git add data && git commit -m "Add November 2026 report" && git push
```

## What is on the page

- Headline: the selected month's learners, institutions and improved share, one highlight from that
  month's narrative report, and a note when a month
  has a known reporting issue.
- Six headline figures with the change from the previous month.
- Learners reached each month by level; learners and schools by region for the selected month.
- Share marked as improved by month; improved share by level and by gender for the selected month.
- Downloadable CSVs and definitions.

The page opens on **All months** (learner figures added up across the monthly reports; institutions and
educators are the highest monthly figure). Pick a month from the menu, or click a bar or point, to see that month. Each month has its own link, for example
`dashboard.tusome.africa/#2026-10`.
