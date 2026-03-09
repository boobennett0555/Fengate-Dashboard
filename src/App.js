import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const US_HOLIDAYS = [
  "2024-11-28","2024-11-29","2024-12-25","2025-01-01","2025-01-20",
  "2025-02-17","2025-05-26","2025-06-19","2025-07-04","2025-09-01",
  "2025-11-27","2025-11-28","2025-12-25","2026-01-01","2026-01-19",
  "2026-02-16","2026-05-25","2026-07-03","2026-09-07","2026-11-26",
];

function isBusinessDay(date) {
  const d = date.getDay();
  if (d === 0 || d === 6) return false;
  return !US_HOLIDAYS.includes(date.toISOString().split("T")[0]);
}

function addBusinessDays(startDate, days) {
  let d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

function businessDaysBetween(start, end) {
  let count = 0;
  let d = new Date(start);
  d.setDate(d.getDate() + 1);
  while (d <= end) {
    if (isBusinessDay(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTs(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const d = new Date(dateStr);
  d.setHours(0,0,0,0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function computeClock(deal) {
  if (!deal.submitted_at) return { daysUsed: 0, daysLeft: 10, pct: 0, deadline: null, paused: false };
  const now = new Date();
  const submitted = new Date(deal.submitted_at);
  const deadline = addBusinessDays(submitted, 10);
  let daysUsed = deal.clock_paused_at
    ? (deal.clock_paused_days || 0)
    : businessDaysBetween(submitted, now);
  daysUsed = Math.min(daysUsed, 10);
  return {
    daysUsed,
    daysLeft: Math.max(0, 10 - daysUsed),
    pct: (daysUsed / 10) * 100,
    deadline,
    paused: !!deal.clock_paused_at,
  };
}

const PROPERTY_TYPES = ["Core", "Core Plus", "Development", "Value-Add"];
const STAGES = ["Draft", "Submitted", "Pending Info", "Awaiting Decision", "Closed"];
const OUTCOMES = ["Approved", "Disapproved", "Deemed Disapproved", "Withdrawn"];
const TEAM_MEMBERS = ["Unassigned", "MedCraft — Team", "MedCraft — Principal", "MedCraft — Analyst", "Fengate — Working Group", "Fengate — IC"];

const STAGE_META = {
  Draft:               { color: "#8B8FA8", bg: "#1E1F2E", label: "DRAFT" },
  Submitted:           { color: "#F5A623", bg: "#2A2010", label: "CLOCK RUNNING" },
  "Pending Info":      { color: "#7EC8E3", bg: "#0F2230", label: "CLOCK PAUSED" },
  "Awaiting Decision": { color: "#A78BFA", bg: "#1E1530", label: "AWAITING DECISION" },
  Closed:              { color: "#6EE7B7", bg: "#0F2A1F", label: "CLOSED" },
};

const H1_ITEMS = [
  { id: 1, label: "Property Description & Designation", required: true },
  { id: 2, label: "Investment Plan", required: false },
  { id: 3, label: "Preliminary Acquisition Budget / Dev Budget", required: false },
  { id: 4, label: "Preliminary Schedule / Development Schedule", required: false },
  { id: 5, label: "Preliminary Pro Forma Financial Model", required: false },
  { id: 6, label: "Underwriting Assumptions & Market Data", required: false },
  { id: 7, label: "Rent Roll (if applicable)", required: false },
  { id: 8, label: "Material Leases (if any)", required: false },
  { id: 9, label: "Other Data / Info Requested by Investor Member", required: false },
];

function Tag({ children, color, bg }) {
  return (
    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
      letterSpacing: "0.08em", color, background: bg,
      border: `1px solid ${color}40`, borderRadius: 3, padding: "2px 7px" }}>
      {children}
    </span>
  );
}

function ClockBar({ pct, paused, daysLeft, closed }) {
  const color = closed ? "#6EE7B7" : paused ? "#7EC8E3" : pct >= 80 ? "#F87171" : pct >= 60 ? "#F5A623" : "#6EE7B7";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4,
        fontSize: 11, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace" }}>
        <span>{paused ? "⏸ CLOCK PAUSED" : closed ? "CLOSED" : `${Math.round(pct)}% elapsed`}</span>
        <span style={{ color }}>{closed ? "—" : paused ? "—" : `${daysLeft} BD left`}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "#1A1B2E", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`,
          background: color, transition: "width 0.6s ease", borderRadius: 2 }} />
      </div>
    </div>
  );
}

function DatePill({ label, dateStr }) {
  if (!dateStr) return null;
  const days = daysUntil(dateStr);
  const color = days < 0 ? "#F87171" : days <= 3 ? "#F5A623" : "#8B8FA8";
  const bg = days < 0 ? "#2A0F0F" : days <= 3 ? "#2A2010" : "#1A1B2E";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11,
      background: bg, border: `1px solid ${color}40`, borderRadius: 4, padding: "3px 8px" }}>
      <span style={{ color: "#555878" }}>{label}</span>
      <span style={{ color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
        {fmtDate(dateStr)}
        {days !== null && (
          <span style={{ marginLeft: 5, fontSize: 10 }}>
            {days < 0 ? `(${Math.abs(days)}d ago)` : days === 0 ? "(today)" : `(${days}d)`}
          </span>
        )}
      </span>
    </div>
  );
}

function H1Checklist({ items, onChange }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {H1_ITEMS.map(item => {
        const status = items?.[item.id];
        return (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12,
            color: status === "submitted" ? "#6EE7B7" : status === "requested" ? "#7EC8E3" : "#555878",
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            <span style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, cursor: "pointer",
              border: `1.5px solid ${status === "submitted" ? "#6EE7B7" : status === "requested" ? "#7EC8E3" : "#383952"}`,
              background: status === "submitted" ? "#6EE7B7" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => onChange && onChange(item.id)}>
              {status === "submitted" && <span style={{ color: "#0A2A1F", fontSize: 10, fontWeight: 900 }}>✓</span>}
              {status === "requested" && <span style={{ color: "#7EC8E3", fontSize: 10 }}>?</span>}
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ opacity: 0.5, marginRight: 5 }}>H-{item.id}</span>
              {item.label}
              {item.required && <span style={{ color: "#F5A623", marginLeft: 5 }}>*</span>}
            </span>
            {onChange && (
              <select value={status || ""} onChange={e => onChange(item.id, e.target.value || null)}
                style={{ fontSize: 10, background: "#12131F", border: "1px solid #2A2B3D",
                  color: "#8B8FA8", borderRadius: 3, padding: "2px 4px",
                  fontFamily: "'IBM Plex Mono', monospace" }}>
                <option value="">—</option>
                <option value="submitted">Submitted</option>
                <option value="requested">Requested</option>
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LogEntry({ entry }) {
  const colors = { submit: "#6EE7B7", pause: "#7EC8E3", resume: "#A78BFA", close: "#F5A623", note: "#8B8FA8" };
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #1A1B2E" }}>
      <div style={{ width: 3, borderRadius: 2, background: colors[entry.type] || "#555878", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2 }}>
          {fmtTs(entry.created_at)} · <span style={{ color: colors[entry.type] || "#8B8FA8" }}>{entry.actor}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#C8CAE0", fontFamily: "'IBM Plex Sans', sans-serif" }}>{entry.action}</div>
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }) {
  const days = daysUntil(task.due_date);
  const overdue = days !== null && days < 0 && !task.completed;
  const dueSoon = days !== null && days <= 2 && days >= 0 && !task.completed;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0",
      borderBottom: "1px solid #1A1B2E", opacity: task.completed ? 0.5 : 1 }}>
      <span onClick={() => onToggle(task.id, !task.completed)}
        style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, cursor: "pointer", marginTop: 1,
          border: `1.5px solid ${task.completed ? "#6EE7B7" : overdue ? "#F87171" : "#383952"}`,
          background: task.completed ? "#6EE7B7" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
        {task.completed && <span style={{ color: "#0A2A1F", fontSize: 10, fontWeight: 900 }}>✓</span>}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: task.completed ? "#555878" : "#C8CAE0",
          textDecoration: task.completed ? "line-through" : "none",
          fontFamily: "'IBM Plex Sans', sans-serif", marginBottom: 4 }}>{task.title}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {task.assigned_to && (
            <span style={{ fontSize: 10, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace" }}>
              → {task.assigned_to}
            </span>
          )}
          {task.due_date && (
            <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace",
              color: overdue ? "#F87171" : dueSoon ? "#F5A623" : "#555878" }}>
              {overdue ? "⚠ OVERDUE · " : dueSoon ? "⚡ DUE SOON · " : ""}{fmtDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
      <button onClick={() => onDelete(task.id)}
        style={{ background: "none", border: "none", color: "#383952", cursor: "pointer",
          fontSize: 14, padding: "0 4px", lineHeight: 1 }}>×</button>
    </div>
  );
}

export default function App() {
  const [deals, setDeals] = useState([]);
  const [logs, setLogs] = useState({});
  const [tasks, setTasks] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("pipeline");
  const [detailTab, setDetailTab] = useState("overview");
  const [filterStage, setFilterStage] = useState("All");
  const [newDeal, setNewDeal] = useState({ name: "", type: "Development", description: "", box_link: "", teams_link: "" });
  const [actionNote, setActionNote] = useState("");
  const [showAction, setShowAction] = useState(null);
  const [closeOutcome, setCloseOutcome] = useState("Approved");
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", assigned_to: "Unassigned", due_date: "" });
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingDates, setEditingDates] = useState(false);
  const [draftDates, setDraftDates] = useState({});

  const selected = deals.find(d => d.id === selectedId);
  const selectedLog = selectedId ? (logs[selectedId] || []) : [];
  const selectedTasks = selectedId ? (tasks[selectedId] || []) : [];

  async function fetchAll() {
    setLoading(true);
    const { data: dealData } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    const { data: logData } = await supabase.from("deal_logs").select("*").order("created_at", { ascending: true });
    const { data: taskData } = await supabase.from("deal_tasks").select("*").order("created_at", { ascending: true });

    if (dealData) {
      const now = new Date();
      for (const deal of dealData) {
        if (["Submitted", "Awaiting Decision"].includes(deal.stage)) {
          const { daysLeft } = computeClock(deal);
          if (daysLeft === 0) {
            await supabase.from("deals").update({ stage: "Closed", outcome: "Deemed Disapproved", closed_at: now.toISOString() }).eq("id", deal.id);
            await supabase.from("deal_logs").insert({ deal_id: deal.id, actor: "System", action: "10 Business Day window expired. Deemed Disapproved per §3.1(b).", type: "close" });
            deal.stage = "Closed"; deal.outcome = "Deemed Disapproved";
          }
        }
      }
      setDeals(dealData);
    }
    if (logData) {
      const grouped = {};
      logData.forEach(e => { if (!grouped[e.deal_id]) grouped[e.deal_id] = []; grouped[e.deal_id].push(e); });
      setLogs(grouped);
    }
    if (taskData) {
      const grouped = {};
      taskData.forEach(t => { if (!grouped[t.deal_id]) grouped[t.deal_id] = []; grouped[t.deal_id].push(t); });
      setTasks(grouped);
    }
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function addLog(dealId, actor, action, type) {
    const { data } = await supabase.from("deal_logs").insert({ deal_id: dealId, actor, action, type }).select().single();
    if (data) setLogs(prev => ({ ...prev, [dealId]: [...(prev[dealId] || []), data] }));
  }

  async function updateDeal(id, patch) {
    await supabase.from("deals").update(patch).eq("id", id);
    setDeals(ds => ds.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  async function handleSubmit(id) {
    setSaving(true);
    const ts = new Date().toISOString();
    await updateDeal(id, { stage: "Submitted", submitted_at: ts, clock_paused_days: 0, clock_paused_at: null });
    await addLog(id, "MedCraft", "Deal submitted to Fengate. 10 Business Day clock started.", "submit");
    setSaving(false);
  }

  async function handlePause(id, note) {
    setSaving(true);
    const deal = deals.find(d => d.id === id);
    const daysUsed = businessDaysBetween(new Date(deal.submitted_at), new Date());
    const suppDeadline = addBusinessDays(new Date(), 3).toISOString();
    await updateDeal(id, { stage: "Pending Info", clock_paused_at: new Date().toISOString(), clock_paused_days: daysUsed, supplemental_requested_at: new Date().toISOString(), supplemental_deadline: suppDeadline });
    await addLog(id, "Fengate", `Supplemental info requested. Clock paused at ${daysUsed} BD used. ${note}`.trim(), "pause");
    setShowAction(null); setActionNote(""); setSaving(false);
  }

  async function handleResume(id, note) {
    setSaving(true);
    const ts = new Date().toISOString();
    await updateDeal(id, { stage: "Awaiting Decision", clock_paused_at: null, clock_paused_days: 0, submitted_at: ts, supplemental_delivered_at: ts });
    await addLog(id, "MedCraft", `Supplemental info delivered. Clock resumed (fresh 10 BD). ${note}`.trim(), "resume");
    setShowAction(null); setActionNote(""); setSaving(false);
  }

  async function handleClose(id, outcome, note) {
    setSaving(true);
    await updateDeal(id, { stage: "Closed", outcome, closed_at: new Date().toISOString() });
    await addLog(id, outcome === "Deemed Disapproved" ? "System" : "Fengate", `${outcome}.${note ? " " + note : ""}`, "close");
    setShowAction(null); setActionNote(""); setSaving(false);
  }

  async function handleNewDeal() {
    setSaving(true);
    const year = new Date().getFullYear();
    const count = deals.filter(d => d.id.startsWith(`MC-${year}`)).length + 1;
    const id = `MC-${year}-${String(count).padStart(3, "0")}`;
    const deal = { id, name: newDeal.name, property_type: newDeal.type, description: newDeal.description, box_link: newDeal.box_link, teams_link: newDeal.teams_link, stage: "Draft", outcome: null, h1_items: {}, submitted_at: null, clock_paused_at: null, clock_paused_days: 0, supplemental_requested_at: null, supplemental_deadline: null, supplemental_delivered_at: null, closed_at: null };
    const { data } = await supabase.from("deals").insert(deal).select().single();
    if (data) { setDeals(ds => [data, ...ds]); await addLog(data.id, "MedCraft", "Deal created in pipeline.", "note"); setSelectedId(data.id); setView("detail"); setDetailTab("overview"); }
    setNewDeal({ name: "", type: "Development", description: "", box_link: "", teams_link: "" });
    setSaving(false);
  }

  async function handleH1Change(dealId, itemId, val) {
    const deal = deals.find(d => d.id === dealId);
    const updated = { ...(deal.h1_items || {}), [itemId]: val || null };
    await updateDeal(dealId, { h1_items: updated });
  }

  async function handleSaveDates(id) {
    await updateDeal(id, draftDates);
    setEditingDates(false); setDraftDates({});
  }

  async function handleAddTask(dealId) {
    if (!newTask.title.trim()) return;
    setSaving(true);
    const { data } = await supabase.from("deal_tasks").insert({
      deal_id: dealId, title: newTask.title,
      assigned_to: newTask.assigned_to === "Unassigned" ? null : newTask.assigned_to,
      due_date: newTask.due_date || null, completed: false,
    }).select().single();
    if (data) setTasks(prev => ({ ...prev, [dealId]: [...(prev[dealId] || []), data] }));
    setNewTask({ title: "", assigned_to: "Unassigned", due_date: "" });
    setShowNewTask(false); setSaving(false);
  }

  async function handleToggleTask(taskId, completed) {
    await supabase.from("deal_tasks").update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq("id", taskId);
    setTasks(prev => {
      const updated = {};
      for (const [k, v] of Object.entries(prev)) updated[k] = v.map(t => t.id === taskId ? { ...t, completed } : t);
      return updated;
    });
  }

  async function handleDeleteTask(taskId) {
    await supabase.from("deal_tasks").delete().eq("id", taskId);
    setTasks(prev => {
      const updated = {};
      for (const [k, v] of Object.entries(prev)) updated[k] = v.filter(t => t.id !== taskId);
      return updated;
    });
  }

  function getCardAlerts(deal) {
    const alerts = [];
    const taskList = tasks[deal.id] || [];
    const overdue = taskList.filter(t => !t.completed && t.due_date && daysUntil(t.due_date) < 0);
    const dueSoon = taskList.filter(t => !t.completed && t.due_date && daysUntil(t.due_date) >= 0 && daysUntil(t.due_date) <= 2);
    if (overdue.length > 0) alerts.push({ color: "#F87171", text: `${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}` });
    if (dueSoon.length > 0) alerts.push({ color: "#F5A623", text: `${dueSoon.length} task${dueSoon.length > 1 ? "s" : ""} due soon` });
    const cfo = daysUntil(deal.date_call_for_offers);
    if (cfo !== null && cfo >= 0 && cfo <= 5) alerts.push({ color: "#A78BFA", text: `CFO in ${cfo}d` });
    if (cfo !== null && cfo < 0) alerts.push({ color: "#F87171", text: `CFO passed` });
    return alerts;
  }

  const filtered = deals.filter(d => filterStage === "All" || d.stage === filterStage);
  const stats = {
    active: deals.filter(d => ["Submitted", "Pending Info", "Awaiting Decision"].includes(d.stage)).length,
    approved: deals.filter(d => d.outcome === "Approved").length,
    deemedDisapproved: deals.filter(d => d.outcome === "Deemed Disapproved").length,
    critical: deals.filter(d => ["Submitted","Awaiting Decision"].includes(d.stage) && computeClock(d).daysLeft <= 2).length,
  };

  const fonts = `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=Playfair+Display:wght@700&display=swap');`;

  if (loading) return (
    <div style={{ height: "100vh", background: "#0D0E1A", display: "flex", alignItems: "center", justifyContent: "center", color: "#555878", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
      <style>{fonts}</style>LOADING PIPELINE...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0D0E1A", color: "#C8CAE0", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{fonts + `
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #12131F; } ::-webkit-scrollbar-thumb { background: #2A2B3D; }
        input, textarea, select { outline: none; } input::placeholder, textarea::placeholder { color: #3A3B52; }
        .card:hover { border-color: #2A2B3D !important; transform: translateY(-1px); }
        .navbtn:hover { background: #1A1B2E !important; } .actionbtn:hover { opacity: 0.85; }
        .tab:hover { color: #C8CAE0 !important; }
      `}</style>

      <div style={{ borderBottom: "1px solid #1A1B2E", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#EEEFFE", letterSpacing: "-0.02em" }}>MedCraft</span>
          <span style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.12em" }}>FENGATE DEAL PIPELINE</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {saving && <span style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", marginRight: 8 }}>saving...</span>}
          {["pipeline", "new"].map(v => (
            <button key={v} className="navbtn" onClick={() => setView(v)}
              style={{ padding: "6px 16px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em", background: view === v ? "#1A1B2E" : "transparent", color: view === v ? "#C8CAE0" : "#555878", transition: "all 0.15s" }}>
              {v === "pipeline" ? "PIPELINE" : "+ NEW DEAL"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>
        <div style={{ width: view === "detail" ? 380 : "100%", flexShrink: 0, borderRight: "1px solid #1A1B2E", overflowY: "auto", padding: 24, transition: "width 0.3s ease" }}>

          {view === "new" ? (
            <div style={{ maxWidth: 480 }}>
              <div style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", marginBottom: 20 }}>NEW DEAL INTAKE</div>
              {[
                { label: "Deal Name / Property *", key: "name", type: "input" },
                { label: "Brief Description", key: "description", type: "textarea" },
                { label: "Box Folder URL", key: "box_link", type: "input" },
                { label: "Teams Channel Link", key: "teams_link", type: "input" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>{f.label}</div>
                  {f.type === "textarea"
                    ? <textarea value={newDeal[f.key]} onChange={e => setNewDeal(n => ({ ...n, [f.key]: e.target.value }))} rows={3} style={{ width: "100%", background: "#12131F", border: "1px solid #2A2B3D", borderRadius: 6, color: "#C8CAE0", fontSize: 13, padding: "10px 12px", fontFamily: "'IBM Plex Sans', sans-serif", resize: "vertical" }} />
                    : <input value={newDeal[f.key]} onChange={e => setNewDeal(n => ({ ...n, [f.key]: e.target.value }))} style={{ width: "100%", background: "#12131F", border: "1px solid #2A2B3D", borderRadius: 6, color: "#C8CAE0", fontSize: 13, padding: "10px 12px", fontFamily: "'IBM Plex Sans', sans-serif" }} />
                  }
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>Property Type</div>
                <select value={newDeal.type} onChange={e => setNewDeal(n => ({ ...n, type: e.target.value }))} style={{ width: "100%", background: "#12131F", border: "1px solid #2A2B3D", borderRadius: 6, color: "#C8CAE0", fontSize: 13, padding: "10px 12px", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <button onClick={handleNewDeal} disabled={!newDeal.name || saving} style={{ width: "100%", padding: "12px", border: "none", borderRadius: 6, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em", cursor: newDeal.name ? "pointer" : "default", transition: "all 0.2s", background: newDeal.name ? "#4F46E5" : "#1A1B2E", color: newDeal.name ? "#fff" : "#555878" }}>
                {saving ? "CREATING..." : "CREATE DEAL →"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "Active", value: stats.active, color: "#F5A623" },
                  { label: "Approved", value: stats.approved, color: "#6EE7B7" },
                  { label: "Deemed Disapp.", value: stats.deemedDisapproved, color: "#F87171" },
                  { label: "⚠ Critical", value: stats.critical, color: "#F87171" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#12131F", border: "1px solid #1A1B2E", borderRadius: 6, padding: "10px 12px" }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "#555878", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                {["All", ...STAGES].map(s => (
                  <button key={s} onClick={() => setFilterStage(s)} style={{ padding: "4px 10px", cursor: "pointer", transition: "all 0.15s", border: `1px solid ${filterStage === s ? "#4F46E5" : "#1A1B2E"}`, borderRadius: 3, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", background: filterStage === s ? "#4F46E530" : "transparent", color: filterStage === s ? "#A78BFA" : "#555878" }}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {filtered.length === 0 && <div style={{ color: "#555878", fontSize: 13, padding: "20px 0", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>No deals yet. Click + NEW DEAL to start.</div>}
                {filtered.map(deal => {
                  const clock = computeClock(deal);
                  const meta = STAGE_META[deal.stage];
                  const isSelected = selectedId === deal.id && view === "detail";
                  const alerts = getCardAlerts(deal);
                  const dealTasks = tasks[deal.id] || [];
                  const openTasks = dealTasks.filter(t => !t.completed).length;
                  return (
                    <div key={deal.id} className="card" onClick={() => { setSelectedId(deal.id); setView("detail"); setShowAction(null); setDetailTab("overview"); }}
                      style={{ background: isSelected ? "#1A1B2E" : "#12131F", border: `1px solid ${isSelected ? "#4F46E5" : "#1A1B2E"}`, borderRadius: 8, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#EEEFFE", marginBottom: 2 }}>{deal.name}</div>
                          <div style={{ fontSize: 10, color: "#555878", fontFamily: "'IBM Plex Mono', monospace" }}>{deal.id}</div>
                        </div>
                        <Tag color={meta.color} bg={meta.bg}>{meta.label}</Tag>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                        <Tag color="#8B8FA8" bg="#1A1B2E">{deal.property_type}</Tag>
                        {deal.outcome && <Tag color={deal.outcome === "Approved" ? "#6EE7B7" : "#F87171"} bg={deal.outcome === "Approved" ? "#0F2A1F" : "#2A0F0F"}>{deal.outcome.toUpperCase()}</Tag>}
                        {openTasks > 0 && <Tag color="#A78BFA" bg="#1E1530">{openTasks} task{openTasks > 1 ? "s" : ""}</Tag>}
                      </div>
                      {alerts.length > 0 && (
                        <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                          {alerts.map((a, i) => <span key={i} style={{ fontSize: 10, color: a.color, fontFamily: "'IBM Plex Mono', monospace" }}>⚠ {a.text}</span>)}
                        </div>
                      )}
                      {deal.date_call_for_offers && <DatePill label="CFO" dateStr={deal.date_call_for_offers} />}
                      {!["Draft", "Closed"].includes(deal.stage) && <ClockBar pct={clock.pct} paused={clock.paused} daysLeft={clock.daysLeft} closed={false} />}
                      {deal.stage === "Closed" && <div style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", marginTop: 6 }}>Closed {fmtDate(deal.closed_at)}</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {view === "detail" && selected && (() => {
          const clock = computeClock(selected);
          return (
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#EEEFFE", fontFamily: "'Playfair Display', serif", marginBottom: 6 }}>{selected.name}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace" }}>{selected.id}</span>
                    <Tag color={STAGE_META[selected.stage].color} bg={STAGE_META[selected.stage].bg}>{STAGE_META[selected.stage].label}</Tag>
                    <Tag color="#8B8FA8" bg="#1A1B2E">{selected.property_type}</Tag>
                    {selected.outcome && <Tag color={selected.outcome === "Approved" ? "#6EE7B7" : "#F87171"} bg={selected.outcome === "Approved" ? "#0F2A1F" : "#2A0F0F"}>{selected.outcome.toUpperCase()}</Tag>}
                  </div>
                </div>
                <button onClick={() => { setView("pipeline"); setSelectedId(null); }} style={{ background: "none", border: "none", color: "#555878", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>

              <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #1A1B2E" }}>
                {["overview", "tasks", "h1", "log"].map(tab => (
                  <button key={tab} className="tab" onClick={() => setDetailTab(tab)}
                    style={{ padding: "8px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em", transition: "all 0.15s", color: detailTab === tab ? "#C8CAE0" : "#555878", borderBottom: `2px solid ${detailTab === tab ? "#4F46E5" : "transparent"}`, marginBottom: -1 }}>
                    {tab.toUpperCase()}
                    {tab === "tasks" && selectedTasks.filter(t => !t.completed).length > 0 && (
                      <span style={{ marginLeft: 6, background: "#4F46E5", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>{selectedTasks.filter(t => !t.completed).length}</span>
                    )}
                  </button>
                ))}
              </div>

              {detailTab === "overview" && (
                <>
                  {selected.stage !== "Draft" && (
                    <div style={{ background: "#12131F", border: "1px solid #1A1B2E", borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>10-DAY PRELIMINARY WINDOW · §3.1(b)</span>
                        {selected.stage !== "Closed" && !clock.paused && <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: clock.daysLeft <= 2 ? "#F87171" : "#F5A623" }}>{clock.daysLeft} BD REMAINING</span>}
                      </div>
                      <ClockBar pct={clock.pct} paused={clock.paused} daysLeft={clock.daysLeft} closed={selected.stage === "Closed"} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
                        {[
                          { label: "Submitted", val: fmtDate(selected.submitted_at) },
                          { label: clock.paused ? "Clock Paused" : "Deadline", val: clock.paused ? fmtDate(selected.clock_paused_at) : fmtDate(clock.deadline) },
                          { label: "BD Used / Total", val: `${clock.daysUsed} / 10` },
                        ].map(item => (
                          <div key={item.label}>
                            <div style={{ fontSize: 10, color: "#555878", marginBottom: 3 }}>{item.label}</div>
                            <div style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: "#C8CAE0" }}>{item.val}</div>
                          </div>
                        ))}
                      </div>
                      {selected.stage === "Pending Info" && (
                        <div style={{ marginTop: 12, padding: "10px 14px", background: "#0F2230", border: "1px solid #7EC8E340", borderRadius: 6 }}>
                          <div style={{ fontSize: 11, color: "#7EC8E3", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>SUPPLEMENTAL INFO REQUEST ACTIVE</div>
                          <div style={{ fontSize: 12, color: "#C8CAE0" }}>MedCraft response due: <strong>{fmtDate(selected.supplemental_deadline)}</strong></div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ background: "#12131F", border: "1px solid #1A1B2E", borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>KEY DATES</span>
                      <button onClick={() => { setEditingDates(!editingDates); setDraftDates({ date_call_for_offers: selected.date_call_for_offers || "", date_loi_expiry: selected.date_loi_expiry || "", date_custom: selected.date_custom || "", date_custom_label: selected.date_custom_label || "" }); }}
                        style={{ background: "none", border: "1px solid #2A2B3D", borderRadius: 4, color: "#8B8FA8", cursor: "pointer", fontSize: 11, padding: "3px 10px", fontFamily: "'IBM Plex Mono', monospace" }}>
                        {editingDates ? "CANCEL" : "EDIT"}
                      </button>
                    </div>
                    {editingDates ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        {[
                          { label: "Call for Offers", key: "date_call_for_offers", type: "date" },
                          { label: "LOI Expiry", key: "date_loi_expiry", type: "date" },
                          { label: "Custom Label", key: "date_custom_label", type: "text" },
                          { label: "Custom Date", key: "date_custom", type: "date" },
                        ].map(f => (
                          <div key={f.key} style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 11, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace" }}>{f.label}</span>
                            <input type={f.type} value={draftDates[f.key] || ""} onChange={e => setDraftDates(d => ({ ...d, [f.key]: e.target.value }))}
                              style={{ background: "#0D0E1A", border: "1px solid #2A2B3D", borderRadius: 4, color: "#C8CAE0", fontSize: 12, padding: "6px 10px", fontFamily: "'IBM Plex Sans', sans-serif" }} />
                          </div>
                        ))}
                        <button onClick={() => handleSaveDates(selected.id)} style={{ padding: "8px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 4, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", marginTop: 4 }}>SAVE DATES</button>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {!selected.date_call_for_offers && !selected.date_loi_expiry && !selected.date_custom
                          ? <span style={{ fontSize: 12, color: "#3A3B52" }}>No key dates set. Click Edit to add.</span>
                          : <>
                            <DatePill label="Call for Offers" dateStr={selected.date_call_for_offers} />
                            <DatePill label="LOI Expiry" dateStr={selected.date_loi_expiry} />
                            <DatePill label={selected.date_custom_label || "Custom"} dateStr={selected.date_custom} />
                          </>
                        }
                      </div>
                    )}
                  </div>

                  {selected.stage !== "Closed" && (
                    <div style={{ background: "#12131F", border: "1px solid #1A1B2E", borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", marginBottom: 12 }}>ACTIONS</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {selected.stage === "Draft" && <button className="actionbtn" onClick={() => handleSubmit(selected.id)} disabled={saving} style={{ padding: "8px 16px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 5, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", letterSpacing: "0.06em" }}>▶ SUBMIT &amp; START CLOCK</button>}
                        {["Submitted", "Awaiting Decision"].includes(selected.stage) && <button className="actionbtn" onClick={() => setShowAction("pause")} style={{ padding: "8px 16px", background: "#0F2230", color: "#7EC8E3", border: "1px solid #7EC8E340", borderRadius: 5, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>⏸ LOG INFO REQUEST</button>}
                        {selected.stage === "Pending Info" && <button className="actionbtn" onClick={() => setShowAction("resume")} style={{ padding: "8px 16px", background: "#1E1530", color: "#A78BFA", border: "1px solid #A78BFA40", borderRadius: 5, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>▶ LOG INFO DELIVERED</button>}
                        {selected.stage !== "Draft" && <button className="actionbtn" onClick={() => setShowAction("close")} style={{ padding: "8px 16px", background: "#2A1010", color: "#F87171", border: "1px solid #F8717140", borderRadius: 5, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>✕ CLOSE DEAL</button>}
                        <button className="actionbtn" onClick={() => setShowAction("note")} style={{ padding: "8px 16px", background: "#1A1B2E", color: "#8B8FA8", border: "1px solid #2A2B3D", borderRadius: 5, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>+ LOG NOTE</button>
                      </div>
                      {showAction && (
                        <div style={{ marginTop: 14, padding: 14, background: "#0D0E1A", border: "1px solid #2A2B3D", borderRadius: 6 }}>
                          {showAction === "close" && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>OUTCOME</div>
                              <select value={closeOutcome} onChange={e => setCloseOutcome(e.target.value)} style={{ width: "100%", background: "#12131F", border: "1px solid #2A2B3D", borderRadius: 4, color: "#C8CAE0", fontSize: 13, padding: "8px 10px", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                {OUTCOMES.map(o => <option key={o}>{o}</option>)}
                              </select>
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>{{ pause: "WHAT DID THEY REQUEST?", resume: "DELIVERY NOTES", close: "NOTES", note: "NOTE" }[showAction]}</div>
                          <textarea value={actionNote} onChange={e => setActionNote(e.target.value)} rows={2} style={{ width: "100%", background: "#12131F", border: "1px solid #2A2B3D", borderRadius: 4, color: "#C8CAE0", fontSize: 13, padding: "8px 10px", fontFamily: "'IBM Plex Sans', sans-serif", resize: "none" }} />
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button disabled={saving} onClick={() => {
                              if (showAction === "pause") handlePause(selected.id, actionNote);
                              else if (showAction === "resume") handleResume(selected.id, actionNote);
                              else if (showAction === "close") handleClose(selected.id, closeOutcome, actionNote);
                              else if (showAction === "note") { addLog(selected.id, "MedCraft", actionNote, "note"); setShowAction(null); setActionNote(""); }
                            }} style={{ padding: "7px 16px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 4, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>{saving ? "SAVING..." : "CONFIRM"}</button>
                            <button onClick={() => { setShowAction(null); setActionNote(""); }} style={{ padding: "7px 14px", background: "none", color: "#555878", border: "1px solid #2A2B3D", borderRadius: 4, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "#12131F", border: "1px solid #1A1B2E", borderRadius: 8, padding: "16px 20px" }}>
                      <div style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", marginBottom: 10 }}>DEAL DETAILS</div>
                      <div style={{ fontSize: 12.5, color: "#8B8FA8", lineHeight: 1.6 }}>{selected.description || "No description added."}</div>
                    </div>
                    <div style={{ background: "#12131F", border: "1px solid #1A1B2E", borderRadius: 8, padding: "16px 20px" }}>
                      <div style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", marginBottom: 10 }}>LINKS</div>
                      {[{ label: "📁 Box Folder", val: selected.box_link }, { label: "💬 Teams Channel", val: selected.teams_link }].map(l => (
                        <div key={l.label} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: "#555878", marginBottom: 3 }}>{l.label}</div>
                          {l.val ? <a href={l.val} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7EC8E3", textDecoration: "none", wordBreak: "break-all" }}>{l.val}</a> : <span style={{ fontSize: 12, color: "#3A3B52" }}>Not linked</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {detailTab === "tasks" && (
                <div style={{ background: "#12131F", border: "1px solid #1A1B2E", borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>TASKS</span>
                    <button onClick={() => setShowNewTask(!showNewTask)} style={{ padding: "5px 12px", background: "#4F46E530", color: "#A78BFA", border: "1px solid #4F46E540", borderRadius: 4, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>+ ADD TASK</button>
                  </div>
                  {showNewTask && (
                    <div style={{ background: "#0D0E1A", border: "1px solid #2A2B3D", borderRadius: 6, padding: 14, marginBottom: 16 }}>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>TASK</div>
                        <input value={newTask.title} onChange={e => setNewTask(n => ({ ...n, title: e.target.value }))} placeholder="Describe the task..." style={{ width: "100%", background: "#12131F", border: "1px solid #2A2B3D", borderRadius: 4, color: "#C8CAE0", fontSize: 13, padding: "8px 10px", fontFamily: "'IBM Plex Sans', sans-serif" }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>ASSIGN TO</div>
                          <select value={newTask.assigned_to} onChange={e => setNewTask(n => ({ ...n, assigned_to: e.target.value }))} style={{ width: "100%", background: "#12131F", border: "1px solid #2A2B3D", borderRadius: 4, color: "#C8CAE0", fontSize: 12, padding: "7px 8px", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                            {TEAM_MEMBERS.map(m => <option key={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "#8B8FA8", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>DUE DATE</div>
                          <input type="date" value={newTask.due_date} onChange={e => setNewTask(n => ({ ...n, due_date: e.target.value }))} style={{ width: "100%", background: "#12131F", border: "1px solid #2A2B3D", borderRadius: 4, color: "#C8CAE0", fontSize: 12, padding: "7px 8px", fontFamily: "'IBM Plex Sans', sans-serif" }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleAddTask(selected.id)} disabled={!newTask.title.trim() || saving} style={{ padding: "7px 16px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 4, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>{saving ? "SAVING..." : "ADD"}</button>
                        <button onClick={() => setShowNewTask(false)} style={{ padding: "7px 14px", background: "none", color: "#555878", border: "1px solid #2A2B3D", borderRadius: 4, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>CANCEL</button>
                      </div>
                    </div>
                  )}
                  {selectedTasks.length === 0 && !showNewTask && <div style={{ color: "#555878", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No tasks yet. Click + ADD TASK.</div>}
                  {selectedTasks.filter(t => !t.completed).map(task => <TaskRow key={task.id} task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} />)}
                  {selectedTasks.filter(t => t.completed).length > 0 && (
                    <>
                      <div style={{ fontSize: 10, color: "#383952", fontFamily: "'IBM Plex Mono', monospace", margin: "16px 0 8px" }}>COMPLETED</div>
                      {selectedTasks.filter(t => t.completed).map(task => <TaskRow key={task.id} task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} />)}
                    </>
                  )}
                </div>
              )}

              {detailTab === "h1" && (
                <div style={{ background: "#12131F", border: "1px solid #1A1B2E", borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", marginBottom: 12 }}>EXHIBIT H-1 CHECKLIST</div>
                  <H1Checklist items={selected.h1_items || {}} onChange={(itemId, val) => handleH1Change(selected.id, itemId, val)} />
                </div>
              )}

              {detailTab === "log" && (
                <div style={{ background: "#12131F", border: "1px solid #1A1B2E", borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, color: "#555878", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", marginBottom: 10 }}>ACTIVITY LOG</div>
                  {selectedLog.length === 0 ? <div style={{ color: "#555878", fontSize: 12 }}>No activity yet.</div> : [...selectedLog].reverse().map((entry, i) => <LogEntry key={i} entry={entry} />)}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
