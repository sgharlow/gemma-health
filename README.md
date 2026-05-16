# HealthPulse Edge

> Overnight Gemma 4 batch analytics for Critical Access Hospitals — runs entirely on a $400 mini-PC. Marlene queues her week's quality work Monday evening; the model processes it overnight; she reviews and signs in the morning. No cloud, no PHI exfiltration, IDSov-aware, every action in a cryptographic audit chain.
>
> **Submitted to:** [Gemma 4 Good Hackathon (Kaggle)](https://www.kaggle.com/competitions/gemma-4-good-hackathon)

| | |
|---|---|
| **Live demo (in your browser)** | https://gemma-health.vercel.app/edge |
| **Recorded demo video (≤3 min)** | https://youtu.be/5hkNbITM5d4 |
| **Submission writeup** | [`WRITEUP.md`](./WRITEUP.md) |
| **Story / persona** | [`docs/STORY.md`](./docs/STORY.md) |
| **Strategy brief** | [`BRIEF.md`](./BRIEF.md) |
| **Build log** | [`STATUS.md`](./STATUS.md) |

## What this is

A self-contained, **batch-first** quality intelligence platform for the ~1,350 US Critical Access Hospitals. The workflow is designed around the operational reality of compute-poor facilities — overnight runs on equipment the building already owns — not around a chatbot users sit at. One overworked nurse-administrator can:

- **Queue** care-gap questions Monday evening; review ranked recommendations Tuesday morning
- **Benchmark** against peer CAHs in the same CMS region (150 synthetic facilities seed-included; production swaps in real CMS Hospital Compare)
- **Detect** equity gaps between tribal and non-tribal cohorts
- **Capture** handwritten patient surveys via webcam — queued for vision transcription in the next batch
- **Submit** CMS-submittable aggregates with cryptographic privacy proofs after a quick morning review-and-sign

…all on a Mac Mini, with airplane mode on, with no cloud LLM in the loop, and every action recorded in an append-only SHA-256 ledger the hospital itself cannot retroactively forge.

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
- *"For DEMO-CAH-001, find the top 3 care gaps and tell me which one to tackle first."*
- Click "Start camera" → hold a paper survey to webcam → "Capture + extract"
- Click "Submit Q2 to CMS" with Sovereignty Mode ON, destination CMS, signature `tc-2026-q2`

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

### Path D — MCP server for Claude Desktop / Cursor / any MCP host

```bash
cd mcp
npm install
node server.js   # speaks Model Context Protocol over stdio
```

Wire it into your MCP host (Claude Desktop config snippet in [`mcp/README.md`](./mcp/README.md)) and the same 6 quality tools are callable directly from your chat client. No Ollama, no WebGPU, no browser — just the tools.

## Architecture

```
On-prem app (Mac Mini)        ←→        Live demo (your browser)  ←→  MCP server (any host)
─────────────────────                    ──────────────────────────    ─────────────────────
Next.js                                  Next.js (same code)            node mcp/server.js
Ollama + Gemma 4 E4B/E2B (+ optional 26B)  MediaPipe LLM + Gemma 4 E2B    Caller's model (Claude, etc.)
DuckDB (CMS data, 150-facility seed)     Static JSON (same data shape)  Same JSON
Node fs ledger (SHA-256)                 IndexedDB ledger (SHA-256)     (host owns its audit log)
6 function-calling tools                 Same 6 tools                   Same 6 tools (over MCP stdio)
```

Three surfaces, one tool contract: the on-prem app is the product, the in-browser demo is the proof, and the MCP server lets any host (Claude Desktop, Cursor, etc.) call the same tools directly.

## Test coverage

58 vitest cases. Run with:

```bash
cd web
STUB_LLM_REDACTION=true npm run test
```

Covers: SHA-256 hash chain integrity, tamper detection, missing-entry detection, all 8 PHI regex classes, Laplace-mechanism noise variance distribution, Sovereignty Mode decision paths (allow / block / needs-signature) + bundled-policy ↔ JSON parity, deep-redaction (regex + LLM) integration, egress envelope build, `/api/egress` route-handler integration (sovereignty wiring + signed envelopes + lifetime ε), all 6 tools against seed data.

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
- Health Pulse, an earlier project that informed the CMS quality-measure schema and tool-contract shapes used here. This repo is self-contained; nothing is imported from Health Pulse at build or run time.
