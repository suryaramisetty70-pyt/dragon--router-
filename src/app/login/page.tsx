"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { Button, Input } from "@/shared/components";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);
  const [setupComplete, setSetupComplete] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [nodeVersion, setNodeVersion] = useState(null);
  const [nodeCompatible, setNodeCompatible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    async function checkAuth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      try {
        const res = await fetch(`${baseUrl}/api/settings/require-login`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.nodeVersion) setNodeVersion(data.nodeVersion);
          if (data.nodeCompatible === false) setNodeCompatible(false);
          if (data.requireLogin === false) {
            router.push("/dashboard");
            router.refresh();
            return;
          }
          setHasPassword(!!data.hasPassword);
          setSetupComplete(!!data.setupComplete);
        } else {
          setHasPassword(true);
          setSetupComplete(true);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        setHasPassword(true);
        setSetupComplete(true);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        sessionStorage.setItem("dragon_router_login_time", String(Date.now()));
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        // (#521) If no password is set, redirect to onboarding instead of showing an error
        if (data.needsSetup) {
          router.push("/dashboard/onboarding");
          return;
        }
        setError(data.error || t("invalidPassword"));
      }
    } catch (err) {
      setError(t("errorOccurredRetry"));
    } finally {
      setLoading(false);
    }
  };

  const nodeWarningBanner =
    !nodeCompatible && nodeVersion ? (
      <div className="w-full max-w-lg mx-auto mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="bg-red-950/60 border-2 border-red-500/40 rounded-2xl p-6 shadow-lg shadow-red-900/20 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-red-400 text-[28px]">error</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-red-300 mb-1">
                {t("nodeIncompatibleTitle")}
              </h3>
              <p className="text-sm text-red-200/80 leading-relaxed mb-3">
                {t("nodeIncompatibleDesc", { version: nodeVersion })}
              </p>
              <div className="bg-black/40 rounded-lg px-4 py-3 font-mono text-sm border border-red-500/20">
                <div className="flex items-center gap-2 text-red-300/60 mb-1">
                  <span className="material-symbols-outlined text-[14px]">terminal</span>
                  <span className="text-xs">{t("nodeIncompatibleFixLabel")}</span>
                </div>
                <code className="text-amber-300">nvm install 22 && nvm use 22</code>
              </div>
              <p className="text-xs text-red-300/50 mt-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">info</span>
                {t("nodeIncompatibleHint")}
              </p>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  if (hasPassword === null || setupComplete === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {nodeWarningBanner}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <span className="text-sm text-text-muted">{t("loading")}</span>
        </div>
      </div>
    );
  }

  if (!hasPassword && !setupComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {nodeWarningBanner}
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 mb-6">
              <span className="material-symbols-outlined text-primary text-[40px]">
                rocket_launch
              </span>
            </div>
            <h1 className="text-3xl font-bold text-text-main tracking-tight">{t("welcome")}</h1>
            <p className="text-text-muted mt-2">{t("configureInstance")}</p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8 shadow-soft">
            <div className="text-center">
              <p className="text-text-muted leading-relaxed mb-6">{t("runOnboardingWizard")}</p>
              <Button
                variant="primary"
                className="w-full h-11 text-sm font-medium"
                onClick={() => router.push("/dashboard/onboarding")}
              >
                {t("startOnboarding")}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted/60 mt-8">
            Dragon Router — {t("unifiedProxy")}
          </p>
        </div>
      </div>
    );
  }

  if (!hasPassword && setupComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {nodeWarningBanner}
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/10 mb-6">
              <span className="material-symbols-outlined text-amber-500 text-[40px]">
                shield_person
              </span>
            </div>
            <h1 className="text-3xl font-bold text-text-main tracking-tight">
              {t("secureYourInstance")}
            </h1>
            <p className="text-text-muted mt-2">{t("passwordNotEnabled")}</p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8 shadow-soft">
            <div className="text-center">
              <p className="text-text-muted leading-relaxed mb-6">{t("setPasswordDescription")}</p>
              <Button
                variant="primary"
                className="w-full h-11 text-sm font-medium"
                onClick={() => router.push("/dashboard/onboarding")}
              >
                {t("configurePassword")}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted/60 mt-8">
            Dragon Router — {t("unifiedAiApiProxy")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text-main relative overflow-hidden font-sans transition-colors duration-500">
      {/* Background Decorative Neon Glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 dark:bg-red-600/10 blur-[130px] pointer-events-none transition-colors duration-500" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent/15 dark:bg-orange-500/10 blur-[130px] pointer-events-none transition-colors duration-500" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {nodeWarningBanner && (
        <div className="flex justify-center pt-6 px-6 relative z-10">{nodeWarningBanner}</div>
      )}

      <div className="flex-1 flex relative z-10">
        <div className="flex-1 flex items-center justify-center p-6">
          <div
            className={`w-full max-w-md transition-all duration-1000 ease-out ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            {/* Logo/Branding */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-surface/80 dark:bg-white/5 border border-border backdrop-blur-md mb-6 hover:scale-105 transition-all shadow-sm hover:shadow">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20">
                  <span className="material-symbols-outlined text-white text-[20px]">
                    local_fire_department
                  </span>
                </div>
                <span className="text-base font-bold tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Dragon Router
                </span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-text-main">
                {t("signIn")}
              </h1>
              <p className="text-sm text-text-muted mt-2">{t("enterPassword")}</p>
            </div>

            {/* Login Card */}
            <div className="bg-surface/75 dark:bg-[#120707]/40 border border-border backdrop-blur-xl rounded-3xl p-8 shadow-soft dark:shadow-[0_0_50px_rgba(220,38,38,0.08)] hover:shadow-soft/80 transition-shadow">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {t("password")}
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      placeholder={t("enterPassword")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      className="h-12 bg-bg/50 border-border text-text-main placeholder-text-muted/40 focus:border-primary/50 focus:ring-primary/10 focus:bg-surface transition-all rounded-xl pl-4 pr-4 text-sm"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5 pt-1 animate-pulse">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {error}
                    </p>
                  )}
                  <p className="text-[11px] text-text-muted/70 leading-normal pt-1">
                    {t("defaultPasswordHint")}
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full h-12 text-sm font-bold tracking-wide bg-gradient-to-r from-primary to-accent hover:brightness-105 text-white rounded-xl shadow-md shadow-primary/10 active:scale-[0.98] transition-all"
                  loading={loading}
                >
                  {t("continue")}
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-border flex justify-center">
                <a
                  href="/forgot-password"
                  className="text-xs text-text-muted hover:text-primary transition-colors"
                >
                  {t("forgotPassword")}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Info Panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-b from-primary/5 via-transparent to-transparent border-l border-border items-center justify-center p-16 relative">
          <div
            className={`max-w-md transition-all duration-1000 delay-300 ease-out ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="space-y-10">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-widest">
                  Enterprise API Gateway
                </span>
                <h2 className="text-4xl font-extrabold tracking-tight mt-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {t("unifiedAiApiProxy")}
                </h2>
                <p className="text-sm text-text-muted leading-relaxed mt-4">
                  {t("unifiedAiApiProxyDesc")}
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    icon: "swap_horiz",
                    title: t("featureMultiProviderTitle"),
                    desc: t("featureMultiProviderDesc"),
                  },
                  {
                    icon: "speed",
                    title: t("featureLoadBalancingTitle"),
                    desc: t("featureLoadBalancingDesc"),
                  },
                  {
                    icon: "analytics",
                    title: t("featureUsageTrackingTitle"),
                    desc: t("featureUsageTrackingDesc"),
                  },
                ].map((item) => (
                  <div
                    key={item.icon}
                    className="flex items-start gap-4 p-5 rounded-2xl bg-surface/40 border border-border hover:bg-surface/80 hover:border-primary/20 hover:shadow-sm transition-all duration-300"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary/10 to-accent/10 border border-primary/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="material-symbols-outlined text-primary text-[22px]">
                        {item.icon}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-text-main text-sm">{item.title}</h3>
                      <p className="text-xs text-text-muted mt-1 leading-normal">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
