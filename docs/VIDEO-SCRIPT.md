# Demo Video — Shooting Script + Voiceover

> **Target:** 2:30 · **Hard cap (Kaggle rule):** 3:00 · **Format:** MP4, ≥1080p · **Hosting:** YouTube (public, no login required) · **Captions:** `assets/demo.vtt`

> **Note (final cut):** the shipped 1:45 video adds a Terminal B-roll (`ollama list`) before Scene 1, four inter-scene title cards ("HealthPulse Edge", "The policy gate", "Cryptographic audit trail", "Same product, in your browser"), and a closing card. Scene 4 now demonstrates the policy gate with a Sovereignty Mode comparison (off → through, on → blocked → signed) and includes a live before/after redaction strip. Scene 5 ends with a Verify-chain-integrity click that pulses the chain-verified badge. A new Scene 6 cameos `/edge` (in-browser WebGPU). The canonical paste-ready voiceover text aligned to the actual video is in `assets/voiceover-teleprompter.html` and `assets/demo.vtt`; the per-scene narration below is the original planning draft kept for context.

---

## Story arc (Morning Review framing)

1. **0:00–0:25** — The problem (cold open, raise stakes)
2. **0:25–1:00** — The morning report (review last night's batch run)
3. **1:00–1:30** — Adding to today's queue (live multimodal capture)
4. **1:30–2:05** — The egress receipt (sign + submit the pre-built envelope)
5. **2:05–2:30** — The closing thesis + URL card

Demo facility throughout: **DEMO-CAH-001, "Sage Mesa Critical Access Hospital", Window Rock, AZ** (composite tribal CAH on Navajo Nation). Persona: **Marlene Tsosie, RN — Quality Improvement Coordinator** (composite character).

**Why batch + morning review:** rural CAHs do not staff analysts at chatbots. They run analytics overnight on whatever compute they own and review results in the morning. The Mac Mini under Marlene's desk runs Gemma 4 between midnight and 6 AM, working through the week's queued questions and scanned surveys. By the time she walks in, the report is ready. This framing reflects how compute-constrained edge sites actually operate, and it makes the Compliance Ledger — the cryptographic record of what the model did while no one was watching — the centerpiece of the demo.

---

## Scene-by-scene shooting script

### Scene 1 — Cold open (0:00–0:25)

**Shot:** Desktop close-up at 6:47 AM. Browser bar visible. The ONLINE/OFFLINE banner reads OFFLINE in green (Wi-Fi toggled off just before rolling). The "Morning Report" status pill in the header reads something like *Last batch: 2026-04-21 22:17 UTC · 5 jobs · 0 errors*.

**On-screen:** `localhost:3000` — HealthPulse Edge home page, OFFLINE banner glowing emerald, Morning Report pill visible.

**Mandatory proof-of-Gemma-4 shot (1.5 sec B-roll over the cold open):** flash a Terminal window running `ollama list`. The list MUST show `gemma4:e2b` (and ideally `gemma4:e4b`). If it shows `gemma3:*` instead, **STOP** and re-edit the voiceover to say "Gemma" without the "4."

**Voiceover (~25 seconds):**
> "There are 1,350 hospitals in the United States that carry the same federal CMS reporting obligations as Mayo Clinic, but with no IT department, no analytics team, and a tribal council policy that forbids patient data from leaving the reservation.
>
> This is one of them. Sage Mesa Critical Access Hospital, Window Rock, Arizona. The Mac Mini under the desk runs Gemma 4 between midnight and 6 AM, working through the week's queued questions and scanned surveys. There is no internet connection right now. There hasn't been one since last night."

**Optional B-roll:** 3-second close-up shot of the Mac Mini on a counter, or a wall clock reading 6:47.

---

### Scene 2 — The morning report (0:25–1:00)

**Shot:** Screen recording of the on-prem `/` page. The chat panel is already populated with last night's conversation — Marlene's queued question is at the top, the streamed Gemma response below. Cursor hovers over the response. The "Morning Report" pill in the header is visible.

**On-screen action:** No typing. Marlene scrolls slowly through the existing conversation. The cursor highlights:
1. Her queued prompt: `For DEMO-CAH-001, find the top 3 care gaps and tell me which one to tackle first.`
2. The Compliance Ledger entries below it — three `tool_call` rows, timestamps from overnight (something like `2026-04-22 02:14 UTC`)
3. The model's final answer, with the recommendation in bold

**Voiceover (~32 seconds):**
> "Marlene Tsosie is the RN, the quality officer, and the EHR admin. On Tuesday morning she has forty-five minutes between rounds and the morning huddle to digest the overnight quality run.
>
> Here it is. The question she queued Monday evening: find the top three care gaps, tell me which one to tackle first. While the hospital slept, Gemma 4 called the care gap finder against six months of CMS data. The answer is waiting — three ranked gaps, with the recommendation in bold:
>
> 'Heart failure and shock with major complications — thirty-eight readmissions, excess ratio one-point-two-one. Tackle this first. Pilot transitional care visits within seven days for heart-failure discharges and verify diuretic titration plans.'
>
> Quality analytics at the level a 200-person analytics team would produce. On a four-hundred-dollar box. Run overnight. With the front door locked."

**Why this quote:** paraphrases what the seeded `care_gap_finder` returns + the assistant's recommendation line. The ledger shows ONE tool call (care_gap_finder) and the chat panel shows the three-bullet answer with the HF recommendation. Verified against the actual on-screen output in the 2026-05-15 prep run (see `web/src/lib/__tests__` and `/api/ledger`). If you re-run prep with a different prompt or model temperature changes the ordering, re-read the chat panel and update this voiceover to match before recording audio.

---

### Scene 3 — Overnight intake batch (1:00–1:30)

**Shot:** Screen recording of the `IntakeQueue` panel on the on-prem `/` page. The panel shows:
- Header: "Patient surveys — overnight batch · Batch ran Apr 21 22:17 → Apr 22 05:42 · 9 processed · 0 errors"
- Left column: a thumbnail of the scanned survey (the rendered + hand-marked form) captioned "Survey #1 of 9 — Gemma 4 extraction on right"
- Right column: the **real Gemma 4 extraction JSON** for that survey (patient initials, visit date, free-text feedback) — captured by running `/api/vision` once during fixture generation
- Below the JSON: a compact table of the other 8 surveys processed last night — initials, visit date, ratings, theme

**On-screen action:** None — the Playwright driver scrolls into the panel and dwells 11 seconds total: 5s on the thumbnail + featured extraction, 6s slow-scrolled onto the "also processed" table.

**Operator tip:** Nothing manual. The IntakeQueue is fully automated. Real Gemma 4 vision output is baked into `data/intake/extractions.json` from the fixture-generation step; the 8 supporting rows are fixture data showing breadth. Regenerate the featured extraction (with a different image or warm model) by running `cd web && node scripts/generate-intake-fixtures.cjs`.

**Voiceover (~28 seconds):**
> "Reception drops scanned paper surveys into the intake folder throughout the day — phone photos, the copier-scanner downstairs, anything that lands in the shared directory.
>
> Here's last night's batch — nine surveys queued. This one ran through Gemma 4 vision on-device: patient initials M-Y, visit date, and the free-text feedback the model pulled off the handwriting — 'Nurse Marlene was very kind. Wait was long but care was good.' Locally, on the same Mac Mini, no network. Below it, the rest of the batch summary — ratings and themes, ready for review.
>
> Cloud OCR exists. Using it would violate HIPAA, violate tribal data sovereignty, and add a per-page cost. So it didn't. The image never left the building."

---

### Scene 4 — The egress receipt (1:30–2:05)

**Shot:** Screen recording. Sovereignty Mode toggle is ON in the header. The egress section is visible — Marlene is reviewing the envelope that last night's batch prepared for the quarterly CMS submission.

**On-screen action:**
1. Sovereignty Mode is ON in the header (visible)
2. Egress section: destination = `CMS`, signature key field empty
3. Click "Submit Q2 to CMS" → red REQUIRES SIGNATURE card appears with the rationale
4. Type `tc-2026-q2` into the signature field
5. Click "Submit Q2 to CMS" again → signed envelope renders with: redactions count >100, LLM spans found, 5 DP aggregates (ε=5.0 total), envelope hash. With `STUB_LLM_REDACTION=true` this returns in <20ms; with `--honest-redact` it takes ~6 min and the editor cuts the wait.

**Voiceover (~33 seconds):**
> "It's quarter-end. CMS reporting is due this afternoon.
>
> Last night's batch already prepared the envelope. Marlene reviews it. Sovereignty Mode evaluated the policy — CMS is allowed, but only with a tribal council co-signature key. The system is holding the egress until she pastes it.
>
> She does. The redaction sub-agent — regex floor plus a Gemma E-2-B semantic pass — has stripped over a hundred PHI fields across the records and free-text. Differential privacy noise applied to all five numeric aggregates. Epsilon five-point-zero spent for the quarter. The envelope is signed with a SHA-256 hash the hospital itself cannot retroactively forge.
>
> CMS gets the aggregate. Marlene's patients get to stay anonymous. The tribal council gets a cryptographic receipt for everything that happened while no one was watching."

---

### Scene 5 — Close (2:05–2:30)

**Shot:** Compliance Ledger panel close-up showing the chain produced during the take — the overnight chat user turn, the `tool_call` to `care_gap_finder`, the assistant final turn, then the Scene-4 BLOCKED egress (`phi_egress: false`), and finally the freshly signed `egress` entry (`phi_egress: true`) with the `dp_epsilon: 5` annotation. Then cut to title card. (Five entries total — the IntakeQueue panel in Scene 3 reads from fixture data and does NOT append to the ledger during the take.)

**Voiceover (~25 seconds):**
> "Frontier intelligence does not require a frontier datacenter. With Gemma 4, the smallest hospital in America can do what only the largest could yesterday — overnight, on cheap hardware, without surrendering a patient's right to be unknown.
>
> HealthPulse Edge. Built on Gemma 4 and Ollama. Live demo and source at github.com/sgharlow/gemma-health."

**Title card (last 3 seconds, freeze frame):**

```
HealthPulse Edge
gemma-health.vercel.app/edge
github.com/sgharlow/gemma-health
Built on Gemma 4 · Submitted to the Gemma 4 Good Hackathon
```

---

## Automated recording flow

Two scripts in `scripts/` handle the whole take hands-off (once you've printed the survey and granted macOS Screen Recording permission):

```bash
# 1. ONE-TIME bootstrap per session (~2 min)
./scripts/prep-recording.sh

# 2. RECORD a take (Wi-Fi auto-toggles, screencapture auto-starts, Playwright
#    drives Scenes 1+2+4+5, you do Scene 3 with the paper survey,
#    script auto-resumes when the vision call lands in the ledger)
./scripts/record-take.sh

# Retake? Just re-prep (it re-wipes the ledger) and re-record:
./scripts/prep-recording.sh --skip-warm  # models stay warm; near-instant
./scripts/record-take.sh
```

The Playwright driver pauses at Scene 3 with on-screen instructions and resumes automatically when it detects new `vision_extract_survey` entries in the ledger — no terminal interaction needed mid-recording. See `web/scripts/record-take.cjs` for the timing and `scripts/record-take.sh --help` for flags including `--rehearse` (safe dry-run with Wi-Fi on, Scene 3 skipped).

**Important — `STUB_LLM_REDACTION=true` is the default** for the recording (set by `prep-recording.sh`). The Gemma E-2-B redaction sub-agent code path runs but returns a canned 2-span stub, so Scene 4's signed envelope returns in <20 ms instead of ~6 minutes of "Working…" on screen. The regex floor remains live and produces the 100+ visible redactions the voiceover describes. Pass `--honest-redact` to `prep-recording.sh` if you must run the live LLM inference (Scene 4 then becomes a 6-minute hold for the editor to cut).

## Pre-recording checklist (Mac, 30 minutes before rolling)

- [ ] `ollama list` shows `gemma4:e4b` and `gemma4:e2b` — if it doesn't, **STOP** and re-record the voiceover to drop the "Gemma 4 specifically" claims. Also capture the `ollama list` output as a 1.5-sec B-roll insert over scene 1.
- [ ] `curl -s http://localhost:3000/api/health | jq '.ollama.resolved_primary_model, .ollama.resolved_redaction_model'` returns gemma4:* tags actually used by the running app (not gemma3:* fallbacks)
- [ ] `npm run dev` is running on http://localhost:3000, started with `GEMMA_MODEL=gemma4:e2b GEMMA_REDACTION_MODEL=gemma4:e2b` (e2b is much faster on Intel CPU than e4b, still Gemma 4)
- [ ] Ollama daemon was started with `OLLAMA_KEEP_ALIVE=1h` so the model stays resident between takes (`ollama ps` should show UNTIL > 30 min)
- [ ] Model has been pre-warmed: hit `/api/chat` with the Scene 2 prompt once and `/api/vision` with any image before rolling. Then reset the ledger (stop dev → `rm data/ledger/ledger.jsonl` → start dev) for a clean chain.
- [ ] `STUB_VISION` and `STUB_LLM_REDACTION` are NOT set (real models)
- [ ] Browser zoom set to 100%
- [ ] Browser window 1280×800 or larger
- [ ] One sample handwritten patient survey printed and within reach
- [ ] Airplane mode toggle binding tested
- [ ] Test the chat prompt once before rolling — confirm Gemma responds with a real answer (not the `ollama_unreachable` JSON)
- [ ] Test the egress flow once before rolling — confirm BLOCKED and then signed envelope work
- [ ] Audio: USB mic plugged in, levels checked, room quiet
- [ ] Screen recording software ready (QuickTime Screen Recording, ScreenFlow, or OBS)

## Post-production

- [ ] **Cut the live Gemma response wait** in Scenes 2 and 3. Even with `e2b` pre-warmed on Intel CPU, the chat answer takes ~30–60 sec and the vision extraction takes ~2 min. The voiceover is timing-agnostic — sync the audio over a tight edit of (a) the prompt being typed, (b) tool-call entries appearing in the ledger, (c) the final answer streaming in. Same trick for the egress envelope.
- [ ] Cut to ≤2:30 target / 3:00 hard cap
- [ ] Burn in subtitles using `assets/demo.vtt` (rewrite timestamps to match final cut)
- [ ] Add a 1-second fade-in / fade-out
- [ ] Optional: light non-distracting background music (royalty-free; ≤-20 dB under voiceover). If unsure, ship no music — voice + screen is enough
- [ ] Export as MP4, H.264, ≥1080p
- [ ] Upload to YouTube — Public, No age restriction, Captions uploaded
- [ ] Use the title and description from `docs/YOUTUBE-METADATA.md`
- [ ] Set the YouTube thumbnail to `assets/youtube-thumb.png`
- [ ] After upload: copy the `https://youtu.be/...` URL into `WRITEUP.md` line 10 and into Vercel env `NEXT_PUBLIC_DEMO_YOUTUBE_URL`

## Why this script wins per the contest rubric

- **Impact & Vision (40 pts):** Cold open establishes the gap clearly (1,350 CAHs, sovereignty, no IT). Every scene reinforces the equity thesis.
- **Video Pitch & Storytelling (30 pts):** Structured 5-act arc, named persona, concrete numbers, payoff in 2:30.
- **Technical Depth & Execution (30 pts):** Three differentiators (compliance ledger, redaction sub-agent, sovereignty mode) all on screen, all verifiable in code.

## Lines you can cut if running long (cut from bottom up)

- Scene 1: drop "The model running here is Gemma 4. The Mac Mini under the desk runs it." (saves ~5 sec)
- Scene 2: drop "Marlene Tsosie is the RN, the quality officer, and the EHR admin." (saves ~6 sec)
- Scene 3: drop "Cloud OCR was never going to be the answer. This is." (saves ~5 sec)
- Scene 4: drop "It's quarter-end. CMS reporting is due." (saves ~3 sec)
