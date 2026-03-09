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
    <div styl
