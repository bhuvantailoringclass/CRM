import React, { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const STATUSES = [
  { key: "present", label: "Present", cls: "bg-green-600 text-white border-green-600" },
  { key: "absent", label: "Absent", cls: "bg-primary text-white border-primary" },
  { key: "late", label: "Late", cls: "bg-amber-500 text-white border-amber-500" },
];

export default function TeacherAttendance() {
  const { user } = useAuth();
  const courses = user?.courses || [];
  const [course, setCourse] = useState(courses[0] || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadRoster = async () => {
    if (!course) return;
    setLoading(true);
    try {
      const res = await api.get(`/teacher/roster?course=${encodeURIComponent(course)}`);
      setRoster(res.data);
      const init = {};
      res.data.forEach((s) => { init[s.student_id] = { status: "present", remark: "" }; });
      setMarks(init);
    } catch { toast.error("Could not load roster"); }
    setLoading(false);
  };

  useEffect(() => { loadRoster(); /* eslint-disable-next-line */ }, [course]);

  const submit = async () => {
    if (!roster.length) return toast.error("No students to mark");
    setSubmitting(true);
    try {
      const entries = roster.map((s) => ({
        student_id: s.student_id, student_name: s.name,
        status: marks[s.student_id].status, remark: marks[s.student_id].remark,
      }));
      const res = await api.post("/teacher/attendance", { date, course, entries });
      if (res.data.saved === 0) toast.error("Attendance already submitted for this date");
      else toast.success(`Attendance submitted for ${res.data.saved} students`);
    } catch { toast.error("Submit failed"); }
    setSubmitting(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Attendance Entry</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Mark Attendance</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-card border border-border p-4">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Course</label>
          <select data-testid="course-select" value={course} onChange={(e) => setCourse(e.target.value)}
            className="w-full h-11 px-3 bg-background border border-input focus:border-primary focus:outline-none text-sm">
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Date</label>
          <input data-testid="date-select" type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full h-11 px-3 bg-background border border-input focus:border-primary focus:outline-none text-sm" />
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading roster…</p> :
        roster.length === 0 ? (
          <div className="bg-card border border-border p-10 text-center text-muted-foreground text-sm">
            No active students found for this course.
          </div>
        ) : (
          <div className="space-y-2">
            {roster.map((s) => (
              <div key={s.student_id} data-testid={`roster-${s.student_id}`} className="bg-card border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground tabular">{s.student_id}</div>
                </div>
                <div className="flex gap-1">
                  {STATUSES.map((st) => {
                    const active = marks[s.student_id]?.status === st.key;
                    return (
                      <button key={st.key} data-testid={`mark-${s.student_id}-${st.key}`}
                        onClick={() => setMarks((m) => ({ ...m, [s.student_id]: { ...m[s.student_id], status: st.key } }))}
                        className={`px-3 h-10 text-xs uppercase tracking-wide border transition-colors ${active ? st.cls : "border-input text-muted-foreground hover:border-foreground"}`}>
                        {st.label}
                      </button>
                    );
                  })}
                </div>
                <input placeholder="Remark" data-testid={`remark-${s.student_id}`}
                  value={marks[s.student_id]?.remark || ""}
                  onChange={(e) => setMarks((m) => ({ ...m, [s.student_id]: { ...m[s.student_id], remark: e.target.value } }))}
                  className="h-10 px-2 bg-background border border-input text-sm sm:w-40 focus:border-primary focus:outline-none" />
              </div>
            ))}
            <button data-testid="submit-attendance-btn" onClick={submit} disabled={submitting}
              className="w-full h-14 bg-primary text-primary-foreground font-medium hover:bg-black transition-colors mt-4 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit Attendance"}
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              <Icons.Lock className="w-3 h-3 inline mr-1" />Entries are locked after submission. Contact admin to change past records.
            </p>
          </div>
        )}
    </div>
  );
}

export function TeacherHistory() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/teacher/attendance").then((r) => setRows(r.data)).catch(() => {}); }, []);
  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Read-only</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">My Attendance History</h1>
      </div>
      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm zebra">
          <thead><tr className="border-b border-border">
            {["Date", "Course", "Student", "Status", "Remark"].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No submissions yet.</td></tr> :
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-3 tabular">{r.date}</td>
                  <td className="px-4 py-3">{r.course}</td>
                  <td className="px-4 py-3">{r.student_name} <span className="text-muted-foreground text-xs">{r.student_id}</span></td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 text-[11px] uppercase border border-border bg-muted">{r.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.remark || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
