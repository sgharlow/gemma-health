# HealthPulse Edge

> Quality intelligence for the smallest hospitals in America — running entirely on a $400 mini-PC, with a cryptographic privacy guarantee even tribal data sovereignty laws can endorse.
>
> **Built on Gemma 4 · Submitted to the Gemma 4 Good Hackathon**

| | |
|---|---|
| **Live demo (in your browser)** | https://gemma-health.vercel.app/edge |
| **Recorded demo video (90 s)** | _replace with YouTube link_ |
| **Code repository** | https://github.com/sgharlow/gemma-health |
| **Categories addressed** | Health & Sciences · Digital Equity & Inclusivity · Safety & Trust |

---

## The 30-second pitch

A 25-bed hospital on tribal land in northern Arizona has the same federal CMS quality reporting obligations as Mayo Clinic, but no IT department, no analytics team, intermittent connectivity, and a tribal-council policy that explicitly forbids patient data leaving the reservation.

**HealthPulse Edge** is a $400 mini-PC running Gemma 4 entirely on-device. It turns one overworked nurse-administrator into a one-person quality intelligence team — finds care gaps, benchmarks against peers, drafts CMS submissions, structures handwritten patient surveys via webcam — and *never sends a byte of patient data anywhere*.

It does this because Gemma 4 is the first open model family that makes frontier reasoning practical at the edge: small enough to run on a $400 box (E4B), powerful enough for real quality analytics (26B), multimodal enough to read paper forms, and **open-weight enough to be cryptographically auditable for compliance**.

This is not "doctor in your pocket." This is **closing the analytics equity gap** between resourced urban systems and the 1,350 Critical Access Hospitals serving rural and tribal America — without compromising the patient sovereignty those communities are owed.

---

## The problem

Every hospital in the US, including a 17-bed CAH in Lake City, Colorado, must report quality data to CMS quarterly. Hospitals like Mayo Clinic have analytics teams of 200. The median Critical Access Hospital has Marlene — an RN who is also the quality coordinator on Tuesdays and the EHR admin when nobody else is around.

Today, Marlene has three options for analytics:
1. **Excel + a calendar reminder.** Slow, error-prone, no peer benchmarking.
2. **Pay a consultancy.** $40-80k/year, often unaffordable.
3. **Use a cloud LLM with PHI.** Often illegal (no BAA, IDSov violation, 42 CFR Part 2 issues for substance-use data).

Every option fails some combination of:
- Speed
- Cost
- Privacy / data sovereignty
- Connectivity (the satellite uplink is billed by the gigabyte; cell drops three afternoons a week)

The system is built to fail her, and her hospital, and her community.

---

## The solution

**HealthPulse Edge** is a single mini-PC appliance the hospital owns. It runs:

- **Gemma 4 26B** for primary quality analysis and natural-language Q&A.
- **Gemma 4 E4B** for the chat interface (when memory is constrained).
- **Gemma 4 E2B** as a dedicated PHI redaction sub-agent.
- A local **DuckDB** holding CMS quality data and the hospital's own FHIR exports.
- A **6-tool MCP function-calling layer** so Gemma can call structured analytics: `facility_benchmark`, `quality_monitor`, `care_gap_finder`, `equity_detector`, `state_ranking`, `cross_cutting_analysis`.
- A **multimodal handler** that turns webcam captures of handwritten patient experience surveys into structured FHIR records.
- A **compliance ledger** (SHA-256 hash chain) that lets a regulator cryptographically verify no PHI ever left the box.
- A **redaction sub-agent + Laplace-mechanism differential-privacy aggregator** that gates any optional CMS submission.
- A **Sovereignty Mode policy engine** honoring CARE Principles for Indigenous Data Governance, configurable per jurisdiction.

A typical session, in 90 seconds:

1. Marlene types: *"For our hospital, find the top 3 care gaps and tell me which one to tackle first."* Gemma 4 fans out three function calls, returns a 2-sentence executive summary citing the highest-leverage intervention.
2. She holds a stack of handwritten patient experience surveys to her laptop's webcam. Gemma 4 vision transcribes them — handwritten English, with a Diné Bizaad note handled gracefully — and adds them to local FHIR.
3. She clicks "Submit Q2 to CMS." The Sovereignty Mode policy engine demands a tribal-council co-signature key. She enters it. The Redaction Sub-Agent runs (regex floor + Gemma E2B semantic pass), strips PHI, applies differential privacy noise (ε=1 per aggregate), and emits a SHA-256-signed envelope. The compliance ledger gains an entry: `phi_egress: true (signed)`.

The whole flow runs on a Mac Mini in Marlene's office. Airplane mode can be on the entire time.

---

## Why Gemma 4 specifically (not a generic edge LLM)

Three properties of Gemma 4 are load-bearing for this submission:

1. **Frontier reasoning at edge sizes.** Quality analysis is not a "generate-text" task — it's "interpret a benchmark, identify the most actionable intervention, cite a clinical bundle." That requires real reasoning, which Gemma 4 26B delivers locally and Gemma 4 E4B delivers acceptably.
2. **Native function calling.** Tool-routing for the 6 MCP tools. Without native function calling we'd be stuck with brittle ReAct prompting.
3. **Multimodal vision.** The webcam capture flow is not a stretch goal; it's table stakes for digitizing the paper surveys nobody has time to enter.
4. **Open weights.** Critical for compliance. A regulator can audit which model version was running. A tribal council can verify the model was not silently swapped for one that exfiltrates data. **You cannot do this with a closed model.**
5. **E2B exists.** A 2 GB sidecar model that can run alongside the primary 26B model is exactly what we need for the redaction sub-agent. Without this size point, defense-in-depth redaction would require a second box.

---

## What's distinctive — three layers no other entry will have

Most "edge LLM healthcare" entries this hackathon will be patient-facing chatbots. We deliberately chose the opposite end of the value chain — administrative AI for the people running under-resourced hospitals — and added three differentiators no patient-chatbot entry will have:

### 1. Compliance Ledger

Every Gemma inference is locally hashed into an append-only SHA-256 chain. If a regulator audits the hospital, they can verify cryptographically:
- Which actions ran on which day
- That the chain has not been tampered with (any modification to a single entry breaks every subsequent hash)
- That `phi_egress: false` was true for every action that didn't go through the egress gate

This turns "we promise no PHI left the box" into "here's the cryptographic proof no PHI left the box." HIPAA's audit-control requirement under §164.312(b) is satisfied by a ledger that the hospital itself cannot retroactively forge.

### 2. Defense-in-Depth Redaction Sub-Agent

A two-layer pipeline gates any optional egress:
- **Layer 1 (regex):** SSN, phone, email, MRN, NPI, DOB, address, name+title — fast, deterministic, safety net even if the LLM is unavailable.
- **Layer 2 (Gemma E2B sub-agent):** semantic catches that regex can't reliably handle — names without honorifics ("Yazzie reported"), indirect identifiers ("the patient who came in Tuesday"), ad-hoc identifiers, quoted patient speech.

If Layer 2 fails or is absent, Layer 1 still runs. **Fail-closed for privacy.**

After redaction, numeric aggregates pass through a Laplace-mechanism differential-privacy aggregator (ε=1.0 per aggregate, total ε declared in the envelope). The result is a CMS-submittable aggregate that satisfies HIPAA + 42 CFR Part 2 without exposing any individual.

### 3. Sovereignty Mode

A configurable policy engine honoring CARE Principles for Indigenous Data Governance. The policy is owned by the tribal council, not the application:

- Some destinations (TRIBAL_COUNCIL, INTERNAL_BENCHMARK) allowed by default
- Others (CMS, STATE_DOH) require a tribal-council co-signature key
- Unknown destinations default to BLOCKED

This is genuinely novel. Almost no commercial AI product honors Indigenous Data Sovereignty (IDSov). Edge AI makes it practical for the first time, because the model can run where the data lives — and the data can live where the community lives.

---

## Architecture (one diagram)

```
┌─────────────────────────────────────────────────────────────┐
│  Mac Mini M4 16GB / equivalent on-prem box                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Local Web UI (Next.js, served on 127.0.0.1)        │    │
│  │   - chat surface  - airplane-mode banner            │    │
│  │   - webcam capture for paper-form OCR               │    │
│  │   - live compliance ledger view                     │    │
│  │   - egress button + sovereignty toggle              │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↕                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Gemma 4 Runtime (Ollama)                           │    │
│  │   - gemma4:e4b (primary chat + function calling)    │    │
│  │   - gemma4:e2b (redaction sub-agent sidecar)        │    │
│  │   - gemma4:26b (optional batch quality analysis)    │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↕                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  6-Tool MCP Layer (DuckDB-backed)                   │    │
│  │   facility_benchmark · quality_monitor              │    │
│  │   care_gap_finder    · equity_detector              │    │
│  │   state_ranking      · cross_cutting_analysis       │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↕                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Local Data                                         │    │
│  │   CMS quality data (DuckDB, ~200 MB)                │    │
│  │   FHIR exports (synthetic Synthea for demo)         │    │
│  │   Compliance ledger (append-only JSONL + sha256)    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Egress Gate (the only path off the box)            │    │
│  │   1. Sovereignty Mode policy check                  │    │
│  │   2. Regex PHI strip                                │    │
│  │   3. Gemma E2B semantic redaction sub-agent         │    │
│  │   4. Differential-privacy aggregation (Laplace)     │    │
│  │   5. SHA-256 sign + ledger entry                    │    │
│  │   6. Optional HTTPS to CMS endpoint                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## How the live demo works

Visit the live demo at `/edge`. The page loads Gemma 4 E2B via MediaPipe LLM Inference and WebGPU into your browser. After the model finishes downloading (cached on second visit), open DevTools → Network → Offline. **Then click "Run care-gap scan" again.** It will keep working.

This is not staged. The model and the tool layer and the compliance ledger all run inside your browser tab. Your prompt never leaves your computer.

If your browser does not support WebGPU (Safari ships it behind a flag, Firefox is partial), fall back to the recorded demo video.

---

## What this submission deliberately does NOT try to do

- **Diagnose patients.** This is administrative AI, not clinical AI. Avoids FDA territory and the safety concerns judges have about LLM healthcare entries.
- **Replace doctors.** Marlene is the user. The output is intelligence for her, not for a patient.
- **Win on raw model performance.** We do not benchmark Gemma 4 against GPT-5 or Claude. The story is sovereignty + edge + equity. The model is the enabler, not the hero.
- **Claim production HIPAA certification.** The architecture is designed to satisfy HIPAA, 42 CFR Part 2, and CARE Principles. No formal certification has been done; that is post-hackathon work.
- **Speak for any tribal nation.** All personas and CAH facilities are composite. We cite the CARE Principles framework; we do not claim endorsement from any specific community.

---

## What's next

If we win or place, the prize money funds:

1. A 6-month pilot at one (1) Critical Access Hospital that has explicitly opted in. The pilot validates whether real quality coordinators find the workflow useful.
2. Replacing the synthetic seed dataset with the actual CMS Hospital Compare ETL (already have the schema, just haven't run the import).
3. A `litert-community` packaged Gemma 4 26B for browsers with sufficient memory, so the live demo can match the on-prem product more closely.
4. Independent security review of the Compliance Ledger + Egress Gate by a privacy lawyer with HIPAA + IDSov experience.
5. A `gemma-health-policies` repository where tribal councils can fork and customize the Sovereignty Mode policy template.

If we don't, the repo stays open and someone else can pick it up. The core insight — *edge AI is the first technology that lets under-resourced clinics participate in public-health intelligence without surrendering patient sovereignty* — is true regardless of who ships it first.

---

## Test coverage

49 vitest cases covering the load-bearing privacy machinery: SHA-256 hash chain integrity, tamper detection, missing-entry detection, regex PHI patterns, Laplace mechanism noise variance, Sovereignty Mode decision paths, deep-redaction integration, egress envelope build. All green. TypeScript clean. `npm run build` clean.

---

## Built by

Steve Harlow. Source code under Apache-2.0 (matching the Gemma 4 license terms).

Specific acknowledgments:
- The CARE Principles for Indigenous Data Governance, authored by the Global Indigenous Data Alliance.
- The MediaPipe LLM Inference team at Google, for making in-browser Gemma practical.
- The litert-community Hugging Face repository for the WebGPU-packaged Gemma 4 E2B artifact.
- Health Pulse, an earlier project of mine that supplied the CMS data schema and MCP tool contracts.
