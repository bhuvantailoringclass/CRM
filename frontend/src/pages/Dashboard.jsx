import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import api from "../lib/api";

const fmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

function Card({ label, value, sub, icon, onClick, accent }) {
  return (
    <button onClick={onClick} data-testid={`stat-${label.replace(/\s+/g, "-").toLowerCase()}`}
      className="text-left bg-card border border-border p-6 hard-shadow">
      <div className="flex items-start justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        {React.createElement(Icons[icon] || Icons.Square, { className: `w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}` })}
      </div>
      <div className={`font-display text-4xl font-bold mt-4 tracking-tight ${accent ? "text-primary" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </button>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.get("/dashboard").then((r) => setD(r.data)).catch(() => {}); }, []);

  if (!d) return <div className="text-muted-foreground text-sm">Loading dashboard…</div>;

  return (
    <div>
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Overview</div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border mb-8">
        <Card label="Active Students" value={d.active_students} sub={`${d.total_students} total`} icon="GraduationCap" onClick={() => navigate("/r/admission")} />
        <Card label="Today's Attendance" value={`${d.attendance_pct}%`} sub={`${d.attendance_marked} marked today`} icon="CalendarCheck" onClick={() => navigate("/r/attendance")} />
        <Card label="Collected This Month" value={fmt(d.collected_month)} sub={`${fmt(d.total_due)} outstanding`} icon="Wallet" onClick={() => navigate("/r/fee")} />
        <Card label="Overdue Fees" value={d.overdue_count} sub="needs follow-up" icon="AlertTriangle" accent={d.overdue_count > 0} onClick={() => navigate("/r/fee")} />
        <Card label="Faculty" value={d.faculty_count} icon="Users" onClick={() => navigate("/r/faculty")} />
        <Card label="Assets Tracked" value={d.assets_total} icon="Package" onClick={() => navigate("/r/asset")} />
        <Card label="Fire Safety Due" value={d.fire_due_count} sub="within 30 days" icon="Flame" accent={d.fire_due_count > 0} onClick={() => navigate("/r/firesafety")} />
        <Card label="Recent Certificates" value={d.recent_certificates.length} icon="Award" onClick={() => navigate("/r/certificate")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border p-6">
          <div className="flex items-center gap-2 mb-4"><Icons.AlertTriangle className="w-4 h-4 text-primary" />
            <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Overdue Fee Alerts</h3></div>
          {d.overdue_fees.length === 0 ? <p className="text-sm text-muted-foreground">No overdue fees. </p> :
            d.overdue_fees.map((f, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-border/60 text-sm">
                <span>{f.student_id}</span>
                <span className="text-primary tabular">{fmt(f.balance_due)} · due {f.due_date}</span>
              </div>
            ))}
        </div>
        <div className="bg-card border border-border p-6">
          <div className="flex items-center gap-2 mb-4"><Icons.UserCheck className="w-4 h-4" />
            <h3 className="text-sm uppercase tracking-[0.15em] font-medium">Recent Visitors</h3></div>
          {d.recent_visitors.length === 0 ? <p className="text-sm text-muted-foreground">No visitor entries yet.</p> :
            d.recent_visitors.map((v, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-border/60 text-sm">
                <span>{v.name}</span>
                <span className="text-muted-foreground">{v.purpose || "—"} · {v.date}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
