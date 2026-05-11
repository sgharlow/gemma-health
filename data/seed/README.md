# Synthetic Seed Dataset

These JSON files seed the local DuckDB with **synthetic** data designed to mirror typical Critical Access Hospital quality patterns, without claiming to represent any real hospital.

- `facilities.json` — 15 synthetic CAHs across CMS Regions 8, 9, and 10
- `quality.json` — quality measure scores (mortality, process, patient experience)
- `readmissions.json` — excess readmission ratios for HF, COPD, AMI, PN, COPD-related DRGs

To populate the DuckDB, run `npm run seed` from `web/` (or it bootstraps automatically on first query).

To replace synthetic data with the real CMS Hospital Compare dataset, run `npm run ingest:cms` (Day 3).
