import React, { useState } from "react";
import { SMTPConfig } from "../types";
import {
  Server,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Shield,
  HelpCircle,
} from "lucide-react";

interface SMTPConfiguratorProps {
  config: SMTPConfig;
  onChange: (config: SMTPConfig) => void;
  authToken?: string;
}

const PRESETS = [
  {
    name: "Auto",
    host: "smtp.simulator.auto",
    port: "587",
    secure: false,
    isSimulation: true,
  },
  {
    name: "Resend #1",
    host: "smtp.resend.com",
    port: "465",
    secure: true,
    isSimulation: false,
  },
  {
    name: "Resend #2",
    host: "smtp.resend.com",
    port: "587",
    secure: false,
    isSimulation: false,
  },
  {
    name: "Brevo #1",
    host: "smtp-relay.brevo.com",
    port: "587",
    secure: false,
    isSimulation: false,
  },
  {
    name: "Brevo #2",
    host: "smtp-relay.brevo.com",
    port: "465",
    secure: true,
    isSimulation: false,
  },
];

export default function SMTPConfigurator({ config, onChange, authToken }: SMTPConfiguratorProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    onChange({
      ...config,
      isSimulation: preset.isSimulation,
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
    });
    setTestResult({ status: "idle", message: "" });
  };

  const handleTestConnection = async () => {
    if (config.isSimulation) {
      setTesting(true);
      await new Promise((r) => setTimeout(r, 800));
      setTesting(false);
      setTestResult({
        status: "success",
        message: "Simulator is live! Ready to handle 1000+ mails offline.",
      });
      return;
    }

    if (!config.host || !config.port || !config.user || !config.pass) {
      setTestResult({
        status: "error",
        message: "Please complete the Host, Port, Username and Password fields to test connection.",
      });
      return;
    }

    setTesting(true);
    setTestResult({ status: "idle", message: "" });

    try {
      const response = await fetch("/api/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": authToken || "" },
        body: JSON.stringify({
          host: config.host,
          port: config.port,
          secure: config.secure,
          user: config.user,
          pass: config.pass,
          senderEmail: config.senderEmail,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({
          status: "success",
          message: data.message || "Connection verified successfully!",
        });
      } else {
        setTestResult({
          status: "error",
          message: data.message || "Connection failure. Please check your credentials.",
        });
      }
    } catch (err: any) {
      setTestResult({
        status: "error",
        message: err.message || "Network error. Failed to reach the SMTP tester API.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div id="smtp-setup" className="bg-[#0f0f10] border border-white/10 rounded-2xl shadow-sm overflow-hidden h-full">
      <div className="bg-[#0D0D0E] border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 text-amber-500 rounded-xl border border-white/10">
            <Server className="w-5 h-5" id="smtp-setup-icon" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">SMTP Credentials & Server</h3>
            <p className="text-xs text-gray-400">Configure how you send emails</p>
          </div>
        </div>
        {config.isSimulation ? (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-medium text-amber-400 animate-pulse">
            <Shield className="w-3.5 h-3.5" /> Simulation Active
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-medium text-emerald-400">
            <Shield className="w-3.5 h-3.5" /> SMTP Direct Ready
          </span>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Presets Grid */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Select Server Preset
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2" id="smtp-presets">
            {PRESETS.map((p) => {
              const active =
                p.isSimulation === config.isSimulation &&
                (p.isSimulation || (p.host === config.host && p.port === config.port));
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={`text-left p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? "border-amber-500 bg-amber-500/10 text-amber-400 shadow-sm"
                      : "border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                  }`}
                >
                  <div className="truncate font-semibold">{p.name.split(" ")[0]}</div>
                  <div className="text-[10px] text-gray-400 truncate mt-0.5">
                    {p.isSimulation ? "Simulated Sandboxed" : p.host}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                SMTP Server Host
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="smtp.example.com"
                  disabled={config.isSimulation}
                  value={config.host}
                  onChange={(e) => onChange({ ...config, host: e.target.value })}
                  className="w-full text-sm border border-white/10 rounded-xl px-4 py-2.5 bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white transition-all outline-none disabled:bg-white/1 disabled:text-gray-500 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  SMTP Port
                </label>
                <input
                  type="text"
                  placeholder="587"
                  disabled={config.isSimulation}
                  value={config.port}
                  onChange={(e) => onChange({ ...config, port: e.target.value })}
                  className="w-full text-sm border border-white/10 rounded-xl px-4 py-2.5 bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white transition-all outline-none disabled:bg-white/1 disabled:text-gray-500 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col justify-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer py-2 px-1 select-none text-gray-300">
                  <input
                    type="checkbox"
                    disabled={config.isSimulation}
                    checked={config.secure}
                    onChange={(e) => onChange({ ...config, secure: e.target.checked })}
                    className="rounded border-white/10 text-amber-500 focus:ring-amber-500 w-4 h-4 bg-white/5"
                  />
                  <span className="text-xs font-medium">SSL/TLS (Port 465)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Sender Friendly Name
              </label>
              <input
                type="text"
                placeholder="Rahul Kumar (Sales)"
                value={config.senderName}
                onChange={(e) => onChange({ ...config, senderName: e.target.value })}
                className="w-full text-sm border border-white/10 rounded-xl px-4 py-2.5 bg-white/5 hover:bg-white/10 focus:bg-[#1C1C1E] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Username / Email Auth
              </label>
              <input
                type="text"
                placeholder="user@example.com"
                disabled={config.isSimulation}
                value={config.user}
                onChange={(e) => onChange({ ...config, user: e.target.value })}
                className="w-full text-sm border border-white/10 rounded-xl px-4 py-2.5 bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white transition-all outline-none disabled:bg-white/1 disabled:text-gray-500 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Password / API Key Pass
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••••••"
                  disabled={config.isSimulation}
                  value={config.pass}
                  onChange={(e) => onChange({ ...config, pass: e.target.value })}
                  className="w-full text-sm border border-white/10 rounded-xl pl-4 pr-10 py-2.5 bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white transition-all outline-none disabled:bg-white/1 disabled:text-gray-500 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={config.isSimulation}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-white disabled:opacity-0 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Sender Reply-To Email (Optional)
              </label>
              <input
                type="email"
                placeholder="noreply@domain.com"
                value={config.senderEmail}
                onChange={(e) => onChange({ ...config, senderEmail: e.target.value })}
                className="w-full text-sm border border-white/10 rounded-xl px-4 py-2.5 bg-white/5 hover:bg-[#1C1C1E] focus:bg-[#1C1C1E] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* Simulator Options Slider - Only visible on Simulation Mode */}
        {config.isSimulation && (
          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Simulation Failure Tolerances (Beta)
              </span>
              <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-medium">
                {config.simulationErrorRate}% Failure Rate
              </span>
            </div>
            <p className="text-[10px] text-gray-400">
              Simulates real-world SMTP failures (like bounce rates, network cuts, spam rejection) to test your queue handling robustness.
            </p>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={config.simulationErrorRate}
              onChange={(e) => onChange({ ...config, simulationErrorRate: Number(e.target.value) })}
              className="w-full accent-amber-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}

        {/* Action Button & Test Status Area */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
          <div className="flex-1 text-left">
            {testResult.status === "success" && (
              <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                <span>{testResult.message}</span>
              </div>
            )}
            {testResult.status === "error" && (
              <div className="flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                <AlertTriangle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                <span className="break-words">{testResult.message}</span>
              </div>
            )}
            {testResult.status === "idle" && (
              <p className="text-xs text-gray-400">
                Tip: If using Gmail, make sure to generate an <strong>App Password</strong> in Google Account &gt; Security.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black disabled:bg-white/5 disabled:text-gray-500 font-bold text-xs px-5 py-3 rounded-xl cursor-pointer select-none transition-all duration-200 min-w-[140px] shrink-0 shadow-[0_4px_12px_rgba(245,158,11,0.15)]"
          >
            {testing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" /> Verification...
              </>
            ) : (
              "Test SMTP Link"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}