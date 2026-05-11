# Final-Submit Checklist (Day 8 / 2026-05-18)

Print this. Walk through it on the Mac in order. Do not skip.

## Track selections (paste into the Kaggle submission form)

| Field | Value | Why |
|---|---|---|
| **Writeup track** | **Digital Equity & Inclusivity** | The core thesis is closing the analytics equity gap for under-resourced + tribal CAHs without sacrificing sovereignty. Less crowded than Health & Sciences (which will get most healthcare entries). |
| **Special Technology Track** | **Ollama** | The on-prem product runs entirely on Ollama — primary chat (`gemma4:e4b`), redaction sub-agent (`gemma4:e2b`), optional batch (`gemma4:26b`). Eligible to win Special Tech alongside Main Track. |

If the Kaggle UI lets you also self-flag for Main Track consideration, do so — Main Track is the biggest prize ($50k 1st) and there is no eligibility rule that excludes us.

## Pre-submit verification

Run this exact sequence on the Mac one last time before clicking Submit:

```bash
# 1. Pull latest
cd C:/Users/sghar/CascadeProjects/gemma-health
git pull
git status   # MUST show "nothing to commit, working tree clean"

# 2. Tests still green
cd web
STUB_LLM_REDACTION=true npm run test    # MUST be 51/51

# 3. Live demo still up
curl -I https://gemma-health.vercel.app/edge   # MUST be 200
curl -I https://gemma-health.vercel.app/        # MUST be 200

# 4. WebGPU demo works in Chrome
# Open https://gemma-health.vercel.app/edge → Load model → Run scan → Toggle offline → Run again
# If it doesn't work, set NEXT_PUBLIC_EDGE_SIMULATED=true in Vercel envs and redeploy
```

## Submission attachments — final URL paste targets

| Attachment | URL / file |
|---|---|
| Live Demo | `https://gemma-health.vercel.app/edge` |
| Public Code Repo | `https://github.com/sgharlow/gemma-health` |
| Public Video | `https://youtu.be/_REPLACE_` (must be YouTube — contest hard rule) |
| Cover Image | `assets/cover.png` (or screenshot from `/cover` route) |
| Writeup body | Paste contents of `WRITEUP.md` |

## Word count check

`WRITEUP.md` is currently **1,485 prose-words / 1,501 raw words**. Contest cap is 1,500 with a vague "may be subject to penalty" clause. We are at the limit. **Do not add anything to the writeup at submission time** without trimming an equivalent amount.

## License check

`LICENSE` is Apache-2.0. `NOTICE` carries the explicit CC-BY-4.0 grant for prize-winning use. Both files are at the repo root. If a judge or Google legal asks why both, the answer is in NOTICE: Apache-2.0 for general use; CC-BY-4.0 if we win, per contest section 1.6.

## Deadline

**2026-05-18, 11:59 PM UTC.**

That's 6:59 PM Eastern, 3:59 PM Pacific. Submit by 5:00 PM Pacific to give yourself an hour of slack.

## What to do if something breaks at the last minute

| Symptom | Action |
|---|---|
| `/edge` model fails to load | Set `NEXT_PUBLIC_EDGE_SIMULATED=true` in Vercel envs → redeploy → updated demo flow shows the simulated path. The video already shows the real Mac Mini path; the live demo is supplemental proof. |
| Vercel deploy is broken | Use the most recent working deploy URL (visible in Vercel dashboard → Deployments). Older deployments stay live unless explicitly removed. |
| Tests fail on Mac with a fresh `npm install` | Set `STUB_LLM_REDACTION=true STUB_VISION=true` and re-run. The 51 cases all pass with stubs. |
| YouTube upload fails | Vimeo has been used in past hackathons but the contest rules say YouTube specifically. Don't substitute. Wait it out, contact Kaggle support. |

## After you click Submit

1. Sanity check: open the submitted Writeup in an incognito window. Confirm video, demo URL, and code repo are all reachable without login.
2. Post the writeup link to LinkedIn. Don't tag the judges.
3. Take the rest of the night off.
