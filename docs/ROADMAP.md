# HealthPulse Edge — Post-Submission Roadmap

> Generated from the Day 8 QA assessment. These are the five highest-leverage improvements for the next development phase, ordered by impact × feasibility.

---

## Summary

| # | Enhancement | Impact | Effort | Category |
|---|---|---|---|---|
| 1 | Real CMS Hospital Compare data pipeline | ★★★★★ | High | Data |
| 2 | Cryptographic signature verification (not just key-ID matching) | ★★★★☆ | Medium | Security |
| 3 | Cross-session differential privacy budget enforcement | ★★★★☆ | Medium | Privacy |
| 4 | Browser-side IndexedDB ledger tests (jsdom) | ★★★☆☆ | Low | Testing |
| 5 | Webcam multimodal end-to-end verification on Mac | ★★★☆☆ | Low | QA |

---

## Enhancement 1 — Real CMS Hospital Compare Data Pipeline

### Summary
Replace the 150-facility synthetic seed with a live ETL pipeline that ingests the real CMS Hospital Compare dataset (~4,800 CAHs, quarterly updates). Every tool result currently carries `data_source: "demo_seed"` — this is honest but limits the submission's credibility as a production system.

### Details

**Current state:** `data/seed/{facilities,quality,readmissions}.json` contains 150 deterministically generated synthetic facilities. The first 15 (`DEMO-CAH-001` through `DEMO-CAH-015`) are hand-crafted to anchor the vitest invariants. Facilities 16–150 are PRNG-generated. No real hospital names, scores, or geographies are present.

**Why it matters:** The core value proposition — "Marlene can benchmark against peer CAHs in her CMS region" — is only meaningful with real peer data. A judge or pilot user who asks "how does my hospital compare to the 12 other CAHs in CMS Region 9?" needs real Region 9 data to get a useful answer. Synthetic data proves the architecture; real data proves the product.

**What's needed:**
1. A download script that fetches the CMS Hospital Compare flat files (publicly available at `data.cms.gov`) and normalizes them to the existing JSON schema (`facilities`, `quality`, `readmissions`).
2. A DuckDB migration that loads the real data into `data/cms/hospital.duckdb` alongside or replacing the seed.
3. A `data_source` field update: `"cms_hospital_compare_YYYY_QN"` instead of `"demo_seed"`.
4. Test fixture updates: the 15 hand-crafted facilities can remain as a stable test anchor; real data supplements them.
5. A `scripts/fetch-cms.cjs` that operators can run to refresh data quarterly.

**Risks:**
- CMS data schema changes quarterly. The ETL needs a version check.
- Real facility names + scores are public data, but the app must never ingest actual patient records — the ETL boundary must be enforced.
- The `gen-seed.cjs` script and its `--seed` reproducibility guarantee become less relevant once real data is the default.

**Acceptance criteria:** `GET /api/health` returns `data_source: "cms_hospital_compare_2026_Q2"`. The `equity_detector` tool returns real tribal vs. non-tribal cohort means. The `state_ranking` tool covers all 50 states.

---

## Enhancement 2 — Cryptographic Signature Verification

### Summary
Replace the current string-equality key-ID check in Sovereignty Mode with actual cryptographic signature verification. Today, `signature_key_id: "tc-2026-q2"` is matched against a hardcoded list of authorized key IDs — there is no cryptographic proof that the caller holds the corresponding private key.

### Details

**Current state:** `lib/sovereignty.ts` → `evaluateEgress()` checks:
```typescript
const valid = !!provided && policy.authorized_signature_key_ids.includes(provided);
```
This is a shared-secret model, not a public-key model. Anyone who knows the string `"tc-2026-q2"` can authorize an egress. The string is visible in the demo UI placeholder text.

**Why it matters:** The Sovereignty Mode story is that the tribal council *holds the egress key* — implying they have exclusive control. With string equality, the hospital operator also knows the key (it's in the UI). A real IDSov implementation requires that the tribal council's approval is cryptographically unforgeable by the hospital operator.

**What's needed:**
1. Replace `authorized_signature_key_ids` in the policy with `authorized_public_keys` (Ed25519 or ECDSA P-256 public keys in PEM or JWK format).
2. The egress request body includes a `signature` field: a base64-encoded signature over a canonical payload (destination + facility_id + reporting_period + timestamp).
3. `evaluateEgress()` verifies the signature against the policy's public keys using Node.js `crypto.verify` (on-prem) or `crypto.subtle.verify` (browser).
4. The tribal council generates a keypair offline; the public key goes into `sovereignty.json`; the private key stays with the council (on a USB key, per the policy file's own notes).
5. The demo flow: the UI shows a "paste your signature" field instead of a "paste your key ID" field.

**Risks:**
- Key management UX is hard. The tribal council needs a simple tool to generate a signature for a given payload. A companion `scripts/sign-egress.cjs` script (takes private key + payload, outputs base64 signature) is needed.
- The demo becomes harder to run without the private key. A `STUB_SIGNATURE=true` env var (analogous to `STUB_LLM_REDACTION`) would let the demo path bypass crypto for judging/testing.
- Ed25519 is not available in all Node.js versions < 15. The target is Node 18+, so this is fine.

**Acceptance criteria:** `evaluateEgress()` rejects a valid key ID paired with an invalid signature. The tribal council can generate a valid signature offline using only the private key and the payload. The `STUB_SIGNATURE=true` path still passes all existing sovereignty tests.

---

## Enhancement 3 — Cross-Session Differential Privacy Budget Enforcement

### Summary
Implement hard enforcement of the cumulative privacy budget (ε) across egress sessions, not just per-envelope accounting. Today, the ledger tracks lifetime ε spent, but nothing prevents a new egress from proceeding when the budget is exhausted.

### Details

**Current state:** `lib/egress.ts` spends `ε = 1.0` per numeric aggregate per envelope. `Ledger.totalEpsilonSpent()` sums `dp_epsilon` across all ledger entries. The `/api/egress` route returns `lifetime_epsilon_spent` in the response. But there is no check: if `lifetime_epsilon_spent` exceeds a configured budget cap, the egress still proceeds.

**Why it matters:** Differential privacy's composition theorem means that repeated queries over the same dataset accumulate privacy loss. If Marlene submits 100 quarterly reports, each spending ε=2.0, the lifetime budget is ε=200 — far beyond any reasonable privacy guarantee. A real DP deployment needs a budget cap and a mechanism to either refuse further queries or require a policy update (e.g., a new tribal council authorization for the next reporting period).

**What's needed:**
1. Add `max_lifetime_epsilon` to `sovereignty.json` (e.g., `10.0` for a reporting period).
2. In `/api/egress`, before building the envelope, check `ledger.totalEpsilonSpent() + envelope_epsilon > policy.max_lifetime_epsilon`. If exceeded, return 403 with `{ error: "privacy_budget_exhausted", lifetime_spent: X, budget: Y }`.
3. Add a `budget_reset_key_id` to the policy — the tribal council can authorize a budget reset for a new reporting period (analogous to the egress signature key).
4. The ledger gains a `system` entry type for budget resets: `{ action: "system", notes: "privacy budget reset for Q3-2026", phi_egress: false }`.
5. UI: the EgressButton shows remaining budget (e.g., "ε remaining: 8.0 / 10.0") before the user clicks "Submit Q2 to CMS."

**Risks:**
- The right budget cap is domain-specific. ε=10.0 per reporting period is a reasonable starting point but needs input from a privacy expert.
- Budget resets need to be auditable — the ledger entry for a reset must be signed by the tribal council (ties back to Enhancement 2).
- The `totalEpsilonSpent()` method re-reads the ledger from disk on every call. For a long-running ledger this becomes slow. A cached running total (updated on each `append`) would be more efficient.

**Acceptance criteria:** A POST to `/api/egress` that would exceed `max_lifetime_epsilon` returns 403 with a structured budget-exhausted error. The UI shows remaining budget. A budget reset entry in the ledger resets the counter. All existing egress tests still pass.

---

## Enhancement 4 — Browser-Side IndexedDB Ledger Tests

### Summary
Add vitest tests for `lib/ledger-browser.ts` using a jsdom + fake-indexeddb polyfill. The browser ledger is currently the only load-bearing privacy component without test coverage.

### Details

**Current state:** `lib/ledger-browser.ts` implements the same SHA-256 hash chain as `lib/ledger.ts` but backed by IndexedDB and `crypto.subtle`. It has zero test coverage. The STATUS.md Day 5 entry notes: "no new tests today — `/edge` is browser-only and IndexedDB needs jsdom polyfill which we'll add Day 7 if needed." It was not added.

**Why it matters:** The browser ledger is what judges interact with on the `/edge` live demo. If the chain verification is broken in the browser implementation, the "Verify chain integrity" button will silently pass a broken chain. The server ledger has 10 tests covering tamper detection and missing-entry detection; the browser ledger has none.

**What's needed:**
1. Add `fake-indexeddb` as a dev dependency (`npm install -D fake-indexeddb`).
2. Add a vitest environment config for browser-like tests: `vitest.config.ts` already uses `environment: "node"` — add a second config or use `@vitest/browser` for the browser-ledger test file.
3. Write `src/lib/__tests__/ledger-browser.test.ts` mirroring the server ledger tests:
   - Chain starts at genesis
   - Entries chain by `prev_hash`
   - `verifyBrowserChain` passes on a clean chain
   - `verifyBrowserChain` detects a tampered entry
   - `verifyBrowserChain` detects a missing entry
   - `clear()` resets seq and prev to genesis
4. Mock `crypto.subtle` with the Node.js `crypto` module's `webcrypto` API (available in Node 18+).

**Risks:**
- `fake-indexeddb` is a well-maintained package but has occasional edge cases with cursor iteration. The `openCursor(null, "prev")` call in `BrowserLedger.init()` needs to be verified against the fake.
- `crypto.subtle` in Node 18 is available at `globalThis.crypto.subtle` — the test setup needs to expose it.
- The test count will increase from 58 to ~64. README and WRITEUP need updating.

**Acceptance criteria:** `npm run test` passes with the new browser ledger tests included. Tamper detection and missing-entry detection work identically to the server ledger tests. The test count in README and WRITEUP is updated to match.

---

## Enhancement 5 — Webcam Multimodal End-to-End Verification on Mac

### Summary
Verify and document the webcam → Gemma 4 vision → structured FHIR flow on the Mac Mini with real Ollama, and add a non-stubbed integration test that runs against a local Ollama instance when available.

### Details

**Current state:** `lib/vision.ts` implements `extractSurveyFromImage(base64)`. When `STUB_VISION=true`, it returns canned structured data. The real path calls Gemma 4 via Ollama's vision endpoint. STATUS.md notes "Real call is verified on Mac Mini Day 4" — but this was a manual verification, not an automated test, and the Mac Mini work was listed as "carried forward" on Day 1 and never confirmed as completed in the status log.

**Why it matters:** The webcam moment is Scene 2 of the demo video — "the multimodal beat." It's described in STORY.md as "the workflow nobody has automated: the bridge between paper and the EHR." If the vision endpoint doesn't work with `gemma4:e4b` on the actual Mac Mini, the demo video cannot show it. The submission currently has no automated evidence that this path works.

**What's needed:**
1. On the Mac Mini: run `npm run dev` with `STUB_VISION` unset, hold a paper survey to the webcam, click "Capture + extract," and confirm the structured JSON output matches the survey content.
2. Document the result in STATUS.md Day 8 with a screenshot or terminal output.
3. Add an optional integration test: `src/lib/__tests__/vision.integration.test.ts` that skips unless `OLLAMA_AVAILABLE=true` is set in the environment. When enabled, it sends a base64-encoded test image to the real Ollama vision endpoint and asserts the response is a non-empty object with at least one string field.
4. Add `OLLAMA_AVAILABLE=true npm run test` to the Mac Mini verification checklist in `docs/SUBMIT-CHECKLIST.md`.
5. If the vision endpoint is not supported by `gemma4:e4b` (some Ollama builds omit vision for the E4B variant), document the fallback: use `gemma4:26b` for vision calls, with a `GEMMA_VISION_MODEL` env var.

**Risks:**
- Gemma 4 E4B may not support vision in all Ollama builds. The `lib/vision.ts` code calls the standard Ollama chat endpoint with an `images` array — this works for multimodal models but silently returns text-only output for non-multimodal ones.
- The webcam `getUserMedia` API requires HTTPS or localhost. The on-prem app runs on `http://localhost:3000`, which is fine. A remote deployment would need HTTPS.
- Handwritten Diné Bizaad (Navajo) OCR quality depends on the model's multilingual training data. The demo should use English-only handwriting if Navajo OCR is unreliable, with a note that multilingual support is a roadmap item.

**Acceptance criteria:** A manual run on the Mac Mini with `STUB_VISION` unset produces a structured JSON output from a real handwritten survey image. The integration test passes with `OLLAMA_AVAILABLE=true`. The demo video shows the webcam flow working end-to-end.

---

## Notes on Prioritization

Enhancements 1 and 2 are the highest-leverage for a post-hackathon pilot: real data makes the product useful, and real cryptographic signatures make the IDSov claim defensible. Enhancements 3, 4, and 5 are correctness and completeness work that should precede any production deployment.

The prize-fund allocation described in WRITEUP.md ("6-month pilot at one opted-in CAH; real CMS Hospital Compare ETL; independent privacy-lawyer review") maps directly to Enhancements 1 and 2, with the privacy-lawyer review informing the ε budget cap in Enhancement 3.

---

*QA assessment date: 2026-05-12 · Submission deadline: 2026-05-18 · Repo: github.com/sgharlow/gemma-health*

---

# Part II — Winning Enhancements (One-Week Sprint)

> These five enhancements are chosen specifically to move the needle with judges, not just improve the codebase. The scoring breakdown is: Video Pitch & Storytelling (30%), Technical Implementation (25%), Impact & Relevance (25%), Innovation & Creativity (20%). The current submission is strong on Technical Implementation and Innovation. These enhancements target the gaps in demonstrability, impact evidence, and storytelling completeness that separate a strong submission from a winning one.
>
> All five are completable within one week. Each is scoped to be self-contained — they don't depend on each other and can be parallelized.

---

## Winning Enhancement W1 — Real CMS Data, Shipped in the Demo

### Summary
Ingest the actual CMS Hospital Compare public dataset and make it the default data source for the live demo. This is the single highest-leverage change available: it transforms every judge interaction from "this is a proof of concept" to "this is a real product." The data is public, the schema is known, and the ETL is a one-day build.

### Why this wins
The SUBMIT-CHECKLIST notes that prior Gemma hackathon winners "cluster around: real persona, underserved population, offline-first, field worker as user, geographic specificity." Every tool result currently returns `data_source: "demo_seed"` — a visible flag that the numbers are made up. A judge who asks "how does my state's CAHs compare?" and gets back synthetic data will mentally discount the entire submission. A judge who gets back real CMS Region 9 data with real hospital names will not.

The competitive context (from SUBMIT-CHECKLIST) shows 301 submissions and no overlap with the IDSov/CAH-quality angle. Real data makes this submission the only one that is *also* a usable tool, not just a demo.

### What's needed
1. **`scripts/fetch-cms.cjs`** — downloads the CMS Hospital Compare flat files from `data.cms.gov` (publicly available, no auth required). The relevant files are `Hospital_General_Information.csv` (~5,000 rows), `HCAHPS_Hospital.csv`, `Complications_and_Deaths_Hospital.csv`, and `Unplanned_Hospital_Visits_Hospital.csv`. Total download ~15MB.
2. **`scripts/normalize-cms.cjs`** — maps CMS column names to the existing `facilities`, `quality`, and `readmissions` JSON schema. The mapping is straightforward: CMS `Provider ID` → `facility_id`, `Hospital Type: Critical Access Hospitals` filter → CAH subset (~1,350 rows), `HCAHPS_STAR_RATING` → `hcahps_overall`, etc.
3. **Filter to CAH subset** — the CMS file contains all ~5,000 hospitals. Filter to `Hospital Type = "Critical Access Hospitals"` (~1,350 rows). This is the exact population the submission claims to serve.
4. **Tribal flag derivation** — CMS does not have a tribal flag. Derive it from IHS (Indian Health Service) facility crosswalk or from the facility's county FIPS code matched against tribal land boundaries (a public dataset). Even a rough approximation (facilities in counties with >20% Native American population) is more defensible than the current synthetic flag.
5. **Keep the 15 demo fixtures** — `DEMO-CAH-001` through `DEMO-CAH-015` remain in the seed for test stability. Real data supplements them; the vitest invariants don't break.
6. **Update `data_source`** — all tool results return `"cms_hospital_compare_2026_Q1"` instead of `"demo_seed"`.

### Timeline
- Day 1 (4h): Write `fetch-cms.cjs` + `normalize-cms.cjs`. Verify the CMS download and schema mapping.
- Day 2 (3h): Load real data into DuckDB. Run all 6 tools against real data. Fix any schema mismatches.
- Day 3 (2h): Update `data_source` strings. Update README and WRITEUP to say "real CMS data." Re-run tests.

### Risks
- CMS column names change between quarterly releases. Pin to the 2026 Q1 release and document the version.
- Some CAHs have suppressed data (CMS suppresses scores with <11 cases). Handle with `null` scores and a `suppressed: true` flag in the tool output.
- The tribal flag derivation is approximate. Document it as "derived from county demographics" and note it as a known limitation.

### Acceptance criteria
`GET /api/health` returns `data_source: "cms_hospital_compare_2026_Q1"`. The `state_ranking` tool returns all 50 states. The `equity_detector` tool returns a tribal cohort derived from real facility geography. The demo video shows a real hospital name (or a real-but-anonymized name like "CAH in Navajo County, AZ") in the care-gap output.

---

## Winning Enhancement W2 — A Visible, Tweetable "Privacy Proof" Moment in the Demo

### Summary
Add a single, visually striking UI element to the `/edge` page that makes the privacy guarantee *undeniable* to a judge in 10 seconds: a live network request inspector panel that shows zero outbound requests during a care-gap scan. This is the demo's missing "aha" moment — the current offline toggle is good, but it requires the judge to know how to use Chrome DevTools. A built-in proof panel removes that friction entirely.

### Why this wins
The submission's core claim is "no data leaves this device." The current proof mechanism is "toggle DevTools → Network → Offline." This works for technical judges but fails for non-technical ones. The Video Pitch & Storytelling criterion (30% of score) rewards submissions that make complex ideas immediately legible. A panel that says "0 outbound requests · 0 bytes sent · model running in this tab" is a screenshot that writes itself — it's the kind of thing that gets shared on Twitter and remembered by judges a week later.

The BRIEF's video script describes this moment: *"Now and only now, the airplane mode icon flickers off momentarily — the redacted aggregate ships — then back on."* That's a great script beat, but it requires a video. The built-in proof panel makes the same beat happen live, in the judge's own browser, without a video.

### What's needed
1. **`NetworkMonitor` component** — uses the `PerformanceObserver` API with `{ type: "resource" }` to intercept all network requests made by the page. Counts outbound requests and bytes. Resets on "Start scan" and freezes on "Scan complete."
2. **Display panel** — a small status bar below the scan button showing:
   - `Outbound requests: 0` (green) or `N requests made` (amber if any)
   - `Model: Gemma 4 E2B · running in WebGPU · this tab only`
   - `Ledger: N entries · SHA-256 chain · IndexedDB only`
3. **The "egress moment"** — when the user clicks "Submit Q2 to CMS" (the egress button), the panel briefly shows `1 outbound request · redacted aggregate only` (amber), then returns to green. This makes the egress gate visible as a deliberate, controlled event rather than an invisible background process.
4. **Screenshot-ready layout** — the panel should be visually distinct (emerald border, monospace font) so a screenshot of it is immediately legible in a media gallery thumbnail.

### Timeline
- Day 1 (3h): Implement `NetworkMonitor` using `PerformanceObserver`. Wire into `/edge` page.
- Day 2 (2h): Style the panel. Test in Chrome and Edge. Verify it shows 0 requests during a scan.
- Day 3 (1h): Add the panel to the demo video shot list. Take a new screenshot for the media gallery.

### Risks
- `PerformanceObserver` with `resource` type does not intercept WebSocket or WebRTC traffic — only HTTP/HTTPS. This is fine for the demo (the model runs in WebGPU, not over a WebSocket).
- The Hugging Face model download (1.8GB) will show as outbound requests during the initial load. The panel should only activate *after* the model is loaded, not during the download phase.
- Some browsers throttle `PerformanceObserver` in certain contexts. Test in Chrome 120+ and Edge 120+.

### Acceptance criteria
During a care-gap scan on `/edge` with the model loaded, the panel shows `Outbound requests: 0`. A screenshot of the panel is added to `assets/screenshot-edge-privacy-proof.png`. The demo video includes a 5-second shot of the panel during the scan.

---

## Winning Enhancement W3 — Streaming Chart Output (Not Just Text)

### Summary
Replace the plain-text executive summary in the `/edge` scan result with a streaming chart that renders as Gemma generates the response. When Gemma says "your readmission rate is 14.2% vs. peer median 11.8%," those numbers should appear as a bar chart, not as text. This is the difference between a demo that looks like a chatbot and a demo that looks like a product.

### Why this wins
The BRIEF's video script describes: *"Result renders as a chart + 3-sentence narrative."* The current implementation renders only the narrative — there is no chart. The `facility_benchmark` tool returns structured data (`facility_score`, `peer_median`, `peer_p25`, `peer_p75`, `percentile_rank`) that is perfect for a bar chart. Rendering it visually makes the submission look like a finished product rather than a prototype, and it directly addresses the "Impact & Relevance" scoring criterion by making the output actionable for a non-technical user like Marlene.

The competitive context shows all other healthcare entries are patient-facing chatbots. A quality-officer tool that renders charts is visually distinct from every other submission in the gallery.

### What's needed
1. **`QualityChart` component** — a lightweight bar chart using the `recharts` library (already in the project per BRIEF.md architecture). Renders:
   - A horizontal bar showing the facility's score vs. peer P25/median/P75
   - A percentile rank badge ("32nd percentile in CMS Region 9")
   - Color coding: red if worse than median, green if better
2. **Structured response extraction** — the `/api/chat` route already returns tool call results in the message history. Add a post-processing step that extracts `facility_benchmark` results from the tool call history and passes them to the UI alongside the text reply.
3. **Streaming chart** — as Gemma streams the text response, the chart renders immediately from the tool call data (which is available before the text response starts). The chart appears first, then the narrative streams in below it. This creates a visually compelling "data first, then explanation" pattern.
4. **`/edge` page chart** — the same chart component works in the browser demo. The `care_gap_finder` tool result already has `score` and `excess_ratio` fields — render them as a ranked gap list with color-coded severity bars.

### Timeline
- Day 1 (4h): Build `QualityChart` component. Wire into the on-prem `/` page chat response.
- Day 2 (3h): Wire into `/edge` page scan result. Test with real tool data.
- Day 3 (2h): Polish styling. Add chart to demo video shot list. Take new screenshots.

### Risks
- `recharts` is listed in BRIEF.md but may not be in `package.json`. If not installed, `npm install recharts` adds ~200KB to the bundle. Acceptable for the on-prem app; for `/edge`, lazy-load the chart component.
- The chart only renders when `facility_benchmark` is called. For queries that don't trigger that tool (e.g., "which states have the worst mortality?"), the response is text-only. This is fine — the chart is additive, not required.
- Streaming chart data requires the tool call results to be surfaced in the API response. The current `/api/chat` route returns only `reply` (text). Add a `tool_results` field to the response.

### Acceptance criteria
A query like "benchmark DEMO-CAH-001 on readmission rate" renders a bar chart showing the facility's score vs. peer percentiles, with a percentile rank badge. The chart appears before the text narrative. The `/edge` scan result shows a ranked gap list with severity bars. A screenshot of the chart is added to `assets/screenshot-chart.png`.

---

## Winning Enhancement W4 — A "Marlene Mode" Guided Walkthrough

### Summary
Add a guided walkthrough to the `/edge` page that walks a first-time visitor through the three demo scenarios from STORY.md — quality scan, equity check, egress receipt — as a step-by-step interactive tour. This replaces the current "try these prompts" hint text with a structured narrative that mirrors the video script, making the live demo self-explanatory for judges who haven't watched the video.

### Why this wins
The Video Pitch & Storytelling criterion is 30% of the score. The current `/edge` page is technically impressive but narratively inert — a judge who lands on it without watching the video first sees a model loader, a facility dropdown, and a scan button. They don't know what story they're supposed to be experiencing. The guided walkthrough makes the story happen in the demo itself, not just in the video.

The BRIEF's competitive analysis notes that prior winners had "real persona, underserved population, offline-first, field worker as user, geographic specificity." Marlene is all of those things — but she's currently only in the writeup and the video. The walkthrough puts her in the live demo.

### What's needed
1. **`MarleneWalkthrough` component** — a step-by-step overlay (not a modal — an inline panel that doesn't block the UI) with 4 steps:
   - **Step 1:** "Meet Marlene — a nurse-administrator at a 25-bed CAH on tribal land. She needs to find her hospital's top care gap before the CMS deadline." → Button: "Load Gemma 4 and start"
   - **Step 2:** "Marlene asks: 'Find the top 3 care gaps at DEMO-CAH-004 and tell me which one to tackle first.'" → Auto-populates the facility selector to DEMO-CAH-004 and runs the scan. The result streams in.
   - **Step 3:** "Now check the equity gap — do tribal CAHs score differently on HCAHPS?" → Runs `equity_detector` for HCAHPS_OVERALL. Shows the tribal vs. non-tribal cohort comparison.
   - **Step 4:** "The compliance ledger recorded every action. No data left this tab." → Highlights the ledger panel. Shows the chain verification result.
2. **Auto-advance** — each step auto-advances after the previous action completes (model loaded → scan complete → equity result → ledger verified). The user can also click "Next" to skip.
3. **"Exit walkthrough" button** — always visible. Exits to the normal free-form demo mode.
4. **URL parameter** — `?walkthrough=true` starts the walkthrough automatically. The Kaggle submission's live demo URL becomes `https://gemma-health.vercel.app/edge?walkthrough=true` — judges land directly in the guided experience.

### Timeline
- Day 1 (4h): Build `MarleneWalkthrough` component. Wire steps 1 and 2.
- Day 2 (3h): Wire steps 3 and 4. Add URL parameter support.
- Day 3 (2h): Polish transitions. Update the live demo URL in WRITEUP.md and SUBMIT-CHECKLIST.md to include `?walkthrough=true`.

### Risks
- The walkthrough auto-runs the model load, which triggers the 1.8GB download. Step 1 must make this explicit ("this will download 1.8GB — cached after first visit") before proceeding.
- If the model fails to load (WebGPU unavailable), the walkthrough must gracefully fall back to simulated mode and continue. The existing `setSimulatedOverride` mechanism handles this.
- The walkthrough adds ~200 lines of component code. Keep it in a single file (`components/MarleneWalkthrough.tsx`) to minimize review surface.

### Acceptance criteria
Visiting `https://gemma-health.vercel.app/edge?walkthrough=true` starts the guided walkthrough automatically. All 4 steps complete without user intervention (beyond clicking "Load Gemma 4"). The walkthrough can be exited at any step. The live demo URL in WRITEUP.md is updated to include `?walkthrough=true`.

---

## Winning Enhancement W5 — A "What Just Happened" Explainer Panel

### Summary
After every egress envelope is built, show a plain-English explainer panel that translates the technical output (redaction counts, DP aggregates, envelope hash) into a narrative that a non-technical judge can understand and remember. This is the submission's "closing argument" — the moment where the technical machinery is translated into human impact.

### Why this wins
The egress flow is the submission's most technically sophisticated feature — two-layer redaction, Laplace DP, SHA-256 signing, Sovereignty Mode policy evaluation — but the current UI presents it as a wall of numbers. A judge who sees "130 PHI fields stripped · ε=5.0 · envelope hash: a3f7..." understands that something happened, but not *why it matters*. The explainer panel answers the question every judge is silently asking: "So what?"

This directly addresses the "Impact & Relevance" scoring criterion (25%). The panel also gives the submission a quotable moment — a sentence that judges can write in their notes and that the video can end on.

### What's needed
1. **`EgressExplainer` component** — rendered below the existing `EgressButton` result, only when an envelope is successfully built. Contains:
   - **The privacy receipt** (3 sentences, plain English): "Gemma E2B found [N] names and indirect identifiers that the regex layer missed. All [total] PHI fields were removed before any data left this device. The remaining numbers were blurred with mathematical noise (ε=[total]) so no individual patient can be identified from the aggregate."
   - **The sovereignty receipt** (1 sentence): "The tribal council's co-signature key authorized this submission. Without it, the data would have stayed on this device."
   - **The audit receipt** (1 sentence): "Every action in this session is recorded in a tamper-evident ledger. A regulator can verify that `phi_egress: false` held for every action except this one."
   - **The closing line** (bold, large): *"The smallest hospital in America just did what only the largest could yesterday — without surrendering a single patient's right to be unknown."*
2. **Dynamic values** — the sentences use real values from the envelope response (`total_redactions`, `llm_spans_found`, `total_epsilon_spent`, `signature_valid`).
3. **Screenshot-ready** — the panel has a distinct visual treatment (dark background, large type for the closing line) so a screenshot of it is immediately usable as a media gallery image.
4. **Video integration** — the demo video's Scene 3 (the egress receipt) ends on this panel. The closing line is the video's final spoken word.

### Timeline
- Day 1 (3h): Build `EgressExplainer` component. Wire into `EgressButton` result.
- Day 2 (2h): Polish copy. Test with real envelope data (both blocked and allowed paths).
- Day 3 (2h): Take a screenshot of the panel for the media gallery. Update the demo video shot list to end on this panel.

### Risks
- The closing line is emotionally resonant but must not overstate the submission's claims. It should appear only after a successful egress (not after a blocked one), and the surrounding context (synthetic data disclaimer, "architecture-aligned not certified") must remain visible.
- The panel adds copy that could push the writeup over the 1,500-word cap if quoted directly. Keep it in the UI only, not in WRITEUP.md.
- The "tribal council's co-signature key" sentence only makes sense when Sovereignty Mode is ON and the destination requires a signature. Add conditional rendering: show the sovereignty sentence only when `policy.decision === "allow"` and `signature_valid === true`.

### Acceptance criteria
After a successful CMS egress with `tc-2026-q2`, the explainer panel renders with real values from the envelope. The closing line is visible and legible in a 1280×900 screenshot. The panel does not render after a blocked egress. A screenshot of the panel is added to `assets/screenshot-egress-explainer.png` and added to the Kaggle media gallery.

---

## One-Week Sprint Plan

| Day | Work | Owner |
|---|---|---|
| **1** | W1: CMS ETL script + schema mapping · W2: NetworkMonitor component skeleton | Dev |
| **2** | W1: DuckDB load + tool verification against real data · W3: QualityChart component | Dev |
| **3** | W2: NetworkMonitor polish + screenshot · W3: Chart wired into `/edge` | Dev |
| **4** | W4: MarleneWalkthrough steps 1–2 · W5: EgressExplainer component | Dev |
| **5** | W4: Steps 3–4 + URL parameter · W5: Copy polish + screenshot | Dev |
| **6** | Integration: all 5 enhancements live on Vercel · Re-record demo video with new beats | Steve (Mac) |
| **7** | Final QA · Update WRITEUP.md with real data claim · Submit | Steve |

## Why These Five, Not Others

The first roadmap (Enhancements 1–5) addressed correctness and production-readiness: real crypto, DP budget enforcement, browser ledger tests. Those are the right things to build *after* the hackathon. These five winning enhancements address a different question: **what makes a judge vote for this submission over 300 others?**

The answer is not more tests or better crypto. It's:
- **Real data** (W1) — makes the product feel real, not academic
- **Visible proof** (W2) — makes the privacy claim undeniable without requiring DevTools knowledge
- **Visual output** (W3) — makes the tool look like a product, not a chatbot
- **Guided narrative** (W4) — makes the story happen in the demo, not just in the video
- **Emotional close** (W5) — gives judges a sentence to write in their notes and remember

Together, they address all four scoring dimensions: W1 → Impact & Relevance, W2 → Technical Implementation, W3 → Innovation & Creativity, W4+W5 → Video Pitch & Storytelling. The current submission is strong on two of four. These enhancements make it strong on all four.

---

*Winning enhancements added: 2026-05-12 · Sprint target: complete by 2026-05-17 · Submit: 2026-05-18*
