/**
 * 1600×900 architecture diagram for the Kaggle Media Gallery.
 * Snapshot from production: assets/architecture-diagram.png
 *
 * Replaces the ASCII diagram in WRITEUP.md as a visual asset.
 */

const COLORS = {
  bg: "#0a0a0a",
  bg2: "#14182a",
  card: "#1f2937",
  cardBorder: "rgba(163,230,53,0.15)",
  ink: "#e5e7eb",
  inkDim: "#cbd5e1",
  accent: "#a3e635",
  accent2: "#34d399",
  warn: "#fbbf24",
  block: "#f87171",
};

function Card({
  title,
  subtitle,
  children,
  highlight,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  highlight?: "warn" | "block" | "accent";
}) {
  const borderColor =
    highlight === "warn"
      ? COLORS.warn
      : highlight === "block"
        ? COLORS.block
        : highlight === "accent"
          ? COLORS.accent
          : COLORS.cardBorder;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: COLORS.ink,
          marginBottom: subtitle ? 2 : 6,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: COLORS.inkDim, marginBottom: 8 }}>{subtitle}</div>
      )}
      <div style={{ fontSize: 11, color: COLORS.inkDim, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function Arrow({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      style={{
        textAlign: "center",
        color: COLORS.accent2,
        fontSize: 16,
        margin: vertical ? "4px 0" : "0 4px",
      }}
    >
      {vertical ? "↕" : "↔"}
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <div
      style={{
        width: 1600,
        height: 900,
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bg2} 60%, ${COLORS.card} 100%)`,
        color: COLORS.ink,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
        padding: 40,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              color: COLORS.accent,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            HealthPulse Edge — Architecture
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
            On a $400 mini-PC the hospital owns. No cloud, no API key, no datacenter.
          </div>
        </div>
        <div style={{ fontSize: 11, color: COLORS.inkDim, textAlign: "right" }}>
          <div style={{ color: COLORS.accent2, fontWeight: 700 }}>Built on Gemma 4 · Ollama + WebGPU</div>
          <div>github.com/sgharlow/gemma-health</div>
        </div>
      </div>

      {/* Outer Mac Mini frame */}
      <div
        style={{
          border: `1px dashed ${COLORS.accent}`,
          borderRadius: 14,
          padding: 16,
          background: "rgba(163,230,53,0.03)",
          height: 770,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 20,
            background: COLORS.bg,
            padding: "0 10px",
            fontSize: 11,
            color: COLORS.accent,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          Mac Mini M4 · 16 GB · airplane-mode capable
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: "100%" }}>
          {/* LEFT column — flow */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Card
              title="Local Web UI (Next.js, served on 127.0.0.1)"
              subtitle="Marlene's interface — chat surface, webcam capture, ledger view, egress button, airplane-mode banner"
            >
              Pages: <code>/</code> on-prem app · <code>/edge</code> WebGPU live demo for the public
            </Card>
            <Arrow vertical />
            <Card
              title="Gemma 4 Runtime (Ollama)"
              subtitle="Open weights — auditable. Cryptographically verifiable model not silently swapped."
            >
              <code>gemma4:e4b</code> — primary chat + native function calling<br />
              <code>gemma4:e2b</code> — sidecar redaction sub-agent<br />
              <code>gemma4:26b</code> — optional batch quality analysis (nightly)
            </Card>
            <Arrow vertical />
            <Card title="6-Tool MCP Function-Calling Layer" subtitle="DuckDB-backed; same contracts as the in-browser /edge demo">
              <code>facility_benchmark</code> · <code>quality_monitor</code> · <code>care_gap_finder</code><br />
              <code>equity_detector</code> · <code>state_ranking</code> · <code>cross_cutting_analysis</code>
            </Card>
            <Arrow vertical />
            <Card title="Local Data" subtitle="Never leaves the box without going through the egress gate">
              CMS quality data (DuckDB, ~200 MB) · synthetic FHIR (Synthea) · compliance ledger (append-only JSONL + SHA-256 chain)
            </Card>
          </div>

          {/* RIGHT column — egress gate (the moat) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card
              title="Egress Gate"
              subtitle="The only path off the box. Five sequential checks; failing any one returns BLOCKED."
              highlight="warn"
            >
              &nbsp;
            </Card>
            <Card title="1 · Sovereignty Mode policy check" subtitle="CARE Principles for Indigenous Data Governance" highlight="block">
              Tribal council co-signature key required for CMS / STATE_DOH destinations. Unknown destinations default to BLOCKED.
            </Card>
            <Card title="2 · Regex PHI strip (Layer 1 floor)">
              SSN · phone · email · MRN · NPI · DOB · address · name+title — fast, deterministic, fail-closed if Layer 2 unavailable
            </Card>
            <Card title="3 · Gemma E2B semantic redaction sub-agent (Layer 2)" highlight="accent">
              Catches names without honorifics, indirect identifiers, ad-hoc IDs, quoted patient speech that regex can't reliably detect
            </Card>
            <Card title="4 · Differential privacy aggregation" subtitle="Laplace mechanism, ε=1.0 per aggregate, total ε in envelope">
              Numeric measures get bounded noise so released aggregates don't leak individuals
            </Card>
            <Card title="5 · SHA-256 sign + ledger entry" highlight="accent">
              Append-only hash chain. Any tampering breaks every subsequent hash. Regulator can verify cryptographically that no PHI ever left.
            </Card>
            <Card title="↓ Optional HTTPS to CMS endpoint" subtitle="Only after all five checks pass. Aggregate-only — no patient records.">
              &nbsp;
            </Card>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 40,
          right: 40,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: COLORS.inkDim,
        }}
      >
        <span>Apache-2.0 · with CC-BY-4.0 grant for prize-winning use per contest rules</span>
        <span>Submitted to the Gemma 4 Good Hackathon · Digital Equity & Inclusivity · Ollama</span>
      </div>
    </div>
  );
}
