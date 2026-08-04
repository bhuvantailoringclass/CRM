import React, { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [panel, setPanel] = useState(null);

  const load = () => api.get("/teachers").then((r) => setTeachers(r.data)).catch(() => {});
  useEffect(() => {
    load();
    api.get("/registers/course").then((r) => setCourses(r.data)).catch(() => {});
  }, []);

  const openAdd = () => setPanel({ name: "", email: "", courses: [], active: true, _new: true });
  const openEdit = (t) => setPanel({ ...t, _new: false });

  const toggleCourse = (c) =>
    setPanel((p) => ({ ...p, courses: p.courses.includes(c) ? p.courses.filter((x) => x !== c) : [...p.courses, c] }));

  const save = async () => {
    if (!panel.name || !panel.email) return toast.error("Name and email required");
    try {
      const body = { name: panel.name, email: panel.email, courses: panel.courses, active: panel.active };
      if (panel._new) await api.post("/teachers", body);
      else await api.put(`/teachers/${panel.id}`, body);
      toast.success("Saved"); setPanel(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
  };

  const remove = async (t) => {
    if (!window.confirm("Delete this teacher account?")) return;
    await api.delete(`/teachers/${t.id}`); toast.success("Deleted"); load();
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Access Control</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Teacher Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Teachers log in with Google using the email you register here.</p>
        </div>
        <button data-testid="add-teacher-btn" onClick={openAdd} className="h-10 px-4 bg-primary text-primary-foreground text-sm flex items-center gap-2 hover:bg-black transition-colors">
          <Icons.Plus className="w-4 h-4" /> Add Teacher
        </button>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm zebra">
          <thead><tr className="border-b border-border">
            {["Name", "Email", "Assigned Courses", "Status", ""].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {teachers.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No teachers yet.</td></tr> :
              teachers.map((t) => (
                <tr key={t.id} data-testid={`teacher-${t.id}`} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.email}</td>
                  <td className="px-4 py-3">{t.courses?.join(", ") || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-[11px] uppercase border ${t.active ? "border-green-600 text-green-700" : "border-border text-muted-foreground"}`}>
                      {t.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button data-testid={`edit-teacher-${t.id}`} onClick={() => openEdit(t)} className="text-muted-foreground hover:text-primary mr-3"><Icons.Pencil className="w-4 h-4 inline" /></button>
                    <button data-testid={`delete-teacher-${t.id}`} onClick={() => remove(t)} className="text-muted-foreground hover:text-destructive"><Icons.Trash2 className="w-4 h-4 inline" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {panel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40" onClick={() => setPanel(null)} />
          <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="font-display text-2xl font-bold">{panel._new ? "Add Teacher" : "Edit Teacher"}</h2>
              <button onClick={() => setPanel(null)}><Icons.X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Name *</label>
                <input data-testid="teacher-name" value={panel.name} onChange={(e) => setPanel((p) => ({ ...p, name: e.target.value }))} className="w-full h-10 px-3 bg-background border border-input focus:border-primary focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Google Email *</label>
                <input data-testid="teacher-email" value={panel.email} onChange={(e) => setPanel((p) => ({ ...p, email: e.target.value }))} className="w-full h-10 px-3 bg-background border border-input focus:border-primary focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Assigned Courses</label>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-border p-2">
                  {courses.length === 0 ? <p className="text-xs text-muted-foreground p-2">Add courses in the Course Register first.</p> :
                    courses.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-muted cursor-pointer">
                        <input type="checkbox" checked={panel.courses.includes(c.name)} onChange={() => toggleCourse(c.name)} />
                        {c.name}
                      </label>
                    ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" data-testid="teacher-active" checked={panel.active} onChange={(e) => setPanel((p) => ({ ...p, active: e.target.checked }))} />
                Account active
              </label>
              <button data-testid="save-teacher-btn" onClick={save} className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-black transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
