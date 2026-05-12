# LinkedIn Post — Post-Submit Announcement

Post this from your **personal** LinkedIn (not the business page). LinkedIn caps at 3,000 chars; this is well under. No hashtags above 3 per the brand guideline you set on the AI Leadership rollout.

---

## Version A — the systemic-equity angle (recommended; matches the Digital Equity track)

```
There are 1,350 hospitals in the United States that have to file the same federal CMS quality reports as Mayo Clinic — and most of them have one part-time RN doing the work.

This weekend I shipped HealthPulse Edge to the Gemma 4 Good Hackathon (Google DeepMind × Kaggle, $200K). It's quality intelligence for the smallest hospitals in America, running entirely on a $400 mini-PC. No cloud. No API key. No datacenter. Patient data never leaves the device.

Three things that I haven't seen anywhere else in production AI:

→ A compliance ledger that hashes every model inference into a SHA-256 chain. A regulator can verify cryptographically that no PHI was exfiltrated.

→ A defense-in-depth redaction layer — regex floor plus a Gemma 4 E2B sub-agent for the semantic spans regex misses. Fail-closed for privacy.

→ A Sovereignty Mode policy engine honoring the CARE Principles for Indigenous Data Governance. The tribal council holds the egress key. Almost no commercial AI product honors IDSov today; edge AI makes it practical for the first time.

Live demo (Gemma 4 runs in your own browser via WebGPU — toggle DevTools to offline and watch it keep working):
gemma-health.vercel.app/edge

Code (Apache-2.0):
github.com/sgharlow/gemma-health

The thesis is narrow and defensible: edge AI is the first technology that lets under-resourced clinics participate in public-health intelligence without surrendering the patient sovereignty their communities are owed.

Marlene Tsosie and Sage Mesa Critical Access Hospital in the demo are composite — no actual hospital or healthcare worker is depicted. The frameworks I cite (HIPAA, 42 CFR Part 2, CARE Principles) are real and load-bearing.

Built with Gemma 4 + Ollama + MediaPipe LLM Inference + WebGPU. Submitted to the Digital Equity & Inclusivity track and the Ollama Special Technology track.
```

(Word count: ~310 words; character count: ~2,090 / 3,000)

---

## Version B — the personal-stakes angle (if you want a softer hook)

```
Most of the AI products built in the last two years assume the user has reliable internet, a cloud subscription, and a legal regime that lets data flow freely to a third-party processor. About 1,350 American hospitals have none of those things.

That's the problem HealthPulse Edge solves. Quality intelligence for Critical Access Hospitals — the small rural and tribal hospitals that file the same federal CMS quality reports as Mayo Clinic but have one part-time nurse doing the work. It runs entirely on a $400 mini-PC with Gemma 4. No cloud. Patient data never leaves the device.

Submitted today to the Gemma 4 Good Hackathon (Google DeepMind × Kaggle, $200K, 300+ teams).

What's distinctive: a cryptographic compliance ledger so a regulator can verify no PHI was exfiltrated, a defense-in-depth PHI redaction pipeline (regex floor + Gemma E2B semantic sub-agent), and a Sovereignty Mode that honors the CARE Principles for Indigenous Data Governance. The tribal council holds the egress key — and that's a real legal framework that almost no commercial AI product respects today.

Live demo (Gemma 4 runs in your own browser tab via WebGPU; offline-capable after first load):
gemma-health.vercel.app/edge

Source: github.com/sgharlow/gemma-health

Built on Gemma 4 + Ollama + MediaPipe LLM Inference. Apache-2.0.
```

(Word count: ~245 words; character count: ~1,640 / 3,000)

---

## Cover image for the LinkedIn post

Use `assets/cover.png` (1200×630). LinkedIn's link-card recommendation is 1200×627; ours is close enough that LinkedIn won't crop it badly.

## When to post

After Kaggle confirms the submission is received (you'll see the Submit button confirm). Post that night or the next morning. Do not tag the judges or Kaggle officially — let the work speak.

## What NOT to do

- Don't post on the business page — keep it on your personal profile per your brand convention
- Don't use more than 3 hashtags (your AI Leadership rollout convention)
- Don't tag the judges by name — performative
- Don't post until the submission is confirmed received on Kaggle
