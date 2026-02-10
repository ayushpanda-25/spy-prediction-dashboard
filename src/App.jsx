import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from "recharts";

// ── Bloomberg Terminal Design Tokens ──
const T = {
  bg: "#0a0a0a",
  panel: "#111111",
  panelHeader: "#1a1a1a",
  inset: "#0d0d0d",
  border: "#2a2a2a",
  amber: "#ff9500",
  amberDim: "#cc7700",
  green: "#00d26a",
  greenDim: "#00a854",
  red: "#ff3b3b",
  text: "#e0e0e0",
  textDim: "#707070",
  font: "'JetBrains Mono', monospace",
  radius: 4,
};

// ── Utility functions ──
const getScoreColor = (score) => {
  if (score >= 0.5) return T.green;
  if (score >= 0.2) return T.greenDim;
  if (score >= 0.05) return T.textDim;
  if (score >= -0.05) return T.textDim;
  if (score >= -0.2) return "#ff6b6b";
  if (score >= -0.5) return T.red;
  return T.red;
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
  if (severity === "high") return T.red;
  if (severity === "medium") return T.amber;
  return T.textDim;
};

const getSeverityBg = (severity) => {
  if (severity === "high") return "rgba(255, 59, 59, 0.08)";
  if (severity === "medium") return "rgba(255, 149, 0, 0.08)";
  return "rgba(107, 114, 128, 0.06)";
};

// ── Panel Component (Bloomberg style) ──
const Panel = ({ title, tag, children, style = {}, contentStyle = {} }) => (
  <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden", ...style }}>
    {title && (
      <div style={{ padding: "0.75rem 1rem", background: T.panelHeader, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: T.amber, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{title}</div>
        {tag && (
          <div style={{ fontSize: 10, padding: "0.2rem 0.5rem", borderRadius: 2, background: "rgba(255,149,0,0.15)", color: T.amber }}>{tag}</div>
        )}
      </div>
    )}
    <div style={{ padding: "1rem", ...contentStyle }}>{children}</div>
  </div>
);

// ── Custom Tooltip ──
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "8px 12px", fontSize: 12, fontFamily: T.font }}>
      <div style={{ color: T.textDim, marginBottom: 4 }}>{payload[0]?.payload?.fullDate || label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>
            {typeof p.value === "number" ? p.value.toFixed(p.name === "SPY" ? 2 : 3) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Factor Bar Component ──
const FactorBar = ({ factor, isExpanded, onToggle, allZero }) => {
  const barWidth = Math.abs(factor.score) * 100;
  const barColor = factor.score !== 0 ? (factor.score >= 0 ? T.green : T.red) : T.textDim;
  const weightedColor = factor.weighted !== 0 ? (factor.weighted >= 0 ? T.green : T.red) : T.textDim;

  // Count signals with real values (non-null)
  const signalsWithValues = factor.signals ? factor.signals.filter((s) => s.value != null).length : 0;
  const totalSignals = factor.signals ? factor.signals.length : 0;

  // Get a preview snippet of key signal values
  const previewSignals = factor.signals
    ? factor.signals.filter((s) => s.value != null && s.interpretation).slice(0, 2)
    : [];

  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", background: isExpanded ? "rgba(255,255,255,0.03)" : "transparent",
          border: "none", padding: "10px 12px", cursor: "pointer", borderRadius: T.radius,
          transition: "background 0.2s", fontFamily: T.font,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = isExpanded ? "rgba(255,255,255,0.03)" : "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 130, textAlign: "left" }}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{factor.label}</div>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>
              {(factor.weight * 100).toFixed(0)}% weight · {signalsWithValues}/{totalSignals} signals
            </div>
          </div>
          <div style={{ flex: 1, height: 6, background: T.panelHeader, borderRadius: 3, position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0,
              left: factor.score >= 0 ? "50%" : `${50 - barWidth / 2}%`,
              width: `${barWidth / 2}%`,
              background: barColor, borderRadius: 3, transition: "all 0.3s",
            }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: T.border }} />
          </div>
          <div style={{ width: 48, textAlign: "right", fontFamily: T.font, fontSize: 13, fontWeight: 600, color: barColor }}>
            {factor.score >= 0 ? "+" : ""}{factor.score.toFixed(2)}
          </div>
          <div style={{ width: 48, textAlign: "right", fontFamily: T.font, fontSize: 11, color: weightedColor, opacity: 0.7 }}>
            {factor.weighted >= 0 ? "+" : ""}{factor.weighted.toFixed(3)}
          </div>
          <div style={{ color: T.textDim, fontSize: 10, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</div>
        </div>
        {/* Show preview of raw values when collapsed and scores are zero */}
        {!isExpanded && allZero && previewSignals.length > 0 && (
          <div style={{ display: "flex", gap: 8, paddingTop: 6, paddingLeft: 130 + 12, flexWrap: "wrap" }}>
            {previewSignals.map((s, i) => (
              <span key={i} style={{ fontSize: 10, color: T.textDim, background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: 2 }}>
                {s.name}: <span style={{ color: T.text }}>{typeof s.value === "number" ? (Math.abs(s.value) > 100 ? s.value.toLocaleString() : s.value.toFixed(2)) : s.value}</span>
              </span>
            ))}
          </div>
        )}
      </button>
      {isExpanded && factor.signals && (
        <div style={{ padding: "8px 12px 12px", background: T.inset, borderTop: `1px solid ${T.border}`, margin: "0 8px 8px", borderRadius: T.radius }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: T.font }}>
            <thead>
              <tr style={{ color: T.textDim, textAlign: "left" }}>
                <th style={{ padding: "4px 8px", fontWeight: 500 }}>Signal</th>
                <th style={{ padding: "4px 8px", fontWeight: 500, textAlign: "right" }}>Raw Value</th>
                <th style={{ padding: "4px 8px", fontWeight: 500, textAlign: "right" }}>Z-Score</th>
                <th style={{ padding: "4px 8px", fontWeight: 500 }}>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {factor.signals.map((s, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "5px 8px", color: T.text }}>{s.name}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", color: s.value != null ? T.text : T.textDim, fontWeight: s.value != null ? 500 : 400 }}>
                    {s.value != null ? (typeof s.value === "number" ? (Math.abs(s.value) > 100 ? s.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : s.value.toFixed(4)) : s.value) : "—"}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", color: s.zScore > 0.5 ? T.green : s.zScore < -0.5 ? T.red : T.textDim }}>
                    {s.zScore ? s.zScore.toFixed(2) : "—"}
                  </td>
                  <td style={{ padding: "5px 8px", color: s.interpretation ? T.text : T.textDim, fontSize: 10 }}>{s.interpretation || "—"}</td>
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
  const [activityLog, setActivityLog] = useState([]);
  const [expandedFactor, setExpandedFactor] = useState(null);
  // Default to SPY price view when composite scores are all zero (insufficient history for z-scores)
  const [chartView, setChartView] = useState("spy");
  const [timeRange, setTimeRange] = useState("1M");
  const [logFilter, setLogFilter] = useState("all");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportedAt, setExportedAt] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [liveError, setLiveError] = useState(false);
  const [backtest, setBacktest] = useState(null);

  // Fetch live market data from serverless function
  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/live");
      if (res.ok) {
        const live = await res.json();
        setLiveData(live);
        setLiveError(false);
      }
    } catch {
      setLiveError(true);
    }
  }, []);

  // Poll live data every 60 seconds during market hours
  useEffect(() => {
    fetchLive(); // initial fetch
    const interval = setInterval(() => {
      const now = new Date();
      const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const hour = et.getHours();
      const day = et.getDay();
      // Poll during extended hours (8am-6pm ET, Mon-Fri)
      if (day >= 1 && day <= 5 && hour >= 8 && hour <= 18) {
        fetchLive();
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  // Fetch data from static JSON files
  const fetchData = useCallback(async () => {
    try {
      const [latestRes, histRes, logRes, statusRes, btRes] = await Promise.all([
        fetch("/data/latest.json"),
        fetch("/data/history.json"),
        fetch("/data/log.json"),
        fetch("/data/status.json"),
        fetch("/data/backtest.json").catch(() => null),
      ]);
      const latest = await latestRes.json();
      const hist = await histRes.json();
      const log = await logRes.json();
      const st = await statusRes.json();
      if (btRes && btRes.ok) {
        const bt = await btRes.json();
        setBacktest(bt);
      }

      if (!latest.error) setData(latest);
      if (latest.exportedAt) setExportedAt(latest.exportedAt);
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
  }, [fetchData]);

  // Auto-switch to composite view once real scores exist
  useEffect(() => {
    if (history.length > 0 && history.some((d) => d.composite !== 0)) {
      setChartView("composite");
    }
  }, [history]);

  // Derived display values — live overrides EOD when available
  const displayPrice = liveData?.spy_price || data?.spyPrice;
  const displayChange = liveData?.spy_change || data?.spyChange;
  const displayChangePct = liveData?.spy_change_pct || data?.spyChangePct;
  const isLive = liveData?.marketOpen && liveData?.spy_price;
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
    fill: f.score >= 0 ? T.green : T.red,
  }));

  const lastUpdate = data?.lastUpdate || "N/A";
  const dataAsOf = exportedAt
    ? new Date(exportedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : lastUpdate;

  if (loading) {
    return (
      <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: "0.1em" }}>
            <span style={{ color: T.amber }}>SPY PREDICTION</span>
          </div>
          <div style={{ color: T.textDim, fontSize: 12 }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: "0.1em" }}>
            <span style={{ color: T.amber }}>SPY PREDICTION</span>
          </div>
          <div style={{ color: T.textDim, marginBottom: 16, fontSize: 12 }}>No data available yet.</div>
          <div style={{ color: T.text, fontSize: 12 }}>
            Run the daily collection script first:<br />
            <code style={{ background: T.panelHeader, padding: "4px 8px", borderRadius: T.radius, fontSize: 11, border: `1px solid ${T.border}` }}>
              python webapp/collect.py
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: T.font }}>
      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0.5rem 1.5rem", background: T.panel, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: T.amber }}>
            SPY PREDICTION
          </div>
          <div style={{ fontSize: 11, color: T.textDim }}>
            MULTI-FACTOR MODEL
          </div>
          <div style={{ fontSize: 10, padding: "0.2rem 0.5rem", borderRadius: 2, background: "rgba(255,149,0,0.15)", color: T.amber }}>
            v1.0
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
          {isLive && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%", background: T.green,
                animation: "pulse 2s infinite",
              }} />
              <span style={{ color: T.green, fontWeight: 700, fontSize: 10, letterSpacing: "0.05em" }}>LIVE</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isLive ? T.green : liveData ? T.amber : T.textDim,
              animation: isLive ? "pulse 2s infinite" : "none",
            }} />
            <span style={{ color: T.textDim }}>UPDATED</span>
            <span style={{ color: T.text, fontSize: 11 }}>
              {isLive ? new Date(liveData.last_tick).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : dataAsOf}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "320px 1fr 280px", gap: "1.5rem", maxWidth: 1440, margin: "0 auto" }}>
        {/* ── Left: Score + SPY ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Composite Score Card */}
          <Panel title="Composite Signal" tag={Object.values(factors).some((f) => f.score === 0) ? `${Object.values(factors).filter((f) => f.score !== 0).length}/${Object.keys(factors).length} ACTIVE` : undefined}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 56, fontWeight: 700, color: compositeColor, lineHeight: 1, marginBottom: 6 }}>
                {composite >= 0 ? "+" : ""}{composite.toFixed(2)}
              </div>
              <div style={{
                display: "inline-block", padding: "4px 16px", borderRadius: 2, fontSize: 12, fontWeight: 700,
                letterSpacing: "0.05em", color: compositeColor, background: `${compositeColor}15`, border: `1px solid ${compositeColor}30`,
              }}>
                {signalLabel}
              </div>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 10, color: T.textDim }}>CONFIDENCE</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{(confidence * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: T.textDim }}>HORIZON</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>1-5D</div>
                </div>
              </div>
              <div style={{ marginTop: 16, position: "relative", height: 8, background: T.panelHeader, borderRadius: T.radius }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: T.radius,
                  background: `linear-gradient(90deg, ${T.red} 0%, ${T.amber} 30%, ${T.textDim} 50%, ${T.greenDim} 70%, ${T.green} 100%)`,
                  width: "100%", opacity: 0.3,
                }} />
                <div style={{
                  position: "absolute", top: -3, width: 14, height: 14, borderRadius: "50%",
                  background: compositeColor, border: `2px solid ${T.bg}`,
                  left: `${((composite + 1) / 2) * 100}%`, transform: "translateX(-50%)",
                  boxShadow: `0 0 8px ${compositeColor}60`,
                }} />
                <div style={{ position: "absolute", bottom: -16, left: 0, fontSize: 9, color: T.textDim }}>-1.0</div>
                <div style={{ position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: T.textDim }}>0</div>
                <div style={{ position: "absolute", bottom: -16, right: 0, fontSize: 9, color: T.textDim }}>+1.0</div>
              </div>
            </div>
          </Panel>

          {/* SPY Price Card */}
          <Panel title="SPY">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700 }}>
                  ${displayPrice ? Number(displayPrice).toFixed(2) : "---"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: (displayChange || 0) >= 0 ? T.green : T.red }}>
                  {displayChange != null ? `${displayChange >= 0 ? "+" : ""}${Number(displayChange).toFixed(2)}` : "---"}
                </div>
                <div style={{ fontSize: 12, color: (displayChangePct || 0) >= 0 ? T.green : T.red }}>
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
                        <stop offset="0%" stopColor={T.amber} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={T.amber} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={["dataMin - 2", "dataMax + 2"]} hide />
                    <Area type="monotone" dataKey="spy" stroke={T.amber} fill="url(#spyGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          {/* Factor Contribution Chart */}
          {factorBarData.length > 0 && (
            <Panel title="Weighted Contribution">
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={factorBarData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                    <XAxis type="number" domain={[-0.06, 0.06]} tickFormatter={(v) => v.toFixed(2)} tick={{ fontSize: 10, fill: T.textDim, fontFamily: T.font }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11, fill: T.text, fontFamily: T.font }} axisLine={false} tickLine={false} />
                    <ReferenceLine x={0} stroke={T.border} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="weighted" radius={[0, 3, 3, 0]} barSize={16}>
                      {factorBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.weighted >= 0 ? T.green : T.red} opacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          {/* Live Market Data */}
          {liveData && liveData.spy_price && (
            <Panel title="Live Market" tag={isLive ? "LIVE" : "CLOSED"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                {[
                  ["SPY", liveData.spy_price, liveData.spy_change_pct],
                  ["QQQ", liveData.qqq, liveData.qqq_change],
                  ["HYG", liveData.hyg, liveData.hyg_change],
                  ["TLT", liveData.tlt, liveData.tlt_change],
                  ["GLD", liveData.gld, liveData.gld_change],
                ].map(([label, price, change]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: T.textDim }}>{label}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: T.text }}>{price != null ? `$${Number(price).toFixed(2)}` : "---"}</span>
                      {change != null && (
                        <span style={{ color: change >= 0 ? T.green : T.red, fontSize: 10 }}>
                          {change >= 0 ? "+" : ""}{Number(change).toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ── Center: Charts + Factor Breakdown ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Chart Area */}
          <Panel title="Signal Chart" tag={data?.date}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {["composite", "spy", "overlay"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setChartView(v)}
                    style={{
                      background: chartView === v ? T.panelHeader : "transparent",
                      color: chartView === v ? T.amber : T.textDim,
                      border: `1px solid ${chartView === v ? T.border : "transparent"}`,
                      padding: "5px 14px", borderRadius: 2, fontSize: 11, cursor: "pointer",
                      fontWeight: chartView === v ? 700 : 400, transition: "all 0.2s",
                      fontFamily: T.font, letterSpacing: "0.02em",
                    }}
                  >
                    {v === "composite" ? "SIGNAL" : v === "spy" ? "SPY PRICE" : "OVERLAY"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["2W", "1M", "3M"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    style={{
                      background: timeRange === r ? T.panelHeader : "transparent",
                      color: timeRange === r ? T.amber : T.textDim,
                      border: "none", padding: "4px 10px", borderRadius: 2, fontSize: 10, cursor: "pointer",
                      fontWeight: timeRange === r ? 700 : 400, fontFamily: T.font,
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
                          <stop offset="0%" stopColor={T.amber} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={T.amber} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.textDim, fontFamily: T.font }} axisLine={false} tickLine={false} />
                      <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={{ fontSize: 10, fill: T.textDim, fontFamily: T.font }} axisLine={false} tickLine={false} />
                      <ReferenceLine y={0} stroke={T.border} strokeDasharray="3 3" />
                      <ReferenceLine y={0.5} stroke={T.green} strokeDasharray="2 4" strokeOpacity={0.3} />
                      <ReferenceLine y={-0.5} stroke={T.red} strokeDasharray="2 4" strokeOpacity={0.3} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="composite" name="Signal" stroke={T.amber} fill="url(#posGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: T.amber }} />
                    </AreaChart>
                  ) : chartView === "spy" ? (
                    <AreaChart data={timeRange === "2W" ? history.slice(-10) : timeRange === "1M" ? history.slice(-22) : history}>
                      <defs>
                        <linearGradient id="spyGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.amber} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={T.amber} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.textDim, fontFamily: T.font }} axisLine={false} tickLine={false} />
                      <YAxis domain={["dataMin - 5", "dataMax + 5"]} tick={{ fontSize: 10, fill: T.textDim, fontFamily: T.font }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="spy" name="SPY" stroke={T.amber} fill="url(#spyGrad2)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: T.amber }} />
                    </AreaChart>
                  ) : (
                    <LineChart data={timeRange === "2W" ? history.slice(-10) : timeRange === "1M" ? history.slice(-22) : history}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.textDim, fontFamily: T.font }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="score" domain={[-1, 1]} tick={{ fontSize: 10, fill: T.textDim, fontFamily: T.font }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="price" orientation="right" domain={["dataMin - 5", "dataMax + 5"]} tick={{ fontSize: 10, fill: T.textDim, fontFamily: T.font }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <ReferenceLine yAxisId="score" y={0} stroke={T.border} strokeDasharray="3 3" />
                      <Tooltip content={<ChartTooltip />} />
                      <Line yAxisId="score" type="monotone" dataKey="composite" name="Signal" stroke={T.amber} strokeWidth={2} dot={false} />
                      <Line yAxisId="price" type="monotone" dataKey="spy" name="SPY" stroke={T.green} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          {/* Factor Breakdown */}
          <Panel title="Factor Breakdown" tag={`${Object.keys(factors).length} FACTORS`} style={{ flex: 1 }} contentStyle={{ padding: "8px" }}>
            {/* Model info notice */}
            {(() => {
              const zeroFactors = Object.entries(factors).filter(([, f]) => f.score === 0);
              const activeFactors = Object.entries(factors).filter(([, f]) => f.score !== 0);
              if (zeroFactors.length > 0 && zeroFactors.length < Object.keys(factors).length) {
                return (
                  <div style={{
                    margin: "4px 8px 12px", padding: "10px 12px", borderRadius: T.radius,
                    background: "rgba(255,149,0,0.06)", border: `1px solid rgba(255,149,0,0.15)`,
                    fontSize: 11, color: T.amber, lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 700 }}>{activeFactors.length}/{Object.keys(factors).length} FACTORS ACTIVE</span> — {zeroFactors.map(([, f]) => f.label).join(", ")} need more daily data for z-score normalization. Live signals are collecting; scores activate after ~60 days.
                  </div>
                );
              }
              if (zeroFactors.length === Object.keys(factors).length) {
                return (
                  <div style={{
                    margin: "4px 8px 12px", padding: "10px 12px", borderRadius: T.radius,
                    background: "rgba(255,149,0,0.06)", border: `1px solid rgba(255,149,0,0.15)`,
                    fontSize: 11, color: T.amber, lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 700 }}>WARMING UP</span> — Z-score normalization requires ~60 days of history. Raw signal values are collecting below.
                  </div>
                );
              }
              return null;
            })()}
            {Object.entries(factors).map(([key, factor]) => (
              <FactorBar
                key={key}
                factor={factor}
                isExpanded={expandedFactor === key}
                onToggle={() => setExpandedFactor(expandedFactor === key ? null : key)}
                allZero={Object.values(factors).every((f) => f.score === 0)}
              />
            ))}
          </Panel>
        </div>

        {/* ── Right: Alerts + Stats + Activity Log ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Alerts */}
          <Panel title="Active Alerts" tag={alerts.length > 0 ? `${alerts.length}` : undefined}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.length > 0 ? alerts.map((alert, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px", borderRadius: T.radius, fontSize: 12,
                    background: getSeverityBg(alert.severity),
                    borderLeft: `3px solid ${getSeverityColor(alert.severity)}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 9, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em",
                      color: getSeverityColor(alert.severity),
                    }}>
                      {alert.type}
                    </span>
                  </div>
                  <div style={{ color: T.text, lineHeight: 1.4 }}>{alert.text}</div>
                </div>
              )) : (
                <div style={{ color: T.textDim, fontSize: 12 }}>No active alerts</div>
              )}
            </div>
          </Panel>

          {/* Signal Backtest */}
          {backtest && backtest.hitRate && Object.keys(backtest.hitRate).length > 0 && (
            <Panel title="Signal Accuracy" tag={`${backtest.totalSignals} SIGNALS`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Hit rate bars */}
                <div style={{ display: "flex", gap: 8 }}>
                  {["1d", "3d", "5d"].map((h) => {
                    const d = backtest.hitRate[h];
                    if (!d) return null;
                    const pct = d.hitRate;
                    const isGood = pct >= 55;
                    const color = isGood ? T.green : pct >= 50 ? T.amber : T.red;
                    return (
                      <div key={h} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h} hit</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{pct.toFixed(0)}%</div>
                        <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>n={d.count}</div>
                        <div style={{ height: 3, background: T.panelHeader, borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Long vs Short breakdown */}
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    {["long", "short"].map((dir) => {
                      const d = backtest.hitRate[`1d_${dir}`];
                      if (!d) return null;
                      const color = dir === "long" ? T.green : T.red;
                      return (
                        <div key={dir} style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color, fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>
                            {dir} signals
                          </div>
                          {["1d", "3d", "5d"].map((h) => {
                            const hd = backtest.hitRate[`${h}_${dir}`];
                            if (!hd) return null;
                            return (
                              <div key={h} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0", color: T.text }}>
                                <span style={{ color: T.textDim }}>{h}</span>
                                <span style={{ fontWeight: 500 }}>{hd.hitRate.toFixed(0)}% <span style={{ color: T.textDim, fontSize: 9 }}>({hd.avgReturn >= 0 ? "+" : ""}{hd.avgReturn.toFixed(2)}%)</span></span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Recent signals */}
                {backtest.records && backtest.records.length > 0 && (
                  <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                    <div style={{ fontSize: 10, color: T.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recent Signals</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {backtest.records.slice(-8).reverse().map((r, i) => {
                        const isLong = r.composite > 0;
                        const sigColor = isLong ? T.green : T.red;
                        const hit1d = r.hit_1d;
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, padding: "3px 4px", background: i === 0 ? "rgba(255,149,0,0.05)" : "transparent", borderRadius: 2 }}>
                            <span style={{ color: T.textDim, width: 55 }}>{r.date.slice(5)}</span>
                            <span style={{ color: sigColor, fontWeight: 600, width: 45, textAlign: "center" }}>{isLong ? "LONG" : "SHORT"}</span>
                            <span style={{ color: T.text, width: 40, textAlign: "right" }}>{r.composite >= 0 ? "+" : ""}{r.composite.toFixed(2)}</span>
                            <span style={{ width: 45, textAlign: "right", color: r.return_1d != null ? (r.return_1d >= 0 ? T.green : T.red) : T.textDim }}>
                              {r.return_1d != null ? `${r.return_1d >= 0 ? "+" : ""}${r.return_1d.toFixed(1)}%` : "..."}
                            </span>
                            <span style={{ width: 16, textAlign: "center" }}>
                              {hit1d === 1 ? <span style={{ color: T.green }}>&#10003;</span> : hit1d === 0 ? <span style={{ color: T.red }}>&#10007;</span> : <span style={{ color: T.textDim }}>-</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 9, color: T.textDim, textAlign: "center" }}>
                  Based on {backtest.totalSignals} non-neutral signals from backfilled + live data
                </div>
              </div>
            </Panel>
          )}

          {/* Factor Scores Summary */}
          <Panel title="Factor Scores">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(factors).map(([key, f]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}22` }}>
                  <span style={{ fontSize: 12, color: T.text }}>{f.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 32, height: 4, borderRadius: 2, background: T.panelHeader,
                      position: "relative", overflow: "hidden",
                    }}>
                      <div style={{
                        position: "absolute", top: 0, bottom: 0,
                        left: f.score >= 0 ? "50%" : `${50 + f.score * 50}%`,
                        width: `${Math.abs(f.score) * 50}%`,
                        background: f.score >= 0 ? T.green : T.red,
                        borderRadius: 2,
                      }} />
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 600, width: 42, textAlign: "right",
                      color: f.score >= 0 ? T.green : T.red,
                    }}>
                      {f.score >= 0 ? "+" : ""}{f.score.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Activity Log */}
          <Panel title="Activity Log" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }} contentStyle={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {["all", "eod", "intraday", "system"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    style={{
                      background: logFilter === f ? T.panelHeader : "transparent",
                      color: logFilter === f ? T.amber : T.textDim,
                      border: "none", padding: "2px 8px", borderRadius: 2, fontSize: 10, cursor: "pointer",
                      textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: T.font,
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
                  const statusColor = entry.status === "ok" ? T.green : entry.status === "warn" ? T.amber : T.red;
                  const isEOD = entry.type === "eod";
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "6px 8px", borderRadius: T.radius, fontSize: 11,
                        background: i === 0 ? "rgba(255,149,0,0.05)" : "transparent",
                        borderLeft: i === 0 ? `2px solid ${T.amber}` : "2px solid transparent",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                          <span style={{ color: T.textDim, fontSize: 10 }}>
                            {(entry.time || "").split(" ")[1] || ""}
                          </span>
                          <span style={{
                            fontSize: 9, padding: "1px 5px", borderRadius: 2, fontWeight: 700, letterSpacing: "0.05em",
                            background: isEOD ? "rgba(255,149,0,0.12)" : "rgba(107,114,128,0.12)",
                            color: isEOD ? T.amber : T.textDim,
                          }}>
                            {(entry.type || "").toUpperCase()}
                          </span>
                        </div>
                        <span style={{ color: T.textDim, fontSize: 10 }}>{entry.duration || ""}</span>
                      </div>
                      <div style={{ color: T.text, fontSize: 11, paddingLeft: 11, opacity: 0.8 }}>{entry.message || ""}</div>
                      {i === 0 && entry.time && (
                        <div style={{ color: T.textDim, fontSize: 9, paddingLeft: 11, marginTop: 2 }}>
                          {entry.time.split(" ")[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
              {activityLog.length === 0 && (
                <div style={{ color: T.textDim, fontSize: 11, padding: 8 }}>No activity logged yet</div>
              )}
            </div>
          </Panel>

          {/* Model Info */}
          <Panel title="Model Info">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              {[
                ["Factors", "6"],
                ["Sub-signals", "22"],
                ["Refresh", "Daily EOD"],
                ["Lookback", "60 days"],
                ["Normalization", "Z-score (60d)"],
                ["DB Records", status?.totalRecords?.toLocaleString() || "0"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: T.textDim }}>{label}</span>
                  <span style={{ color: T.text }}>{value}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Disclaimer */}
          <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.5, padding: "0 4px" }}>
            For educational and research purposes only. Not financial advice. Past signals do not guarantee future performance.
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign: "center", padding: "24px 0 32px", borderTop: `1px solid ${T.border}`, marginTop: 8 }}>
        <div style={{ fontSize: 11, color: T.textDim }}>
          Built by <span style={{ color: T.amber }}>Ayush Panda</span>
        </div>
        <div style={{ fontSize: 10, color: T.border, marginTop: 4 }}>
          Multi-factor quantitative model using LSEG/Refinitiv data
        </div>
      </div>
    </div>
  );
}
