# HealthPulse Edge

> Overnight Gemma 4 batch analytics for the smallest hospitals in America — running entirely on a $400 mini-PC, with a cryptographic privacy receipt for every action even tribal data sovereignty laws can endorse.
>
> **Built on Gemma 4 · Submitted to the Gemma 4 Good Hackathon**

| | |
|---|---|
| **Live demo (in your browser)** | https://gemma-health.vercel.app/edge |
| **Recorded demo video** | https://youtu.be/5hkNbITM5d4 |
| **Code repository** | https://github.com/sgharlow/gemma-health |
| **Writeup track** | Digital Equity & Inclusivity |
| **Special Technology Track** | Ollama |

---

## The 30-second pitch

A 25-bed hospital on tribal land has the same federal CMS reporting obligations as Mayo Clinic, but no IT team, intermittent connectivity, and a tribal-council policy that forbids patient data leaving the reservation. It has one nurse-administrator with forty-five minutes between rounds and the morning huddle.

**HealthPulse Edge** is a $400 mini-PC under her desk. Between midnight and 6 AM it runs Gemma 4 against the week's queued questions and scanned surveys, locally, building offline. Marlene reviews, signs with the tribal council key, submits. Every action — every tool call, PHI redaction, DP noise injection — is in an append-only SHA-256 ledger she cannot retroactively forge.

Not "doctor in your pocket." This is **closing the analytics equity gap** between resourced urban systems and the 1,350 Critical Access Hospitals serving rural and tribal America, by matching how compute-poor facilities *actually* operate: overnight batch on equipment they already own, with a cryptographic record of what ran while no one was watching.

---

## The problem

Every US hospital reports quality data to CMS quarterly. Mayo has analytics teams of 200. The median CAH has Marlene — an RN who is also the quality coordinator and the EHR admin. She does not have a colleague who sits at a chatbot.

Marlene's three options today: Excel (slow, no benchmarking); a $40-80k/year consultancy (unaffordable); or a cloud LLM with PHI (often illegal — no BAA, IDSov violation, 42 CFR Part 2 issues). Every option fails some combination of speed, cost, privacy, and connectivity.

She also doesn't have analyst hours. She has *batch windows* — overnight, between shifts. Tools designed for interactive analyst use don't fit her shape of time. The product needs to look like a job queue, not a chatbot.

---

## The solution

A single mini-PC the hospital owns. It runs:

- **Gemma 4 E4B / E2B** via **Ollama** for quality analysis and natural-language Q&A.
- **Gemma 4 E2B** as a PHI redaction sidecar.
- **DuckDB** holding CMS quality data + the hospital's FHIR exports.
- **6 function-calling tools** — `facility_benchmark`, `quality_monitor`, `care_gap_finder`, `equity_detector`, `state_ranking`, `cross_cutting_analysis` — exposed as Ollama function calls AND as a Model Context Protocol (MCP) server in `mcp/` for Claude Desktop and other MCP hosts.
- A **multimodal handler** that queues webcam captures of handwritten surveys for vision transcription into local FHIR.
- A **compliance ledger** (SHA-256 chain) that lets a regulator cryptographically verify what the model did and that no PHI left the box.
- A **Sovereignty Mode** policy engine honoring CARE Principles for Indigenous Data Governance.

**The workflow is batch-first.** Marlene queues her week's questions Monday evening. Overnight, Gemma fans them out across the 6 tools, writes results to the local FHIR store and the compliance ledger. Tuesday at 6:47 AM she opens the app, sees the **Morning Report** banner, reviews the recommendations, signs the pre-built CMS envelope. Submission goes out by 9 AM. The whole flow runs on a Mac Mini in her office, airplane mode on.

---

## Why Gemma 4 specifically

Five properties of Gemma 4 are load-bearing:

1. **Frontier reasoning at edge sizes.** Quality analysis is not "generate-text" — it's "interpret a benchmark, identify the most actionable intervention, cite a clinical bundle." Gemma 4 26B delivers this locally.
2. **Native function calling** — for the 6 tools. No brittle ReAct prompting.
3. **Multimodal vision** — table stakes for the webcam capture flow.
4. **Open weights** — critical for compliance. A regulator can audit the running model version; a tribal council can verify it was not swapped for a data-exfiltrating clone. **You cannot do this with a closed model.**
5. **E2B exists** — a 2 GB sidecar runs alongside the primary; without it, defense-in-depth redaction would need a second box.

---

## What's distinctive — three layers

Most "edge LLM healthcare" entries this hackathon are patient-facing chatbots. We chose the opposite end of the value chain — administrative AI for under-resourced hospitals — and added three differentiators:

### 1. Compliance Ledger

Every Gemma inference is locally hashed into an append-only SHA-256 chain. A regulator can verify cryptographically which actions ran on which day, that the chain has not been tampered with, and that `phi_egress: false` held for every action outside the egress gate. The ledger is designed to be compatible with the audit-control intent of HIPAA §164.312(b); the hospital cannot retroactively forge it. Formal compliance certification is a separate exercise.

### 2. Defense-in-Depth Redaction Sub-Agent

A two-layer pipeline gates any optional egress:
- **Layer 1 (regex):** SSN, phone, email, MRN, NPI, DOB, address, name+title — fast, deterministic, runs even if the LLM is unavailable.
- **Layer 2 (Gemma E2B):** semantic catches regex can't reliably handle — names without honorifics, indirect identifiers, ad-hoc identifiers, quoted patient speech.

If Layer 2 fails or is absent, Layer 1 still runs. **Fail-closed for privacy.** Numeric aggregates then pass through a Laplace differential-privacy aggregator (ε=1.0 per aggregate, total ε declared and persisted to the ledger).

### 3. Sovereignty Mode

A configurable policy engine honoring [CARE Principles for Indigenous Data Governance](https://www.gida-global.org/care). The policy is owned by the tribal council, not the application: some destinations allowed by default, others require a co-signature key, unknown destinations default to BLOCKED.

This is genuinely novel. Almost no commercial AI product honors Indigenous Data Sovereignty (IDSov). Edge AI makes it practical for the first time, because the model can run where the data lives.

---

## Why this qualifies for the Special Technology Track — Ollama

The on-prem product runs entirely on Ollama — the most operationally honest path for hospitals without IT teams: `brew install ollama` and `ollama pull gemma4:e4b` is the entire bring-up. Three concrete uses:

- **Primary chat + function calling** via `gemma4:e4b`.
- **Sidecar redaction** via `gemma4:e2b`. Two models, one runtime, no orchestration code.
- **Optional batch analysis** via `gemma4:26b` on machines with sufficient RAM, run on demand for nightly reports.

A documented fallback chain (`gemma4:e4b` → `gemma4` → `gemma3:4b`) keeps the on-prem path resilient to tag drift.

---

## Live demo

Visit `/edge`. The page loads Gemma 4 E2B via MediaPipe LLM Inference + WebGPU into your browser. After download (cached on second visit), open DevTools → Network → Offline. Then click "Run care-gap scan" again. **It will keep working.**

This is not staged. The model and the tool layer and the compliance ledger all run inside your browser tab. Your prompt never leaves your computer. If your browser does not support WebGPU, fall back to the recorded demo video.

---

## What this submission deliberately does NOT try to do

- **Diagnose patients.** Administrative AI, not clinical. Avoids FDA territory.
- **Replace doctors.** Marlene is the user; output is intelligence for her.
- **Win on raw model performance.** Story is sovereignty + edge + equity; the model is the enabler, not the hero.
- **Claim HIPAA certification.** Architecture is aligned with HIPAA, 42 CFR Part 2, and CARE Principles. No formal certification has been done.
- **Speak for any tribal nation.** All personas and facilities are composite. We cite the CARE Principles framework; we do not claim endorsement.

---

## Known limitations

Synthetic 150-facility seed (production swaps in CMS Hospital Compare). Every tool result carries `data_source: "demo_seed"` so this is visible to the caller. Privacy budget (ε) is summed per envelope and persisted to the ledger; cross-session composition is operator-tracked, not enforced. Architecture-aligned with HIPAA, 42 CFR Part 2, and CARE Principles; no formal certification or tribal council endorsement has been performed.

## What's next

If we win, the prize funds a 6-month pilot at one opted-in CAH; the real CMS Hospital Compare ETL; independent privacy-lawyer review; and a `gemma-health-policies` repo where tribal councils can fork the Sovereignty Mode template.

If we don't, the repo stays open. The core insight — *edge AI is the first technology that lets under-resourced clinics participate in public-health intelligence without surrendering patient sovereignty* — is true regardless of who ships it first.

---

## Test coverage + reproducibility

58 vitest cases covering the load-bearing privacy machinery: SHA-256 chain integrity, tamper detection, regex PHI patterns, Laplace noise variance, Sovereignty Mode decision paths, deep-redaction integration, egress envelope build, and `/api/egress` route-handler integration. All green. TypeScript and `npm run build` clean. Apache-2.0 licensed (with CC-BY-4.0 grant for prize-winning use, per contest rules).

---

## Built by

Steve Harlow. Acknowledgments: the CARE Principles for Indigenous Data Governance (Global Indigenous Data Alliance); the MediaPipe LLM Inference team at Google; the litert-community Hugging Face repository; Health Pulse, an earlier project of mine that supplied the CMS data schema and MCP tool contracts.
