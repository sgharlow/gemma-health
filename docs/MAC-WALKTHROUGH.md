# Mac Walkthrough — Submission Day, Start to Finish

> **Audience:** you, on your Mac, doing the work tomorrow with Claude Code as your pair.
>
> **Total active time:** ~2–3 hours (most of it recording the demo).
>
> **Strategy:** install Claude Code first, then have Claude follow this doc with you. At every step that has a failure mode, there's a "ping Claude with this" prompt prepared.

---

## Prerequisites

- A Mac (Apple Silicon strongly preferred; Intel works but model inference is slower)
- ≥30 GB free disk space (Gemma 4 models + Node/Ollama + cached npm)
- Stable internet for the model + YouTube upload
- Your Anthropic account (for Claude Code login)
- Your Kaggle account (already joined the hackathon, draft created)
- Your YouTube account
- Your GitHub account (`sgharlow`, already authenticated via gh on Windows — re-auth on Mac)

---

## Phase 0 — Install Claude Code + dev tools (15 minutes)

### 0.1 Install Homebrew (skip if already installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After it finishes, follow the on-screen "Next steps" to add `brew` to your PATH (the installer prints exactly what to run).

### 0.2 Install the toolchain in one shot

```bash
brew install node@22 git gh ollama
brew link --overwrite node@22
```

Verify:

```bash
node --version    # expect v22.x
git --version
gh --version
ollama --version
```

### 0.3 Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Verify:

```bash
claude --version
```

### 0.4 Authenticate Claude Code

```bash
claude
```

It prompts you to log in via browser. Use your Anthropic account. After login, exit (`Ctrl-D`) — we'll re-launch from inside the repo so Claude has project context.

### 0.5 Authenticate gh

```bash
gh auth login
```

Pick GitHub.com → HTTPS → "Login with a web browser" → paste the one-time code. Confirms the account is `sgharlow`.

**Phase 0 success criteria:** `node`, `git`, `gh`, `ollama`, `claude` all resolve to versions; `gh auth status` shows you're logged in.

**If anything fails — ping Claude:**
> *I'm setting up my Mac for the gemma-health submission. Step 0.X (`<command>`) returned this error: `<paste error>`. What should I check?*

---

## Phase 1 — Clone the repo, install deps, verify (10 minutes)

```bash
mkdir -p ~/Code && cd ~/Code
git clone https://github.com/sgharlow/gemma-health
cd gemma-health
```

### 1.1 Launch Claude Code from inside the repo

```bash
claude
```

Now Claude has the full repo in context. Useful first prompts (optional):

> *Read `docs/MAC-WALKTHROUGH.md` and confirm we're starting at Phase 1.*
>
> *Show me the test count and current branch.*

### 1.2 Install web deps + run tests

In a regular terminal (or via Claude with `!`):

```bash
cd web
npm install
```

Should complete without errors. The `@duckdb/node-api` package will download a Mac arm64 native binary (or x86_64 on Intel) — this is the only Mac-specific dep.

```bash
STUB_LLM_REDACTION=true npm run test
```

**Phase 1 success criteria:** `51 passed` (51/51).

**If something fails — ping Claude:**
> *Step 1.2 of MAC-WALKTHROUGH failed. The `npm install` / `npm test` output was: `<paste>`. Diagnose.*

---

## Phase 2 — Install + populate Ollama with Gemma 4 (10–15 minutes)

```bash
brew services start ollama
ollama pull gemma4:e4b      # ~6 GB
ollama pull gemma4:e2b      # ~2 GB
ollama list
```

`ollama list` should show both `gemma4:e4b` and `gemma4:e2b` with non-zero sizes.

Quick-fire test that Ollama is alive and the model responds:

```bash
ollama run gemma4:e4b "Say 'HealthPulse Edge online' and nothing else."
```

Expect output like `HealthPulse Edge online`.

**Phase 2 success criteria:** both tags pulled, model responds to a one-liner prompt.

**If a tag name fails to pull — ping Claude:**
> *`ollama pull gemma4:e4b` returned: `<paste>`. Check ollama.com/library/gemma4 for the current canonical tag and update `web/src/lib/ollama.ts` and `docs/MODELS.md` if the tag has changed.*

---

## Phase 3 — Verify Ollama integration end-to-end (10 minutes)

### 3.1 Start the dev server (real models, no stubs)

```bash
cd ~/Code/gemma-health/web
unset STUB_VISION STUB_LLM_REDACTION
npm run dev
```

Server should be up at http://localhost:3000.

### 3.2 Health check

In another terminal:

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

Expect `ollama.ok: true` and a real version string.

### 3.3 Real chat with real tool calls (highest-risk integration)

Open http://localhost:3000 in Safari or Chrome (any modern browser). In the chat box, type:

```
For DEMO-CAH-001, find the top 3 care gaps and tell me which one to tackle first.
```

**Expected behavior:**
- Compliance Ledger panel populates with `tool_call:care_gap_finder` and other tool entries
- Gemma streams a 1–2 sentence summary that names specific care gaps (sepsis, ED throughput, HF readmissions for Sage Mesa CAH)

**If the model returns the JSON `{ error: "ollama_unreachable" ... }`:** Ollama died, restart it: `brew services restart ollama`.

**If the model responds but doesn't call any tools:** the tool-calling format mismatch is real. Ping Claude:
> *Step 3.3 failed — model responded but the Compliance Ledger shows no `tool_call` entries. Paste the chat response and check whether Gemma 4 via Ollama uses a different tool-call shape than my OpenAI-compatible types.*

### 3.4 Webcam capture (multimodal)

Print any handwritten note or sample patient form. In the UI:

1. Click "Start camera" — accept the permission prompt
2. Hold the printed form to the camera
3. Click "Capture + extract"

**Expected behavior:** structured JSON appears showing fields the model can actually see (initials, date, scores). If it returns generic stub-like fields, the `images` array fix didn't take — ping Claude:
> *Step 3.4 failed — webcam capture returned generic data instead of real OCR. Paste the response and diagnose `lib/vision.ts`.*

### 3.5 Egress + Sovereignty Mode

Confirm header toggle "Sovereignty Mode ON" is checked.

1. Egress section: destination = `CMS`, leave signature blank → click "Build envelope" → expect a red **REQUIRES SIGNATURE** card
2. Type `tc-2026-q2` into the signature field → click "Build envelope" → expect a signed envelope with `redactions stripped: ≥3` and `llm_spans_found ≥ 1`

**Phase 3 success criteria:** all four interactive flows work end-to-end with real Gemma 4.

---

## Phase 4 — Capture the missing screenshot (5 minutes)

### 4.1 The /edge "model loaded" screenshot — only Mac+Chrome can produce this

Why: the existing `assets/screenshot-edge.png` was captured by Playwright headless on Windows, which doesn't support WebGPU — so the screenshot shows the page in its *unavailable* state. We want to replace it with the *loaded* state.

1. Open Chrome → https://gemma-health.vercel.app/edge
2. Click "Load Gemma 4 E2B" → wait ~2–5 minutes for the ~2 GB download (cached after)
3. Pick `DEMO-CAH-001` from the facility dropdown
4. Click "Run care-gap scan"
5. Wait for the streaming summary to complete
6. **In DevTools → Network → Throttling → Offline**
7. Click "Run care-gap scan" again — confirm it still works
8. Take a full-page screenshot (Cmd-Shift-P → "Capture full size screenshot" in DevTools)
9. Save as `~/Code/gemma-health/assets/screenshot-edge.png` (overwrite)

```bash
cd ~/Code/gemma-health
git add assets/screenshot-edge.png
git commit -m "Replace /edge screenshot with Mac+Chrome model-loaded state"
git push
```

**Phase 4 success criteria:** new screenshot shows the Compliance Ledger populated with real entries (not just the 4 demo seeds), the Gemma summary visible, the OFFLINE banner green.

---

## Phase 5 — Record the demo video (30–60 minutes including retakes)

The shooting script is `docs/VIDEO-SCRIPT.md`. **Read it once before recording.** Five scenes, ~30 seconds each, target 2:30 total.

### 5.1 Pre-flight checklist

Open `docs/VIDEO-SCRIPT.md` § "Pre-recording checklist (Mac, 30 minutes before rolling)" and walk through every item. Specifically:

- [ ] `ollama list` shows both Gemma 4 tags
- [ ] `npm run dev` running, http://localhost:3000 working
- [ ] Browser zoom 100%, window 1280×800
- [ ] Print one handwritten patient survey to hold to the webcam
- [ ] USB mic plugged in, levels checked, room quiet
- [ ] Test the chat prompt and the egress flow ONCE before rolling — confirm both work end-to-end

### 5.2 Recording tools

- **Built-in (free, easy):** QuickTime → File → New Screen Recording. Hit Options → External mic. Record selected window only.
- **Better (free, more control):** OBS Studio (`brew install --cask obs`). Window capture + mic input + scene transitions.
- **Best (paid):** ScreenFlow.

### 5.3 Record 5 scenes per the script

Follow `docs/VIDEO-SCRIPT.md` § "Scene-by-scene shooting script". For each scene:

1. Read the voiceover line aloud once before recording (smoothness)
2. Hit record
3. Speak the voiceover while performing the on-screen action
4. Cut as soon as the scene's beat lands

Two takes per scene minimum; pick the better one.

### 5.4 Cut + render

Combine the 5 best takes in iMovie (free, comes with the Mac) or your editor of choice. Target 2:30, hard cap 3:00.

If burning subtitles in: rewrite `assets/demo.vtt` timestamps to match your final cut. If uploading captions to YouTube as a separate file: same .vtt with adjusted timestamps.

Render: MP4, H.264, ≥1080p.

**Phase 5 success criteria:** an MP4 file ≤3:00 with clear audio + visible UI + voiceover that lands the 5 beats from the script.

**If you're unhappy with a take — ping Claude:**
> *Watching Scene N back, the [thing] doesn't land. Suggest a tighter rewrite of the voiceover that hits the same beat in fewer words.*

---

## Phase 6 — Upload to YouTube (10 minutes)

Follow `docs/YOUTUBE-METADATA.md` exactly. Copy-paste:

- Title (74 chars)
- Description (~1,800 chars with all 3 links)
- Tags (comma list)
- Custom thumbnail: upload `assets/youtube-thumb.png`
- Captions: upload `assets/demo.vtt` (with adjusted timestamps from Phase 5.4)
- Visibility: **Public**, Not made for kids, no age restriction
- After upload: pin the comment from `docs/YOUTUBE-METADATA.md`

Copy the share URL (format: `https://youtu.be/<id>`).

**Phase 6 success criteria:** video URL is reachable in an incognito window without login.

---

## Phase 7 — Wire the YouTube URL into the repo + redeploy (5 minutes)

```bash
cd ~/Code/gemma-health

# 1. Update WRITEUP.md line 10
# Mac sed needs '' after -i
sed -i '' 's|_replace with YouTube link_|https://youtu.be/REAL_ID_HERE|' WRITEUP.md
grep "youtu.be" WRITEUP.md   # confirm it landed

# 2. Set the Vercel env so /edge shows the YouTube fallback link to non-WebGPU visitors
cd web
vercel env add NEXT_PUBLIC_DEMO_YOUTUBE_URL production
# paste the URL when prompted, choose "Production" only
vercel deploy --prod --yes
cd ..

# 3. Re-run pre-submit verification
node scripts/verify-submission.cjs
# expect: ALL CHECKS PASS (the YouTube placeholder warning is now gone)

# 4. Commit + push
git add -A
git commit -m "Day 8: YouTube URL + final polish"
git push
```

**Phase 7 success criteria:** `verify-submission.cjs` exits 0; visiting https://gemma-health.vercel.app/edge from a browser without WebGPU shows the "Watch the recorded demo on YouTube ↗" link.

---

## Phase 8 — Flip the GitHub repo public (1 minute)

The Kaggle submission requires a public code repository. The repo is currently **private**.

```bash
gh repo edit sgharlow/gemma-health --visibility public --accept-visibility-change-consequences
```

Verify in incognito:

```bash
curl -sI https://github.com/sgharlow/gemma-health | head -1   # MUST be 200
```

**Phase 8 success criteria:** repo is reachable from incognito.

---

## Phase 9 — Submit on Kaggle (15 minutes)

Follow `docs/SUBMIT-CHECKLIST.md` Step 1 exactly. Copy-paste blocks for each form field.

1. Go to https://www.kaggle.com/competitions/gemma-4-good-hackathon/writeups
2. Open your existing in-progress draft (don't create new)
3. Fill the form:
   - Title (16/80 chars)
   - Subtitle (132/140 chars — the short version)
   - Card and Thumbnail Image: upload `assets/cover-thumb.png` (560×280)
   - Track: Digital Equity & Inclusivity
   - (If a Special Tech field exists: also pick Ollama)
   - Project Description: paste WRITEUP.md body **starting at the table that begins `| | |`** (skip the H1 + 2 blockquote lines)
   - Project Links: GitHub repo URL + live demo URL + YouTube URL
   - Media Gallery: upload `cover.png`, `screenshot-edge.png`, `screenshot-sovereignty-block.png`, `screenshot-onprem-home.png`, `architecture-diagram.png`
4. **Save first** (preserves work)
5. Re-open and verify everything renders right
6. Click **Submit** in the top right
7. Open the submitted writeup in an incognito window — confirm video, demo URL, repo all reachable without login

**Phase 9 success criteria:** Kaggle confirms the submission is received.

**Hard deadline:** **2026-05-18, 4:59 PM MST** (= 3:59 PM PDT = 11:59 PM UTC). **Submit by 2:00 PM PDT** for slack.

---

## Phase 10 — Post-submit (5 minutes)

### 10.1 LinkedIn announcement

Open `docs/LINKEDIN-POST.md`. Pick Version A (recommended) or Version B. Paste into LinkedIn from your **personal** profile (not business page). Attach `assets/cover.png` as the link card image.

### 10.2 Take the rest of the night off

Done. Reflect.

---

## Working with Claude Code through this doc — a few tips

**Best opening prompt after `claude` launches inside the repo:**

> *I'm doing the Mac walkthrough at `docs/MAC-WALKTHROUGH.md`. Read it. We're at Phase X. Watch over my shoulder — when I paste an error, diagnose against the codebase. When I hit a success criterion, confirm it. Don't make any code changes without asking me first.*

**For specific step failures:**

> *Step X.Y of `docs/MAC-WALKTHROUGH.md` failed. Output: `<paste>`. Diagnose against the relevant code and recommend a fix.*

**For the recording phase:**

> *I just finished Scene N of the video. The voiceover felt awkward at "<paste line>". Suggest 2 alternatives that say the same thing more cleanly in fewer words.*

**Don't ask Claude to:**
- Push commits without showing you the diff first
- Make structural changes to the submission package on submit day
- Edit `WRITEUP.md` body — it's at the word-count limit; any edit is a tradeoff

**Do ask Claude to:**
- Verify state at every checkpoint (`git status`, `npm run test`, `node scripts/verify-submission.cjs`)
- Explain anything you don't understand in the codebase
- Catch typos in your YouTube description before you paste it
- Watch for any contradictions between your video voiceover and what's actually on screen

---

## If everything goes well, the submission timeline tomorrow

| Phase | Time | Cumulative |
|---|---|---|
| 0. Install Claude + tools | 15 min | 0:15 |
| 1. Clone + npm install + tests | 10 min | 0:25 |
| 2. Ollama + pull Gemma 4 | 15 min | 0:40 |
| 3. Verify Ollama integration | 10 min | 0:50 |
| 4. Replace /edge screenshot | 5 min | 0:55 |
| 5. Record video (4 scenes × 5 min × 2 takes + cuts) | 60 min | 1:55 |
| 6. Upload YouTube | 10 min | 2:05 |
| 7. Wire URL + redeploy | 5 min | 2:10 |
| 8. Flip repo public | 1 min | 2:11 |
| 9. Submit on Kaggle | 15 min | 2:26 |
| 10. LinkedIn | 5 min | 2:31 |

Plan to start by **noon Pacific** to land everything before the 3:59 PM PDT deadline with comfortable slack.
