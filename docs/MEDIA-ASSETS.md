# Media Assets — Catalog + What's Still to Generate

Single source of truth for every visual / video / audio / text asset that touches the submission. Date: 2026-05-11.

---

## Status legend

- ✅ **Done** — file exists in repo, ready to use
- 🟡 **Drafted** — content written; Steve must produce the final artifact (e.g. record / photograph / upload)
- ⏳ **Steve-only** — only Steve can produce it (Mac-required action, physical photo, YouTube upload, etc.)

---

## A. Submission attachments (Kaggle form fields)

| # | Asset | Where on form | Source | Dimensions | Status |
|---|---|---|---|---|---|
| A1 | Title | Title field (max 80 chars) | "HealthPulse Edge" — see SUBMIT-CHECKLIST | text | ✅ |
| A2 | Subtitle | Subtitle field (max 140 chars) | The 132-char version in SUBMIT-CHECKLIST Step 1 | text | ✅ |
| A3 | Card and Thumbnail | Card/Thumbnail field | `assets/cover-thumb.png` | 560×280 @ 2x | ✅ |
| A4 | Project Description (body) | Description (markdown editor) | `WRITEUP.md` minus first 5 lines | ~1,440 prose-words | ✅ |
| A5 | Track | Submission Tracks dropdown | "Digital Equity & Inclusivity" | dropdown | ✅ documented |
| A6 | Code repo | Project Links | `https://github.com/sgharlow/gemma-health` | URL | ✅ exists, currently private |
| A7 | Live demo | Project Links | `https://gemma-health.vercel.app/edge` | URL | ✅ live, verified |
| A8 | YouTube video | Media Gallery + Project Links | `https://youtu.be/<id>` | URL after upload | ⏳ Steve records + uploads |

---

## B. Media Gallery — visual assets

| # | Asset | Purpose | Source | Dimensions | Status |
|---|---|---|---|---|---|
| B1 | Hero cover image | Primary cover when viewing writeup | `assets/cover.png` | 1200×630 | ✅ |
| B2 | Architecture diagram | Visual replacement for the ASCII diagram in WRITEUP — judges scan this in 5 seconds | `assets/architecture-diagram.png` | 1600×900 | ✅ NEW |
| B3 | On-prem `/` page | Shows the "on-prem app, Ollama not reachable on Vercel" sky callout | `assets/screenshot-onprem-home.png` | 1280×900 | ✅ |
| B4 | `/edge` live demo | Shows all 4 wow-improvements visible (download explainer, sample preview card, seeded ledger, facility dropdown, WebGPU detection) | `assets/screenshot-edge.png` | 1280×900 | ✅ |
| B5 | `/edge` full-page | Same as B4 but full-page scroll | `assets/screenshot-edge-full.png` | 1280 wide × full | ✅ |
| B6 | Sovereignty Mode block (the money shot) | Live-captured Sovereignty Mode REQUIRES SIGNATURE card refusing CMS egress | `assets/screenshot-sovereignty-block.png` | 1280×900 | ✅ |
| B7 | `/edge` page with model loaded (Mac, Chrome) | Shows the actual WebGPU + Gemma 4 loaded state with a streamed reply visible | not yet — Steve takes on Mac in Chrome | ≥1280 wide | ⏳ Steve captures |
| B8 | Mac Mini "in situ" still | Optional — physical photo or render of the Mini on a clinic counter | not yet — Steve takes/sources | ≥1200 wide | ⏳ Steve (optional) |

---

## C. YouTube assets

| # | Asset | Purpose | Source | Dimensions | Status |
|---|---|---|---|---|---|
| C1 | Video file | The 2:30 demo, MP4, ≥1080p | not yet — Steve records on Mac | 1920×1080 min | ⏳ Steve records |
| C2 | YouTube thumbnail | The clickable card on YouTube | `assets/youtube-thumb.png` | 1280×720 | ✅ NEW |
| C3 | Captions / subtitles | Accessibility + judges who watch with sound off | `assets/demo.vtt` | text | ✅ rewritten to align with new script |
| C4 | Title | YouTube video title | See `docs/YOUTUBE-METADATA.md` | ≤100 chars | ✅ written |
| C5 | Description | YouTube video description | See `docs/YOUTUBE-METADATA.md` | ≤5000 chars | ✅ written |
| C6 | Tags | YouTube tags | See `docs/YOUTUBE-METADATA.md` | comma list | ✅ written |
| C7 | Pinned comment | Top comment for clarifications | See `docs/YOUTUBE-METADATA.md` | ≤10000 chars | ✅ written |

---

## D. Production scripts + supporting docs

| # | Asset | Purpose | Source | Status |
|---|---|---|---|---|
| D1 | Video shooting script | Scene-by-scene shots, on-screen actions, voiceover word-for-word | `docs/VIDEO-SCRIPT.md` | ✅ NEW |
| D2 | Demo subtitles | .vtt aligned to script | `assets/demo.vtt` | ✅ rewritten |
| D3 | YouTube metadata pack | Title, description, tags, pinned comment, follow-up steps | `docs/YOUTUBE-METADATA.md` | ✅ NEW |
| D4 | LinkedIn post draft | Post-submit announcement, 2 versions to choose from | `docs/LINKEDIN-POST.md` | ✅ NEW |
| D5 | Submission checklist | Step-by-step Day 8 walkthrough | `docs/SUBMIT-CHECKLIST.md` | ✅ |
| D6 | Story / persona | Marlene Tsosie composite, three demo scenes shot-by-shot | `docs/STORY.md` | ✅ |
| D7 | Strategy brief | The original positioning + creative angle | `BRIEF.md` | ✅ |

---

## E. What Steve still needs to physically produce

In rough order:

1. **Record the demo video** (~30 minutes including 2 takes per scene)
   - Voiceover audio (USB mic, quiet room)
   - Screen recordings of the 5 scenes per `docs/VIDEO-SCRIPT.md`
   - Optional: B-roll of the actual Mac Mini on a counter
   - Cut to ≤2:30 / 3:00 hard cap
   - Burn captions or upload `assets/demo.vtt` with adjusted timestamps

2. **Upload to YouTube** (~10 minutes)
   - Use `assets/youtube-thumb.png` as custom thumbnail
   - Paste title + description from `docs/YOUTUBE-METADATA.md`
   - Set captions
   - Public visibility, no age restriction
   - Pin the comment from `docs/YOUTUBE-METADATA.md`

3. **Capture B7** — `/edge` with model actually loaded in Chrome on Mac
   - This is the only screenshot Playwright headless can't produce (no real WebGPU)
   - Replaces the placeholder Playwright screenshot showing "WebGPU unavailable"
   - Save as `assets/screenshot-edge-loaded.png` (or replace `screenshot-edge.png`)

4. **Optional B8** — Mac Mini "on a clinic counter" still photo
   - Stock photo + label sticker on the Mini
   - Or skip — the video B-roll covers this

5. **Update `WRITEUP.md` line 10** with the YouTube URL

6. **Set Vercel env** `NEXT_PUBLIC_DEMO_YOUTUBE_URL` so the `/edge` fallback link renders

7. **Flip GitHub repo public**: `gh repo edit sgharlow/gemma-health --visibility public --accept-visibility-change-consequences`

8. **Fill the Kaggle Writeup form** per `docs/SUBMIT-CHECKLIST.md` Step 1, Submit before deadline

9. **Post to LinkedIn** per `docs/LINKEDIN-POST.md` after submission confirmed

---

## F. Consistency-checked claims (audit pass)

These appear in multiple places and have been verified to match across all docs:

| Claim | Verified value |
|---|---|
| Number of US Critical Access Hospitals | 1,350 |
| Number of vitest cases | 51 |
| Mac Mini target hardware | $400 mini-PC |
| MCP tools count | 6 |
| Gemma 4 variants used | E2B (redaction), E4B (primary chat), 26B (optional batch) |
| Differential privacy budget | ε=1.0 per aggregate |
| Demo facility | DEMO-CAH-001 / Sage Mesa Critical Access Hospital / Window Rock, AZ |
| Persona | Marlene Tsosie, RN — composite character |
| Composite framing acknowledged | YES (in WRITEUP "what we don't claim" + STORY + LinkedIn post + YouTube pinned comment) |
| Three differentiators | Compliance Ledger · Defense-in-Depth Redaction · Sovereignty Mode |
| Frameworks cited | HIPAA · 42 CFR Part 2 · CARE Principles for Indigenous Data Governance |
| License | Apache-2.0 + CC-BY-4.0 grant for prize use (per contest section 1.6) |
| Submission tracks | Digital Equity & Inclusivity (Impact) + Ollama (Special Tech) |
| Live demo URL | https://gemma-health.vercel.app/edge |
| Repo URL | https://github.com/sgharlow/gemma-health |

---

## G. What I'm explicitly NOT producing (and why)

- **Audio music bed** — leave it to Steve's discretion at edit time. Dialog-clear audio over no music is better than mediocre music covering dialog.
- **Stock B-roll footage** — not needed; screen recording + airplane-mode toggle is enough visually.
- **A second video for sub-track** — one video is the contest requirement; multiple would dilute attention.
- **Animated logo / brand mark** — premature; the cover-image system already establishes the brand visually.
- **Press release / journalist outreach** — post-submit decision; the submission has to land first.
