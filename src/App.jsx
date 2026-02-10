import { useState, useEffect, useMemo, useCallback } from "react";
import "./App.css";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from "recharts";

// ── Utility functions (same as design reference) ──
const getScoreColor = (score) => {
  if (score >= 0.5) return "#22c55e";
  if (score >= 0.2) return "#4ade80";
  if (score >= 0.05) return "#a3a3a3";
  if (score >= -0.05) return "#a3a3a3";
  if (score >= -0.2) return "#f87171";
  if (score >= -0.5) return "#ef4444";
  return "#dc2626";
};

const getSignalLabel = (score) => {
  if (score >= 0.5) return "STRONG BUY";
  if (score >= 0.2) return "BUY";
  if (score >= 0.05) return "LEAN LONG";
  if (score >= -0.05) return "NEUTRAL";
  if (score >= -0.2) return "LEAN SHORT";
  if (score >= -0.5) return "SELL";
  return "STRONG SELL";
};

const getSeverityColor = (severity) => {
  if (severity === "high") return "#ef4444";
  if (severity === "medium") return "#f59e0b";
  return "#6b7280";
};

const getSeverityBg = (severity) => {
  if (severity === "high") return "rgba(239, 68, 68, 0.08)";
  if (severity === "medium") return "rgba(245, 158, 11, 0.08)";
  return "rgba(107, 114, 128, 0.06)";
};

// ── Custom Tooltip ──
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: "#9ca3af", marginBottom: 4 }}>{payload[0]?.payload?.fullDate || label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
            {typeof p.value === "number" ? p.value.toFixed(p.name === "SPY" ? 2 : 3) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Factor Bar Component ──
const FactorBar = ({ factor, isExpanded, onToggle }) => {
  const barWidth = Math.abs(factor.score) * 100;
  const barColor = factor.score >= 0 ? "#22c55e" : "#ef4444";
  const weightedColor = factor.weighted >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", background: isExpanded ? "rgba(255,255,255,0.03)" : "transparent",
          border: "none", padding: "10px 12px", cursor: "pointer", borderRadius: 6,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = isExpanded ? "rgba(255,255,255,0.03)" : "transparent")}
      >
        <div className="factor-bar-inner" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="factor-label" style={{ width: 130, textAlign: "left" }}>
            <div style={{ fontSize: 13, color: "#e5e5e5", fontWeight: 500 }}>{factor.label}</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>{(factor.weight * 100).toFixed(0)}% weight</div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 20, background: "#1a1a2e", borderRadius: 3, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#333" }} />
              <div
                style={{
                  position: "absolute",
                  top: 3, bottom: 3,
                  left: factor.score >= 0 ? "50%" : `${50 - barWidth / 2}%`,
                  width: `${barWidth / 2}%`,
                  background: barColor,
                  borderRadius: 2,
                  opacity: 0.7,
                  transition: "all 0.3s ease",
                }}
              />
            </div>
          </div>
          <div className="factor-score" style={{ width: 65, textAlign: "right", fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: barColor }}>
            {factor.score >= 0 ? "+" : ""}{factor.score.toFixed(2)}
          </div>
          <div className="factor-weighted" style={{ width: 65, textAlign: "right", fontFamily: "monospace", fontSize: 11, color: weightedColor, opacity: 0.7 }}>
            w: {factor.weighted >= 0 ? "+" : ""}{factor.weighted.toFixed(3)}
          </div>
          <div style={{ width: 16, color: "#555", fontSize: 10, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
            &#9660;
          </div>
        </div>
      </button>
      {isExpanded && factor.signals && (
        <div className="factor-expand-content" style={{ padding: "4px 12px 12px 154px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#6b7280", borderBottom: "1px solid #222" }}>
                <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 500 }}>Signal</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 500 }}>Value</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 500 }}>Z-Score</th>
                <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 500 }}>Reading</th>
              </tr>
            </thead>
            <tbody>
              {factor.signals.map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "5px 8px", color: "#d4d4d4" }}>{s.name}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", color: "#e5e5e5" }}>
                    {s.value != null ? (Math.abs(s.value) > 1000 ? s.value.toLocaleString() : Number(s.value).toFixed(2)) : "N/A"}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", color: (s.zScore || 0) >= 0 ? "#4ade80" : "#f87171" }}>
                    {s.zScore != null ? `${s.zScore >= 0 ? "+" : ""}${Number(s.zScore).toFixed(2)}` : "N/A"}
                  </td>
                  <td style={{ padding: "5px 8px", color: "#9ca3af", fontSize: 11 }}>{s.interpretation || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Main Dashboard ──
export default function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [liveData, setLiveData] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [expandedFactor, setExpandedFactor] = useState(null);
  const [chartView, setChartView] = useState("composite");
  const [timeRange, setTimeRange] = useState("1M");
  const [logFilter, setLogFilter] = useState("all");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const [latestRes, histRes, logRes, statusRes] = await Promise.all([
        fetch("/data/latest.json"),
        fetch("/data/history.json"),
        fetch("/data/log.json"),
        fetch("/data/status.json"),
      ]);
      const latest = await latestRes.json();
      const hist = await histRes.json();
      const log = await logRes.json();
      const st = await statusRes.json();

      if (!latest.error) setData(latest);
      if (hist.data) {
        setHistory(hist.data.map((d) => {
          const dt = new Date(d.date);
          return {
            ...d,
            date: `${dt.getMonth() + 1}/${dt.getDate()}`,
            fullDate: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            composite: d.composite,
            spy: d.spyPrice,
          };
        }));
      }
      if (log.entries) setActivityLog(log.entries);
      setStatus(st);
    } catch (e) {
      console.error("Failed to fetch data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // SSE live stream — only connect if running locally (not static deploy)
    let evtSource = null;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      evtSource = new EventSource("/api/stream");
      evtSource.onmessage = (event) => {
        try {
          const tick = JSON.parse(event.data);
          setLiveData(tick);
        } catch (e) {
          // ignore parse errors
        }
      };
      evtSource.onerror = () => {
        console.log("SSE reconnecting...");
      };
    }

    // Auto-refresh every 5 minutes during market hours
    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 9 && hour <= 16) {
        fetchData();
      }
    }, 5 * 60 * 1000);

    return () => {
      if (evtSource) evtSource.close();
      clearInterval(interval);
    };
  }, [fetchData]);

  // Merge live data with EOD data for display
  const displayPrice = liveData?.spy_price || data?.spyPrice;
  const displayChange = liveData?.spy_change || data?.spyChange;
  const displayChangePct = liveData?.spy_change_pct || data?.spyChangePct;
  const composite = data?.composite || 0;
  const compositeColor = getScoreColor(composite);
  const signalLabel = data?.signal ? data.signal.replace(/_/g, " ") : getSignalLabel(composite);
  const confidence = data?.confidence || 0;

  const factors = data?.factors || {};
  const alerts = data?.alerts || [];

  const factorBarData = Object.entries(factors).map(([key, f]) => ({
    name: f.label,
    score: f.score,
    weighted: f.weighted,
    fill: f.score >= 0 ? "#22c55e" : "#ef4444",
  }));

  const lastUpdate = data?.lastUpdate || "N/A";
  const lastTick = liveData?.last_tick || "N/A";

  if (loading) {
    return (
      <div style={{ background: "#0d0d1a", color: "#e5e5e5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
            <span style={{ color: "#818cf8" }}>SPY</span> Prediction System
          </div>
          <div style={{ color: "#6b7280" }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div style={{ background: "#0d0d1a", color: "#e5e5e5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
            <span style={{ color: "#818cf8" }}>SPY</span> Prediction System
          </div>
          <div style={{ color: "#6b7280", marginBottom: 16 }}>No data available yet.</div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>
            Run the daily collection script first:<br />
            <code style={{ background: "#1a1a2e", padding: "4px 8px", borderRadius: 4, fontSize: 12 }}>
              python webapp/collect.py
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0d0d1a", color: "#e5e5e5", minHeight: "100vh", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Header ── */}
      <div className="header-bar" style={{ borderBottom: "1px solid #1a1a2e", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="header-left" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px" }}>
            <span style={{ color: "#818cf8" }}>SPY</span> Prediction System
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", background: "#1a1a2e", padding: "3px 10px", borderRadius: 4 }}>
            Multi-Factor Model v1.0
          </div>
        </div>
        <div className="header-status" style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#1a1a2e", padding: "5px 12px", borderRadius: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
              boxShadow: "0 0 6px rgba(34,197,94,0.5)", animation: "pulse 2s ease-in-out infinite",
            }} />
            <span style={{ color: "#6b7280" }}>EOD:</span>
            <span style={{ color: "#a3a3a3", fontFamily: "monospace", fontSize: 11 }}>{lastUpdate}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#1a1a2e", padding: "5px 12px", borderRadius: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: liveData?.spy_price ? "#818cf8" : "#555",
              boxShadow: liveData?.spy_price ? "0 0 6px rgba(129,140,248,0.5)" : "none",
              animation: liveData?.spy_price ? "pulse 3s ease-in-out infinite" : "none",
            }} />
            <span style={{ color: "#6b7280" }}>Live:</span>
            <span style={{ color: "#a3a3a3", fontFamily: "monospace", fontSize: 11 }}>
              {lastTick !== "N/A" ? lastTick : "Not connected"}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "320px 1fr 280px", gap: 20, maxWidth: 1440, margin: "0 auto" }}>
        {/* ── Left: Score + SPY ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Composite Score Card */}
          <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Composite Signal</div>
            <div className="score-display" style={{ fontSize: 56, fontWeight: 700, fontFamily: "monospace", color: compositeColor, lineHeight: 1, marginBottom: 6 }}>
              {composite >= 0 ? "+" : ""}{composite.toFixed(2)}
            </div>
            <div style={{
              display: "inline-block", padding: "4px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600,
              letterSpacing: 1, color: compositeColor, background: `${compositeColor}15`, border: `1px solid ${compositeColor}30`,
            }}>
              {signalLabel}
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Confidence</div>
                <div style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 600, color: "#a3a3a3" }}>{(confidence * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Horizon</div>
                <div style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 600, color: "#a3a3a3" }}>1-5D</div>
              </div>
            </div>
            <div style={{ marginTop: 16, position: "relative", height: 8, background: "#1a1a2e", borderRadius: 4 }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4,
                background: "linear-gradient(90deg, #ef4444 0%, #f59e0b 30%, #a3a3a3 50%, #4ade80 70%, #22c55e 100%)",
                width: "100%", opacity: 0.3,
              }} />
              <div style={{
                position: "absolute", top: -3, width: 14, height: 14, borderRadius: "50%",
                background: compositeColor, border: "2px solid #0d0d1a",
                left: `${((composite + 1) / 2) * 100}%`, transform: "translateX(-50%)",
                boxShadow: `0 0 8px ${compositeColor}60`,
              }} />
              <div style={{ position: "absolute", bottom: -16, left: 0, fontSize: 9, color: "#6b7280" }}>-1.0</div>
              <div style={{ position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#6b7280" }}>0</div>
              <div style={{ position: "absolute", bottom: -16, right: 0, fontSize: 9, color: "#6b7280" }}>+1.0</div>
            </div>
          </div>

          {/* SPY Price Card */}
          <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>SPY</div>
                <div className="spy-price" style={{ fontSize: 32, fontWeight: 700, fontFamily: "monospace" }}>
                  ${displayPrice ? Number(displayPrice).toFixed(2) : "---"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 600, color: (displayChange || 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                  {displayChange != null ? `${displayChange >= 0 ? "+" : ""}${Number(displayChange).toFixed(2)}` : "---"}
                </div>
                <div style={{ fontSize: 12, fontFamily: "monospace", color: (displayChangePct || 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                  {displayChangePct != null ? `(${displayChangePct >= 0 ? "+" : ""}${Number(displayChangePct).toFixed(2)}%)` : ""}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, height: 80 }}>
              {history.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.slice(-20)}>
                    <defs>
                      <linearGradient id="spyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="spy" stroke="#818cf8" fill="url(#spyGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Factor Contribution Chart */}
          {factorBarData.length > 0 && (
            <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>Weighted Contribution</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={factorBarData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                    <XAxis type="number" domain={[-0.06, 0.06]} tickFormatter={(v) => v.toFixed(2)} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11, fill: "#a3a3a3" }} axisLine={false} tickLine={false} />
                    <ReferenceLine x={0} stroke="#333" />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="weighted" radius={[0, 3, 3, 0]} barSize={16}>
                      {factorBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.weighted >= 0 ? "#22c55e" : "#ef4444"} opacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Live Market Data */}
          {liveData && liveData.vix && (
            <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Live Market</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                {[
                  ["VIX", liveData.vix],
                  ["VIX/VIX3M", liveData.vix_ratio],
                  ["10Y Yield", liveData.us10y ? `${liveData.us10y}%` : null],
                  ["2s10s", liveData.spread_2s10s ? `${liveData.spread_2s10s}%` : null],
                  ["HYG", liveData.hyg ? `$${Number(liveData.hyg).toFixed(2)}` : null],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#6b7280" }}>{label}</span>
                    <span style={{ color: "#a3a3a3", fontFamily: "monospace" }}>{value ?? "---"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Center: Charts + Factor Breakdown ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Chart Area */}
          <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: 20 }}>
            <div className="chart-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {["composite", "spy", "overlay"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setChartView(v)}
                    style={{
                      background: chartView === v ? "#2a2a4a" : "transparent",
                      color: chartView === v ? "#e5e5e5" : "#6b7280",
                      border: "1px solid", borderColor: chartView === v ? "#3a3a5a" : "transparent",
                      padding: "5px 14px", borderRadius: 5, fontSize: 12, cursor: "pointer",
                      fontWeight: chartView === v ? 600 : 400, transition: "all 0.15s",
                    }}
                  >
                    {v === "composite" ? "Signal" : v === "spy" ? "SPY Price" : "Overlay"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["2W", "1M", "3M"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    style={{
                      background: timeRange === r ? "#2a2a4a" : "transparent",
                      color: timeRange === r ? "#e5e5e5" : "#6b7280",
                      border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                      fontWeight: timeRange === r ? 600 : 400,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 260 }}>
              {history.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === "composite" ? (
                    <AreaChart data={timeRange === "2W" ? history.slice(-10) : timeRange === "1M" ? history.slice(-22) : history}>
                      <defs>
                        <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
                      <ReferenceLine y={0.5} stroke="#22c55e" strokeDasharray="2 4" strokeOpacity={0.3} />
                      <ReferenceLine y={-0.5} stroke="#ef4444" strokeDasharray="2 4" strokeOpacity={0.3} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="composite" name="Signal" stroke="#818cf8" fill="url(#posGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#818cf8" }} />
                    </AreaChart>
                  ) : chartView === "spy" ? (
                    <AreaChart data={timeRange === "2W" ? history.slice(-10) : timeRange === "1M" ? history.slice(-22) : history}>
                      <defs>
                        <linearGradient id="spyGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis domain={["dataMin - 5", "dataMax + 5"]} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="spy" name="SPY" stroke="#818cf8" fill="url(#spyGrad2)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#818cf8" }} />
                    </AreaChart>
                  ) : (
                    <LineChart data={timeRange === "2W" ? history.slice(-10) : timeRange === "1M" ? history.slice(-22) : history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="score" domain={[-1, 1]} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="price" orientation="right" domain={["dataMin - 5", "dataMax + 5"]} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <ReferenceLine yAxisId="score" y={0} stroke="#333" strokeDasharray="3 3" />
                      <Tooltip content={<ChartTooltip />} />
                      <Line yAxisId="score" type="monotone" dataKey="composite" name="Signal" stroke="#818cf8" strokeWidth={2} dot={false} />
                      <Line yAxisId="price" type="monotone" dataKey="spy" name="SPY" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Factor Breakdown */}
          <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: "16px 8px", flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, paddingLeft: 12 }}>
              Factor Breakdown
            </div>
            {Object.entries(factors).map(([key, factor]) => (
              <FactorBar
                key={key}
                factor={factor}
                isExpanded={expandedFactor === key}
                onToggle={() => setExpandedFactor(expandedFactor === key ? null : key)}
              />
            ))}
          </div>
        </div>

        {/* ── Right: Alerts + Stats + Activity Log ── */}
        <div className="dashboard-right" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Alerts */}
          <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>Active Alerts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.length > 0 ? alerts.map((alert, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px", borderRadius: 6, fontSize: 12,
                    background: getSeverityBg(alert.severity),
                    borderLeft: `3px solid ${getSeverityColor(alert.severity)}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 9, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.8,
                      color: getSeverityColor(alert.severity),
                    }}>
                      {alert.type}
                    </span>
                  </div>
                  <div style={{ color: "#d4d4d4", lineHeight: 1.4 }}>{alert.text}</div>
                </div>
              )) : (
                <div style={{ color: "#6b7280", fontSize: 12 }}>No active alerts</div>
              )}
            </div>
          </div>

          {/* Factor Scores Summary */}
          <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>Factor Scores</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(factors).map(([key, f]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ fontSize: 12, color: "#a3a3a3" }}>{f.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 32, height: 4, borderRadius: 2, background: "#1a1a2e",
                      position: "relative", overflow: "hidden",
                    }}>
                      <div style={{
                        position: "absolute", top: 0, bottom: 0,
                        left: f.score >= 0 ? "50%" : `${50 + f.score * 50}%`,
                        width: `${Math.abs(f.score) * 50}%`,
                        background: f.score >= 0 ? "#22c55e" : "#ef4444",
                        borderRadius: 2,
                      }} />
                    </div>
                    <span style={{
                      fontSize: 13, fontFamily: "monospace", fontWeight: 600, width: 42, textAlign: "right",
                      color: f.score >= 0 ? "#4ade80" : "#f87171",
                    }}>
                      {f.score >= 0 ? "+" : ""}{f.score.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1.2 }}>Activity Log</div>
              <div style={{ display: "flex", gap: 4 }}>
                {["all", "eod", "intraday", "system"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    style={{
                      background: logFilter === f ? "#2a2a4a" : "transparent",
                      color: logFilter === f ? "#e5e5e5" : "#555",
                      border: "none", padding: "2px 8px", borderRadius: 3, fontSize: 10, cursor: "pointer",
                      textTransform: "uppercase", letterSpacing: 0.5,
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
              {activityLog
                .filter((e) => logFilter === "all" || e.type === logFilter)
                .map((entry, i) => {
                  const statusColor = entry.status === "ok" ? "#22c55e" : entry.status === "warn" ? "#f59e0b" : "#ef4444";
                  const isEOD = entry.type === "eod";
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "6px 8px", borderRadius: 4, fontSize: 11,
                        background: i === 0 ? "rgba(129,140,248,0.05)" : "transparent",
                        borderLeft: i === 0 ? "2px solid #818cf8" : "2px solid transparent",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                          <span style={{ fontFamily: "monospace", color: "#6b7280", fontSize: 10 }}>
                            {(entry.time || "").split(" ")[1] || ""}
                          </span>
                          <span style={{
                            fontSize: 9, padding: "1px 5px", borderRadius: 2, fontWeight: 600, letterSpacing: 0.5,
                            background: isEOD ? "rgba(129,140,248,0.12)" : "rgba(107,114,128,0.12)",
                            color: isEOD ? "#818cf8" : "#6b7280",
                          }}>
                            {(entry.type || "").toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontFamily: "monospace", color: "#555", fontSize: 10 }}>{entry.duration || ""}</span>
                      </div>
                      <div style={{ color: "#9ca3af", fontSize: 11, paddingLeft: 11 }}>{entry.message || ""}</div>
                      {i === 0 && entry.time && (
                        <div style={{ color: "#555", fontSize: 9, paddingLeft: 11, marginTop: 2 }}>
                          {entry.time.split(" ")[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
              {activityLog.length === 0 && (
                <div style={{ color: "#555", fontSize: 11, padding: 8 }}>No activity logged yet</div>
              )}
            </div>
          </div>

          {/* Model Info */}
          <div style={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>Model Info</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              {[
                ["Factors", "6"],
                ["Sub-signals", "22"],
                ["Refresh", "Live stream + EOD"],
                ["Lookback", "60 days"],
                ["Normalization", "Z-score (60d)"],
                ["DB Records", status?.totalRecords?.toLocaleString() || "0"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>{label}</span>
                  <span style={{ color: "#a3a3a3", fontFamily: "monospace" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: 10, color: "#4a4a6a", lineHeight: 1.5, padding: "0 4px" }}>
            For educational and research purposes only. Not financial advice. Past signals do not guarantee future performance.
          </div>
        </div>
      </div>
    </div>
  );
}
