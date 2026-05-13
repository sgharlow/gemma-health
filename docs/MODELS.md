# Gemma 4 Model Variants — Which Job Gets Which Model

| Variant | Approx VRAM/RAM | Role in HealthPulse Edge | Why this fit |
|---|---|---|---|
| `gemma4:e2b` | ~2 GB | Redaction sub-agent (Day 4) | Small enough to run alongside the primary model. PHI strip is a narrow task — a small model is fine and keeps the main model's context free. |
| `gemma4:e4b` | ~4 GB | Primary chat + function calling on Mac Mini 16 GB | Default. Fits comfortably with room for the OS + browser + Next.js dev server. |
| `gemma4:26b` | ~16 GB (q4) | Optional batch quality analysis (overnight CMS report draft) | Only loaded for batch jobs; swapped out before chat. Mac Mini 16GB cannot run this and the OS comfortably — used for reference / nightly batch only. |
| `gemma4:31b` | ~20 GB+ | Not used in this submission | Out of scope for the demo hardware. |

## Mac Mini bootstrap (run on the Mini, not on Windows)

```bash
# 1. Install Ollama
brew install ollama
brew services start ollama

# 2. Pull the two variants this submission uses
ollama pull gemma4:e4b
ollama pull gemma4:e2b

# 3. Verify
ollama run gemma4:e4b "Say 'HealthPulse Edge online' and nothing else."

# 4. (Optional) Pull the larger model for nightly batch
ollama pull gemma4:26b
```

If `gemma4:e4b` is not yet a published Ollama tag at install time the adapter automatically walks a documented fallback chain — no code patch needed.

## Model resolution fallback chains

`lib/ollama.ts` walks these chains at first use (cached afterward, per role):

| Role | Env-pinned head | Fallback chain (in order) |
|---|---|---|
| Primary (chat + function calling) | `$GEMMA_MODEL` (default `gemma4:e4b`) | `gemma4:e4b` → `gemma4` → `gemma4:latest` → `gemma3:4b` → `gemma3` |
| Redaction sub-agent | `$GEMMA_REDACTION_MODEL` (default `gemma4:e2b`) | `gemma4:e2b` → `gemma4:2b` → `gemma3:1b` → `gemma3` |

Resolution probes `GET /api/tags` once, picks the first installed tag in the chain (exact or `<tag>-`/`<tag>.` prefix match), and caches the result. If nothing matches, the head tag is returned and the Ollama call surfaces a clean error naming the missing tag.

`GET /api/health` reports the resolved tags as `resolved_primary_model` / `resolved_redaction_model` so the operator can see what the adapter actually picked.

## Environment variables (web/.env.local)

```
OLLAMA_HOST=http://localhost:11434
GEMMA_MODEL=gemma4:e4b
GEMMA_REDACTION_MODEL=gemma4:e2b
```

All have safe defaults in `web/src/lib/ollama.ts`, so `.env.local` is only needed to pin to a non-default tag.

## Sanity check from the web app

`GET /api/health` returns `{ ollama: { ok: true, version: "..." }, model, host }` when Ollama is reachable. This is the first thing to verify after `npm run dev`.
