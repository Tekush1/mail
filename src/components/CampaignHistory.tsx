import React, { useState, useEffect } from 'react';
import { fetchCampaigns, fetchEmailLogs, DbCampaign } from '../lib/supabase';
import { History, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

export default function CampaignHistory() {
  const [campaigns, setCampaigns] = useState<DbCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, any[]>>({});
  const [supabaseReady, setSupabaseReady] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCampaigns();
      setCampaigns(data);
    } catch (err: any) {
      if (err?.message?.includes('invalid') || err?.message?.includes('Failed')) {
        setSupabaseReady(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!logs[id]) {
      try {
        const data = await fetchEmailLogs(id);
        setLogs((prev) => ({ ...prev, [id]: data }));
      } catch {}
    }
  };

  if (!supabaseReady) {
    return (
      <div className="bg-[#0F0F10] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-white">Campaign History</span>
        </div>
        <p className="text-xs text-gray-500">Supabase configure karo to history save ho.</p>
      </div>
    );
  }

  const statusColor = (s: string) => {
    if (s === 'completed') return 'text-emerald-400';
    if (s === 'running') return 'text-amber-400';
    if (s === 'paused') return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-[#0F0F10] border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-white">Campaign History</span>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-all text-gray-400 hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {campaigns.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-6 italic">
            Koi campaign nahi mila. Pehla campaign chalao!
          </p>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} className="border border-white/5 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleExpand(c.id)}
                className="w-full p-3 bg-white/2 hover:bg-white/5 transition-all text-left flex items-center gap-3"
              >
                {expanded === c.id
                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {new Date(c.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[10px] font-bold capitalize ${statusColor(c.status)}`}>{c.status}</p>
                  <p className="text-[10px] text-gray-500">
                    ✓{c.sent_count} ✗{c.failed_count} / {c.total_contacts}
                  </p>
                </div>
              </button>

              {expanded === c.id && (
                <div className="border-t border-white/5 bg-[#080809] p-3 space-y-2">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">
                    SMTP: {c.smtp_account_used}
                  </p>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {(logs[c.id] || []).map((log: any) => (
                      <div key={log.id} className="flex items-center gap-2 text-[10px]">
                        {log.status === 'sent'
                          ? <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                          : <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                        }
                        <span className={`truncate ${log.status === 'sent' ? 'text-gray-300' : 'text-rose-300'}`}>
                          {log.recipient_email}
                        </span>
                        {log.error_message && (
                          <span className="text-rose-400 truncate text-[9px]">{log.error_message}</span>
                        )}
                      </div>
                    ))}
                    {logs[c.id]?.length === 0 && (
                      <p className="text-[10px] text-gray-600 italic">Logs nahi milein</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
