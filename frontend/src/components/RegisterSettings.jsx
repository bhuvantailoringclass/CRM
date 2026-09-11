import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Reorder, useDragControls } from "framer-motion";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { REGISTERS } from "../registers";

const TYPE_OPTIONS = [
  ["text", "Text"], ["longtext", "Long Text"], ["number", "Number"], ["currency", "Currency"],
  ["date", "Date"], ["time", "Time"], ["email", "Email"], ["phone", "Phone"],
  ["dropdown", "Dropdown"], ["checkbox", "Checkbox"], ["yesno", "Yes/No"],
  ["image", "Image Upload"], ["file", "File Upload"], ["signature", "Signature"],
  ["student", "Student (link)"], ["course", "Course (link)"],
];
const typeLabel = (t) => (TYPE_OPTIONS.find(([v]) => v === t) || [t, t])[1];
const normType = (t) => (t === "select" ? "dropdown" : t === "textarea" ? "longtext" : t);
const isLocked = (f) => f.locked || f.auto;
const genKey = () => "custom_" + Math.random().toString(36).slice(2, 9);

function FieldRow({ field, onChange, onArchive }) {
  const controls = useDragControls();
  const locked = isLocked(field);
  return (
    <Reorder.Item value={field} dragListener={false} dragControls={controls}
      className="bg-card border border-border p-3 flex flex-col gap-3" data-testid={`field-row-${field.name}`}>
      <div className="flex items-center gap-3">
        <button onPointerDown={(e) => controls.start(e)} className="cursor-grab text-muted-foreground touch-none" data-testid={`drag-${field.name}`}>
          <Icons.GripVertical className="w-4 h-4" />
        </button>
        <input data-testid={`label-${field.name}`} value={field.label || ""}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          className="flex-1 h-9 px-2 bg-background border border-input focus:border-primary focus:outline-none text-sm font-medium" />
        <select data-testid={`type-${field.name}`} value={normType(field.type)} disabled={locked}
          onChange={(e) => onChange({ ...field, type: e.target.value })}
          className="h-9 px-2 bg-background border border-input text-sm disabled:opacity-50">
          {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="flex items-center flex-wrap gap-4 pl-7 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" data-testid={`required-${field.name}`} checked={!!field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })} /> Required
        </label>
        <button onClick={() => onChange({ ...field, hidden: !field.hidden })} data-testid={`hide-${field.name}`}
          className={`flex items-center gap-1.5 ${field.hidden ? "text-muted-foreground" : "text-foreground"}`}>
          {field.hidden ? <Icons.EyeOff className="w-3.5 h-3.5" /> : <Icons.Eye className="w-3.5 h-3.5" />}
          {field.hidden ? "Hidden" : "Visible"}
        </button>
        <button onClick={() => onChange({ ...field, locked: !field.locked })} data-testid={`lock-${field.name}`}
          className={`flex items-center gap-1.5 ${field.locked ? "text-primary" : "text-muted-foreground"}`} disabled={field.auto}>
          {locked ? <Icons.Lock className="w-3.5 h-3.5" /> : <Icons.Unlock className="w-3.5 h-3.5" />}
          {locked ? "Locked" : "Unlocked"}
        </button>
        <span className="text-muted-foreground">· {typeLabel(normType(field.type))} · key: {field.name}</span>
        <button onClick={() => onArchive(field)} disabled={locked} data-testid={`archive-${field.name}`}
          className="ml-auto flex items-center gap-1.5 text-destructive disabled:opacity-30">
          <Icons.Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
      {(normType(field.type) === "dropdown") && (
        <input data-testid={`options-${field.name}`} value={(field.options || []).join(", ")}
          onChange={(e) => onChange({ ...field, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="Dropdown options, comma separated"
          className="ml-7 h-9 px-2 bg-background border border-input focus:border-primary focus:outline-none text-sm" />
      )}
    </Reorder.Item>
  );
}

export default function RegisterSettings() {
  const { key } = useParams();
  const navigate = useNavigate();
  const staticCfg = REGISTERS[key];
  const [cfg, setCfg] = useState(staticCfg || { label: key, group: "Custom Registers", fields: [] });
  const [active, setActive] = useState([]);
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let fields = staticCfg?.fields || [];
    try {
      const res = await api.get(`/registers/${key}/schema`);
      if (res.data.fields) fields = res.data.fields;
      if (!staticCfg && res.data.label) setCfg({ label: res.data.label, group: res.data.group || "Custom Registers", fields: [] });
    } catch {}
    setActive(fields.filter((f) => !f.archived));
    setArchived(fields.filter((f) => f.archived));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [key]);

  const updateOne = (upd) => setActive((a) => a.map((f) => (f.name === upd.name ? upd : f)));

  const archive = (field) => {
    if (!window.confirm(`Delete the field "${field.label}"?\n\nIt will be moved to Archived — existing record data is kept and can be restored anytime.`)) return;
    setActive((a) => a.filter((f) => f.name !== field.name));
    setArchived((ar) => [...ar, { ...field, archived: true }]);
  };
  const restore = (field) => {
    setArchived((ar) => ar.filter((f) => f.name !== field.name));
    setActive((a) => [...a, { ...field, archived: false }]);
  };
  const purge = (field) => {
    if (!window.confirm(`Permanently remove "${field.label}" from the schema?\n\nExisting record values stay in the database but will no longer be shown or exported.`)) return;
    setArchived((ar) => ar.filter((f) => f.name !== field.name));
  };
  const addField = () => setActive((a) => [...a, { name: genKey(), label: "New Field", type: "text", required: false }]);

  const save = async () => {
    const fields = [...active, ...archived.map((f) => ({ ...f, archived: true }))];
    try {
      await api.put(`/registers/${key}/schema`, { fields });
      toast.success("Register structure saved");
      navigate(`/r/${key}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
  };

  const resetDefaults = async () => {
    if (!window.confirm("Restore this register to its default field structure? Your custom field settings will be removed (record data is kept).")) return;
    try {
      await api.delete(`/registers/${key}/schema`);
      setActive(cfg.fields.filter((f) => !f.archived));
      setArchived([]);
      toast.success("Restored to default structure");
    } catch { toast.error("Reset failed"); }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading settings…</div>;

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate(`/r/${key}`)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4" data-testid="back-btn">
        <Icons.ArrowLeft className="w-4 h-4" /> Back to {cfg.label}
      </button>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
            <Icons.Settings className="w-3 h-3" /> Register Settings
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{cfg.label}</h1>
          <p className="text-sm text-muted-foreground mt-1">Rename, reorder, add, hide, lock or archive fields. Changes apply everywhere — forms, table, search, exports & print.</p>
        </div>
        <div className="flex gap-2">
          {staticCfg && (
            <button onClick={resetDefaults} data-testid="reset-defaults-btn" className="h-10 px-3 text-sm border border-input flex items-center gap-2 hover:bg-black hover:text-white transition-colors">
              <Icons.RotateCcw className="w-4 h-4" /> Restore Defaults
            </button>
          )}
          <button onClick={save} data-testid="save-schema-btn" className="h-10 px-4 text-sm bg-primary text-primary-foreground flex items-center gap-2 hover:bg-black transition-colors">
            <Icons.Save className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </div>

      <Reorder.Group axis="y" values={active} onReorder={setActive} className="space-y-2">
        {active.map((f) => (
          <FieldRow key={f.name} field={f} onChange={updateOne} onArchive={archive} />
        ))}
      </Reorder.Group>

      <button onClick={addField} data-testid="add-field-btn" className="mt-3 w-full h-11 border border-dashed border-input text-sm flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors">
        <Icons.Plus className="w-4 h-4" /> Add Field
      </button>

      {archived.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
            <Icons.Archive className="w-3.5 h-3.5" /> Archived Fields ({archived.length})
          </h3>
          <div className="space-y-2">
            {archived.map((f) => (
              <div key={f.name} className="bg-muted/50 border border-border p-3 flex items-center gap-3 text-sm" data-testid={`archived-${f.name}`}>
                <span className="flex-1">{f.label} <span className="text-muted-foreground">· {typeLabel(normType(f.type))} · key: {f.name}</span></span>
                <button onClick={() => restore(f)} data-testid={`restore-${f.name}`} className="text-primary hover:underline flex items-center gap-1"><Icons.RotateCcw className="w-3.5 h-3.5" /> Restore</button>
                <button onClick={() => purge(f)} data-testid={`purge-${f.name}`} className="text-destructive hover:underline flex items-center gap-1"><Icons.X className="w-3.5 h-3.5" /> Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground border-t border-border pt-4">
        <Icons.ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
        Renaming a field only changes its display label — the underlying data key stays the same, so existing records are never lost. Locked fields cannot be deleted.
      </p>
    </div>
  );
}
