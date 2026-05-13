#!/usr/bin/env node
/**
 * HealthPulse Edge — MCP (Model Context Protocol) server.
 *
 * Exposes the same 6 quality-intelligence tools as the web/ on-prem app and
 * the /edge in-browser demo, but over the MCP stdio transport so Gemma, Claude
 * Desktop, Cursor, or any other MCP host can call them directly.
 *
 * Usage:
 *   cd mcp && npm install && node server.js
 *
 * Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json
 * on macOS, %APPDATA%/Claude/claude_desktop_config.json on Windows):
 *
 *   {
 *     "mcpServers": {
 *       "healthpulse-edge": {
 *         "command": "node",
 *         "args": ["/absolute/path/to/gemma-health/mcp/server.js"]
 *       }
 *     }
 *   }
 *
 * All tools return `data_source: "demo_seed"` to make synthetic-data
 * provenance visible to the host. To swap in a real CMS extract, set
 * `HPE_DATA_ROOT` to a directory containing facilities/quality/readmissions
 * JSON in the same shape as `data/seed/`.
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { TOOL_DEFINITIONS, TOOL_HANDLERS } = require("./tools");
const { load } = require("./data");

async function main() {
  // Eagerly load + count rows so first invocation latency is honest.
  const { facilities, quality, readmissions, root } = load();
  process.stderr.write(
    `[healthpulse-edge-mcp] loaded ${facilities.length} facilities · ${quality.length} quality rows · ${readmissions.length} readmissions rows from ${root}\n`,
  );

  const server = new Server(
    { name: "healthpulse-edge", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = req.params.arguments ?? {};
    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: `unknown tool: ${name}` }) }],
      };
    }
    try {
      const result = await handler(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[healthpulse-edge-mcp] connected over stdio\n");
}

main().catch((e) => {
  process.stderr.write(`[healthpulse-edge-mcp] fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
