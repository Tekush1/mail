import React, { useState, useEffect, useRef } from 'react';
import { Recipient, SMTPConfig, EmailTemplate, AttachmentFile, LogMessage } from '../types';
import { createCampaign, updateCampaignStats, logEmail } from '../lib/supabase';
import AccountStatus from './AccountStatus';
import {
  Play, Pause, RotateCcw, CheckCircle, XCircle, Clock,
  Terminal, AlertTriangle, Search, RefreshCcw, Sliders,
  Send, Zap, ToggleLeft, ToggleRight,
} from 'lucide-react';

interface CampaignQueueProps {
  smtpConfig: SMTPConfig;
  recipients: Recipient[];
  template: EmailTemplate;
  attachments: AttachmentFile[];
  onUpdateRecipientStatus: (id: string, update: Partial<Recipient>) => void;
  onResetRecipients: () => void;
  onAddLog: (message: string, type: 'info' | 'success' | 'error') => void;
  logs: LogMessage[];
  clearLogs: () => void;
  recipientEmailField: string;
  authToken: string;
}

export default function CampaignQueue({
  smtpConfig, recipients, template, attachments,
  onUpdateRecipientStatus, onResetRecipients, onAddLog, logs, clearLogs,
  recipientEmailField, authToken,
}: CampaignQueueProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [senderDelay, setSenderDelay] = useState(300);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [useAutoRotation, setUseAutoRotation] = useState(true);
  const [currentSmtpLabel, setCurrentSmtpLabel] = useState('');
  const [statusRefresh, setStatusRefresh] = useState(0);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const PAGE_SIZE = 8;

  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const campaignActiveRef = useRef(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const sentCountRef = useRef(0);
  const failedCountRef = useRef(0);

  useEffect(() => {
    if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setElapsedTime((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  const totalCount = recipients.length;
  const sentCount = recipients.filter((r) => r.status === 'success').length;
  const failedCount = recipients.filter((r) => r.status === 'failed').length;
  const pendingCount = recipients.filter((r) => r.status === 'idle').length;
  const sendsCompleted = sentCount + failedCount;
  const percentage = totalCount > 0 ? Math.round((sendsCompleted / totalCount) * 100) : 0;

  const sendIndividualEmail = async (recipient: Recipient): Promise<boolean> => {
    onUpdateRecipientStatus(recipient.id, { status: 'sending' });

    let personalizedSubject = template.subject;
    let personalizedBody = template.body;
    Object.keys(recipient.row).forEach((col) => {
      const regex = new RegExp(`{${col}}`, 'g');
      const val = recipient.row[col] || '';
      personalizedSubject = personalizedSubject.replace(regex, val);
      personalizedBody = personalizedBody.replace(regex, val.replace(/\n/g, '<br />'));
    });

    const recipientName = recipient.row['Name'] || recipient.row['name'] || '';

    const payload: any = {
      useAutoRotation,
      emailData: {
        to: recipient.email,
        subject: personalizedSubject || '(No Subject)',
        body: personalizedBody || '',
        attachments,
      },
    };

    if (!useAutoRotation) {
      payload.manualSmtpConfig = smtpConfig;
    } else if (smtpConfig.isSimulation) {
      // Even in auto mode, allow simulation
      payload.useAutoRotation = false;
      payload.manualSmtpConfig = smtpConfig;
    }

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onUpdateRecipientStatus(recipient.id, { status: 'success', sentAt: new Date().toLocaleTimeString() });
        if (data.smtpAccount) setCurrentSmtpLabel(data.smtpAccount);
        onAddLog(
          `✓ Sent to ${recipient.email}${data.simulated ? ' (Simulated)' : ` via ${data.smtpAccount || 'SMTP'}`}`,
          'success'
        );
        // Log to Supabase
        if (activeCampaignId) {
          logEmail(activeCampaignId, recipient.email, recipientName, personalizedSubject, 'sent', data.smtpAccount || 'manual');
        }
        sentCountRef.current++;
        setStatusRefresh((p) => p + 1);
        return true;
      } else {
        const errMsg = data.message || 'Unknown error';
        onUpdateRecipientStatus(recipient.id, { status: 'failed', errorMessage: errMsg });
        onAddLog(`✗ Failed: ${recipient.email} — ${errMsg}`, 'error');
        if (activeCampaignId) {
          logEmail(activeCampaignId, recipient.email, recipientName, personalizedSubject, 'failed', 'unknown', errMsg);
        }
        failedCountRef.current++;
        return false;
      }
    } catch (err: any) {
      const errMsg = err.message || 'Network error';
      onUpdateRecipientStatus(recipient.id, { status: 'failed', errorMessage: errMsg });
      onAddLog(`✗ Network error for ${recipient.email}: ${errMsg}`, 'error');
      failedCountRef.current++;
      return false;
    }
  };

  const executeCampaignLoop = async () => {
    onAddLog('✈ Campaign queue started.', 'info');
    campaignActiveRef.current = true;

    // Create campaign in Supabase
    let campId: string | null = null;
    try {
      campId = await createCampaign(
        `Campaign ${new Date().toLocaleString('en-IN')}`,
        recipients.filter((r) => r.status === 'idle').length,
        useAutoRotation ? 'Auto-Rotation' : (smtpConfig.isSimulation ? 'Simulation' : smtpConfig.host)
      );
      setActiveCampaignId(campId);
    } catch { /* Supabase not configured, proceed without logging */ }

    while (campaignActiveRef.current) {
      const nextRecipient = recipients.find((r) => r.status === 'idle');
      if (!nextRecipient) {
        setIsRunning(false);
        campaignActiveRef.current = false;
        onAddLog(
          `🏁 Done! Sent: ${sentCountRef.current}, Failed: ${failedCountRef.current}`,
          'info'
        );
        if (campId) updateCampaignStats(campId, sentCountRef.current, failedCountRef.current, 'completed');
        break;
      }
      await sendIndividualEmail(nextRecipient);
      if (senderDelay > 0 && campaignActiveRef.current) {
        await new Promise((r) => setTimeout(r, senderDelay));
      }
    }

    if (campId && campaignActiveRef.current === false && isRunning) {
      updateCampaignStats(campId, sentCountRef.current, failedCountRef.current, 'paused');
    }
  };

  useEffect(() => {
    if (isRunning) executeCampaignLoop();
    else campaignActiveRef.current = false;
    return () => { campaignActiveRef.current = false; };
  }, [isRunning, recipients]);

  const handleStartResume = () => {
    if (recipients.length === 0) { alert('CSV upload karo pehle!'); return; }
    if (!template.subject || !template.body) {
      if (!confirm('Subject/body blank hai. Start anyway?')) return;
    }
    if (pendingCount === 0 && recipients.length > 0) {
      if (confirm('Sab already processed ho gaye. Reset karke dobara bhejein?')) {
        onResetRecipients();
        onAddLog('🔄 Reset to queue.', 'info');
      } else return;
    }
    sentCountRef.current = 0;
    failedCountRef.current = 0;
    setIsRunning(true);
    onAddLog(`▶ Starting... delay: ${senderDelay}ms | ${useAutoRotation ? 'Auto-Rotation' : 'Manual SMTP'}`, 'info');
  };

  const handlePause = () => {
    setIsRunning(false);
    campaignActiveRef.current = false;
    onAddLog('⏸ Paused.', 'info');
  };

  const handleHardReset = () => {
    setIsRunning(false);
    campaignActiveRef.current = false;
    if (confirm('Sab reset ho jaayega — contacts aur logs. Confirm?')) {
      onResetRecipients();
      clearLogs();
      setElapsedTime(0);
      setActiveCampaignId(null);
      onAddLog('🔄 Reset complete.', 'info');
    }
  };

  const handleRetry = async (recipient: Recipient) => {
    onAddLog(`⚡ Retry: ${recipient.email}`, 'info');
    await sendIndividualEmail(recipient);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const filteredRecipients = recipients.filter((r) => {
    const q = searchQuery.toLowerCase();
    return r.email.toLowerCase().includes(q) || Object.values(r.row).some((v) => v.toLowerCase().includes(q));
  });
  const totalPages = Math.ceil(filteredRecipients.length / PAGE_SIZE) || 1;
  const paginatedRecipients = filteredRecipients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT PANEL */}
      <div className="lg:col-span-2 space-y-6">
        {/* Controls */}
        <div className="bg-[#0f0f10] border border-white/10 rounded-2xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/10">
            <div className="text-left">
              <h3 className="font-semibold text-white text-lg">Transmission Engine</h3>
              <p className="text-xs text-gray-400">
                {useAutoRotation ? `Auto-Rotation Active${currentSmtpLabel ? ` • ${currentSmtpLabel}` : ''}` : 'Manual SMTP Mode'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Auto-rotation toggle */}
              <button
                type="button"
                onClick={() => setUseAutoRotation(!useAutoRotation)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                  useAutoRotation
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {useAutoRotation ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                Auto-Rotate
              </button>
              {isRunning ? (
                <button type="button" onClick={handlePause}
                  className="flex items-center gap-1.5 px-5 py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/15 shadow-md transition-all cursor-pointer">
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              ) : (
                <button type="button" onClick={handleStartResume}
                  disabled={recipients.length === 0}
                  className="flex items-center gap-1.5 px-5 py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black shadow-amber-500/15 shadow-md transition-all cursor-pointer">
                  <Play className="w-3.5 h-3.5 fill-current" /> {recipients.length === 0 ? 'CSV Upload Karo' : 'Start'}
                </button>
              )}
              <button type="button" onClick={handleHardReset}
                className="flex items-center gap-1 px-3.5 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer text-xs font-semibold">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between text-xs text-gray-400 font-semibold uppercase tracking-wider">
              <span>Delivery Progress</span>
              <span className="font-mono text-amber-500 text-sm font-black">{percentage}%</span>
            </div>
            <div className="h-4 bg-white/5 border border-white/5 rounded-full overflow-hidden">
              <div style={{ width: `${percentage}%` }}
                className="h-full bg-amber-500 transition-all duration-300 rounded-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>0</span>
              <span>{sendsCompleted} of {totalCount}</span>
              <span>{totalCount}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 text-left">
            <div className="p-4 bg-[#070708] border border-white/5 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending</span>
              <p className="text-2xl font-black text-white font-mono mt-1">{pendingCount}</p>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/10 rounded-xl">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Delivered</span>
              <p className="text-2xl font-black text-amber-400 font-mono mt-1">{sentCount}</p>
            </div>
            <div className="p-4 bg-rose-950/40 border border-rose-500/10 rounded-xl">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Bounced</span>
              <p className="text-2xl font-black text-rose-400 font-mono mt-1">{failedCount}</p>
            </div>
            <div className="p-4 bg-[#070708] border border-white/5 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time</span>
              <p className="text-base font-black text-white font-mono mt-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" /> {formatTime(elapsedTime)}
              </p>
            </div>
          </div>

          {/* Throttle slider */}
          <div className="mt-6 pt-5 border-t border-white/10 space-y-3 bg-[#0D0D0E]/60 p-4 rounded-xl text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-500" /> Rate Throttle
              </span>
              <span className="text-xs font-mono text-amber-400 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded font-black">
                {senderDelay === 0 ? 'Max Speed' : `${senderDelay}ms`}
              </span>
            </div>
            <input type="range" min="0" max="5000" step="100" value={senderDelay}
              onChange={(e) => setSenderDelay(Number(e.target.value))}
              className="w-full h-1 bg-white/10 accent-amber-500 rounded-lg appearance-none cursor-pointer" />
          </div>
        </div>

        {/* Recipient table */}
        <div className="bg-[#0f0f10] border border-white/10 rounded-2xl shadow-sm p-6 text-left">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
            <div>
              <h4 className="font-semibold text-white text-base">Recipients</h4>
              <p className="text-xs text-gray-400">Search & retry individual contacts</p>
            </div>
            <div className="relative">
              <input type="text" placeholder="Search..." value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-[220px] text-xs border border-white/10 bg-white/5 text-white rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-amber-500 transition-all" />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="overflow-x-auto border border-white/10 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#101012] border-b border-white/10 text-gray-300">
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Properties</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecipients.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500 italic">No records.</td></tr>
                ) : paginatedRecipients.map((rec) => (
                  <tr key={rec.id} className="border-b last:border-0 border-white/5 hover:bg-white/5 transition-all text-gray-200">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white truncate max-w-[200px]">{rec.email}</div>
                      <div className="text-[10px] text-gray-500 font-mono">#{rec.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {Object.keys(rec.row).slice(0, 3).map((key) => (
                          <span key={key} className="text-[10px] bg-white/5 text-gray-300 px-1.5 py-0.5 rounded border border-white/5 truncate max-w-[90px]">
                            {key}: {rec.row[key]}
                          </span>
                        ))}
                        {Object.keys(rec.row).length > 3 && (
                          <span className="text-[9px] text-gray-500">+{Object.keys(rec.row).length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {rec.status === 'success' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-semibold">
                            <CheckCircle className="w-3 h-3" /> Sent
                          </span>
                          <span className="text-[10px] text-gray-500 block mt-1 font-mono">{rec.sentAt}</span>
                        </div>
                      )}
                      {rec.status === 'failed' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-[10px] font-semibold">
                            <AlertTriangle className="w-3 h-3" /> Bounced
                          </span>
                          <p className="text-[9px] text-rose-400 break-words max-w-[160px] truncate mt-1">{rec.errorMessage}</p>
                        </div>
                      )}
                      {rec.status === 'sending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-500 border border-amber-500/10 rounded-md text-[10px] font-semibold animate-pulse">
                          <RefreshCcw className="w-3 h-3 animate-spin" /> Sending...
                        </span>
                      )}
                      {rec.status === 'idle' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 text-gray-400 border border-white/5 rounded-md text-[10px]">
                          <Clock className="w-3 h-3" /> Queued
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => handleRetry(rec)}
                        disabled={rec.status === 'sending' || isRunning}
                        className="p-1 px-2 h-7 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1">
                        <Send className="w-2.5 h-2.5 text-amber-500" /> Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs font-semibold">
              <span className="text-gray-400">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-1.5">
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((c) => c - 1)}
                  className="px-3 py-1.5 border border-white/10 text-gray-300 rounded-md disabled:opacity-40 text-[11px] hover:bg-white/5">Prev</button>
                <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((c) => c + 1)}
                  className="px-3 py-1.5 border border-white/10 text-gray-300 rounded-md disabled:opacity-40 text-[11px] hover:bg-white/5">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="space-y-4 lg:col-span-1">
        {/* Account Status */}
        {useAutoRotation && (
          <AccountStatus authToken={authToken} refreshTrigger={statusRefresh} />
        )}

        {/* Live Terminal */}
        <div className="bg-[#080809] text-gray-100 border border-white/10 rounded-2xl shadow-xl p-5 h-[420px] flex flex-col">
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/5 text-amber-500 rounded-lg border border-white/10">
                <Terminal className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-sm text-white">Live Terminal</h4>
                <p className="text-[10px] text-amber-500 font-mono uppercase">STDOUT</p>
              </div>
            </div>
            {logs.length > 0 && (
              <button type="button" onClick={clearLogs}
                className="text-[10px] text-gray-400 hover:text-white border border-white/10 px-2 py-1 rounded">
                Clear
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2 text-left pr-1">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-600">
                <Zap className="w-5 h-5 text-amber-500/30 animate-bounce mb-2" />
                <p className="italic">Queue start karo — logs yahan dikhenge.</p>
              </div>
            ) : logs.map((log) => (
              <div key={log.id} className="border-l border-white/5 pl-2">
                <span className="text-[10px] text-gray-600 mr-1">[{log.timestamp}]</span>
                <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-rose-400 font-medium' : 'text-gray-300'}>
                  {log.text}
                </span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}