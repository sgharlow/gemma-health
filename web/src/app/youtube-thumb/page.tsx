/**
 * 1280×720 YouTube thumbnail (16:9). Distinct from:
 *   /cover         → 1200×630 Media Gallery hero (1.9:1)
 *   /cover-thumb   → 560×280 Kaggle Card/Thumbnail (2:1)
 *
 * Snapshot from production: assets/youtube-thumb.png
 */

export default function YouTubeThumb() {
  return (
    <div
      style={{
        width: 1280,
        height: 720,
        background: "linear-gradient(135deg, #0a0a0a 0%, #14182a 50%, #1f2937 100%)",
        color: "#e5e7eb",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* OFFLINE banner */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 50,
          background: "#059669",
          color: "white",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 0.6,
          display: "flex",
          alignItems: "center",
          paddingLeft: 30,
          textTransform: "uppercase",
        }}
      >
        OFFLINE — Gemma 4 running locally · No data leaves this device
      </div>

      <div style={{ position: "absolute", top: 100, left: 56, right: 56 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 3,
            color: "#a3e635",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Gemma 4 Good Hackathon · Digital Equity · Ollama
        </div>
        <h1
          style={{
            fontSize: 102,
            fontWeight: 800,
            lineHeight: 1.02,
            margin: "0 0 22px 0",
            letterSpacing: -2.5,
          }}
        >
          HealthPulse Edge
        </h1>
        <p
          style={{
            fontSize: 30,
            lineHeight: 1.3,
            color: "#cbd5e1",
            margin: 0,
            maxWidth: 1100,
          }}
        >
          Quality intelligence for the smallest hospitals in America — Gemma 4
          on a $400 mini-PC, never sends a byte of patient data anywhere.
        </p>
      </div>

      {/* Big "Watch the demo" badge bottom-right (YouTube CTA) */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          right: 56,
          background: "rgba(220,38,38,0.95)",
          color: "white",
          padding: "14px 26px",
          borderRadius: 8,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 0.5,
          boxShadow: "0 12px 24px rgba(0,0,0,0.4)",
        }}
      >
        ▶  90s · See it offline
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 56,
          fontSize: 16,
          color: "#94a3b8",
        }}
      >
        github.com/sgharlow/gemma-health
      </div>
    </div>
  );
}
