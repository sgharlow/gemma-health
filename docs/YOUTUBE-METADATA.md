# YouTube Upload Pack

Paste these into the YouTube upload form after rendering the demo video.

---

## Video file

- Format: MP4 (H.264 video, AAC audio)
- Resolution: ≥1080p (1920×1080)
- Frame rate: 30 or 60 fps
- Length: ≤3:00 (Kaggle hard cap); target 2:30
- Audio: voiceover; optional ≤-20 dB music bed

## Visibility settings

- **Public** (NOT unlisted — judges + general public must reach it without login)
- **Audience: Not made for kids**
- **Age restriction: No**
- Comments: **on** (engagement signal)
- Embedding: **allowed** (so the writeup can embed if Kaggle supports it)
- Captions: upload `assets/demo.vtt` (rewrite timestamps to match the final cut first)

## Custom thumbnail

Upload `assets/youtube-thumb.png` (1280×720, 16:9).

---

## Title (≤100 chars on YouTube — but keep under 70 for mobile)

```
HealthPulse Edge — Quality Intelligence on a $400 Mini-PC, On-Device Gemma 4
```

(74 chars — clear, keyword-rich, mentions the model and the hook)

Alternative if you want shorter:

```
Gemma 4 Quality Intelligence for Rural Hospitals — Runs Entirely On-Prem
```

(72 chars)

## Description

```
HealthPulse Edge: quality intelligence for the 1,350 smallest hospitals in America — running entirely on a $400 mini-PC with Gemma 4. No cloud, no API key, no datacenter. Patient data never leaves the device. The on-prem app honors HIPAA, 42 CFR Part 2, and Indigenous Data Sovereignty (CARE Principles).

Submitted to the Gemma 4 Good Hackathon (Google DeepMind × Kaggle) — Digital Equity & Inclusivity track + Ollama Special Technology track.

🌐 Live demo (runs Gemma 4 in your browser via WebGPU):
https://gemma-health.vercel.app/edge

📂 Source code (Apache-2.0, with CC-BY-4.0 grant for prize use):
https://github.com/sgharlow/gemma-health

📄 Writeup (architecture + technical detail):
https://www.kaggle.com/competitions/gemma-4-good-hackathon/writeups/healthpulse-edge

— Three differentiators no other entry has —

1. Compliance Ledger: every Gemma inference SHA-256 hashed into an append-only chain. A regulator can verify cryptographically that no PHI ever left the box.

2. Defense-in-Depth Redaction: regex floor + Gemma E2B sub-agent for the semantic spans regex can't catch (names without honorifics, indirect identifiers, quoted patient speech). Fail-closed for privacy.

3. Sovereignty Mode: a configurable policy engine honoring CARE Principles for Indigenous Data Governance. The tribal council holds the egress key. Almost no commercial AI product honors IDSov today.

— Built with —
- Gemma 4 (E2B + E4B + 26B variants) via Ollama on Mac Mini
- Gemma 4 E2B in browser via MediaPipe LLM Inference + WebGPU
- Next.js 16 + DuckDB + Laplace-mechanism differential privacy
- 6-tool MCP function-calling layer
- 51 vitest cases covering the load-bearing privacy machinery

#Gemma4 #Ollama #EdgeAI #HealthcareAI #PrivacyByDesign #IndigenousDataSovereignty #CARE #CMS #CriticalAccessHospital
```

(Description is ~1,800 chars; YouTube allows 5,000.)

## Tags (separated by commas in YouTube's tag field)

```
Gemma 4, Gemma, Google DeepMind, Ollama, MediaPipe, WebGPU, Edge AI, on-device AI, Healthcare AI, HIPAA, Indigenous Data Sovereignty, CARE Principles, CMS, Critical Access Hospital, quality reporting, compliance ledger, differential privacy, Laplace mechanism, redaction, MCP, function calling, multimodal, on-prem, privacy by design, tribal sovereignty, hackathon
```

## Cards / End screens

- **Card at 0:30** (after the cold-open frame): link to live demo URL
- **Card at 1:30** (during egress scene): link to GitHub repo
- **End screen (last 5 sec):** "Subscribe" button + "Watch live demo" link (gemma-health.vercel.app/edge)

## Pinned comment

After upload, post this as a pinned comment so viewers see it first:

```
📌 Live demo (Gemma 4 in your browser, no install): https://gemma-health.vercel.app/edge
📂 Source: https://github.com/sgharlow/gemma-health
📄 Writeup: see Kaggle Gemma 4 Good Hackathon

Marlene Tsosie and Sage Mesa Critical Access Hospital are composite — no actual hospital or healthcare worker is depicted. The IDSov framing cites the CARE Principles for Indigenous Data Governance; we do not claim endorsement from any tribal nation. Synthetic CMS data throughout.
```

(Counters the most likely reasonable concern from a careful viewer.)

## After upload — required follow-up steps

1. Copy the `https://youtu.be/<id>` short URL
2. Paste into `WRITEUP.md` line 10 (replaces `_replace with YouTube link_`)
3. Set Vercel env: `vercel env add NEXT_PUBLIC_DEMO_YOUTUBE_URL production` (paste URL when prompted)
4. Redeploy: `vercel deploy --prod --yes`
5. Verify the `/edge` page now shows the YouTube fallback link in the WebGPU-unavailable callout
6. Run `node scripts/verify-submission.cjs` — placeholder check should now pass
7. Commit + push the WRITEUP change
