import React, { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { REGISTERS } from "../registers";

export default function RegisterManagement() {
  const [builtins, setBuiltins] = useState([]);
  const [customs, setCustoms] = useState([]);
  const [panel, setPanel] = useState(null); // {name, key}
  const [editing, setEditing] = useState(null); // {key, label}
  const builtinLabels = Object.fromEntries(Object.entries(REGISTERS).map(([k, r]) => [k, r.label]));

  const load = async () => {
    try {
      const r = await api.get("/register-mgmt");
      setBuiltins((r.data.builtins || []).map((b) => ({ ...b, label: b.label || builtinLabels[b.key] || b.key })));
      setCustoms(r.data.customs || []);
    } catch { toast.error("Failed to load"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const allLabels = () => [...builtins, ...customs].map((r) => (r.label || "").toLowerCase());

  const add = async () => {
    const name = (panel.name || "").trim();
    if (!name) return toast.error("Enter a register name");
    if (allLabels().includes(name.toLowerCase())) return toast.error("A register with this name already exists");
    try {
      await api.post("/register-mgmt", { label: name, key: (panel.key || "").trim() || undefined });
      toast.success("Register created"); setPanel(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Create failed"); }
  };

  const toggle = async (row) => {
    try { await api.put(`/register-mgmt/${row.key}`, { active: !row.active }); load(); }
    catch { toast.error("Update failed"); }
  };

  const saveRename = async (key) => {
    const label = (editing?.label || "").trim();
    if (!label) return toast.error("Name cannot be empty");
    try {
      await api.put(`/register-mgmt/${key}`, { label });
      toast.success("Renamed"); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Rename failed"); }
  };

  const Row = ({ row, custom }) => (
    <tr className="border-b border-border/60" data-testid={`reg-row-${row.key}`}>
      <td className="px-4 py-3 font-medium">
        {editing?.key === row.key ? (
          <span className="flex items-center gap-2">
            <input data-testid={`rename-input-${row.key}`} value={editing.label}
              onChange={(e) => setEditing({ key: row.key, label: e.target.value })}
              className="h-8 px-2 bg-background border border-input focus:border-primary focus:outline-none text-sm" />
            <button data-testid={`save-rename-${row.key}`} onClick={() => saveRename(row.key)} className="text-green-700"><Icons.Check className="w-4 h-4" /></button>
            <button onClick={() => setEditing(null)} className="text-muted-foreground"><Icons.X className="w-4 h-4" /></button>
          </span>
        ) : row.label}
      </td>
      <td className="px-4 py-3 tabular text-muted-foreground">{row.key}</td>
      <td className="px-4 py-3">
        <span className="inline-block px-2 py-0.5 text-[11px] uppercase tracking-wide border border-border bg-muted">{custom ? "Custom" : "Built-in"}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 text-[11px] uppercase border ${row.active ? "border-green-600 text-green-700" : "border-border text-muted-foreground"}`}>
          {row.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <button data-testid={`rename-${row.key}`} onClick={() => setEditing({ key: row.key, label: row.label })}
          className="text-muted-foreground hover:text-primary mr-3"><Icons.Pencil className="w-4 h-4 inline" /></button>
        <button data-testid={`toggle-active-${row.key}`} onClick={() => toggle(row)}
          className="text-muted-foreground hover:text-primary" title={row.active ? "Deactivate" : "Activate"}>
          {row.active ? <Icons.ToggleRight className="w-5 h-5 inline text-green-700" /> : <Icons.ToggleLeft className="w-5 h-5 inline" />}
        </button>
      </td>
    </tr>
  );

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Admin Settings</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Register Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View all registers, add new ones, rename, and activate or deactivate — no code changes needed. Deactivated registers are hidden from the sidebar; their data is preserved.
          </p>
        </div>
        <button data-testid="add-register-btn" onClick={() => setPanel({ name: "", key: "" })}
          className="h-10 px-4 bg-primary text-primary-foreground text-sm flex items-center gap-2 hover:bg-black transition-colors">
          <Icons.Plus className="w-4 h-4" /> Add New Register
        </button>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm zebra">
          <thead><tr className="border-b border-border">
            {["Register Name", "Register ID", "Type", "Status", ""].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {customs.map((r) => <Row key={r.key} row={r} custom />)}
            {builtins.map((r) => <Row key={r.key} row={r} />)}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {customs.length} custom · {builtins.length} built-in registers. New registers appear under "Custom Registers" in the sidebar with starter fields (Date, Particulars, Amount, Remarks) that you can customise via Register Settings.
      </p>

      {panel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40" onClick={() => setPanel(null)} />
          <div className="w-full max-w-md bg-card h-full overflow-y-auto border-l border-border">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="font-display text-2xl font-bold">Add New Register</h2>
              <button onClick={() => setPanel(null)}><Icons.X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Register Name *</label>
                <input data-testid="reg-name-input" value={panel.name}
                  onChange={(e) => setPanel((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Library Fine Register" className="w-full h-10 px-3 bg-background border border-input focus:border-primary focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Register ID (optional)</label>
                <input data-testid="reg-key-input" value={panel.key}
                  onChange={(e) => setPanel((p) => ({ ...p, key: e.target.value }))}
                  placeholder="auto-generated from name" className="w-full h-10 px-3 bg-background border border-input focus:border-primary focus:outline-none text-sm" />
                <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers and underscores. Must be unique.</p>
              </div>
              <button data-testid="save-register-btn" onClick={add} className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-black transition-colors">Create Register</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
