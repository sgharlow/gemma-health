# HealthPulse Edge — Gemma 4 Good Hackathon Submission Brief

> **Hackathon:** Gemma 4 Good Hackathon · **Prize Pool:** $200,000 · **Deadline:** ~2026-05-18 (8 days from 2026-05-10)
> **Submission slug (target):** TBD on Kaggle · **Code repo (this):** github.com/sgharlow/gemma-health (TBD)

## The pitch (the writeup opener)

A 25-bed hospital on tribal land in northern Arizona has the same federal CMS quality reporting obligations as Mayo Clinic, but no IT department, no analytics team, intermittent connectivity, and a legal duty to keep patient data inside tribal jurisdiction.

**HealthPulse Edge** is a $400 mini-PC running Gemma 4 entirely on-device. It turns a single overworked nurse-administrator into a one-person quality intelligence team — finds care gaps, benchmarks against peers, drafts CMS submissions, structures handwritten patient surveys via webcam, and never sends a byte of patient data anywhere.

It does this because Gemma 4 is the first open model family that makes frontier reasoning practical at the edge — small enough to run on a $400 box (E4B), powerful enough to do real clinical-quality analytics (26B), multimodal enough to read paper forms, and open-weight enough to be cryptographically auditable for compliance.

This is not "doctor in your pocket." This is **closing the analytics equity gap** between resourced urban systems and the 1,350 Critical Access Hospitals serving rural and tribal America — without compromising the patient sovereignty that those communities are owed.

## Why this wins (the angle judges have not seen 50 times)

Most Gemma 4 healthcare entries will be patient-facing chatbots running offline. We deliberately choose the opposite end of the value chain: the **administrative AI** that hospital systems use to comply with federal reporting and find care gaps. This positions us in three Gemma 4 categories simultaneously:

- **Health & Sciences** — quality intelligence + clinical decision support
- **Digital Equity & Inclusivity** — closing the rural/tribal analytics gap
- **Safety & Trust** — cryptographic compliance ledger + Indigenous Data Sovereignty

Differentiators no other submission will have:

1. **Compliance Ledger** — every Gemma inference is hashed into a SHA-256 chain so a regulator can verify cryptographically that no PHI was ever exfiltrated.
2. **Redaction Sub-Agent** — a Gemma E2B sidecar runs a PHI redaction + differential-privacy aggregation pass before any optional CMS sync.
3. **Sovereignty Mode** — honors CARE Principles for Indigenous Data Sovereignty: configurable jurisdictional boundary, tribal council holds the egress key.

This combination is genuinely novel. IDSov-compliant AI products essentially do not exist today; edge LLMs make them possible for the first time.

## The persona (the writeup's emotional anchor)

**Marlene Tsosie**, RN, 31. Title: Quality Improvement Coordinator. Actual job: ICU charge nurse + quality officer + occasional EHR admin + occasional CMS submitter at a 25-bed Critical Access Hospital on Navajo Nation in northern Arizona. (Composite character — not a specific real person, to avoid implying endorsement.)

Marlene's reality:
- CMS submission deadlines she misses because she cannot make pivot tables fast enough
- Cell signal that drops three afternoons a week
- A satellite uplink billed by the gigabyte
- Tribal council policy that explicitly forbids patient data leaving the reservation
- A hospital board that wants quality benchmarks against peer CAHs but cannot afford an analytics consultant
- Cannot legally use ChatGPT/Claude with PHI (no BAA + IDSov violation)
- A stack of handwritten patient experience surveys she has not entered into the system in three weeks

Marlene is not unusual. She is approximately the median Critical Access Hospital quality lead.

## The demo (video script — target 2:30, contest max is 3:00)

Hard-cut, no music swells, real footage. Subtitled.

**0:00 — Cold open.** Camera on a counter. A Mac Mini with a label: "HealthPulse Edge — Property of [composite tribal CAH]." Marlene's hands. She opens a laptop connected to it.

**0:05 — The privacy promise.** Camera pulls in on the laptop's WiFi indicator: airplane mode is on. A red banner across the screen reads: "OFFLINE — Gemma 4 26B running locally."

**0:12 — The first ask.** Marlene types: *"Compare our 30-day readmission rate to peer CAHs in CMS Region 8 and tell me which DRG is dragging it down most."*

**0:20 — Function calling in action.** Screen shows three tool calls fanning out (HealthPulse Edge ships 6 MCP tools, schema-borrowed from Health Pulse): `facility_benchmark` → `quality_monitor` → `cross_cutting_analysis`. Result renders as a chart + 3-sentence narrative. *"Your readmission rate is 14.2% vs. peer median 11.8%. The DRG driving this is 291 (heart failure), with 28% of readmissions occurring in the 7–14 day window. Recommend reviewing transitional care protocols for HF discharges."*

**0:38 — The multimodal moment.** Marlene picks up a stack of handwritten patient experience surveys. Holds one to the laptop's webcam. The screen shows Gemma 4 transcribing it in real time — handwritten English plus a note in Diné Bizaad (Navajo) handled gracefully — and then asking: *"Add this to the Q2 patient experience cohort?"* She nods. It does.

**0:55 — The compliance receipt.** A small panel in the corner shows the latest entry in the Compliance Ledger: a SHA-256 hash, a timestamp, a tool call, the assertion `phi_egress: false`, signed. *"Every action is logged. No data has left this device."*

**1:10 — The federation hook.** Marlene clicks "Submit Q2 to CMS." A separate panel: "Redaction Agent: over a hundred PHI fields stripped. Differential privacy noise applied (ε=1.0 per aggregate). Aggregate ready." She approves. *Now and only now*, the airplane mode icon flickers off momentarily — the redacted aggregate ships — then back on.

**1:25 — The closer.** Voiceover: *"Frontier intelligence does not require a frontier datacenter. With Gemma 4, the smallest hospital in America can do what only the largest could yesterday — without surrendering a patient's right to be unknown."*

**1:30 — Cut to title card.** "HealthPulse Edge. Built on Gemma 4. github.com/sgharlow/gemma-health."

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Mini-PC (target: Mac Mini M4 16GB, or NVIDIA Jetson Orin)  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Local Web UI (Next.js, served on 127.0.0.1)        │    │
│  │   - chat surface                                    │    │
│  │   - charts (recharts)                               │    │
│  │   - webcam capture for paper-form OCR               │    │
│  │   - airplane-mode banner                            │    │
│  │   - compliance ledger view                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↕                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Gemma 4 Runtime                                    │    │
│  │   - Ollama (gemma4:e4b for primary reasoning +      │    │
│  │     tool calls + vision)                            │    │
│  │   - Ollama (gemma4:e2b for redaction sub-agent)     │    │
│  │   - vision endpoint for multimodal forms            │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↕                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Local MCP Tool Server (schema from Health Pulse)   │    │
│  │   6 tools: quality_monitor, care_gap_finder,        │    │
│  │   equity_detector, facility_benchmark,              │    │
│  │   state_ranking, cross_cutting_analysis             │    │
│  │   Backed by local DuckDB over CMS parquet           │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↕                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Local Data                                         │    │
│  │   - CMS quality data (DuckDB / parquet, ~200MB)     │    │
│  │   - Local FHIR exports (synthetic Synthea for demo) │    │
│  │   - Compliance ledger (append-only JSONL + sha256)  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Egress Gate (only path off the box)                │    │
│  │   1. Redaction sub-agent strips PHI                 │    │
│  │   2. Differential privacy aggregation (ε=1.0)       │    │
│  │   3. Cryptographic sign + ledger entry              │    │
│  │   4. Optional HTTPS to CMS endpoint                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Schema borrow from Health Pulse (no code import):**
- Tool-contract shapes for `quality_monitor`, `care_gap_finder`, etc. — re-implemented locally against DuckDB / static JSON
- CMS quality-measure column conventions
- Next.js UI scaffold patterns

**Net new for HealthPulse Edge:**
- 6 function-calling tools, exposed three ways (Ollama, in-browser, MCP server)
- Local Gemma 4 runtime integration (Ollama) with documented model fallback chain
- Webcam multimodal handler
- Redaction sub-agent + Laplace differential-privacy aggregator
- Compliance ledger (SHA-256 chain) with cumulative ε tracking
- Sovereignty Mode policy engine (bundled TS module + canonical JSON)
- Offline-first UX (airplane mode banner, queued egress)

## 8-day plan

| Day | Focus | Definition of Done |
|---|---|---|
| **1 (today)** | Repo scaffold, Gemma 4 runtime install, decide hardware target. Pull Health Pulse MCP tool definitions for reuse audit. | `ollama run gemma4` returns text on the dev machine. Mock UI page renders. |
| **2** | Port Health Pulse MCP tools to local DuckDB. Implement function-calling loop (Gemma → tool → Gemma). | One tool round-trip working end-to-end against real CMS sample data. |
| **3** | Multimodal: webcam capture → Gemma vision → structured FHIR. Compliance ledger append-only writer. | Hold up a paper form, see structured output land on disk + ledger entry. |
| **4** | Redaction sub-agent (Gemma E2B). Differential privacy aggregator. Egress gate. | Submit aggregate → all PHI stripped → signed envelope ready. |
| **5** | Sovereignty Mode policy engine. Polish UI. Wire airplane-mode detection. Cut first demo recording. | First end-to-end demo recorded (rough). |
| **6** | Demo polish — re-record with good lighting, clean cuts, subtitles. Writeup draft. Live demo deploy decision. | Final video locked. Writeup at 80%. |
| **7** | Writeup polish, code repo README, attached assets, **submit a draft Writeup early** so the form is filled and we can edit. | Draft Writeup submitted. |
| **8** | Final submit by 11:59 UTC. Test live demo from a clean device. Tweet thread + LinkedIn post. | Submitted. |

## Live demo strategy

The hackathon requires a "live demo." For a fully on-prem product this is a tension: judges cannot SSH into our Mac Mini.

Three options, ranked:

1. **Recommended: a public web demo that runs Gemma 4 in WebGPU in the judge's own browser.** Zero server. Judge clicks the link, model downloads (~2GB), runs locally, prove offline by toggling browser DevTools network panel to "Offline." This is the maximum wow factor and also literally proves the privacy promise. Risk: WebGPU + Gemma 4 may not be ready / fast enough by 2026-05-18. Fallback to #2 if so.
2. **Public web demo backed by a Cloudflare Worker proxying to a Gemma 4 endpoint** (Vercel AI Gateway or a self-hosted Gemma instance). Less ideologically pure (the inference is not in the judge's browser), but reliable. Caveat in writeup: "Production deployment runs on-prem; this hosted demo exists only because we cannot ship a Mac Mini to each judge."
3. **Recorded demo + downloadable Mac Mini disk image.** Last resort.

Decision deadline: end of Day 2.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| WebGPU Gemma 4 not ready / too slow | High | Fallback to hosted demo (option 2) |
| Gemma 4 26B too large for target hardware | Medium | Drop to gemma4:e4b for primary, lose some reasoning quality |
| Multimodal form OCR unreliable on handwritten Diné Bizaad | High | Use English-only handwritten form in demo; mention multilingual as roadmap |
| Differential privacy implementation has a math bug judges spot | Medium | Cite the Laplace mechanism + use established library (e.g., `python-dp`) |
| 8 days is not 8 days because of other portfolio fires (domo-ssrs, report-bridge) | High | **This is the real risk.** Decision check at end of Day 2 — if behind, descope to a single category submission instead of three. |
| Health Pulse MCP tools have Domo dependencies that don't unwind cleanly to local DuckDB | Medium | Wrap the Domo SQL adapter; ship 6 of 11 tools instead of all 11 if needed |

## Decision points

- **End of Day 1:** is Gemma 4 actually open and downloadable yet? If not, the entire submission is at risk and we walk away.
- **End of Day 2:** is the hosted-demo path viable? Lock the live demo strategy here.
- **End of Day 5:** is the demo video coherent? If the narrative is muddy, simplify and re-record on Day 6 — do not ship a confused video.
- **End of Day 7:** is the submission complete? If not, descope creative layers (drop Layer 3 first, then Layer 2) to ship something coherent rather than something incomplete.

## What this submission deliberately does NOT try to do

- **Diagnose patients.** This is administrative AI, not clinical AI. Avoids FDA territory and the safety concerns judges have about LLM healthcare entries.
- **Replace doctors.** Marlene is the user. The output is intelligence for her, not for a patient.
- **Sell to hospitals.** The submission is a research demonstration; commercialization is a separate post-hackathon decision.
- **Win on raw model performance.** We do not benchmark Gemma against GPT-5 or Claude. The story is sovereignty + equity + edge — the model is the enabler, not the hero.

## Submission checklist (Kaggle requirements)

- [ ] Kaggle Writeup (project narrative)
- [ ] Public Video (≤3 minutes, on YouTube — hard contest requirement)
- [ ] Public Code Repository (this repo, public on github.com/sgharlow/gemma-health)
- [ ] Live Demo (URL, choice TBD per Day 2 decision)
- [ ] Media Gallery (cover image + 3-5 supporting images)

## Open questions for Steve

1. **Hardware target for the demo recording.** Mac Mini M4 16GB is ideal. Is there one available, or do we record on a laptop and frame it as "comparable to a $600 mini-PC"?
2. **Tribal CAH framing — go or no?** The IDSov angle is the strongest differentiator but carries cultural-sensitivity risk. Alternative: lead with rural Appalachia or Mountain West CAH (less novel, less risk). My recommendation: keep IDSov, frame respectfully, use composite character.
3. **Public repo timing.** Make github.com/sgharlow/gemma-health public day 1 (transparency, version history visible to judges) or day 7 (avoids early scrutiny)? My recommendation: public day 5 once it is presentable.
4. **How much Health Pulse code to copy vs link to.** Cleanest: this repo is self-contained but credits Health Pulse in README. Avoids confusing judges about which submission is what.
