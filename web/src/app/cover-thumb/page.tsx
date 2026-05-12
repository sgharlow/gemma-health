/**
 * 560×280 Card / Thumbnail image source for the Kaggle Writeup form.
 * The /cover route is the 1200×630 Media Gallery hero. This page is the
 * separate small thumbnail Kaggle uses in cards/listings.
 *
 * Snapshot from production: assets/cover-thumb.png via
 * web/scripts/snapshot-cover.cjs (with COVER_PATH=/cover-thumb).
 */

export default function CoverThumbPage() {
  return (
    <div
      style={{
        width: 560,
        height: 280,
        background:
          "linear-gradient(135deg, #0a0a0a 0%, #14182a 50%, #1f2937 100%)",
        color: "#e5e7eb",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top status strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 22,
          background: "#059669",
          color: "white",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: 0.4,
          display: "flex",
          alignItems: "center",
          paddingLeft: 14,
          textTransform: "uppercase",
        }}
      >
        OFFLINE — Gemma 4 running locally · No data leaves this device
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", top: 42, left: 24, right: 24 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 1.5,
            color: "#a3e635",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Gemma 4 Good · Digital Equity & Inclusivity · Ollama
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 800,
            lineHeight: 1.05,
            margin: "0 0 8px 0",
            letterSpacing: -1,
          }}
        >
          HealthPulse Edge
        </h1>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.35,
            color: "#cbd5e1",
            margin: 0,
            maxWidth: 510,
          }}
        >
          Quality intelligence for the smallest hospitals in America — Gemma 4
          on a $400 mini-PC, never sends a byte of patient data anywhere.
        </p>
      </div>

      {/* Bottom brand */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 24,
          right: 24,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "#94a3b8",
        }}
      >
        <span>github.com/sgharlow/gemma-health</span>
        <span>Built on Gemma 4 · Ollama + WebGPU</span>
      </div>
    </div>
  );
}
