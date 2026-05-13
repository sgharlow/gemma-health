# Synthetic Seed Dataset

These JSON files seed the local DuckDB (Mac on-prem path), the static `web/public/edge/*.json` (in-browser `/edge` demo), and the MCP server with **synthetic** data designed to mirror typical Critical Access Hospital quality patterns, without claiming to represent any real hospital.

- `facilities.json` — 150 synthetic CAHs across all 10 CMS Regions, with ~10% tribal (concentrated in regions 6/8/9/10)
- `quality.json` — quality measure scores (HCAHPS, mortality, ED throughput, sepsis bundle)
- `readmissions.json` — excess readmission ratios for HF, COPD, AMI, PN DRGs

**The first 15 facilities (`DEMO-CAH-001` … `DEMO-CAH-015`) are preserved verbatim** so the vitest invariants in `web/src/lib/__tests__/tools.test.ts` keep anchoring on stable inputs. Facilities 16–150 are deterministically generated.

## Regenerate

```bash
node scripts/gen-seed.cjs                       # default: 150 facilities, PRNG seed 20260511
node scripts/gen-seed.cjs --total 200 --seed 42 # custom total + seed
```

Re-running with the same `--total` and `--seed` produces byte-identical output. Writes to both `data/seed/*.json` and `web/public/edge/*.json` so the on-prem and browser surfaces stay in sync.

## Provenance

Every tool result returns `data_source: "demo_seed"` so the synthetic origin is visible to callers (Ollama function calls, browser tools, MCP host responses). To replace synthetic data with the real CMS Hospital Compare dataset, drop equivalently-shaped JSON files in `$HPE_DATA_ROOT` for the MCP server, or rewrite `data/seed/*.json` for the on-prem app.
