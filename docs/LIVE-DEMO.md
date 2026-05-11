# Live Demo Decision

**Decision (locked Day 2):** Option 1 — Public WebGPU demo running Gemma 4 in the judge's own browser. **No server. No API key. The judge proves offline by clicking the DevTools "offline" toggle.**

## Why this won the decision

The "live demo" requirement is in tension with "runs entirely on-device" — judges cannot SSH into a Mac Mini in Window Rock. Three paths were considered:

| Option | Wow factor | Reliability | Reinforces story | Decision |
|---|---|---|---|---|
| 1. WebGPU in judge's browser | **Maximum** — judge literally toggles offline and watches model run | Medium — depends on judge's GPU + browser | **Yes** — the demo IS the proof | **CHOSEN** |
| 2. Hosted demo via Vercel + Gemma endpoint | Low — looks like any cloud chat app | High | No — undermines the privacy claim | Fallback |
| 3. Recorded video + Mac Mini disk image | Low — judges hate recorded-only demos | High | Partial | Last resort |

## What changed since Day 1 made WebGPU viable

- Gemma 4 family launched April 2026 with explicit WebGPU support
- MediaPipe LLM Inference Web JS supports Gemma 4 instruction-tuned variants directly
- Transformers.js v4 (Feb 2026) ships a WebGPU backend with speculative decoding
- `litert-community/gemma-4-E2B-it-litert-lm` on Hugging Face is the right artifact for ~2GB browser download
- A public reference (`kessler/gemma-gem`) demonstrates the exact pattern we need

## Architecture for the live demo

The live-demo deployment is a **separate, slimmed-down build** of the same UI, with the Gemma runtime swapped from local Ollama to in-browser MediaPipe. Tools are stubbed in the browser bundle (the same TS modules, but read from a static JSON of demo seed data).

```
Judge's browser (Chrome/Edge with WebGPU enabled)
  │
  ├── Page loads (<200KB initial JS)
  ├── Tap "Start" → MediaPipe LLM downloads Gemma 4 E2B (~1.8GB, cached on second visit)
  ├── User asks question
  ├── Gemma 4 runs locally in WebGPU
  ├── Tool calls hit in-browser stub functions reading static JSON
  ├── Compliance Ledger writes to IndexedDB (still SHA-256 chained)
  └── Full conversation never leaves the browser
```

## Hosting

- The static SPA (Next.js `output: 'export'`) → Vercel or Cloudflare Pages
- The Gemma 4 weights are downloaded by the browser directly from Hugging Face
- Hosting cost: $0 / month

## Risk & fallback

| Risk | Mitigation |
|---|---|
| Judge's GPU rejects WebGPU | Page detects + shows "use Chrome on a desktop with a discrete GPU" + a link to the recorded demo |
| Initial 1.8GB download too slow / spooky | Show a gauge with "downloading model — runs locally after this, never again" + a "Watch the recorded demo instead" button |
| MediaPipe + Gemma 4 has a bug we hit | Keep `kessler/gemma-gem` as a reference; their working build is a known-good fallback we can fork |
| Demo URL goes down on judging day | Static export → CDN-cached → no server to fail |

## Build deadline

Live demo URL must be publicly reachable by **end of Day 6** so it can be linked in the Writeup on Day 7 and tested by the team end-to-end before submit on Day 8.

## What this does NOT cover

The live demo is a stripped-down "show it works in your browser" experience. The full submission also includes:
- Mac-Mini-on-counter video (the canonical demo, recorded Day 5-6)
- Source code (this repo)
- Writeup explaining the production architecture (Mac Mini + Ollama, not browser)

The live demo is the **wow proof**. The video is the **product story**. Both are needed.
