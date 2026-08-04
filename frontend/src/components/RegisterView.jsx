import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import api, { API } from "../lib/api";
import { REGISTERS } from "../registers";

function FormField({ field, value, onChange, students, courses }) {
  const base = "w-full h-10 px-3 bg-background border border-input focus:border-primary focus:outline-none text-sm";
  if (field.type === "textarea")
    return <textarea data-testid={`field-${field.name}`} value={value || ""} onChange={(e) => onChange(e.target.value)} className={base + " h-20 py-2"} />;
  if (field.type === "select")
    return (
      <select data-testid={`field-${field.name}`} value={value || ""} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">—</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  if (field.type === "student")
    return (
      <select data-testid={`field-${field.name}`} value={value || ""} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">Select student</option>
        {students.map((s) => <option key={s.student_id} value={s.student_id}>{s.student_id} — {s.name}</option>)}
      </select>
    );
  if (field.type === "course")
    return (
      <select data-testid={`field-${field.name}`} value={value || ""} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">Select course</option>
        {courses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
      </select>
    );
  return (
    <input data-testid={`field-${field.name}`} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={value || ""} disabled={field.auto} placeholder={field.hint || ""}
      onChange={(e) => onChange(e.target.value)} className={base + (field.auto ? " bg-muted text-muted-foreground" : "")} />
  );
}

export default function RegisterView() {
  const { key } = useParams();
  const cfg = REGISTERS[key];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ col: null, dir: 1 });
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState(null); // {mode, data}
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const dateField = cfg.fields.find((f) => f.type === "date")?.name;
  const cols = cfg.fields.slice(0, 7);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/registers/${key}`);
      setRows(res.data);
    } catch { toast.error("Failed to load"); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    setQ(""); setPage(0); setFrom(""); setTo("");
    api.get("/registers/admission").then((r) => setStudents(r.data)).catch(() => {});
    api.get("/registers/course").then((r) => setCourses(r.data)).catch(() => {});
    // eslint-disable-next-line
  }, [key]);

  const filtered = useMemo(() => {
    let out = rows;
    if (q) { const ql = q.toLowerCase(); out = out.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(ql))); }
    if (dateField && from) out = out.filter((r) => (r[dateField] || "") >= from);
    if (dateField && to) out = out.filter((r) => (r[dateField] || "") <= to);
    if (sort.col) out = [...out].sort((a, b) => (String(a[sort.col] || "") > String(b[sort.col] || "") ? 1 : -1) * sort.dir);
    return out;
  }, [rows, q, sort, from, to, dateField]);

  const paged = filtered.slice(page * 25, page * 25 + 25);

  const openAdd = () => {
    const data = {};
    cfg.fields.forEach((f) => { if (f.default) data[f.name] = f.default; });
    setPanel({ mode: "add", data });
  };
  const openEdit = (row) => setPanel({ mode: "edit", data: { ...row } });

  const save = async () => {
    const d = panel.data;
    for (const f of cfg.fields) if (f.required && !d[f.name]) return toast.error(`${f.label} is required`);
    try {
      if (panel.mode === "add") await api.post(`/registers/${key}`, d);
      else await api.put(`/registers/${key}/${d.id}`, d);
      toast.success(panel.mode === "add" ? "Entry added" : "Entry updated");
      setPanel(null); load();
    } catch { toast.error("Save failed"); }
  };

  const remove = async (row) => {
    if (!window.confirm("Delete this entry?")) return;
    try { await api.delete(`/registers/${key}/${row.id}`); toast.success("Deleted"); load(); }
    catch { toast.error("Delete failed"); }
  };

  const exportCsv = async () => {
    try {
      const res = await api.get(`/registers/${key}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `${key}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{cfg.group}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{cfg.label}</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} records{cfg.subtitle ? ` · ${cfg.subtitle}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="export-btn" onClick={exportCsv} className="h-10 px-4 border border-input text-sm flex items-center gap-2 hover:bg-black hover:text-white transition-colors">
            <Icons.Download className="w-4 h-4" /> Export CSV
          </button>
          <button data-testid="add-entry-btn" onClick={openAdd} className="h-10 px-4 bg-primary text-primary-foreground text-sm flex items-center gap-2 hover:bg-black transition-colors">
            <Icons.Plus className="w-4 h-4" /> Add New Entry
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Icons.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input data-testid="table-search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Search…" className="w-full h-10 pl-9 pr-3 bg-card border border-input focus:border-primary focus:outline-none text-sm" />
        </div>
        {dateField && (
          <div className="flex items-center gap-2 text-sm">
            <input data-testid="filter-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 px-2 bg-card border border-input text-sm" />
            <span className="text-muted-foreground">→</span>
            <input data-testid="filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 px-2 bg-card border border-input text-sm" />
          </div>
        )}
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm zebra">
          <thead>
            <tr className="border-b border-border">
              {cols.map((f) => (
                <th key={f.name} onClick={() => setSort((s) => ({ col: f.name, dir: s.col === f.name ? -s.dir : 1 }))}
                  className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground cursor-pointer whitespace-nowrap hover:text-foreground">
                  {f.label} {sort.col === f.name && (sort.dir === 1 ? "▲" : "▼")}
                </th>
              ))}
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length + 1} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={cols.length + 1} className="px-4 py-10 text-center text-muted-foreground">No records yet. Click "Add New Entry".</td></tr>
            ) : paged.map((row) => (
              <tr key={row.id} data-testid={`row-${row.id}`} className="border-b border-border/60 hover:bg-primary/[0.03]">
                {cols.map((f) => (
                  <td key={f.name} className={`px-4 py-3 whitespace-nowrap ${f.type === "number" ? "text-right tabular" : ""}`}>
                    {f.type === "select" && row[f.name] ? (
                      <span className="inline-block px-2 py-0.5 text-[11px] uppercase tracking-wide border border-border bg-muted">{row[f.name]}</span>
                    ) : (row[f.name] ?? "—")}
                  </td>
                ))}
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button data-testid={`edit-${row.id}`} onClick={() => openEdit(row)} className="text-muted-foreground hover:text-primary mr-3"><Icons.Pencil className="w-4 h-4 inline" /></button>
                  <button data-testid={`delete-${row.id}`} onClick={() => remove(row)} className="text-muted-foreground hover:text-destructive"><Icons.Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 25 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">Page {page + 1} of {Math.ceil(filtered.length / 25)}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-9 px-3 border border-input disabled:opacity-40">Prev</button>
            <button disabled={(page + 1) * 25 >= filtered.length} onClick={() => setPage((p) => p + 1)} className="h-9 px-3 border border-input disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {panel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40" onClick={() => setPanel(null)} />
          <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-card">
              <h2 className="font-display text-2xl font-bold">{panel.mode === "add" ? "Add Entry" : "Edit Entry"}</h2>
              <button onClick={() => setPanel(null)} data-testid="close-panel"><Icons.X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {cfg.fields.map((f) => (
                <div key={f.name}>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
                    {f.label}{f.required && <span className="text-primary"> *</span>}
                  </label>
                  <FormField field={f} value={panel.data[f.name]} students={students} courses={courses}
                    onChange={(v) => setPanel((p) => ({ ...p, data: { ...p.data, [f.name]: v } }))} />
                </div>
              ))}
              <button data-testid="save-entry-btn" onClick={save} className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-black transition-colors mt-2">
                {panel.mode === "add" ? "Create Entry" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
