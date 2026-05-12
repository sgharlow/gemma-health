# Final-Submit Checklist (Day 8 / 2026-05-18)

Print this. Walk through it on the Mac in order. Do not skip.

> **Status (as of 2026-05-11):** You have already joined the hackathon and accepted the rules. Kaggle says you have an in-progress draft (URL reserved). NOTE.md = "Welcome! This is a Hackathon with no provided dataset." (no further instructions).

---

## Step 1 — Field-by-field paste guide for the New Writeup form

The form has these fields with these constraints (all verified from a logged-in form view):

### Title (required, 80 chars max)

```
HealthPulse Edge
```

(16 / 80 chars)

### Writeup URL slug (auto-generated from Title; editable)

Confirm or set to:

```
healthpulse-edge
```

Final URL: `kaggle.com/competitions/gemma-4-good-hackathon/writeups/healthpulse-edge`

### Subtitle (140 chars max)

```
Quality intelligence for the smallest hospitals in America — Gemma 4 on a $400 mini-PC, never sends a byte of patient data anywhere.
```

(132 / 140 chars)

> NB: The longer tagline that opens `WRITEUP.md` (the markdown blockquote) is **not** the form Subtitle — it's a body element. The form Subtitle is the one above.

### Submission Tracks (required dropdown)

The form labels it "Submission Tracks" (plural) but says "Select the track..." (singular). Likely single-select.

**Pick: `Digital Equity & Inclusivity`**

If a separate Special Technology Track field appears at submit time, also pick **`Ollama`**. If there's no second field, our writeup body declares Ollama in the header table — judges will catch it.

### Card and Thumbnail Image (required, 560 × 280)

Upload: **`assets/cover-thumb.png`** (NOT `cover.png` — that's a different aspect ratio, 1200×630, designed for the Media Gallery hero).

### Project Description (Markdown body — has a built-in word counter)

Open `WRITEUP.md`. **Skip the first 5 lines** (the H1 `# HealthPulse Edge` and the two blockquote lines that start with `>`). Start your paste at the table that begins `| | |`. End at the bottom (Acknowledgments).

Word count after exclusion ≈ **1,440 prose-words** against the 1,500 cap. Buffer of ~60 words. Watch the form's own word counter as confirmation — **DO NOT submit if it says > 1,500**.

### Media Gallery (videos + images)

| File / URL | Order | Why |
|---|---|---|
| YouTube video URL | First | The video is the most important part of the submission per the rules |
| `assets/cover.png` | After video | 1200×630 hero — the canonical visual |
| `assets/screenshot-edge.png` | | The /edge live demo with all 4 wow improvements visible (preview card + seeded ledger + download explainer + facility dropdown) |
| `assets/screenshot-sovereignty-block.png` | | Money shot — Sovereignty Mode REQUIRES SIGNATURE in production |
| `assets/screenshot-onprem-home.png` | | On-prem app home with the sky callout pointing to /edge |

### Project Links (Attachments)

| Label | URL |
|---|---|
| GitHub repo | `https://github.com/sgharlow/gemma-health` |
| Live demo | `https://gemma-health.vercel.app/edge` |
| (YouTube also goes in Media Gallery, above) | |

### Files (max 100MB)

Optional. Could host the cover.png here as backup. Skip unless Kaggle complains about a missing attachment.

---

## Step 2 — Pre-submit verification (Mac terminal)

```bash
cd ~/path/to/gemma-health
git pull
git status                                # MUST show clean
cd web
STUB_LLM_REDACTION=true npm run test      # MUST be 51/51

# Live demo still up
node -e "['/','/edge','/cover','/cover-thumb','/api/health','/api/ledger'].forEach(p => fetch('https://gemma-health.vercel.app'+p).then(r => console.log(r.status, p)))"

# WebGPU live demo in Chrome
# https://gemma-health.vercel.app/edge → Load model → Run scan → DevTools to offline → Run again
# If it doesn't work, set NEXT_PUBLIC_EDGE_SIMULATED=true on Vercel and redeploy

# Pre-submit script
cd ..
node scripts/verify-submission.cjs        # 0 failures (the YouTube placeholder check needs WRITEUP updated first)
```

---

## Step 3 — After recording the demo video

```bash
# 1. Update WRITEUP.md line 10:
#    _replace with YouTube link_  →  the actual https://youtu.be/... URL
sed -i '' 's|_replace with YouTube link_|https://youtu.be/REAL_ID|' WRITEUP.md   # Mac sed needs ''

# 2. Set Vercel env so /edge shows the YouTube fallback link when WebGPU unavailable:
vercel env add NEXT_PUBLIC_DEMO_YOUTUBE_URL production
# paste the URL when prompted, then:
vercel deploy --prod --yes

# 3. Re-run verification
node scripts/verify-submission.cjs

# 4. Commit + push
git add -A && git commit -m "Day 8: YouTube URL"
git push
```

---

## Step 4 — Flip the GitHub repo public

The Kaggle submission requires a public code repository. The repo is currently **private**.

```bash
gh repo edit sgharlow/gemma-health --visibility public --accept-visibility-change-consequences
```

Verify in incognito:

```bash
curl -sI https://github.com/sgharlow/gemma-health | head -1   # MUST be 200
```

---

## Step 5 — Open the Writeup draft and fill it

You already have an in-progress draft (URL reserved). Don't create a new one.

1. Go to https://www.kaggle.com/competitions/gemma-4-good-hackathon/writeups
2. Open the existing in-progress draft (NOT "New Writeup")
3. Paste fields per Step 1
4. **Save first** (preserves your work)
5. Re-open and verify everything renders right
6. Click **Submit** in the top right
7. Open the submitted Writeup in an **incognito window** to confirm video URL, demo URL, and repo link all reachable without login

---

## Word count + license guardrails

- Body should be ≈1,440 prose-words after stripping the first 5 lines of `WRITEUP.md`. The Kaggle form has its own word counter — trust it. Don't submit if it shows > 1,500.
- `LICENSE` is Apache-2.0. `NOTICE` carries the explicit CC-BY-4.0 grant for prize-winning use per contest section 1.6.

---

## Deadline + slack — REVISED

**2026-05-18, 11:59 PM UTC** which is:
- **4:59 PM MST** (Mountain — Kaggle UI shows this for you)
- **3:59 PM PDT** (Pacific Daylight Time)
- **6:59 PM EDT** (Eastern)

**Hard cutoff for clicking Submit: 2:00 PM PDT / 3:00 PM MST.** That gives you 2 hours of slack for last-minute fixes. **Do not push past 3:00 PM PDT — you'll miss the deadline.**

(The previous version of this checklist said "5:00 PM Pacific" which was 1 hour AFTER the actual deadline. That was wrong.)

---

## What to do if something breaks at the last minute

| Symptom | Action |
|---|---|
| `/edge` model fails to load in Chrome | Set `NEXT_PUBLIC_EDGE_SIMULATED=true` on Vercel → redeploy → page shows simulated path. Your Mac Mini video already shows the real flow; the live demo is supplemental proof. |
| Vercel deploy is broken | Use the most recent working deploy URL from Vercel dashboard → Deployments. Older deployments stay live unless explicitly removed. |
| Tests fail on Mac with fresh `npm install` | Set `STUB_LLM_REDACTION=true STUB_VISION=true` env. The 51 cases all pass with stubs. |
| YouTube upload fails | Don't substitute Vimeo — contest rules say YouTube specifically. Wait it out, contact Kaggle support if needed. |
| `/api/chat` returns 500 on Vercel | Already hardened — `lib/tools` is lazy-imported only after the Ollama check. If you broke it, revert to commit `5122abb` or later. |
| Form rejects subtitle as too long | Use the 132-char version in Step 1 above. The body's blockquote tagline is longer; that goes in the body Description, NOT the Subtitle field. |
| Form rejects thumbnail | Confirm you're uploading `cover-thumb.png` (560×280), NOT `cover.png` (1200×630). The latter is for the Media Gallery hero, not the Card/Thumbnail field. |

---

## After you click Submit

1. Sanity check: open the submitted Writeup in incognito. Confirm video, demo URL, code repo all reachable without login.
2. Post the writeup link to LinkedIn. Don't tag the judges.
3. Take the rest of the night off.

---

## Competitive context (as of 2026-05-11, ~7 days to deadline)

- 13,101 entrants · 334 participants · 300 teams · 301 submissions
- The Code page shows ~20 published notebooks. Healthcare entries are all patient-facing (field medic, Alzheimer's companion, clinical CDSS); none are quality-officer-administrative
- **No published submission overlaps with HealthPulse Edge's IDSov / compliance-ledger / CAH-quality angle**
- Most published notebooks lean on **Unsloth fine-tuning** — the **Ollama** Special Tech Track looks under-contested
- Prior winners (Gemma 3n + MedGemma) cluster around: real persona, underserved population, offline-first, field worker as user, geographic specificity, equity layered on top — **HealthPulse Edge matches 8/8 of these patterns**
