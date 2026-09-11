import React, { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { getCompany, clearCompanyCache, COMPANY_DEFAULTS } from "../lib/company";

const FIELDS = [
  { name: "name", label: "Company / Organization Name", required: true },
  { name: "short_name", label: "Short Name / Acronym", hint: "Shown in the sidebar & login (e.g. BIFD)" },
  { name: "address", label: "Company Address", textarea: true },
  { name: "phone", label: "Phone Number" },
  { name: "email", label: "Email Address", type: "email" },
  { name: "website", label: "Website (optional)", type: "url" },
];

export default function CompanySettings() {
  const [form, setForm] = useState(COMPANY_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCompany(true).then((c) => { setForm(c); setLoading(false); });
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Max logo size is 2MB");
    const reader = new FileReader();
    reader.onload = () => set("logo", reader.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Company name is required");
    setSaving(true);
    try {
      await api.put("/company-settings", form);
      clearCompanyCache();
      await getCompany(true);
      toast.success("Company settings saved");
    } catch { toast.error("Save failed"); }
    setSaving(false);
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading settings…</div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Admin Settings</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Company Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          White-label identity for this installation. The company name and logo update everywhere they are already displayed — sidebar, header, login page, and print/PDF views.
        </p>
      </div>

      <div className="bg-card border border-border p-6 space-y-5">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Company Logo</label>
          <div className="flex items-center gap-4">
            {form.logo ? (
              <img src={form.logo} alt="logo" data-testid="logo-preview" className="h-14 w-14 object-contain border border-border bg-white" />
            ) : (
              <div className="h-14 w-14 border border-dashed border-input flex items-center justify-center text-muted-foreground">
                <Icons.Image className="w-5 h-5" />
              </div>
            )}
            <div className="flex gap-2">
              <label className="h-9 px-3 border border-input text-sm flex items-center gap-2 cursor-pointer hover:bg-black hover:text-white transition-colors">
                <Icons.Upload className="w-4 h-4" /> Upload
                <input type="file" accept="image/*" data-testid="logo-upload" onChange={uploadLogo} className="hidden" />
              </label>
              {form.logo && (
                <button data-testid="logo-remove" onClick={() => set("logo", "")} className="h-9 px-3 border border-input text-sm hover:text-destructive">Remove</button>
              )}
            </div>
          </div>
        </div>

        {FIELDS.map((f) => (
          <div key={f.name}>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
              {f.label}{f.required && <span className="text-primary"> *</span>}
            </label>
            {f.textarea ? (
              <textarea data-testid={`company-${f.name}`} value={form[f.name] || ""} onChange={(e) => set(f.name, e.target.value)}
                className="w-full h-20 px-3 py-2 bg-background border border-input focus:border-primary focus:outline-none text-sm" />
            ) : (
              <input data-testid={`company-${f.name}`} type={f.type || "text"} value={form[f.name] || ""}
                onChange={(e) => set(f.name, e.target.value)} placeholder={f.hint || ""}
                className="w-full h-10 px-3 bg-background border border-input focus:border-primary focus:outline-none text-sm" />
            )}
          </div>
        ))}

        <button data-testid="save-company-btn" onClick={save} disabled={saving}
          className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-black transition-colors disabled:opacity-50">
          {saving ? "Saving…" : "Save Company Settings"}
        </button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        <Icons.ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
        Settings are stored in the database and persist across restarts. Defaults remain Bhuvan Institute of Fashion Design (BIFD) until changed.
      </p>
    </div>
  );
}
