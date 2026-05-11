# HealthPulse Edge

> Quality intelligence for Critical Access Hospitals — runs entirely on a $400 mini-PC with Gemma 4. No cloud, no PHI exfiltration, IDSov-aware.
>
> **Submitted to:** [Gemma 4 Good Hackathon (Kaggle)](https://www.kaggle.com/competitions/gemma-4-good-hackathon)

| | |
|---|---|
| **Live demo (in your browser)** | https://gemma-health.vercel.app/edge |
| **Recorded demo video (≤3 min)** | _link added on submit_ |
| **Submission writeup** | [`WRITEUP.md`](./WRITEUP.md) |
| **Story / persona** | [`docs/STORY.md`](./docs/STORY.md) |
| **Strategy brief** | [`BRIEF.md`](./BRIEF.md) |
| **Build log** | [`STATUS.md`](./STATUS.md) |

## What this is

A self-contained quality intelligence platform for the ~1,350 US Critical Access Hospitals. One overworked nurse-administrator can:

- Find care gaps and rank them by intervention leverage
- Benchmark against peer CAHs in the same CMS region
- Detect equity gaps between tribal and non-tribal cohorts
- Digitize handwritten patient surveys via webcam
- Produce CMS-submittable aggregates with cryptographic privacy proofs

…all on a Mac Mini, with airplane mode on, with no cloud LLM in the loop.

## What's distinctive

Three layers no other "edge LLM healthcare" entry will have:

1. **Compliance Ledger** — SHA-256 hash chain so a regulator can cryptographically verify no PHI ever left the box.
2. **Defense-in-depth redaction** — regex floor + Gemma E2B sub-agent for semantic spans (names without honorifics, indirect identifiers, quoted speech).
3. **Sovereignty Mode** — configurable policy engine honoring [CARE Principles for Indigenous Data Governance](https://www.gida-global.org/care). Tribal council holds the egress key.

See [`WRITEUP.md`](./WRITEUP.md) for the full story.

## Quick start

### Path A — full on-prem app (Mac / Linux with Ollama)

```bash
# 1. Install Ollama and pull Gemma 4
brew install ollama
brew services start ollama
ollama pull gemma4:e4b
ollama pull gemma4:e2b

# 2. Clone, install, run
git clone https://github.com/sgharlow/gemma-health
cd gemma-health/web
npm install
npm run test          # 49/49
npm run dev           # http://localhost:3000
```

Open http://localhost:3000 and try:
- *"For DEMO-CAH-004, find the top 3 care gaps and tell me which one to tackle first."*
- Click "Start camera" → hold a paper survey to webcam → "Capture + extract"
- Click "Build envelope" with Sovereignty Mode ON, destination CMS, signature `tc-2026-q2`

### Path B — in-browser live demo (any modern Chrome/Edge with WebGPU)

```bash
npm run build
npm run start
# open http://localhost:3000/edge
```

Or visit the hosted version: https://gemma-health.vercel.app/edge

After the model loads (~1.8 GB on first visit, cached after):
1. Pick a facility from the dropdown
2. Click "Run care-gap scan" — Gemma streams a 2-sentence summary
3. Open DevTools → Network → Offline
4. Run the scan again — **it still works**

### Path C — no GPU / quick browse

Set `STUB_VISION=true` and `STUB_LLM_REDACTION=true` in `web/.env.local` to bypass the model calls. Useful for UI iteration. See [`web/.env.example`](./web/.env.example).

## Architecture

```
On-prem app (Mac Mini)        ←→        Live demo (your browser)
─────────────────────                    ──────────────────────────
Next.js                                  Next.js (same code)
Ollama + Gemma 4 26B/E4B/E2B             MediaPipe LLM + Gemma 4 E2B
DuckDB (CMS data + FHIR)                 Static JSON (same data shape)
Node fs ledger (SHA-256)                 IndexedDB ledger (SHA-256)
6 MCP tools (DuckDB-backed)              Same 6 tools (JSON-backed)
```

Both surfaces use the same tool contracts so the function-calling story is identical. The on-prem app is the product; the in-browser demo is the proof.

## Test coverage

49 vitest cases. Run with:

```bash
cd web
STUB_LLM_REDACTION=true npm run test
```

Covers: SHA-256 hash chain integrity, tamper detection, missing-entry detection, all 8 PHI regex classes, Laplace-mechanism noise variance distribution, Sovereignty Mode decision paths (allow / block / needs-signature), deep-redaction (regex + LLM) integration, egress envelope build, all 6 MCP tools against seed data.

## What this is NOT

- A clinical decision support system
- A patient-facing chatbot
- HIPAA-certified (architecture-aligned, not formally certified)
- Speaking for any specific tribal nation (composite personas; we cite CARE Principles)

See ["What this submission deliberately does NOT try to do"](./WRITEUP.md#what-this-submission-deliberately-does-not-try-to-do) in the writeup.

## License

[Apache-2.0](./LICENSE). If this submission is awarded a prize, the work and its source code are additionally granted under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) per the Gemma 4 Good Hackathon rules — see [`NOTICE`](./NOTICE).

## Acknowledgments

- The CARE Principles for Indigenous Data Governance, authored by the Global Indigenous Data Alliance
- The MediaPipe LLM Inference team at Google
- The litert-community Hugging Face repository for the WebGPU-packaged Gemma 4 E2B artifact
- [Health Pulse](https://github.com/sgharlow/health-pulse), an earlier project of mine that supplied the CMS data schema + MCP tool contracts
