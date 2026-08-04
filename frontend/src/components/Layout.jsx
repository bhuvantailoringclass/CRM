import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import { REGISTERS, GROUPS } from "../registers";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const Icon = ({ name, className }) => {
  const C = Icons[name] || Icons.Square;
  return <C className={className} />;
};

function GroupBlock({ group, open, toggle }) {
  const items = Object.entries(REGISTERS).filter(([, r]) => r.group === group);
  return (
    <div className="mb-1">
      <button
        onClick={toggle}
        data-testid={`nav-group-${group}`}
        className="w-full flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        {group}
        <Icons.ChevronDown className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && items.map(([key, r]) => (
        <NavLink
          key={key}
          to={`/r/${key}`}
          data-testid={`nav-${key}`}
          className={({ isActive }) =>
            `flex items-center gap-3 pl-6 pr-4 py-2 text-sm border-l-2 transition-colors duration-150 ${
              isActive
                ? "border-primary bg-primary/5 text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.03]"
            }`
          }
        >
          <Icon name={r.icon} className="w-4 h-4" />
          {r.label}
        </NavLink>
      ))}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(GROUPS.map((g) => [g, true]))
  );
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  const search = async (val) => {
    setQ(val);
    if (!val || val.length < 2) { setResults(null); return; }
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(val)}`);
      setResults(res.data);
    } catch {}
  };

  const SidebarInner = (
    <>
      <div className="px-5 py-6 border-b border-border">
        <div className="font-display text-3xl font-black tracking-tight leading-none">BIFD</div>
        <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground mt-1">Institute ERP</div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {isAdmin && (
          <NavLink to="/dashboard" data-testid="nav-dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm border-l-2 mb-2 ${
                isActive ? "border-primary bg-primary/5 font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
            <Icons.LayoutDashboard className="w-4 h-4" /> Dashboard
          </NavLink>
        )}
        {!isAdmin && (
          <>
            <NavLink to="/attendance" data-testid="nav-attendance-entry"
              className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 text-sm border-l-2 ${isActive ? "border-primary bg-primary/5 font-medium" : "border-transparent text-muted-foreground"}`}>
              <Icons.CalendarCheck className="w-4 h-4" /> Mark Attendance
            </NavLink>
            <NavLink to="/attendance-history" data-testid="nav-attendance-history"
              className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 text-sm border-l-2 ${isActive ? "border-primary bg-primary/5 font-medium" : "border-transparent text-muted-foreground"}`}>
              <Icons.History className="w-4 h-4" /> My History
            </NavLink>
          </>
        )}
        {isAdmin && GROUPS.map((g) => (
          <GroupBlock key={g} group={g} open={openGroups[g]}
            toggle={() => setOpenGroups((s) => ({ ...s, [g]: !s[g] }))} />
        ))}
        {isAdmin && (
          <div className="mt-2 border-t border-border pt-2">
            <NavLink to="/teachers" data-testid="nav-teachers"
              className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 text-sm border-l-2 ${isActive ? "border-primary bg-primary/5 font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icons.UserCog className="w-4 h-4" /> Teacher Accounts
            </NavLink>
          </div>
        )}
      </nav>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black text-white flex items-center justify-center text-xs font-bold uppercase">
            {user?.name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-primary">{user?.role}</div>
          </div>
          <button onClick={logout} data-testid="logout-btn" className="text-muted-foreground hover:text-primary">
            <Icons.LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card fixed inset-y-0 left-0">
        {SidebarInner}
      </aside>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <aside className="w-64 flex flex-col border-r border-border bg-card">{SidebarInner}</aside>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center gap-4 px-4 sm:px-6 sticky top-0 z-30">
          <button className="md:hidden" onClick={() => setMobileOpen(true)} data-testid="mobile-menu-btn">
            <Icons.Menu className="w-5 h-5" />
          </button>
          {isAdmin && (
            <div className="relative flex-1 max-w-md">
              <Icons.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid="global-search"
                value={q}
                onChange={(e) => search(e.target.value)}
                placeholder="Search students & faculty…"
                className="w-full h-9 pl-9 pr-3 bg-muted border border-transparent focus:border-primary focus:outline-none text-sm"
              />
              {results && (
                <div className="absolute mt-1 w-full bg-card border border-border shadow-lg z-50 max-h-80 overflow-y-auto">
                  {[...(results.students || []).map((s) => ({ ...s, _t: "Student" })),
                    ...(results.faculty || []).map((f) => ({ ...f, _t: "Faculty" }))].map((r, i) => (
                    <div key={i} onClick={() => { setResults(null); setQ(""); navigate(r._t === "Student" ? "/r/admission" : "/r/faculty"); }}
                      className="px-3 py-2 text-sm hover:bg-muted cursor-pointer flex justify-between">
                      <span>{r.name}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">{r._t}</span>
                    </div>
                  ))}
                  {!results.students?.length && !results.faculty?.length && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="ml-auto text-xs uppercase tracking-[0.2em] text-muted-foreground hidden sm:block">
            Bhuvan Institute of Fashion Design
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
