# Final-Submit Checklist (Day 8 / 2026-05-18)

Print this. Walk through it on the Mac in order. Do not skip.

---

## Step 0 — Join the hackathon (if not already)

The Kaggle Overview page shows a "Join Hackathon" button until you accept the rules. Until you do:

- You can't see other teams' Writeups
- You can't see the `NOTE.md` (56 B) in the Data tab — read it once visible; it's the host's last-minute clarifications
- You can't create your Writeup
- You're not eligible for prizes

Click "Join Hackathon" → accept rules. Solo team is fine — max team size is 5, you don't need teammates.

---

## Step 1 — Field-by-field map of the Kaggle "New Writeup" form

The Overview specifies four fields plus attachments. Here's the exact copy-paste:

### Title (single-line text input)

```
HealthPulse Edge
```

### Subtitle (single-line text input)

```
Quality intelligence for the smallest hospitals in America — running entirely on a $400 mini-PC, with a cryptographic privacy guarantee even tribal data sovereignty laws can endorse.
```

### Track (dropdown — REQUIRED)

**Pick: `Digital Equity & Inclusivity`**

Why: closing the analytics equity gap for under-resourced + tribal CAHs without sacrificing patient sovereignty. Less crowded than Health & Sciences; perfect IDSov fit. The Special Tech Track is a separate field (or auto-detected from your writeup body — confirm at submit time).

### Body (Markdown editor)

Paste **all of `WRITEUP.md` EXCEPT** the top H1 (`# HealthPulse Edge`) and the blockquote subtitle (those are the Title + Subtitle fields above). Start your paste at the table that begins `| | |`. End at the bottom (Acknowledgments).

Word count after exclusion ≈ **1,470 prose-words** (the table headers and code blocks count for less). Cap is 1,500 — you have a small buffer. **Do not edit the writeup at submission time** without trimming.

### Attachments → Project Links (required)

| Label | URL |
|---|---|
| GitHub repo | `https://github.com/sgharlow/gemma-health` |
| Live demo | `https://gemma-health.vercel.app/edge` |
| YouTube video | `https://youtu.be/_REPLACE_AFTER_UPLOAD_` |

### Media Gallery (REQUIRED — needs a cover image)

| File | Role | Path |
|---|---|---|
| **Cover image** (required) | Primary thumbnail | `assets/cover.png` |
| Supporting 1 | On-prem app home (sky callout) | `assets/screenshot-onprem-home.png` |
| Supporting 2 | /edge live demo with all 4 wow-improvements visible | `assets/screenshot-edge.png` |
| Supporting 3 | Sovereignty Mode REQUIRES SIGNATURE in production | `assets/screenshot-sovereignty-block.png` |

The YouTube video also belongs in the Media Gallery (per Overview: "Attach your video to the Media Gallery").

### Special Technology Track flag (verify on form)

The Overview says "Projects are eligible to win both a Main Track Prize and a Special Technology Prize." If the form has a Special Tech opt-in field, pick **Ollama**. If there's no field, our writeup body already declares it in the header table — judges will catch it.

---

## Step 2 — Pre-submit verification (Mac terminal)

```bash
cd ~/path/to/gemma-health
git pull
git status                                # MUST show clean
cd web
STUB_LLM_REDACTION=true npm run test      # MUST be 51/51

# Live demo still up
curl -I https://gemma-health.vercel.app/edge          # MUST be 200
curl -I https://gemma-health.vercel.app/api/chat -X POST \
     -H "Content-Type: application/json" -d '{"messages":[]}' # MUST be 200 (structured JSON)

# WebGPU live demo in Chrome
# Open https://gemma-health.vercel.app/edge → Load model → Run scan → Toggle DevTools to offline → Run again
# If it doesn't work, set NEXT_PUBLIC_EDGE_SIMULATED=true in Vercel envs and redeploy

# Pre-submit script
node scripts/verify-submission.cjs        # MUST be 0 failures (the YouTube placeholder check needs you to update WRITEUP first)
```

---

## Step 3 — After recording the demo video

```bash
# 1. Update WRITEUP.md line 10:  _replace with YouTube link_  →  the actual https://youtu.be/... URL
# 2. (optional) Set Vercel env so /edge shows the YouTube fallback link when WebGPU unavailable:
vercel env add NEXT_PUBLIC_DEMO_YOUTUBE_URL production
# paste the URL when prompted
vercel deploy --prod --yes

# 3. Re-run verification — placeholder check should now pass
node scripts/verify-submission.cjs

# 4. Commit + push
git add -A && git commit -m "Day 8: YouTube URL + final polish"
git push
```

---

## Step 4 — Flip the GitHub repo public

The Kaggle submission requires a public code repository. The repo is currently **private**.

```bash
gh repo edit sgharlow/gemma-health --visibility public --accept-visibility-change-consequences
```

---

## Step 5 — Open the Kaggle Writeup form

1. Go to https://www.kaggle.com/competitions/gemma-4-good-hackathon/writeups
2. Click "New Writeup"
3. Fill the fields per Step 1 above
4. Save as draft FIRST (so the form exists). Then re-open and Submit.
5. Open the submitted Writeup in an **incognito window** to confirm video URL, demo URL, and repo link are all reachable without login.

---

## Word count + license guardrails

- `WRITEUP.md` is at **1,484 prose-words / 1,500 raw**. Cap is 1,500. Don't add anything at submit time without trimming.
- `LICENSE` is Apache-2.0. `NOTICE` carries the explicit CC-BY-4.0 grant for prize-winning use per contest section 1.6.

---

## Deadline + slack

**2026-05-18, 11:59 PM UTC** = 6:59 PM Eastern, 3:59 PM Pacific.

Submit by **5:00 PM Pacific** to give yourself an hour of slack for last-minute fixes.

---

## What to do if something breaks at the last minute

| Symptom | Action |
|---|---|
| `/edge` model fails to load in Chrome | Set `NEXT_PUBLIC_EDGE_SIMULATED=true` in Vercel envs → redeploy → page shows simulated path. Your Mac Mini video already shows the real flow; the live demo is supplemental proof. |
| Vercel deploy is broken | Use the most recent working deploy URL from Vercel dashboard → Deployments. Older deployments stay live unless explicitly removed. |
| Tests fail on Mac with fresh `npm install` | Set `STUB_LLM_REDACTION=true STUB_VISION=true` env. The 51 cases all pass with stubs. |
| YouTube upload fails | Don't substitute Vimeo — contest rules say YouTube specifically. Wait it out, contact Kaggle support if needed. |
| `/api/chat` returns 500 on Vercel after some change | Already hardened — `lib/tools` is lazy-imported only after the Ollama check. If you broke it, revert to commit `5122abb` or later. |

---

## After you click Submit

1. Sanity check: open the submitted Writeup in an incognito window. Confirm video, demo URL, and code repo are all reachable without login.
2. Post the writeup link to LinkedIn. Don't tag the judges.
3. Take the rest of the night off.

---

## Competitive context (as of 2026-05-11, ~7 days to deadline)

- 13,101 entrants · 334 participants · 300 teams · 301 submissions
- The Code page shows ~20 published notebooks. Healthcare entries are all patient-facing (field medic, Alzheimer's companion, clinical CDSS); none are quality-officer-administrative
- **No published submission overlaps with HealthPulse Edge's IDSov / compliance-ledger / CAH-quality angle**
- Most published notebooks lean on **Unsloth fine-tuning** — the **Ollama** Special Tech Track looks under-contested
- Prior winners (Gemma 3n + MedGemma) cluster around: real persona, underserved population, offline-first, field worker as user, geographic specificity, equity layered on top — **HealthPulse Edge matches 8/8 of these patterns**
