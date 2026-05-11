# The Story — Marlene, the Critical Access Hospital, and the Box

This document is source material for the writeup, video script, and submission narrative. It anchors the technical architecture in a specific human persona so judges remember the submission a week later.

## The persona

**Marlene Tsosie**, RN. Age 31. Job title: Quality Improvement Coordinator. Actual day-to-day: ICU charge nurse two shifts a week, quality officer on Tuesdays and Thursdays, occasional EHR admin, occasional CMS submitter, on-call infection preventionist when the actual IP is in Albuquerque for training.

She works at a 25-bed Critical Access Hospital. The hospital is fictional — a deliberate composite, not a real place — but the constraints she operates under are universal across the ~1,350 CAHs in the US:

- CMS quality reporting deadlines that move whether or not she has time
- A satellite uplink billed by the gigabyte
- Cell signal that drops three afternoons a week when monsoon weather rolls in
- A board chair who wants peer benchmarks but cannot fund an analytics consultant
- A tribal council that has explicitly told her: patient data does not leave reservation
- A stack of handwritten patient experience surveys, three weeks deep, that nobody has entered

## Cultural framing — what we are careful about

Marlene is composite. The hospital is composite. The tribal nation in our framing is the Navajo Nation but no actual Navajo Nation hospital, IHS facility, or healthcare worker is depicted, named, or implied. The synthetic facilities (`DEMO-CAH-001` through `DEMO-CAH-015`) include 5 explicitly tribal CAHs distributed across CMS regions to mirror the real geography of tribal CAHs without claiming to represent any specific one.

We use the term **Indigenous Data Sovereignty (IDSov)** because it is the established name for the legal/ethical framework, anchored in the [CARE Principles for Indigenous Data Governance](https://www.gida-global.org/care). We cite the framework; we do not speak for any nation.

The submission's claim is narrow and defensible: *edge AI is the first technology that lets under-resourced clinics participate in public-health intelligence without having to surrender patient sovereignty as the price of admission.* That is true regardless of which specific community is in the foreground.

## The three demo scenarios — beats for the video

### Scene 1 — The morning quality scan (90 seconds → 25 seconds of video)

**Setup.** Marlene's office. A Mac Mini on a counter. The Mini is labeled "HealthPulse Edge — Property of [composite CAH]." Her laptop sits next to it, connected over USB-C.

**The shot.** Camera pulls in on the laptop's WiFi indicator: airplane mode is on. A red banner across the screen reads: "OFFLINE — Gemma 4 26B running locally."

**The ask.** Marlene types: *"For DEMO-CAH-001, find the top 3 care gaps and tell me which one to tackle first."*

**The reveal.** Three function calls fan out (`care_gap_finder` → `facility_benchmark` → `cross_cutting_analysis`). The model returns a chart and a recommendation: *"Your sepsis bundle compliance is 64%, 14 points below peer median. The single highest-leverage intervention is refreshing your 3-hour bundle education and auditing antibiotic timing — historically a 6-week change project, not a 6-month one."*

**Why it lands.** This is the Stanford-Medicine-grade analysis Marlene's hospital cannot afford to commission, returned in 4 seconds, on a $400 box, with no internet.

### Scene 2 — The webcam moment (the multimodal beat)

**Setup.** Marlene picks up a stack of handwritten patient experience surveys.

**The shot.** She holds one up to the laptop's webcam.

**The reveal.** The screen transcribes it in real time — handwritten English, with a note in Diné Bizaad (Navajo) handled gracefully. The model asks: *"Add this to the Q2 patient experience cohort?"* She nods. It does. The local FHIR store grows by one record. The Compliance Ledger gains a new entry: `phi_egress: false`.

**Why it lands.** This is the workflow nobody has automated: the bridge between paper and the EHR. Cloud OCR services exist, but using them violates IDSov and risks a HIPAA breach. Local multimodal makes the workflow safe to automate for the first time.

### Scene 3 — The egress receipt (the compliance beat)

**Setup.** Marlene clicks "Submit Q2 to CMS." A panel opens.

**The shot.** Two things happen in sequence on screen:
1. The Sovereignty Mode policy engine evaluates the request. CMS requires a tribal council co-signature. Marlene enters `tc-2026-q2`. Approved.
2. The Redaction Sub-Agent runs. *"142 PHI fields stripped (regex floor + 18 LLM-detected semantic spans). Differential privacy noise applied to 5 numeric aggregates, ε=5.0 spent."* The signed envelope appears with a SHA-256 hash.

**The closer.** *"Frontier intelligence does not require a frontier datacenter. With Gemma 4, the smallest hospital in America can do what only the largest could yesterday — without surrendering a patient's right to be unknown."*

## What we explicitly are NOT claiming

- We are not a clinical decision support system. Marlene is the user; outputs are intelligence for her, not for a patient.
- We are not a diagnostic tool. Symptom triage and prescription advice are out of scope.
- We are not replacing a quality-improvement specialist. We are giving the only RN in a 100-mile radius the tools to be one part-time.
- We are not claiming Gemma 4 outperforms Claude or GPT-5 on reasoning. The story is sovereignty + edge + equity. The model is the enabler, not the hero.

## Why this submission resonates across three Gemma 4 categories

| Category | How HealthPulse Edge fits |
|---|---|
| **Health & Sciences** | Quality intelligence, care-gap detection, multimodal form digitization |
| **Digital Equity & Inclusivity** | Closes the analytics gap between resourced systems and 1,350 under-resourced CAHs |
| **Safety & Trust** | Cryptographic compliance ledger, defense-in-depth PHI redaction, IDSov-aware policy engine |

This breadth is intentional. Most submissions will fit one category. We fit three because the underlying claim — *edge AI lets under-resourced communities participate in public health without sacrificing sovereignty* — touches all three.

## Quotes for the writeup

> *"My job is to keep this hospital open. CMS reporting is what keeps it open. The cloud is what would close it."* — Marlene (composite)

> *"For the first time, the smallest hospital in America can do the work of a Stanford analytics team — on a box that fits in a desk drawer, on no internet, with no one outside this building seeing a single patient name."*

> *"The CARE Principles tell us that data about Indigenous communities should serve those communities first. Gemma 4 makes that practical for the first time, because the model can run where the data lives — and the data can live where the community lives."*

## What the writeup must avoid

- Treating any tribal nation as monolithic. Specifics matter; we use composite framing.
- Implying that we have piloted in any real hospital. We have not.
- Promising the system is HIPAA-certified or 42 CFR Part 2 compliant. The architecture is designed to satisfy those frameworks but no certification has been done.
- Romanticizing rural healthcare. The story is hard work in hard conditions, not a narrative of resilience.
