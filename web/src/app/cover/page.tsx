/**
 * Cover image source for the Kaggle Media Gallery.
 *
 * Render this page at 1200×630 viewport and screenshot.
 * On macOS Chrome:
 *   1. cmd-opt-J → Console
 *   2. paste:
 *      await new Promise(r => setTimeout(r, 200));
 *   3. cmd-opt-i → Device toolbar → Responsive → 1200 x 630
 *   4. cmd-shift-p → "Capture full size screenshot"
 *
 * Or use the snapshot script: `node scripts/snapshot-cover.cjs`
 */

export default function CoverPage() {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        background:
          "linear-gradient(135deg, #0a0a0a 0%, #14182a 35%, #1f2937 100%)",
        color: "#e5e7eb",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top status bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 40,
          background: "#059669",
          color: "white",
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 0.4,
          display: "flex",
          alignItems: "center",
          paddingLeft: 24,
          textTransform: "uppercase",
        }}
      >
        OFFLINE — Gemma 4 running locally · No data leaves this device
      </div>

      {/* Title */}
      <div style={{ position: "absolute", top: 80, left: 64, right: 64 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 2,
            color: "#a3e635",
            textTransform: "uppercase",
          }}
        >
          Gemma 4 Good Hackathon · Digital Equity & Inclusivity · Ollama
        </div>
        <h1
          style={{
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.05,
            margin: "12px 0 14px 0",
            letterSpacing: -1.5,
          }}
        >
          HealthPulse Edge
        </h1>
        <p
          style={{
            fontSize: 24,
            lineHeight: 1.35,
            color: "#cbd5e1",
            maxWidth: 980,
            margin: 0,
          }}
        >
          Quality intelligence for the smallest hospitals in America — running
          entirely on a $400 mini-PC, with a cryptographic privacy guarantee
          even tribal data sovereignty laws can endorse.
        </p>
      </div>

      {/* Three-card "what's distinctive" strip */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 64,
          right: 64,
          display: "flex",
          gap: 20,
        }}
      >
        {[
          {
            title: "Compliance Ledger",
            body: "SHA-256 chain. Regulator-verifiable.",
          },
          {
            title: "Defense-in-Depth Redaction",
            body: "Regex floor + Gemma E2B sub-agent.",
          },
          {
            title: "Sovereignty Mode",
            body: "Honors CARE Principles for Indigenous Data Governance.",
          },
        ].map((c) => (
          <div
            key={c.title}
            style={{
              flex: 1,
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 6,
                color: "#fafafa",
              }}
            >
              {c.title}
            </div>
            <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.4 }}>
              {c.body}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom credit */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 64,
          right: 64,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          color: "#94a3b8",
        }}
      >
        <span>github.com/sgharlow/gemma-health</span>
        <span>Built on Gemma 4 · Ollama + WebGPU</span>
      </div>
    </div>
  );
}
