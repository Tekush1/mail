import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Zap } from 'lucide-react';

interface SlotStatus {
  slot: string;
  label: string;
  used: number;
  limit: number;
  active: boolean;
  configured: boolean;
}

interface AccountStatusProps {
  authToken: string;
  refreshTrigger?: number;
}

export default function AccountStatus({ authToken, refreshTrigger }: AccountStatusProps) {
  const [slots, setSlots] = useState<SlotStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/smtp/status', {
        headers: { 'x-auth-token': authToken },
      });
      const data = await res.json();
      setSlots(data.status || []);
    } catch {}
    finally { setLoading(false); }
  };

  const resetCounters = async () => {
    if (!confirm('Session counters reset ho jaayenge. Sab slots phir se 0 se shuru honge?')) return;
    await fetch('/api/smtp/reset-counters', {
      method: 'POST',
      headers: { 'x-auth-token': authToken },
    });
    fetchStatus();
  };

  useEffect(() => { fetchStatus(); }, [refreshTrigger]);

  return (
    <div className="bg-[#0F0F10] border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-white">SMTP Account Rotation</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchStatus}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-all text-gray-400 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={resetCounters}
            className="text-[10px] font-bold px-2.5 py-1.5 border border-white/10 text-gray-400 hover:text-rose-400 hover:border-rose-500/30 rounded-lg transition-all"
          >
            Reset Counters
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {slots.map((slot) => (
          <div
            key={slot.slot}
            className={`p-3 rounded-xl border transition-all ${
              slot.active
                ? 'border-amber-500/40 bg-amber-500/5'
                : slot.configured
                ? 'border-white/5 bg-white/2'
                : 'border-white/5 bg-white/2 opacity-40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {slot.active ? (
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                ) : slot.configured ? (
                  <div className="w-2 h-2 rounded-full bg-gray-600" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-700" />
                )}
                <span className={`text-xs font-semibold ${slot.active ? 'text-amber-400' : 'text-gray-400'}`}>
                  {slot.label}
                  {slot.active && <span className="ml-1.5 text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                  {!slot.configured && <span className="ml-1.5 text-[9px] bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded-full">NOT SET</span>}
                </span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">
                {slot.used} / {slot.limit}
              </span>
            </div>

            {slot.configured && (
              <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    slot.used >= slot.limit ? 'bg-rose-500' : slot.active ? 'bg-amber-500' : 'bg-gray-600'
                  }`}
                  style={{ width: `${Math.min((slot.used / slot.limit) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 leading-relaxed">
        300 mails ke baad automatically next account pe switch hota hai: Resend1 → Resend2 → Brevo1 → Brevo2
      </p>
    </div>
  );
}
