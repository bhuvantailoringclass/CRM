import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
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
  const [audit, setAudit] = useState(null); // array or null
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const dateField = cfg.fields.find((f) => f.type === "date")?.name;
  const cols = cfg.fields;

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
    setQ(""); setPage(0); setFrom(""); setTo(""); setAudit(null);
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

  const updateField = (f, v) => {
    setPanel((p) => {
      const data = { ...p.data, [f.name]: v };
      if (f.type === "student") {
        const s = students.find((x) => x.student_id === v);
        if (s) {
          if (cfg.fields.some((ff) => ff.name === "student_name")) data.student_name = s.name;
          if (cfg.fields.some((ff) => ff.name === "course")) data.course = s.course;
          if (cfg.fields.some((ff) => ff.name === "batch_id")) data.batch_id = s.batch_id;
        }
      }
      return { ...p, data };
    });
  };

  const save = async () => {
    const dd = panel.data;
    for (const f of cfg.fields) if (f.required && !dd[f.name]) return toast.error(`${f.label} is required`);
    try {
      if (panel.mode === "add") await api.post(`/registers/${key}`, dd);
      else await api.put(`/registers/${key}/${dd.id}`, dd);
      toast.success(panel.mode === "add" ? "Entry added" : "Entry updated");
      setPanel(null); load();
    } catch { toast.error("Save failed"); }
  };

  const remove = async (row) => {
    if (!window.confirm("Delete this entry?")) return;
    try { await api.delete(`/registers/${key}/${row.id}`); toast.success("Deleted"); load(); }
    catch { toast.error("Delete failed"); }
  };

  const download = async (fmt) => {
    try {
      const path = fmt === "xlsx" ? `/registers/${key}/export.xlsx` : `/registers/${key}/export`;
      const res = await api.get(path, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `${key}.${fmt === "xlsx" ? "xlsx" : "csv"}`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
  };

  const printOut = () => {
    const w = window.open("", "_blank");
    if (!w) return toast.error("Allow pop-ups to print/PDF");
    const head = ["#", ...cols.map((c) => c.label)];
    const body = filtered.map((r, i) => [i + 1, ...cols.map((c) => r[c.name] ?? "")]);
    w.document.write(`<html><head><title>${cfg.label} — BIFD</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0} .sub{color:#666;font-size:12px;margin:4px 0 16px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
        th{background:#f2f2f2;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
        tr:nth-child(even){background:#fafafa}
      </style></head><body>
      <h1>${cfg.label}</h1>
      <div class="sub">Bhuvan Institute of Fashion Design · ${filtered.length} records · Generated ${new Date().toLocaleString()}</div>
      <table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${body.map((row) => `<tr>${row.map((c) => `<td>${String(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  const openAudit = async () => {
    try {
      const res = await api.get(`/registers/${key}/audit`);
      setAudit(res.data);
    } catch { toast.error("Could not load audit log"); }
  };

  const Btn = ({ onClick, icon, label, testid, primary }) => (
    <button data-testid={testid} onClick={onClick}
      className={`h-10 px-3 text-sm flex items-center gap-2 transition-colors ${primary ? "bg-primary text-primary-foreground hover:bg-black" : "border border-input hover:bg-black hover:text-white"}`}>
      {React.createElement(Icons[icon], { className: "w-4 h-4" })}<span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{cfg.group}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{cfg.label}</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} records{cfg.subtitle ? ` · ${cfg.subtitle}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn testid="audit-btn" onClick={openAudit} icon="ScrollText" label="Audit Log" />
          <Btn testid="excel-btn" onClick={() => download("xlsx")} icon="Sheet" label="Excel" />
          <Btn testid="pdf-btn" onClick={printOut} icon="FileText" label="PDF" />
          <Btn testid="print-btn" onClick={printOut} icon="Printer" label="Print" />
          <Btn testid="add-entry-btn" onClick={openAdd} icon="Plus" label="Add New Entry" primary />
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
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Sl. No.</th>
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
              <tr><td colSpan={cols.length + 2} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={cols.length + 2} className="px-4 py-10 text-center text-muted-foreground">No records yet. Click "Add New Entry".</td></tr>
            ) : paged.map((row, i) => (
              <tr key={row.id} data-testid={`row-${row.id}`} className="border-b border-border/60 hover:bg-primary/[0.03]">
                <td className="px-4 py-3 tabular text-muted-foreground">{page * 25 + i + 1}</td>
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
                    onChange={(v) => updateField(f, v)} />
                </div>
              ))}
              <button data-testid="save-entry-btn" onClick={save} className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-black transition-colors mt-2">
                {panel.mode === "add" ? "Create Entry" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {audit !== null && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40" onClick={() => setAudit(null)} />
          <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-card">
              <h2 className="font-display text-2xl font-bold">Audit Log</h2>
              <button onClick={() => setAudit(null)}><Icons.X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              {audit.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> :
                audit.map((a) => (
                  <div key={a.id} className="border border-border p-3 text-sm">
                    <div className="flex justify-between">
                      <span className={`text-[11px] uppercase tracking-wide ${a.action === "delete" ? "text-destructive" : a.action === "create" ? "text-green-700" : "text-primary"}`}>{a.action}</span>
                      <span className="text-[11px] text-muted-foreground tabular">{new Date(a.at).toLocaleString()}</span>
                    </div>
                    <div className="text-muted-foreground mt-1">{a.user_email}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
