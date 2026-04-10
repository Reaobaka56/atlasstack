import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  sub: string;
  layer: "client" | "infra" | "core" | "data";
  risk: boolean;
  riskMsg?: string;
  info: string;
  // layout — injected by backend or computed client-side
  x?: number;
  y?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  flow: boolean; // true = animated dashed (live data path), false = static (structural)
}

export interface ArchGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  repo: string;
  score: number;
}

// ─── Colour map ───────────────────────────────────────────────────────────────

const LAYER_STYLE: Record<
  GraphNode["layer"],
  { fill: string; stroke: string; text: string }
> = {
  client: { fill: "#B5D4F4", stroke: "#185FA5", text: "#0C447C" },
  infra:  { fill: "#D3D1C7", stroke: "#5F5E5A", text: "#444441" },
  core:   { fill: "#9FE1CB", stroke: "#0F6E56", text: "#085041" },
  data:   { fill: "#D3D1C7", stroke: "#5F5E5A", text: "#444441" },
};

const RISK_STROKE = "#E24B4A";
const RISK_FILL   = "#FCEBEB";
const FLOW_COLOR  = "#1D9E75";
const STATIC_COLOR = "#B4B2A9";

// ─── Layout helpers ───────────────────────────────────────────────────────────

const NODE_W = 130;
const NODE_H = 44;
const H_GAP  = 20;
const V_GAP  = 60;

/**
 * Simple layer-based auto-layout.
 * If the backend already provides x/y values these are used as-is.
 * Otherwise nodes are arranged into rows by layer order.
 */
function autoLayout(nodes: GraphNode[]): GraphNode[] {
  if (nodes.every((n) => n.x !== undefined && n.y !== undefined)) return nodes;

  const LAYER_ORDER: GraphNode["layer"][] = ["client", "infra", "core", "data"];
  const rows: Record<string, GraphNode[]> = {};
  LAYER_ORDER.forEach((l) => (rows[l] = []));
  nodes.forEach((n) => rows[n.layer]?.push(n));

  const CANVAS_W = 660;
  let y = 30;

  return nodes.map((node) => {
    const row = rows[node.layer];
    const idx = row.indexOf(node);
    const totalW = row.length * NODE_W + (row.length - 1) * H_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    return {
      ...node,
      x: startX + idx * (NODE_W + H_GAP),
      y: y + LAYER_ORDER.indexOf(node.layer) * (NODE_H + V_GAP),
    };
  });
}

// ─── Edge path helper ─────────────────────────────────────────────────────────

function edgePath(a: GraphNode, b: GraphNode): string {
  const ax = a.x! + NODE_W / 2;
  const ay = a.y! + NODE_H / 2;
  const bx = b.x! + NODE_W / 2;
  const by = b.y! + NODE_H / 2;
  // Simple quadratic curve via midpoint
  const mx = (ax + bx) / 2;
  return `M${ax},${ay} Q${mx},${ay} ${bx},${by}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Filter = "all" | "core" | "data" | "risks";

interface Props {
  graph: ArchGraph;
  /** Called when user clicks "Share map" */
  onShare?: () => void;
}

export default function ArchitectureMap({ graph, onShare }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [laid, setLaid] = useState<GraphNode[]>([]);
  const [replayKey, setReplayKey] = useState(0);
  const animRef = useRef(0);

  // Run layout once on mount / graph change
  useEffect(() => {
    setLaid(autoLayout(graph?.nodes || []));
    setSelected(null);
  }, [graph]);

  const visibleIds = useCallback((): Set<string> => {
    let nodes = laid;
    if (filter === "core")  nodes = laid.filter((n) => n.layer === "core" || n.layer === "infra");
    if (filter === "data")  nodes = laid.filter((n) => n.layer === "data" || n.layer === "infra");
    if (filter === "risks") nodes = laid.filter((n) => n.risk);
    return new Set(nodes.map((n) => n.id));
  }, [filter, laid]);

  const visible = laid.filter((n) => visibleIds().has(n.id));
  const visibleEdges = (graph?.edges || []).filter(
    (e) => visibleIds().has(e.from) && visibleIds().has(e.to)
  );

  const nodeById = (id: string) => laid.find((n) => n.id === id);

  // Canvas height — bottom of last node + padding
  const canvasH = visible.length
    ? Math.max(...visible.map((n) => n.y! + NODE_H)) + 50
    : 300;

  return (
    <div className="arch-map" style={{ width: "100%", fontFamily: "inherit" }}>
      {/* ── Controls ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {(["all", "core", "data", "risks"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setSelected(null); }}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 6,
              border: "0.5px solid",
              borderColor: filter === f ? "var(--color-border-primary, #888)" : "var(--color-border-secondary, #ccc)",
              background: filter === f ? "var(--color-background-secondary, #f5f5f5)" : "transparent",
              cursor: "pointer",
              color: filter === f ? "var(--color-text-primary, #111)" : "var(--color-text-secondary, #666)",
              fontWeight: filter === f ? 500 : 400,
              transition: "all .15s",
            }}
          >
            {f === "all" ? "All services" : f === "risks" ? "Risks only" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        {/* Legend */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 11, color: "var(--color-text-tertiary, #999)", flexWrap: "wrap" }}>
          {[
            { color: "#378ADD", label: "client" },
            { color: "#1D9E75", label: "service" },
            { color: "#888780", label: "data" },
            { color: "#E24B4A", label: "risk" },
          ].map((l) => (
            <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
              {l.label}
            </span>
          ))}
        </div>

        <button
          onClick={() => setReplayKey(k => k + 1)}
          style={{
            fontSize: 11, padding: "4px 10px", borderRadius: 6,
            border: "0.5px solid var(--color-border-secondary, border-white/20)",
            background: "transparent", cursor: "pointer",
            color: "var(--color-text-secondary, #888)",
            transition: "all .15s",
            display: "flex", alignItems: "center", gap: 4
          }}
        >
          Replay
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>

        {onShare && (
          <button
            onClick={onShare}
            style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 6,
              border: "0.5px solid var(--color-border-info, #378ADD)",
              background: "var(--color-background-info, #E6F1FB)",
              color: "var(--color-text-info, #185FA5)", cursor: "pointer", fontWeight: 500,
            }}
          >
            Share map ↗
          </button>
        )}
      </div>

      {/* ── SVG Canvas ── */}
      <svg
        key={replayKey}
        width="100%"
        viewBox={`0 0 660 ${canvasH}`}
        style={{ display: "block", overflow: "visible" }}
        aria-label={`Architecture map for ${graph.repo}`}
      >
        <defs>
          <marker id="am-arrow" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>

          <style>{`
            @keyframes am-dash { to { stroke-dashoffset: -24; } }
            @keyframes am-node-in { from { opacity:0; transform:scale(.75); } to { opacity:1; transform:scale(1); } }
            @keyframes am-fade-in { from { opacity:0; } to { opacity:1; } }
            @keyframes am-risk-blink { 0%,100%{opacity:1} 50%{opacity:.35} }
            @keyframes am-risk-glow-anim {
              0%, 100% { stroke-width: 4; stroke-opacity: 0.2; }
              50% { stroke-width: 8; stroke-opacity: 0.8; }
            }
            .am-flow { stroke-dasharray:6 4; animation: am-dash 1.4s linear infinite; }
            .am-node { cursor:pointer; transition: opacity .15s; transform-origin: center; transform-box: fill-box; }
            .am-node:hover > rect { opacity:.88; }
            .am-risk-dot { animation: am-risk-blink 1.6s ease-in-out infinite; }
            .am-risk-glow-rect { animation: am-risk-glow-anim 1.5s ease-in-out infinite; fill: none; }
          `}</style>
        </defs>

        {/* Edges */}
        {visibleEdges.map((e, i) => {
          const a = nodeById(e.from);
          const b = nodeById(e.to);
          if (!a || !b) return null;
          return (
            <g key={`${e.from}-${e.to}`} style={{ opacity: 0, animation: `am-fade-in .4s ease ${i * 0.03}s forwards` }}>
              <path
                d={edgePath(a, b)}
                fill="none"
                stroke={e.flow ? FLOW_COLOR : STATIC_COLOR}
                strokeWidth={e.flow ? 1.2 : 0.7}
                markerEnd="url(#am-arrow)"
                className={e.flow ? "am-flow" : undefined}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {visible.map((n, i) => {
          const style = LAYER_STYLE[n.layer];
          const isRisk = n.risk;
          const isSelected = selected?.id === n.id;
          return (
            <g
              key={n.id}
              className="am-node"
              onClick={() => setSelected(selected?.id === n.id ? null : n)}
              onMouseEnter={(e) => {
                setHovered(n);
                setMousePos({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => {
                if (hovered?.id === n.id) {
                  setMousePos({ x: e.clientX, y: e.clientY });
                }
              }}
              onMouseLeave={() => setHovered(null)}
              style={{ animation: `am-node-in .35s ease ${i * 0.05}s both` }}
            >
              {isRisk && (
                <rect
                  x={n.x! - 2} y={n.y! - 2}
                  width={NODE_W + 4} height={NODE_H + 4}
                  rx={10}
                  stroke={RISK_STROKE}
                  className="am-risk-glow-rect"
                />
              )}
              <rect
                x={n.x} y={n.y}
                width={NODE_W} height={NODE_H}
                rx={8}
                fill={isRisk && filter === "risks" ? RISK_FILL : style.fill}
                stroke={isRisk ? RISK_STROKE : isSelected ? "#378ADD" : style.stroke}
                strokeWidth={isSelected ? 2 : isRisk ? 1.5 : 0.5}
              />
              {/* Node title */}
              <text
                x={n.x! + NODE_W / 2} y={n.y! + 16}
                textAnchor="middle" dominantBaseline="central"
                fontSize={12} fontWeight={500} fill={style.text}
              >
                {n.label}
              </text>
              {/* Node subtitle */}
              <text
                x={n.x! + NODE_W / 2} y={n.y! + 30}
                textAnchor="middle" dominantBaseline="central"
                fontSize={10} fill={style.text} opacity={0.65}
              >
                {n.sub}
              </text>
              {/* Risk indicator dot */}
              {isRisk && (
                <circle
                  cx={n.x! + NODE_W - 7} cy={n.y! + 7}
                  r={4} fill={RISK_STROKE}
                  className="am-risk-dot"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Info panel ── */}
      <div style={{
        marginTop: 10,
        background: "var(--color-background-secondary, #f5f5f5)",
        borderRadius: 10,
        padding: "12px 14px",
        fontSize: 12,
        color: "var(--color-text-secondary, #555)",
        border: "0.5px solid var(--color-border-tertiary, #ddd)",
        minHeight: 52,
        lineHeight: 1.6,
      }}>
        {selected ? (
          <>
            <span style={{ fontWeight: 500, color: "var(--color-text-primary, #111)" }}>
              {selected.label}
            </span>
            {selected.risk && (
              <span style={{ color: "#A32D2D", fontSize: 11, marginLeft: 6 }}>⚠ risk</span>
            )}
            <br />
            {selected.info}
            {selected.risk && selected.riskMsg && (
              <div style={{ color: "#A32D2D", fontSize: 11, marginTop: 4 }}>
                Risk: {selected.riskMsg}
              </div>
            )}
          </>
        ) : (
          "Click any node to learn what it does."
        )}
      </div>

      {/* ── Tooltip Overlay ── */}
      {hovered && (
        <div style={{
          position: "fixed",
          left: mousePos.x + 15,
          top: mousePos.y + 15,
          background: "rgba(10, 10, 10, 0.95)",
          backdropFilter: "blur(4px)",
          color: "#fff",
          padding: "10px 14px",
          borderRadius: "8px",
          fontSize: "12px",
          pointerEvents: "none",
          zIndex: 9999,
          maxWidth: "300px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          border: "1px solid rgba(255,255,255,0.1)"
        }}>
          <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "14px", color: "var(--color-primary, #60A5FA)" }}>
            {hovered.label}
          </div>
          <div style={{ opacity: 0.85, lineHeight: 1.4, marginBottom: (hovered.risk && hovered.riskMsg) ? "8px" : "0" }}>
            {hovered.info || "No additional information provided."}
          </div>
          {hovered.risk && hovered.riskMsg && (
            <div style={{
              color: "#FCA5A5",
              background: "rgba(226, 75, 74, 0.1)",
              padding: "6px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              border: "1px solid rgba(226, 75, 74, 0.2)"
            }}>
              <strong style={{ fontWeight: 600 }}>Risk:</strong> {hovered.riskMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
