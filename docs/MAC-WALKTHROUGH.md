# Mac Walkthrough — Submission Day, Start to Finish

> **Audience:** you, on your Mac, doing the work today with Claude Code as your pair.
>
> **Total active time:** ~2.5–3.5 hours (most of it recording the demo).
>
> **Strategy:** install Claude Code first, then have Claude follow this doc with you. Every step that has a failure mode has a "ping Claude with this" prompt prepared.
>
> **Repo state going in:** 58/58 vitest, `npm run build` clean (12 routes), WRITEUP at 1,492/1,500 words, MCP server compile-checked but `npm install`-untested (Windows SSL blocked it; Mac will work fine). The Vercel production deploy is still on Day 7-8 code — Phase 4 of this walkthrough redeploys with Day 9 fixes BEFORE recording.

---

## What's new since the last time you looked at this repo

The Day 9 hardening pass added meaningful surface area you should know before recording:

- **`mcp/` is now a real MCP server** (was an empty `.gitkeep`). Exposes the same 6 tools as the web app, JSON-backed, runs via `node mcp/server.js`. README has Claude Desktop config snippet.
- **`/api/egress` sovereignty wiring now works on Vercel** (was a production bug — `data/policy/sovereignty.json` wasn't bundled into the serverless function; now inlined as `web/src/data/sovereignty-policy.ts` with a parity test).
- **`/api/health` is now a trust dashboard** — returns ledger info (head, count, lifetime ε), sovereignty info (version, jurisdiction, posture), and resolved Ollama model tags.
- **`/edge` got 3 new affordances** — synthetic-seed badge, "Verify chain integrity" button, "Use simulated narrative" toggle, plus auto-fallback when WebGPU/model load fails.
- **150 synthetic facilities** (was 15) — `scripts/gen-seed.cjs` is deterministic. First 15 IDs preserved so tests stay anchored.
- **Ollama model resolution fallback chain** — `gemma4:e4b` → `gemma4` → `gemma4:latest` → `gemma3:4b` → `gemma3` for chat; analogous chain for redaction. `/api/health` reports what got resolved. **Caveat: vision is its own model surface — if `gemma4:e4b` isn't installed and you fall back to `gemma3:4b`, vision will not work.** See Phase 3.4 below.
- **DP is mathematically tightened** — `dpMean` is now DP-sum/public-n; cumulative ε persisted to the ledger.

If you want the full receipt of what changed, `STATUS.md` Day 9 has it.

---

## Prerequisites

- Mac (Apple Silicon strongly preferred; Intel works but model inference is slower)
- ≥30 GB free disk space (Gemma 4 models + Node/Ollama + cached npm)
- Stable internet for model downloads + YouTube upload
- Your Anthropic account (Claude Code login)
- Your Kaggle account (already joined the hackathon, draft created)
- Your YouTube account
- Your GitHub account (`sgharlow`) — re-auth via `gh` on Mac
- Your Vercel account (already authenticated previously; if not, `npx vercel login`)

---

## Phase 0 — Install Claude Code + dev tools (15 minutes)

### 0.1 Install Homebrew (skip if installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After it finishes, run the "Next steps" lines it prints to add `brew` to your PATH.

### 0.2 Toolchain

```bash
brew install node@22 git gh ollama
brew link --overwrite node@22
node --version    # expect v22.x
git --version
gh --version
ollama --version
```

### 0.3 Claude Code + Vercel CLI

```bash
npm install -g @anthropic-ai/claude-code vercel
claude --version
vercel --version
```

### 0.4 Authenticate

```bash
claude            # log in via browser, then Ctrl-D to exit (we'll relaunch from inside the repo)
gh auth login     # GitHub.com → HTTPS → web browser → confirm sgharlow
vercel login      # if not already logged in from another machine
```

**Phase 0 success criteria:** `node`, `git`, `gh`, `ollama`, `claude`, `vercel` all resolve to versions; `gh auth status` shows you're logged in as `sgharlow`; `vercel whoami` shows your account.

**If anything fails:**
> *I'm setting up my Mac for the gemma-health submission. Step 0.X (`<command>`) returned this error: `<paste>`. What should I check?*

---

## Phase 1 — Clone, install, verify (10 minutes)

### 1.1 Clone + launch Claude inside the repo

```bash
mkdir -p ~/Code && cd ~/Code
git clone https://github.com/sgharlow/gemma-health
cd gemma-health
git log --oneline -5    # confirm latest commit is Day 9 hardening
claude
```

Useful first prompt for Claude inside the repo:

> *Read `docs/MAC-WALKTHROUGH.md` and confirm we're starting at Phase 1.2. Show me `git status` and the current commit. Don't make code changes without asking me first.*

### 1.2 Install web deps + run tests

```bash
cd web
npm install
STUB_LLM_REDACTION=true npm run test
```

**Phase 1.2 success criteria:** `58 passed` (58 / 58 across 8 test files).

### 1.3 Install MCP server deps (NEW)

```bash
cd ../mcp
npm install
node --check server.js && echo "syntax OK"
# Smoke-test the MCP stdio handshake — pipe `Ctrl-D` (EOF) to exit cleanly
echo "" | node server.js 2>&1 | head -3
```

**Phase 1.3 success criteria:** Output contains `[healthpulse-edge-mcp] loaded 150 facilities · 573 quality rows · 295 readmissions rows`. The server hangs waiting for MCP requests on stdin — that's correct, the smoke-test pipes EOF to make it exit.

**If `@modelcontextprotocol/sdk` install fails or import paths reject:**

> *Phase 1.3 of MAC-WALKTHROUGH failed. Output: `<paste>`. The MCP SDK was never end-to-end tested on Windows due to SSL issues — check whether the import paths in `mcp/server.js` match the current @modelcontextprotocol/sdk export map, and patch if needed.*

Then back to web:

```bash
cd ../web
```

---

## Phase 2 — Ollama + Gemma 4 (15 minutes)

```bash
brew services start ollama
ollama pull gemma4:e4b      # ~9.6 GB · primary chat + function calling + vision
ollama pull gemma4:e2b      # ~7.2 GB · redaction sub-agent
ollama list
```

**Critical check before recording:** the architecture documents `gemma4:e4b` as multimodal. **If the pull fails or `gemma4` is not yet a published Ollama tag at the time you're reading this**, the chat fallback chain (`gemma4` → `gemma4:latest` → `gemma3:4b`) will still let `/api/chat` work, BUT vision will *not* fall back gracefully — `gemma3:4b` is text-only. In that case you have three options:

1. **(Preferred)** Pull whatever the canonical Gemma 4 multimodal tag is right now: `ollama search gemma` and re-run with the actual tag. Then `export GEMMA_MODEL=<actual-tag>` before `npm run dev`.
2. Drop the multimodal Marlene-webcam scene from the video; reframe in WRITEUP as roadmap (Phase 6 has the doc edits).
3. Record the webcam scene with `STUB_VISION=true` set; the canned response demonstrates the structured-output flow, label the scene "structured output mock" in subtitles.

```bash
# Quick alive-check
ollama run gemma4:e4b "Say 'HealthPulse Edge online' and nothing else."
```

**Phase 2 success criteria:** both tags pulled, model responds to a one-liner.

---

## Phase 3 — Verify all 3 surfaces end-to-end (15 minutes)

### 3.1 Dev server up

```bash
cd ~/Code/gemma-health/web
unset STUB_VISION STUB_LLM_REDACTION
npm run dev
```

Server up at http://localhost:3000.

### 3.2 Health check shows the new shape

In another terminal:

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

**Expect:**

```json
{
  "ollama": {
    "ok": true,
    "version": "...",
    "resolved_primary_model": "gemma4:e4b",      // or whatever the fallback resolved to
    "resolved_redaction_model": "gemma4:e2b"
  },
  "model": "gemma4:e4b",
  "host": "http://localhost:11434",
  "ledger": {
    "count": 0,                                  // or higher if you already played
    "head_hash": "0000...",                      // genesis or the latest entry hash
    "persistent": true,
    "lifetime_epsilon_spent": 0
  },
  "sovereignty": {
    "version": "2026-05-10",
    "jurisdiction": "Navajo Nation",
    "default_egress_posture": "blocked",
    "framework_basis": ["CARE Principles for Indigenous Data Governance", "HIPAA", "42 CFR Part 2"]
  }
}
```

If `resolved_primary_model` is NOT `gemma4:e4b` (e.g., resolved to `gemma3:4b`), the model fallback chain kicked in — **stop and re-evaluate Phase 2's options 1–3 about vision** before continuing.

### 3.3 On-prem app surface — chat + tool calls

Open http://localhost:3000 in Safari or Chrome. In the chat:

```
For DEMO-CAH-001, find the top 3 care gaps and tell me which one to tackle first.
```

**Expect:**
- "synthetic seed data" badge near the chat title (Day 9 addition)
- Compliance Ledger panel populates with `tool_call:care_gap_finder` (and possibly `facility_benchmark` if Gemma fans out)
- Gemma streams a 1-2 sentence summary that names specific care gaps for Sage Mesa CAH

**If the model responds but the Compliance Ledger shows no tool_call entries:** tool-calling format mismatch.

> *Phase 3.3 failed — model responded but no `tool_call` entries in the Compliance Ledger. Paste the chat response. Diagnose whether Gemma 4 via Ollama uses a different tool-call shape than `web/src/lib/ollama.ts` types expect.*

### 3.4 On-prem app surface — webcam (multimodal — only if Phase 2 verified Gemma 4 vision)

Print any handwritten note or sample patient survey.

1. Click "Start camera" — accept the permission prompt
2. Hold the printed form to the camera
3. Click "Capture + extract"

**Expect:** structured JSON with fields the model can actually see (patient_initials, visit_date, rating_overall). If it returns canned-looking generic fields or fails, see Phase 2 vision-fallback options.

### 3.5 On-prem app surface — egress + sovereignty (the money shot)

Confirm header toggle "Sovereignty Mode ON" is checked.

1. Egress section: destination = `CMS`, leave signature blank → click "Submit Q2 to CMS"
   - **Expect:** red **Sovereignty Mode REQUIRES SIGNATURE** card with rationale citing tribal council co-signature
2. Type `tc-2026-q2` into signature field → click "Submit Q2 to CMS"
   - **Expect:** signed envelope with `redaction: N fields stripped (regex caught N-M, LLM caught M extra)`, DP aggregates, lifetime ε in ledger
3. Take a screenshot of the REQUIRES SIGNATURE state — this is `assets/screenshot-sovereignty-block.png`. Save and overwrite.

**If the REQUIRES SIGNATURE card doesn't show and you get BLOCKED with "Destination 'CMS' not declared":** the sovereignty policy isn't being loaded.

> *Phase 3.5 failed — Sovereignty Mode shows BLOCKED instead of REQUIRES SIGNATURE for CMS. Verify `web/src/data/sovereignty-policy.ts` is being imported correctly by `web/src/lib/sovereignty.ts` and that `evaluateEgress` is using the bundled policy not the file-system path.*

### 3.6 In-browser /edge surface

Open Chrome → http://localhost:3000/edge

1. Notice the new affordances: WebGPU status + "Use simulated narrative" toggle in the header
2. Step 1 — Click "Load Gemma 4 E2B"
   - On a Mac with WebGPU + bandwidth: real download (~1.8 GB) — wait 2-5 minutes
   - If WebGPU unavailable or upstream fails: auto-falls-back to simulated with an amber banner; the rest of the flow still works
3. Step 2 — Pick `DEMO-CAH-001` → click "Run care-gap scan"
4. Streaming summary appears in the panel (real Gemma if model loaded, deterministic narrative if simulated)
5. Click "Verify chain integrity" — banner reports `✓ Chain valid — N entries verified`
6. Open DevTools → Network → Offline → click "Run care-gap scan" again → it still works (this is the proof shot)

**Phase 3.6 screenshot:** save as `assets/screenshot-edge.png` (overwrite). Should show: header with WebGPU "available" + facility dropdown + Step 2 with a streamed summary + Compliance Ledger with multiple entries + green offline banner. Cmd-Shift-P in DevTools → "Capture full size screenshot."

### 3.7 MCP server surface (NEW)

In a third terminal:

```bash
cd ~/Code/gemma-health/mcp

# Round-trip: list tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node server.js 2>/dev/null | head -1

# Round-trip: call care_gap_finder
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"care_gap_finder","arguments":{"facility_id":"DEMO-CAH-004"}}}' | node server.js 2>/dev/null | head -1
```

**Expect:** JSON-RPC responses. The first should list all 6 tool definitions; the second should return care gaps for DEMO-CAH-004.

**Better verification:** install Claude Desktop, edit `~/Library/Application Support/Claude/claude_desktop_config.json` per `mcp/README.md`, restart Claude Desktop, then ask: *"Use the healthpulse-edge MCP server to find the top care gaps at DEMO-CAH-004."* The 6 tools should appear in the Claude Desktop tools list. Take a screenshot — if it's visually compelling, it's a candidate Media Gallery image.

**Phase 3 success criteria:** all 3 surfaces work, sovereignty + edge screenshots re-captured against current code.

---

## Phase 4 — Redeploy Vercel with Day 9 fixes (5 minutes)

> **Critical** — Production currently runs Day 7-8 code. The sovereignty fix, /api/health expansion, /edge UX upgrades, 150-facility data — none of it is live yet. Redeploy BEFORE recording the video, otherwise the live URLs judges visit won't match what you demo.

```bash
cd ~/Code/gemma-health/web
vercel deploy --prod --yes
```

Should complete in ~35 seconds. After:

```bash
# Sanity-check live URLs return the new shape
curl -s https://gemma-health.vercel.app/api/health | python3 -m json.tool | head -25
# Expect: includes "ledger" and "sovereignty" keys

curl -sI https://gemma-health.vercel.app/edge | head -1   # expect HTTP/2 200
curl -s https://gemma-health.vercel.app/edge | grep -o "Verify chain integrity"   # expect match
```

**Phase 4 success criteria:** new deploy live; `/api/health` returns ledger + sovereignty info; `/edge` HTML contains "Verify chain integrity" string.

**If the deploy fails:** the build error will name the file. Most likely cause is a missing env var or a type error introduced inadvertently. Don't force-merge; fix and redeploy.

---

## Phase 5 — Re-capture sovereignty screenshot from production (3 minutes)

The screenshot you took in Phase 3.5 was from `localhost:3000`. For the Kaggle Media Gallery, the live URL version is more credible:

1. Open https://gemma-health.vercel.app in Chrome
2. Egress section: destination = `CMS`, signature blank → "Submit Q2 to CMS"
3. REQUIRES SIGNATURE card appears
4. DevTools → Cmd-Shift-P → Capture full size screenshot
5. Save as `~/Code/gemma-health/assets/screenshot-sovereignty-block.png` (overwrite)

```bash
cd ~/Code/gemma-health
git add assets/screenshot-sovereignty-block.png assets/screenshot-edge.png
git commit -m "Re-capture screenshots against Mac+Chrome production"
git push
```

---

## Phase 6 — Record the demo video (45-75 minutes including retakes)

The shooting script is `docs/VIDEO-SCRIPT.md`. Read it once before recording. Five scenes, ~30 seconds each, target 2:30 total, hard cap 3:00.

### 6.1 Pre-flight

Walk `docs/VIDEO-SCRIPT.md` § "Pre-recording checklist." Specifically:

- [ ] `ollama list` shows both Gemma 4 tags
- [ ] `npm run dev` running; http://localhost:3000 working
- [ ] Browser zoom 100%, window 1280×800
- [ ] Print one handwritten patient survey for the webcam scene
- [ ] USB mic plugged in, levels checked, room quiet
- [ ] **Reset the local ledger before recording**: in Safari, http://localhost:3000/edge → "Reset" button in the Compliance Ledger card. Keeps the demo recording clean.
- [ ] **If you decided to skip the multimodal scene in Phase 2 — update `docs/VIDEO-SCRIPT.md` to remove it and re-time the remaining scenes to 2:30 total.**

### 6.2 Recording tools

- **Easy:** QuickTime → File → New Screen Recording → Options → External mic. Selected-window recording.
- **Better:** OBS Studio (`brew install --cask obs`).

### 6.3 Five scenes per script

For each scene:

1. Read voiceover aloud once before rolling
2. Hit record
3. Speak the line while performing the on-screen action
4. Cut as soon as the beat lands
5. Two takes minimum; pick the better one

### 6.4 Cut + render

Combine best takes in iMovie. Target 2:30. Render MP4 + H.264 + ≥1080p.

If you're burning subtitles in: rewrite `assets/demo.vtt` timestamps to match. If uploading captions to YouTube separately: same `.vtt` with adjusted timestamps.

**Phase 6 success criteria:** MP4 ≤3:00 with clear audio, visible UI, voiceover landing the 5 beats.

> *Watching Scene N back, [thing] doesn't land. Suggest a tighter rewrite of the voiceover that hits the same beat in fewer words.*

---

## Phase 7 — Upload to YouTube (10 minutes)

Follow `docs/YOUTUBE-METADATA.md` exactly. Copy-paste:

- Title (under 80 chars)
- Description (with all 3 links — GitHub, live demo, Kaggle)
- Tags (comma list)
- Custom thumbnail: upload `assets/youtube-thumb.png`
- Captions: upload `assets/demo.vtt`
- Visibility: **Public**, not for kids, no age restriction
- After upload: pin the comment from `docs/YOUTUBE-METADATA.md`

Copy share URL (format: `https://youtu.be/<id>`).

**Phase 7 success criteria:** video URL reachable from an incognito window without login.

---

## Phase 8 — Wire YouTube URL + redeploy again (5 minutes)

```bash
cd ~/Code/gemma-health

# 1. Replace placeholder in WRITEUP
sed -i '' 's|_replace with YouTube link_|https://youtu.be/REAL_ID_HERE|' WRITEUP.md
grep "youtu.be" WRITEUP.md   # confirm

# 2. Set Vercel env so /edge shows the YouTube fallback link for non-WebGPU visitors
cd web
vercel env add NEXT_PUBLIC_DEMO_YOUTUBE_URL production
# Paste URL, choose Production environment only
vercel deploy --prod --yes
cd ..

# 3. Pre-submit verification — MUST be 0 failures now
node scripts/verify-submission.cjs

# 4. Commit + push
git add -A
git commit -m "Day 10: YouTube URL wired + final polish"
git push
```

**Phase 8 success criteria:** `verify-submission.cjs` exits 0; visiting `https://gemma-health.vercel.app/edge` from a non-WebGPU browser (Firefox works) shows the "watch the recorded demo on YouTube ↗" fallback link.

---

## Phase 9 — Flip the repo public (1 minute)

```bash
gh repo edit sgharlow/gemma-health --visibility public --accept-visibility-change-consequences

# Verify from incognito context
curl -sI https://github.com/sgharlow/gemma-health | head -1   # expect HTTP/2 200
```

**Phase 9 success criteria:** repo reachable from incognito.

---

## Phase 10 — Submit on Kaggle (15 minutes)

Follow `docs/SUBMIT-CHECKLIST.md` Step 1 exactly. Field-by-field copy-paste.

1. https://www.kaggle.com/competitions/gemma-4-good-hackathon/writeups → open your existing in-progress draft (NOT new)
2. Fill the form (Title, Subtitle, Card+Thumbnail = `cover-thumb.png`, Track = Digital Equity & Inclusivity, optional Special Tech = Ollama)
3. Project Description: paste `WRITEUP.md` **starting at the `| | |` table** (skip H1 + 2 blockquote lines)
4. Project Links: GitHub repo + live demo + YouTube
5. Media Gallery (in this order): YouTube → `cover.png` → `screenshot-edge.png` → `screenshot-sovereignty-block.png` → `screenshot-onprem-home.png` → `architecture-diagram.png`
6. **Save first** (preserves work)
7. Re-open, verify everything renders
8. Click **Submit**
9. Open submitted writeup in incognito — confirm all links work

**Phase 10 success criteria:** Kaggle confirms submission.

**Hard deadline:** **2026-05-18, 4:59 PM MST** (= 3:59 PM PDT = 11:59 PM UTC). **Self-imposed cutoff: 2:00 PM PDT for slack.**

---

## Phase 11 — Post-submit (5 minutes)

```bash
# Open the LinkedIn post template
open docs/LINKEDIN-POST.md
```

Pick Version A or B. Paste into LinkedIn from your **personal** profile (not business page). Attach `assets/cover.png`.

Take the rest of the night off.

---

## Working with Claude through this doc

**Best opening prompt after `claude` launches inside the repo:**

> *I'm doing the Mac walkthrough at `docs/MAC-WALKTHROUGH.md`. Read it. We're at Phase X. Watch over my shoulder — when I paste an error, diagnose against the codebase. When I hit a success criterion, confirm it. Don't make any code changes without asking me first.*

**For specific step failures:**

> *Step X.Y of `docs/MAC-WALKTHROUGH.md` failed. Output: `<paste>`. Diagnose against the relevant code and recommend a fix.*

**For the recording phase:**

> *I just finished Scene N of the video. The voiceover felt awkward at "<paste line>." Suggest 2 tighter alternatives.*

**Don't ask Claude to:**
- Push commits without showing the diff first
- Make structural changes to the submission package on submit day
- Edit `WRITEUP.md` body — it's at the word-count limit; any edit is a tradeoff

**Do ask Claude to:**
- Verify state at every checkpoint (`git status`, `npm run test`, `node scripts/verify-submission.cjs`)
- Explain anything you don't understand in the codebase
- Catch typos in your YouTube description before you paste it
- Watch for contradictions between video voiceover and what's actually on screen

---

## Timeline (if everything goes well)

| Phase | Time | Cumulative |
|---|---|---|
| 0. Install Claude + tools | 15 min | 0:15 |
| 1. Clone + web npm install + mcp npm install + tests | 12 min | 0:27 |
| 2. Ollama + pull Gemma 4 | 15 min | 0:42 |
| 3. Verify 3 surfaces (on-prem, /edge, MCP) | 15 min | 0:57 |
| 4. Vercel redeploy with Day 9 fixes | 5 min | 1:02 |
| 5. Re-capture sovereignty screenshot | 3 min | 1:05 |
| 6. Record video (5 scenes × 5 min × 2 takes + cuts) | 60 min | 2:05 |
| 7. Upload to YouTube | 10 min | 2:15 |
| 8. Wire URL + redeploy + verify-submission | 5 min | 2:20 |
| 9. Flip repo public | 1 min | 2:21 |
| 10. Submit on Kaggle | 15 min | 2:36 |
| 11. LinkedIn | 5 min | 2:41 |

**Start by noon Pacific** to land everything well before 3:59 PM PDT deadline with comfortable slack.

---

## Quick reference — every command in one place

```bash
# Phase 0 — install
brew install node@22 git gh ollama
brew link --overwrite node@22
npm install -g @anthropic-ai/claude-code vercel
gh auth login
vercel login

# Phase 1 — clone + install + test
mkdir -p ~/Code && cd ~/Code && git clone https://github.com/sgharlow/gemma-health
cd gemma-health/web && npm install
STUB_LLM_REDACTION=true npm run test    # expect 58/58
cd ../mcp && npm install
node --check server.js

# Phase 2 — Ollama
brew services start ollama
ollama pull gemma4:e4b
ollama pull gemma4:e2b
ollama list
ollama run gemma4:e4b "Say 'HealthPulse Edge online' and nothing else."

# Phase 3 — dev server (real, no stubs)
cd ../web
unset STUB_VISION STUB_LLM_REDACTION
npm run dev
# Manual UI verification in browser

# Phase 4 — redeploy with Day 9 fixes
vercel deploy --prod --yes
curl -s https://gemma-health.vercel.app/api/health | python3 -m json.tool | head -25

# Phase 5 — re-screenshot, commit, push
cd ..
git add assets/screenshot-sovereignty-block.png assets/screenshot-edge.png
git commit -m "Re-capture screenshots against Mac+Chrome production"
git push

# Phase 6+7 — record + YouTube (manual)

# Phase 8 — wire YouTube URL
sed -i '' 's|_replace with YouTube link_|https://youtu.be/REAL_ID|' WRITEUP.md
cd web
vercel env add NEXT_PUBLIC_DEMO_YOUTUBE_URL production
vercel deploy --prod --yes
cd ..
node scripts/verify-submission.cjs       # expect 0 failures
git add -A && git commit -m "Day 10: YouTube URL wired + final polish" && git push

# Phase 9 — repo public
gh repo edit sgharlow/gemma-health --visibility public --accept-visibility-change-consequences
curl -sI https://github.com/sgharlow/gemma-health | head -1   # expect 200

# Phase 10 — Kaggle submit (manual, per docs/SUBMIT-CHECKLIST.md Step 1)
```

---

## Things that could go wrong + what to do

| Symptom | Action |
|---|---|
| `ollama pull gemma4:e4b` returns "manifest not found" | Run `ollama search gemma` to find the current tag, pull that one, `export GEMMA_MODEL=<tag>` before `npm run dev`. Update `docs/MODELS.md` to mention the real tag. |
| Vision returns garbage / `gemma3:4b` resolved instead of `gemma4:e4b` | See Phase 2 options 1–3. Most likely: drop multimodal scene from video, reframe as roadmap in WRITEUP. |
| Tests fail with `npm install` on Mac | `cd web && rm -rf node_modules package-lock.json && npm install`. If still failing, paste error to Claude. |
| `cd mcp && npm install` rejects SDK import paths | Likely the SDK published a major version after I wrote `server.js`. Ping Claude with the error — usually one-line fix to `server.js` import paths. |
| `/api/egress` returns BLOCKED for CMS instead of REQUIRES SIGNATURE | Sovereignty policy not loading. Check `web/src/data/sovereignty-policy.ts` exists; confirm `web/src/lib/sovereignty.ts` imports `DEFAULT_POLICY` from it. |
| Vercel deploy fails | Read the build error in the Vercel output. Most likely cause: missing env var or TypeScript error from a stray local change. Don't force; fix and redeploy. |
| `verify-submission.cjs` fails on live URL content needles | The deploy that just landed serves old code, OR the page content changed. Compare the failing needle to the live page (`curl -s URL | grep -i NEEDLE`). |
| YouTube upload fails | Don't substitute Vimeo — contest requires YouTube. Wait it out; if blocked, contact Kaggle support. |
| Form rejects subtitle as too long | Use the 132-char version in `docs/SUBMIT-CHECKLIST.md` Step 1. The body blockquote tagline is longer; that goes in Description, not Subtitle. |
| Form rejects thumbnail | Confirm `cover-thumb.png` (560×280), NOT `cover.png` (1200×630). |
| Form word counter says > 1,500 | You included the H1 or blockquote intro. The body starts at the `| | |` table. Skip the first 5 lines of WRITEUP.md. |
| Anything else | Ping Claude with: *"Step X.Y failed: `<paste error>`. Diagnose against the codebase + this walkthrough and recommend a fix. Don't change code without showing me the diff first."* |
