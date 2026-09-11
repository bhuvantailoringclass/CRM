import React, { useEffect, useState } from "react";
import { getCompany, COMPANY_DEFAULTS } from "../lib/company";

export default function Login() {
  const [company, setCompany] = useState(COMPANY_DEFAULTS);
  useEffect(() => { getCompany().then(setCompany); }, []);

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:block relative bg-black">
        <img
          src="https://images.pexels.com/photos/7561201/pexels-photo-7561201.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="BIFD" className="w-full h-full object-cover opacity-90" />
        <div className="absolute top-10 left-10">
          {company.logo && <img src={company.logo} alt={company.name} className="h-12 mb-4 object-contain" />}
          <div className="text-white font-display text-6xl font-black leading-none tracking-tight">{company.short_name}</div>
          <div className="text-white/70 text-xs uppercase tracking-[0.3em] mt-3">{company.name}</div>
        </div>
        <div className="absolute bottom-10 left-10 right-10 border-t border-white/20 pt-5">
          <p className="text-white/60 text-sm">One connected system for all institute registers.</p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-background">
        <div className="lg:hidden font-display text-5xl font-black mb-8">{company.short_name}</div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Institute Management ERP</div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-none">
          Welcome back.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-sm">
          Sign in with your institute Google account. Access is limited to authorised admins and teachers.
        </p>
        <button
          data-testid="google-login-btn"
          onClick={handleLogin}
          className="mt-10 w-full max-w-sm bg-primary text-primary-foreground h-14 flex items-center justify-center gap-3 font-medium hover:bg-black transition-colors duration-150"
        >
          <span className="bg-white text-black w-6 h-6 flex items-center justify-center font-bold text-sm">G</span>
          Continue with Google
        </button>
        <div className="mt-6 text-xs text-muted-foreground max-w-sm">
          Teachers: use the email your admin registered. Not registered yet? Contact the institute office.
        </div>
      </div>
    </div>
  );
}
