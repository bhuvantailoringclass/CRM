import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash;
    const sid = new URLSearchParams(hash.replace("#", "")).get("session_id");
    (async () => {
      try {
        const res = await api.post("/auth/session", { session_id: sid });
        setUser(res.data);
        window.history.replaceState({}, "", "/dashboard");
        const role = res.data.role;
        navigate(role === "teacher" ? "/attendance" : "/dashboard", { replace: true, state: { user: res.data } });
      } catch {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Signing in…</div>
    </div>
  );
}
