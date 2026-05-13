# HealthPulse Edge MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the 6 HealthPulse Edge quality-intelligence tools to any MCP host: Claude Desktop, Cursor, Continue, or your own client.

This is the third deployment surface for the same logical tool set:

| Surface | Where it runs | Backing store | Protocol |
|---|---|---|---|
| `web/` on-prem app | Mac Mini + Ollama | DuckDB | HTTP + Ollama function-calling |
| `web/.../edge` live demo | Judge's browser tab | Static JSON in IndexedDB cache | WebGPU + MediaPipe LLM |
| **`mcp/` (this)** | **Any MCP host process** | **`data/seed/*.json`** | **MCP stdio** |

All three surfaces return identical tool result shapes. Each tool result includes `data_source: "demo_seed"` so the synthetic provenance is visible to the host.

## Install + run

```bash
cd mcp
npm install
node server.js   # speaks MCP over stdio; not meant to be run interactively
```

The server writes a one-line startup banner to stderr (row counts + data root) and waits for MCP requests on stdin.

## Claude Desktop wiring

Edit your Claude Desktop config:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add:

```json
{
  "mcpServers": {
    "healthpulse-edge": {
      "command": "node",
      "args": ["/absolute/path/to/gemma-health/mcp/server.js"]
    }
  }
}
```

Restart Claude Desktop. The 6 tools become available alongside any other MCP servers you have configured. Try: *"Use the healthpulse-edge MCP server to find the top care gaps at DEMO-CAH-004."*

## Tools

All six mirror the contracts in `web/src/lib/tools/` and `web/src/lib/tools-edge.ts`:

| Tool | Input | Returns |
|---|---|---|
| `facility_benchmark` | `facility_id`, `metric` | facility score + peer percentiles + DRG contributors |
| `quality_monitor` | `facility_id` | all measures, sorted worse → better |
| `care_gap_finder` | `facility_id` | ranked gaps + intervention hints |
| `equity_detector` | `measure_id` | tribal vs non-tribal cohort means + gap |
| `state_ranking` | `measure_id`, `order?` | states ranked by mean CAH score |
| `cross_cutting_analysis` | `measure_a`, `measure_b` | Pearson r across paired facilities |

## Swapping in real data

The server loads `data/seed/*.json` by default. Set `HPE_DATA_ROOT` to a directory containing files of the same shape to swap in real CMS Hospital Compare data — no other changes needed.

```bash
HPE_DATA_ROOT=/path/to/cms/extract node server.js
```

## Why a separate package

Keeping `mcp/` as its own package with its own `package.json` means the MCP host installs only `@modelcontextprotocol/sdk` (~1 small dependency), not the full Next.js + DuckDB + MediaPipe stack from `web/`. Operators who only want the MCP surface never pay for the rest.
