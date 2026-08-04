import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import RegisterView from "@/components/RegisterView";
import TeacherAttendance, { TeacherHistory } from "@/pages/TeacherAttendance";
import Teachers from "@/pages/Teachers";

function Loading() {
  return <div className="min-h-screen flex items-center justify-center text-xs uppercase tracking-[0.3em] text-muted-foreground">Loading…</div>;
}

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "denied") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="font-display text-4xl font-bold">Access denied</div>
      <p className="text-muted-foreground max-w-sm">Your account is not authorised. Ask the institute admin to register your email.</p>
    </div>
  );
  if (adminOnly && user.role !== "admin") return <Navigate to="/attendance" replace />;
  return children;
}

function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user?.role === "admin") return <Navigate to="/dashboard" replace />;
  if (user?.role === "teacher") return <Navigate to="/attendance" replace />;
  return <Login />;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<HomeGate />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/dashboard" element={<Protected adminOnly><Dashboard /></Protected>} />
        <Route path="/teachers" element={<Protected adminOnly><Teachers /></Protected>} />
        <Route path="/r/:key" element={<Protected adminOnly><RegisterView /></Protected>} />
        <Route path="/attendance" element={<TeacherAttendance />} />
        <Route path="/attendance-history" element={<TeacherHistory />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}
