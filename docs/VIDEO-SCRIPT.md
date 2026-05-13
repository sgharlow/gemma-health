# Demo Video — Shooting Script + Voiceover

> **Target:** 2:30 · **Hard cap (Kaggle rule):** 3:00 · **Format:** MP4, ≥1080p · **Hosting:** YouTube (public, no login required) · **Captions:** `assets/demo.vtt`

---

## Story arc (write this on a sticky note before recording)

1. **0:00–0:25** — The problem (cold open, raise stakes)
2. **0:25–1:00** — The morning quality scan (chat → tool calls → summary)
3. **1:00–1:30** — The webcam capture moment (multimodal, paper survey)
4. **1:30–2:05** — The egress receipt (sovereignty + redaction + signed envelope)
5. **2:05–2:30** — The closing thesis + URL card

Demo facility throughout: **DEMO-CAH-001, "Sage Mesa Critical Access Hospital", Window Rock, AZ** (composite tribal CAH on Navajo Nation). Persona: **Marlene Tsosie, RN — Quality Improvement Coordinator** (composite character).

---

## Scene-by-scene shooting script

### Scene 1 — Cold open (0:00–0:25)

**Shot:** Desktop close-up. Browser bar visible. The ONLINE/OFFLINE banner is on screen — toggle airplane mode just before rolling so it reads OFFLINE in green.

**On-screen:** `https://localhost:3000` — HealthPulse Edge home page, OFFLINE banner glowing emerald.

**Voiceover (~25 seconds):**
> "There are 1,350 hospitals in the United States that have the same federal CMS reporting obligations as Mayo Clinic, but no IT department, no analytics team, and a tribal council policy that explicitly forbids patient data leaving the reservation.
>
> This is one of them. Sage Mesa Critical Access Hospital, Window Rock, Arizona. The model running here is Gemma 4. The Mac Mini under the desk runs it. There is no internet connection right now."

**Optional B-roll if recording on the Mac Mini:** Close-up shot of the Mini on a counter for 3 seconds. Otherwise stay on the airplane-mode banner.

---

### Scene 2 — Morning quality scan (0:25–1:00)

**Shot:** Screen recording of the on-prem `/` page chat surface. Marlene types the prompt; cursor visible.

**On-screen action:**
1. Marlene types into the chat box: `For DEMO-CAH-001, find the top 3 care gaps and tell me which one to tackle first.`
2. Press Enter
3. Compliance Ledger panel populates with two `tool_call` entries (visible in the lower section)
4. Gemma's response streams in: a 2-sentence summary

**Voiceover (~35 seconds):**
> "Marlene Tsosie is the RN, the quality officer, and the EHR admin. On Tuesdays she has half a day to run the federal quality reports.
>
> She types her question. Gemma 4 calls three tools — care gap finder, facility benchmark, cross-cutting analysis. Four seconds later, here's the answer:
>
> 'Your sepsis bundle compliance is the lowest in your CMS region. Refresh the three-hour bundle education and audit antibiotic timing — that's your highest leverage move this quarter.'
>
> This is Stanford Medicine-grade quality analytics. Returned in four seconds. On a four-hundred-dollar box. With airplane mode on."

---

### Scene 3 — The webcam capture (1:00–1:30)

**Shot:** Side-angle. Marlene's hand holds a stack of paper forms; she lifts one to the laptop's webcam. The screen is visible: webcam feed appears on the left, JSON appears on the right when the capture completes.

**On-screen action:**
1. Click "Start camera" — webcam feed appears
2. Hold a (printable, sample) handwritten patient experience survey to the camera. (Print one beforehand from a generic template.)
3. Click "Capture + extract"
4. The JSON extraction renders next to the video frame: patient initials, visit date, ratings, free-text feedback
5. The Compliance Ledger gains two new entries: `tool_call:vision_extract_survey` (request, then result) — both labeled `phi_egress: false`

**Voiceover (~30 seconds):**
> "She has three weeks of handwritten patient experience surveys nobody has entered. The cloud OCR services exist, but using them violates HIPAA, violates tribal data sovereignty, and adds a per-page cost.
>
> Gemma 4 sees the form locally. Transcribes it. Adds it to the local FHIR store. Compliance ledger logs the action — phi-egress equals false, signed.
>
> Cloud OCR was never going to be the answer. This is."

---

### Scene 4 — The egress receipt (1:30–2:05)

**Shot:** Screen recording. Header banner shows Sovereignty Mode toggle is ON. The Egress section is visible. Two takes: first the BLOCKED card, then the signed envelope.

**On-screen action:**
1. Sovereignty Mode is ON in the header (visible)
2. Egress section: destination = `CMS`, signature key field empty
3. Click "Build envelope" → red REQUIRES SIGNATURE card appears with the rationale
4. Type `tc-2026-q2` into the signature field
5. Click "Build envelope" again → signed envelope renders with: redactions count, LLM spans found, DP aggregates, envelope hash

**Voiceover (~35 seconds):**
> "It's quarter-end. CMS reporting is due.
>
> She clicks Submit. Sovereignty Mode evaluates the policy. CMS is allowed — but only with a tribal council co-signature key. The system blocks the egress until she pastes the key.
>
> She does. The redaction sub-agent runs — regex floor plus a Gemma E-2-B semantic pass — and strips over a hundred PHI fields. Differential privacy noise gets applied to the numeric measures. The envelope is signed with a SHA-two-fifty-six hash that the hospital itself cannot retroactively forge.
>
> CMS gets the aggregate. Marlene's patients get to stay anonymous. The tribal council gets a cryptographic receipt."

---

### Scene 5 — Close (2:05–2:30)

**Shot:** Compliance Ledger panel close-up, showing the chain of entries from the session — system, tool_call, tool_call, egress (with `phi_egress: true`). Then cut to title card.

**Voiceover (~25 seconds):**
> "Frontier intelligence does not require a frontier datacenter. With Gemma 4, the smallest hospital in America can do what only the largest could yesterday — without surrendering a patient's right to be unknown.
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

## Pre-recording checklist (Mac, 30 minutes before rolling)

- [ ] `ollama list` shows `gemma4:e4b` and `gemma4:e2b`
- [ ] `npm run dev` is running on http://localhost:3000
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
