# HealthPulse Edge

> Quality intelligence for the smallest hospitals in America — running entirely on a $400 mini-PC, with a cryptographic privacy guarantee even tribal data sovereignty laws can endorse.
>
> **Built on Gemma 4 · Submitted to the Gemma 4 Good Hackathon**

| | |
|---|---|
| **Live demo (in your browser)** | https://gemma-health.vercel.app/edge |
| **Recorded demo video** | _replace with YouTube link_ |
| **Code repository** | https://github.com/sgharlow/gemma-health |
| **Writeup track** | Digital Equity & Inclusivity |
| **Special Technology Track** | Ollama |

---

## The 30-second pitch

A 25-bed hospital on tribal land has the same federal CMS reporting obligations as Mayo Clinic, but no IT team, intermittent connectivity, and a tribal-council policy that forbids patient data leaving the reservation.

**HealthPulse Edge** is a $400 mini-PC running Gemma 4 entirely on-device via Ollama. It turns one overworked nurse-administrator into a one-person quality intelligence team — care gaps, peer benchmarks, CMS submissions, handwritten survey OCR — and *never sends a byte of patient data anywhere*.

Not "doctor in your pocket." This is **closing the analytics equity gap** between resourced urban systems and the 1,350 Critical Access Hospitals serving rural and tribal America — without compromising patient sovereignty.

---

## The problem

Every hospital in the US, including a 17-bed CAH in Lake City, Colorado, must report quality data to CMS quarterly. Mayo has analytics teams of 200. The median CAH has Marlene — an RN who is also the quality coordinator on Tuesdays and the EHR admin when nobody else is around.

Marlene's three options today: Excel (slow, no benchmarking); a $40-80k/year consultancy (unaffordable); or a cloud LLM with PHI (often illegal — no BAA, IDSov violation, 42 CFR Part 2 issues). Every option fails some combination of speed, cost, privacy, and connectivity. The system is built to fail her.

---

## The solution

A single mini-PC the hospital owns. It runs:

- **Gemma 4 26B / E4B** for quality analysis and natural-language Q&A, served locally via **Ollama**.
- **Gemma 4 E2B** as a dedicated PHI redaction sub-agent (sidecar).
- **DuckDB** holding CMS quality data + the hospital's own FHIR exports.
- A **6-tool MCP function-calling layer** so Gemma can call structured analytics: `facility_benchmark`, `quality_monitor`, `care_gap_finder`, `equity_detector`, `state_ranking`, `cross_cutting_analysis`.
- A **multimodal handler** that turns webcam captures of handwritten patient surveys into structured FHIR records.
- A **compliance ledger** (SHA-256 hash chain) that lets a regulator cryptographically verify no PHI ever left the box.
- A **Sovereignty Mode policy engine** honoring CARE Principles for Indigenous Data Governance.

A typical session:

1. Marlene types: *"Find the top 3 care gaps and tell me which one to tackle first."* Gemma 4 fans out three function calls, returns a 2-sentence executive summary.
2. She holds a stack of handwritten patient experience surveys to her laptop's webcam. Gemma 4 vision transcribes them and adds them to local FHIR.
3. She clicks "Submit Q2 to CMS." Sovereignty Mode demands a tribal-council co-signature key. The Redaction Sub-Agent runs (regex floor + Gemma E2B semantic pass), strips PHI, applies differential privacy noise (ε=1 per aggregate), and emits a SHA-256-signed envelope. The compliance ledger gains an entry: `phi_egress: true (signed)`.

The whole flow runs on a Mac Mini in Marlene's office. Airplane mode can be on the entire time.

---

## Why Gemma 4 specifically

Five properties of Gemma 4 are load-bearing:

1. **Frontier reasoning at edge sizes.** Quality analysis is not "generate-text" — it's "interpret a benchmark, identify the most actionable intervention, cite a clinical bundle." Gemma 4 26B delivers this locally.
2. **Native function calling** — for the 6 MCP tools. No brittle ReAct prompting.
3. **Multimodal vision** — table stakes for the webcam capture flow.
4. **Open weights** — critical for compliance. A regulator can audit which model version was running. A tribal council can verify the model was not silently swapped for one that exfiltrates data. **You cannot do this with a closed model.**
5. **E2B exists.** A 2 GB sidecar that runs alongside the primary model is exactly what we need for the redaction sub-agent. Without this size point, defense-in-depth redaction would require a second box.

---

## What's distinctive — three layers

Most "edge LLM healthcare" entries this hackathon will be patient-facing chatbots. We chose the opposite end of the value chain — administrative AI for the people running under-resourced hospitals — and added three differentiators:

### 1. Compliance Ledger

Every Gemma inference is locally hashed into an append-only SHA-256 chain. A regulator can verify cryptographically: which actions ran on which day, that the chain has not been tampered with, that `phi_egress: false` was true for every action that didn't go through the egress gate. HIPAA's audit-control requirement under §164.312(b) is satisfied by a ledger the hospital itself cannot retroactively forge.

### 2. Defense-in-Depth Redaction Sub-Agent

A two-layer pipeline gates any optional egress:
- **Layer 1 (regex):** SSN, phone, email, MRN, NPI, DOB, address, name+title — fast, deterministic, safety net even if the LLM is unavailable.
- **Layer 2 (Gemma E2B):** semantic catches that regex can't reliably handle — names without honorifics ("Yazzie reported"), indirect identifiers, ad-hoc identifiers, quoted patient speech.

If Layer 2 fails or is absent, Layer 1 still runs. **Fail-closed for privacy.** After redaction, numeric aggregates pass through a Laplace-mechanism differential-privacy aggregator (ε=1.0 per aggregate, total ε declared in the envelope).

### 3. Sovereignty Mode

A configurable policy engine honoring [CARE Principles for Indigenous Data Governance](https://www.gida-global.org/care). The policy is owned by the tribal council, not the application: some destinations allowed by default, others require a tribal-council co-signature key, unknown destinations default to BLOCKED.

This is genuinely novel. Almost no commercial AI product honors Indigenous Data Sovereignty (IDSov). Edge AI makes it practical for the first time, because the model can run where the data lives — and the data can live where the community lives.

---

## Why this qualifies for the Special Technology Track — Ollama

The on-prem product runs entirely on Ollama. We chose Ollama (not a custom inference stack) because it is the most operationally honest path for hospitals that lack IT teams: `brew install ollama` and `ollama pull gemma4:e4b` is the entire bring-up procedure. Three concrete uses:

- **Primary chat + function calling** via `gemma4:e4b`, served at `http://localhost:11434`.
- **Sidecar redaction sub-agent** via a separate `gemma4:e2b` invocation. Two models, one runtime, no orchestration code.
- **Optional batch quality analysis** via `gemma4:26b` on machines with sufficient RAM, swapped in/out between chat sessions.

Our minimal `lib/ollama.ts` adapter is ~60 lines of TypeScript. No vendor lock-in. The architecture transfers verbatim to any hospital with a $400 box.

---

## Live demo

Visit `/edge`. The page loads Gemma 4 E2B via MediaPipe LLM Inference + WebGPU into your browser. After download (cached on second visit), open DevTools → Network → Offline. Then click "Run care-gap scan" again. **It will keep working.**

This is not staged. The model and the tool layer and the compliance ledger all run inside your browser tab. Your prompt never leaves your computer. If your browser does not support WebGPU, fall back to the recorded demo video.

---

## What this submission deliberately does NOT try to do

- **Diagnose patients.** This is administrative AI, not clinical AI. Avoids FDA territory.
- **Replace doctors.** Marlene is the user. Output is intelligence for her, not for a patient.
- **Win on raw model performance.** The story is sovereignty + edge + equity. The model is the enabler, not the hero.
- **Claim production HIPAA certification.** Architecture is designed to satisfy HIPAA, 42 CFR Part 2, and CARE Principles. No formal certification has been done.
- **Speak for any tribal nation.** All personas and CAH facilities are composite. We cite the CARE Principles framework; we do not claim endorsement.

---

## What's next

If we win or place, the prize money funds: a 6-month pilot at one (1) opted-in CAH; replacing the synthetic seed dataset with the actual CMS Hospital Compare ETL; a `litert-community` packaged Gemma 4 26B for browsers; independent security review by a privacy lawyer with HIPAA + IDSov experience; a `gemma-health-policies` repository where tribal councils can fork the Sovereignty Mode policy template.

If we don't, the repo stays open. The core insight — *edge AI is the first technology that lets under-resourced clinics participate in public-health intelligence without surrendering patient sovereignty* — is true regardless of who ships it first.

---

## Test coverage + reproducibility

51 vitest cases covering the load-bearing privacy machinery: SHA-256 hash chain integrity, tamper detection, missing-entry detection, regex PHI patterns, Laplace mechanism noise variance, Sovereignty Mode decision paths, deep-redaction integration, egress envelope build. All green. TypeScript clean. `npm run build` clean. Apache-2.0 licensed (with explicit CC-BY-4.0 grant for prize-winning use, per contest rules).

---

## Built by

Steve Harlow. Acknowledgments: the CARE Principles for Indigenous Data Governance (Global Indigenous Data Alliance); the MediaPipe LLM Inference team at Google; the litert-community Hugging Face repository; Health Pulse, an earlier project of mine that supplied the CMS data schema and MCP tool contracts.
