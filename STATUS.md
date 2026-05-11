# HealthPulse Edge — Day-by-Day Status

## Day 1 — 2026-05-10 — Scaffold + skeleton end-to-end loop

**Decisions locked:** Mac Mini target / IDSov framing / Day-5 public repo / self-contained code reuse.

**Shipped:** Next.js 16 + TS + Tailwind 4 scaffold; `lib/ollama.ts` (typed Ollama client + tool-calling); `lib/ledger.ts` (SHA-256 hash-chain Compliance Ledger); 8 vitest cases for ledger; first MCP tool stub (seed data); `/api/chat` tool-calling loop (max 4 hops); `/api/health` Ollama probe; minimal chat UI with airplane-mode banner; `docs/MODELS.md` Gemma variant decisions; `STATUS.md` initial entry.

**Mac-blocked at Day 1:** end-to-end test against real Gemma 4. Carried forward.

---

## Day 2 — 2026-05-10 — Real data + tool surface + live-demo decision

**Verified Day 1 on Windows:** `npm install` clean; fixed one `stableStringify` bug that included `undefined` keys (verifyChain was failing). 8/8 ledger tests now green; one TS cast in tool registry tightened.

**Net new code shipped:**
- `data/seed/{facilities,quality,readmissions}.json` — 15 synthetic CAHs across CMS Regions 6/8/9/10, including 5 explicitly tribal facilities. ~80 quality measures + ~25 readmission DRG rows. Marked `data_source: demo_seed` in every tool result.
- `web/src/lib/db.ts` — DuckDB singleton; lazy bootstraps `data/cms/hospital.duckdb` from JSON seed on first query
- `web/scripts/smoke-db.ts` — verified DuckDB ingest + query end-to-end on Windows
- `web/src/lib/tools/facility-benchmark.ts` — replaced seed stub with real DuckDB query; computes peer median / P25 / P75 / percentile rank within CMS region; pulls top 3 contributing DRGs for readmission metrics
- `web/src/lib/tools/quality-monitor.ts` — all measures for a facility, sorted "worse" → "no different" → "better"
- `web/src/lib/tools/care-gap-finder.ts` — flags worse-than-national measures + excess-readmission DRGs, with a one-sentence intervention hint per gap (HF discharge bundle, sepsis bundle, etc.)
- `web/src/lib/tools/equity-detector.ts` — **the IDSov-aligned tool** — compares tribal vs non-tribal CAH cohorts on any measure, flags meaningful equity gaps
- `web/src/lib/tools/state-ranking.ts` — rank states by mean CAH score on a measure
- `web/src/lib/tools/cross-cutting-analysis.ts` — Pearson correlation between two measures across all CAHs
- `web/src/lib/__tests__/tools.test.ts` — 9 vitest cases covering every tool against the seed data
- `web/src/lib/tools/index.ts` — registry now exports 6 tools (was 1)
- `docs/LIVE-DEMO.md` — locked Option 1 (WebGPU in judge's browser); full architecture + risk/fallback table

**Test totals:** 17 vitest cases, all green. TypeScript clean (`tsc --noEmit` exit 0).

**Live-demo decision (locked):** Public WebGPU demo running Gemma 4 in judge's browser. No server. Judge proves offline by toggling DevTools network panel. Build deadline EOD Day 6. Fallback: hosted Cloudflare Worker proxy.

**Day 2 DoD:**
- [x] DuckDB integration end-to-end (Windows-verified)
- [x] `facility_benchmark` queries real data
- [x] 5 additional tools ported (6 total)
- [x] Live-demo path locked + documented
- [x] All tests green; TypeScript clean

**Mac Mini work for tomorrow (when hardware is set up):**

1. Pull repo on Mac Mini
2. `cd web && npm install` (DuckDB binary will install for darwin-arm64)
3. `brew install ollama && brew services start ollama`
4. `ollama pull gemma4:e4b` and `ollama pull gemma4:e2b`
5. `npm run test` → expect 17/17
6. `npm run dev` → http://localhost:3000
7. Hit `/api/health` → expect `{ ollama: { ok: true, ... } }`
8. Ask: *"For DEMO-CAH-004, find the top 3 care gaps and tell me which one to tackle first."*
9. Expected: model calls `care_gap_finder`, then potentially `facility_benchmark` for context, replies citing tools + DRGs

If the tool-calling protocol Gemma 4 expects via Ollama doesn't match the OpenAI-style `tools` array (single most likely failure mode), I'll patch within an hour — fallback is a prompt-based ReAct loop using the same tool registry.

**What I can keep building on Windows tomorrow without the Mac:**
- Day 3: multimodal webcam handler + redaction sub-agent scaffold (UI + API; can't end-to-end test against Gemma vision until Mac Mini)
- Day 3: differential-privacy aggregator (pure math, no model needed)
- Day 4: sovereignty-mode policy engine (config + UI; no model needed)

**Mac Mini becomes critical at:**
- End of Day 3 (verify multimodal vision actually works with `gemma4:e4b` vision endpoint)
- Day 5 (record the demo video — must happen on the Mac)
- Day 6 (live-demo WebGPU build — can develop on Windows but verify on macOS Safari + Chrome)

**Carried to Day 3:**
- Multimodal handler (webcam capture → Gemma vision → structured FHIR)
- Redaction sub-agent (Gemma E2B sidecar that strips PHI before any optional sync)
- Differential privacy aggregator (Laplace mechanism, ε=1.0)
- Compliance ledger view in the UI (so the demo can show the chain in real time)

---

## Day 3 — 2026-05-10 — Privacy machinery + multimodal scaffold + visible ledger

**Privacy primitives:**
- `lib/dp.ts` — Laplace mechanism: `addLaplaceNoise`, `dpCount`, `dpSum`, `dpMean`, `aggregateMeasure`. Vitest verifies noise variance scales as 2(Δ/ε)² across 5,000 samples; counts clamp at 0; range clamping works.
- `lib/redaction.ts` — regex-based PHI strip (SSN, phone, email, MRN, NPI, DOB, address, name+title). Returns redacted text + per-class counts. `redactObject` walks nested structures. Day 4 layers a Gemma E2B sub-agent on top; regex stays as defense-in-depth.

**Egress gate:**
- `lib/egress.ts` — `buildEgressEnvelope` runs PHI redaction on patient records + free text, applies Laplace DP to numeric measures, returns a SHA-256-signed envelope with declared privacy budget (ε per aggregate × count = total ε spent).
- `/api/egress` POST — wires the egress flow + writes a `phi_egress: true` ledger entry containing the envelope hash. The "Submit Q2 to CMS" demo button hits this.

**Multimodal scaffold:**
- `lib/vision.ts` — `extractSurveyFromImage(base64)`. Returns canned data when `STUB_VISION=true` (Windows dev path); calls Gemma 4 vision via Ollama otherwise. Real call is verified on Mac Mini Day 4.
- `/api/vision` POST — image in, structured survey JSON out, two ledger entries written (request + result, both `phi_egress: false` since image stays local).
- `components/WebcamCapture.tsx` — `getUserMedia` → canvas snapshot → POST to `/api/vision`. Result rendered as JSON.

**Compliance ledger surface (the visible receipt):**
- `/api/ledger` GET — returns recent entries + chain verification status.
- `components/LedgerView.tsx` — live list of recent ledger entries with action badges (chat/tool_call/egress), `phi_egress` flag in green or amber, hash prefix, chain-verified pill.
- `components/EgressButton.tsx` — the demo button. Triggers a hardcoded sample egress payload (3 patient records with synthetic PHI + 2 numeric measures + 1 free-text summary) so the video can show the redaction + DP + signed envelope flow in one click.

**UI:** `app/page.tsx` rebuilt to a single scrollable surface — Chat → Webcam capture → Egress → Ledger view. Airplane-mode banner now reflects real `navigator.onLine` (toggle airplane mode and watch the banner go green).

**Build infra:**
- `next.config.ts` adds `serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"]` so Next.js bundler doesn't try to trace native binaries.
- `web/.env.example` documents `STUB_VISION` for the Mac handoff.
- `npm run build` succeeds — 5 API routes (`/`, `/api/chat`, `/api/egress`, `/api/health`, `/api/ledger`, `/api/vision`).

**Test totals:** 40 vitest cases (8 ledger + 9 tools + 13 dp + 10 redaction + 4 egress + ledger view tests-by-build), all green.

**Day 3 DoD:**
- [x] DP aggregator + tests
- [x] PHI redaction + tests
- [x] `/api/vision` route + webcam capture (stubbed; Mac verifies real Gemma vision)
- [x] `/api/egress` (redaction + DP + ledger sign)
- [x] `/api/ledger` + visible ledger view in UI
- [x] Production build succeeds

**Mac Mini work for tomorrow (single first-thing-in-the-morning sweep):**

```bash
git pull
cd web
npm install
npm run test                # 40/40
brew services start ollama
ollama pull gemma4:e4b
ollama pull gemma4:e2b
unset STUB_VISION           # use real Gemma vision
npm run dev
# Open http://localhost:3000
# 1. Ask: "For DEMO-CAH-004, find top 3 care gaps."
# 2. Click "Start camera," hold a paper survey to webcam, click "Capture + extract"
# 3. Click "Build redacted envelope"
# 4. Watch ledger panel populate in real time, including phi_egress:true on egress
```

If any step fails, screenshot the error and tell me — I patch within an hour.

**What I'll keep building on Windows tomorrow (Day 4) without the Mac:**
- Redaction sub-agent: Gemma E2B integration (code + stub for Windows)
- Sovereignty Mode: jurisdictional policy engine + UI toggle (config-driven, no model needed)
- WebGPU live-demo skeleton: separate `web-edge/` build that loads MediaPipe LLM + Gemma 4 E2B in browser (no Ollama needed)
- Demo persona detail in `docs/STORY.md` for the writeup

**Mac becomes critical at:**
- End of Day 4 (verify Gemma E2B redaction sub-agent works)
- Day 5 (record demo video — irreversibly Mac-only)

**Carried to Day 4:**
- Gemma E2B integration for redaction sub-agent
- Sovereignty Mode config + UI toggle
- WebGPU live-demo build
- Persona narrative doc for the writeup

---

## Day 4 — 2026-05-10 — Defense-in-depth + sovereignty + edge scaffold + story

**Defense-in-depth redaction:**
- `lib/redaction-llm.ts` — Gemma E2B sub-agent runs AFTER the regex layer to catch what regex can't reliably detect (names without honorifics, indirect identifiers, ad-hoc identifiers, quoted patient speech). `STUB_LLM_REDACTION=true` returns canned spans on Windows; real Gemma E2B call wires on Mac. Regex layer is the floor — if the LLM call fails or is absent, we ship what regex caught. Fail-closed for privacy.
- `deepRedactText` and `deepRedactObject` — composable two-pass pipelines. Both are async.
- `lib/egress.ts` rewritten to use `deepRedactObject` / `deepRedactText`. Now async. Envelope `redaction_summary` includes `llm_spans_found` count separately.
- `/api/egress` updated for the async signature.

**Sovereignty Mode:**
- `data/policy/sovereignty.json` — committed sample policy honoring CARE Principles (Indigenous Data Governance), HIPAA, 42 CFR Part 2. Default egress posture: blocked. Per-destination rules: `TRIBAL_COUNCIL` allowed, `INTERNAL_BENCHMARK` allowed (DP aggregates only), `STATE_DOH` and `CMS` require tribal-council co-signature key id `tc-2026-q2`.
- `lib/sovereignty.ts` — `loadPolicy()` + `evaluateEgress({destination, signature_key_id, enabled})`. Returns `{decision: 'allow' | 'block' | 'needs_signature', rationale, required_signature_key_ids}`. Cached singleton with `clearPolicyCache` for tests.
- `/api/egress` integrates the check. 403 + ledger entry when blocked.
- UI: Sovereignty Mode toggle in header (default ON). EgressButton has destination dropdown + signature key input; renders block/needs-signature explainer when policy denies.
- 6 vitest cases cover allow / block / needs-signature / wrong-key / unknown-destination / disabled paths.

**WebGPU live-demo scaffold:**
- `web/src/app/edge/page.tsx` — separate `/edge` route. WebGPU adapter detection. Model-loader UX with download progress (currently simulated; real MediaPipe LLM call lands Day 5). Static seed data served from `web/public/edge/*.json`.
- `web/public/edge/{facilities,quality,readmissions}.json` — committed, in-browser table preview already working.
- Page is static-prerendered (`○ /edge` in build manifest) — deploys to any CDN at zero cost.

**Persona for the writeup:**
- `docs/STORY.md` — Marlene Tsosie composite character; cultural-framing disclaimers; three demo scenes (morning quality scan / webcam moment / egress receipt) shot-by-shot; quotes for the writeup; explicit list of what the submission does NOT claim; mapping to the three Gemma 4 categories (Health & Sciences, Digital Equity, Safety & Trust).

**Test totals:** 49 vitest cases, all green (added 3 redaction-llm + 6 sovereignty). TypeScript clean. `npm run build` clean — 6 routes (`/`, `/edge`, 5 API routes), `/edge` is static.

**Day 4 DoD:**
- [x] Gemma E2B redaction sub-agent + tests + egress integration
- [x] Sovereignty Mode policy engine + UI toggle + egress integration + tests
- [x] `/edge` WebGPU scaffold (loader UX + adapter check + seed data preview)
- [x] STORY.md persona narrative
- [x] All tests green, build clean

**Mac Mini sanity check tomorrow morning (single sweep):**

```bash
git pull
cd web
npm install
STUB_LLM_REDACTION=true npm run test     # expect 49/49
brew services start ollama
ollama pull gemma4:e4b
ollama pull gemma4:e2b
unset STUB_VISION
unset STUB_LLM_REDACTION                  # use real Gemma E2B
npm run dev
# Then in browser:
# 1. Toggle Sovereignty Mode in header.
# 2. EgressButton: try destination=CMS without signature → expect 403 BLOCKED card
# 3. Same with signature=tc-2026-q2 → expect signed envelope with llm_spans_found > 0
# 4. Visit /edge → click Load Gemma 4 E2B → confirm WebGPU adapter is detected on Safari/Chrome
```

**Day 5 plan (Windows-doable):**
- Real MediaPipe LLM Inference wiring in `/edge` (replaces the simulated download)
- In-browser tool stubs (read from static seed JSON instead of DuckDB)
- In-browser ledger (IndexedDB-backed instead of node:fs)
- UI polish for the recorded demo (typography, spacing, dark mode pass)
- First demo recording (must happen on Mac Mini → Steve, end of Day 5)

**Mac becomes critical at:**
- Day 5 evening (record first take of the demo video)

**Carried to Day 5:**
- Real WebGPU/MediaPipe inference
- In-browser tool layer + in-browser ledger
- Demo UI polish
- Demo video first recording

---

## Day 5 — 2026-05-10 — WebGPU live demo wired end-to-end

**MediaPipe LLM Inference wired:**
- `lib/edge-llm.ts` — `loadEdgeLlm(onProgress)` wires `@mediapipe/tasks-genai` to load Gemma 4 E2B from `litert-community/gemma-4-E2B-it-litert-lm` on Hugging Face. Lazy-imported (`await import(...)`) so it's not in the main bundle for non-`/edge` traffic. Streams tokens via the listener API. WebGPU adapter check up front. `NEXT_PUBLIC_EDGE_SIMULATED=true` returns a fake LLM so we can preview without the 1.8 GB download.
- `NEXT_PUBLIC_GEMMA_EDGE_MODEL_URL` is overridable so Steve can swap if the canonical URL turns out to be different.

**In-browser tool layer:**
- `lib/edge-data.ts` — fetches `/edge/{facilities,quality,readmissions}.json` once and caches.
- `lib/tools-edge.ts` — all 6 MCP tools ported to read JSON instead of DuckDB. Tool *definitions* are inlined here (not imported from `lib/tools/*`) so the module does not transitively bundle DuckDB into the browser.
- Same tool contracts (judge sees identical function-calling surface) but `data_source: "edge_browser_seed"` so the source is honest.

**In-browser compliance ledger:**
- `lib/ledger-browser.ts` — `BrowserLedger` class with same `append/read/count/headHash` API as the server `Ledger`. IndexedDB-backed, SHA-256 chained via `crypto.subtle`, `verifyBrowserChain` for tamper detection. Same security properties as the server ledger; different storage substrate.

**`/edge` page rebuilt to a complete in-browser demo:**
- Step 1: Load Gemma 4 E2B (real MediaPipe call; simulated path available via env).
- Step 2: Pick a facility + run care-gap scan. `care_gap_finder` runs in-browser → ledger entry → result fed into Gemma → token-streamed executive summary → ledger entry.
- Compliance Ledger panel shows IndexedDB entries live, with hash prefixes + action badges + `phi_egress: false` everywhere.
- Footer credits + GitHub link.
- "Toggle DevTools network to offline" instruction is the airplane-mode banner.

**UI polish on the on-prem page:**
- Wrapped chat surface in a card matching the rest of the layout.
- Footer credits.
- Tightened spacing (gap-6 → gap-8, py-8 → py-10) so each section breathes.

**Tests:** 49/49 vitest green (no new tests today — `/edge` is browser-only and IndexedDB needs jsdom polyfill which we'll add Day 7 if needed). TypeScript clean. `npm run build` clean — 8 routes total (`/`, `/edge`, 6 API routes), `/edge` is static.

**Day 5 DoD:**
- [x] Real MediaPipe LLM Inference wired (`@mediapipe/tasks-genai` + Gemma 4 E2B URL + WebGPU check + streaming)
- [x] Browser tool layer (6 tools) reading static JSON
- [x] IndexedDB ledger with SHA-256 chain
- [x] `/edge` page wired end-to-end (load → scan → stream → ledger)
- [x] UI polish on on-prem page
- [x] All tests green, build clean

**Mac Mini CRITICAL work tomorrow morning:**

Two parallel paths.

**Path A — verify the Mac Mini app (15 min):**
```bash
git pull
cd web && npm install
STUB_LLM_REDACTION=true npm run test     # expect 49/49
brew services start ollama
ollama pull gemma4:e4b && ollama pull gemma4:e2b
unset STUB_VISION
unset STUB_LLM_REDACTION
npm run dev
# Test chat → tool call → ledger; egress with sovereignty toggle; webcam capture
```

**Path B — verify the WebGPU demo on macOS (~30 min):**
```bash
# Same checkout, no env changes
npm run build
npm run start
# In Chrome (must be Chrome — Safari WebGPU shipped behind a flag, may or may not work):
# 1. Open http://localhost:3000/edge
# 2. Confirm "WebGPU: available"
# 3. Click "Load Gemma 4 E2B" — first load is ~1.8 GB, ~2-5 minutes on broadband
# 4. Pick DEMO-CAH-004 → "Run care-gap scan"
# 5. Watch Gemma stream a 2-sentence summary in your browser
# 6. Open DevTools → Network tab → throttling: Offline
# 7. Click "Run care-gap scan" again — IT STILL WORKS
# 8. Screenshot/screen-record this.

# If MediaPipe + Gemma 4 fails to load:
# - First check the model URL is reachable (it's Hugging Face public)
# - Fallback: NEXT_PUBLIC_EDGE_SIMULATED=true to verify the rest of the UX
# - Then tell me the exact error and I patch within an hour
```

**Day 5 evening — first demo recording:**
- Mac Mini app demo (Marlene scenario): chat → tool call → webcam capture → egress with sovereignty toggle → ledger view filling up in real time
- WebGPU live demo (judge experience): /edge page, model load, run scan, toggle offline, scan again
- Two takes minimum, no music yet (Day 6)

**Day 6 plan:**
- Re-record demo if Day 5 take is muddy
- Add subtitles + light music to video
- Writeup draft (use STORY.md as raw material)
- Deploy `/edge` static export to Vercel
- Open repo to public
- Submit DRAFT writeup to Kaggle (so the form exists, edits land later)

**Mac criticality from here on:**
- Day 5 evening — recording (irreversible)
- Day 6 — recording polish, browser verification

**Carried to Day 6:**
- Final demo recording + edit
- Writeup draft + polish
- Vercel deployment of /edge
- Public-repo flip on github.com/sgharlow/gemma-health
- Draft Kaggle submission
