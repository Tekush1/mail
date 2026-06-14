import React, { useState, useEffect, useRef } from 'react';
import { SMTPConfig, Recipient, EmailTemplate, AttachmentFile, LogMessage } from './types';
import SMTPConfigurator from './components/SMTPConfigurator';
import CSVUploader from './components/CSVUploader';
import EmailEditor from './components/EmailEditor';
import CampaignQueue from './components/CampaignQueue';
import LoginScreen from './components/LoginScreen';
import TemplateManager from './components/TemplateManager';
import CampaignHistory from './components/CampaignHistory';
import {
  Settings, FileSpreadsheet, Mail, Play, Sparkles, ChevronRight,
  Database, ArrowRight, History, BookOpen, LogOut, X,
} from 'lucide-react';

const INITIAL_SMTP_CONFIG: SMTPConfig = {
  host: 'smtp.simulator.auto', port: '587', secure: false,
  user: 'sandbox@mailing-system.internal', pass: 'simulated_secure_password_123',
  senderName: 'Campaign Manager', senderEmail: 'news@mailing-system.internal',
  isSimulation: true, simulationErrorRate: 2,
};

const INITIAL_TEMPLATE: EmailTemplate = {
  subject: 'Hi {Name}, your message is here',
  body: `Dear {Name},\n\nThank you for reaching out.\n\nWarm regards,\nTeam`,
};

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'csv' | 'email' | 'queue' | 'history'>('csv');
  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>(INITIAL_SMTP_CONFIG);
  const [csvFileName, setCsvFileName] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [emailFieldName, setEmailFieldName] = useState('Email');
  const [nameFieldName, setNameFieldName] = useState('Name');
  const [template, setTemplate] = useState<EmailTemplate>(INITIAL_TEMPLATE);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('mailing_auth_token');
    if (saved) setAuthToken(saved);
  }, []);

  // Close drawer on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsOpen && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  const addLog = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs((prev) => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toLocaleTimeString(), type, text },
    ].slice(-150));
  };

  const handleLogout = () => {
    localStorage.removeItem('mailing_auth_token');
    setAuthToken(null);
  };

  const handleCSVDataParsed = (data: { headers: string[]; records: Record<string, string>[]; emailFieldName: string; nameFieldName: string; fileName: string; }) => {
    setCsvHeaders(data.headers);
    setCsvFileName(data.fileName);
    setEmailFieldName(data.emailFieldName);
    setNameFieldName(data.nameFieldName);
    const mapped: Recipient[] = data.records.map((r, i) => ({
      id: String(i + 1), email: r[data.emailFieldName] || '', row: r, status: 'idle',
    }));
    setRecipients(mapped);
    addLog(`📊 Loaded "${data.fileName}" — ${mapped.length} contacts`, 'info');
    setActiveTab('email');
  };

  const handleResetRecipientStatuses = () => {
    setRecipients((prev) => prev.map((r) => ({ ...r, status: 'idle', errorMessage: undefined, sentAt: undefined })));
  };

  const handleUpdateRecipient = (id: string, update: Partial<Recipient>) => {
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  };

  const handleAddAttachment = (file: AttachmentFile) => {
    setAttachments((prev) => [...prev, file]);
    addLog(`📎 Attachment: ${file.name} (${Math.round(file.size / 1024)} KB)`, 'info');
  };

  const handleRemoveAttachment = (idx: number) => {
    const removed = attachments[idx];
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    if (removed) addLog(`🗑 Removed: ${removed.name}`, 'info');
  };

  const sentCount = recipients.filter((r) => r.status === 'success').length;
  const failedCount = recipients.filter((r) => r.status === 'failed').length;

  if (!authToken) {
    return <LoginScreen onLogin={(token) => setAuthToken(token)} />;
  }

  const tabs = [
    { id: 'csv', label: 'Recipients', icon: FileSpreadsheet },
    { id: 'email', label: 'Template', icon: Mail },
    { id: 'queue', label: 'Send', icon: Play },
    { id: 'history', label: 'History', icon: History },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-200 flex flex-col font-sans">
      {/* Settings Drawer Overlay */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          {/* Drawer */}
          <div ref={drawerRef} className="relative ml-auto h-full w-full max-w-xl bg-[#0D0D0E] border-l border-white/10 flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#0D0D0E] z-10">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-white text-sm">SMTP Settings</span>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 flex-1">
              <SMTPConfigurator config={smtpConfig} onChange={setSmtpConfig} authToken={authToken ?? undefined} />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#0D0D0E] border-b border-white/10 shrink-0 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center text-black font-black shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-serif italic tracking-wide text-white">
                  MailingEngine <span className="text-amber-500 font-sans not-italic font-bold text-lg">Pro</span>
                </h1>
                <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-bold">v3.0</span>
              </div>
              <p className="text-[11px] text-gray-500">Supabase • Auto-Rotation • Auth Protected</p>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2 text-xs font-semibold">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-gray-300 rounded-xl border border-white/10">
              <Database className="w-3.5 h-3.5 text-gray-500" />
              <span>{recipients.length > 0 ? `${recipients.length} Contacts` : 'No list loaded'}</span>
            </div>
            {/* Settings button — opens SMTP drawer */}
            <button type="button" onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-all">
              <Settings className="w-3.5 h-3.5" />
              <span>{smtpConfig.isSimulation ? 'Simulator' : smtpConfig.host}</span>
            </button>
            {sentCount > 0 && (
              <div className="px-2.5 py-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 rounded-xl">✓ {sentCount}</div>
            )}
            {failedCount > 0 && (
              <div className="px-2.5 py-1.5 bg-rose-950/40 text-rose-400 border border-rose-500/20 rounded-xl">✗ {failedCount}</div>
            )}
            <button type="button" onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 text-gray-400 hover:text-rose-400 hover:border-rose-500/30 rounded-xl transition-all">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-white/10 gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none ${
                activeTab === id
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-white/10'
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className="min-h-[450px]">
          {activeTab === 'csv' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <CSVUploader onDataParsed={handleCSVDataParsed} currentFileName={csvFileName} currentRecordCount={recipients.length} />
              </div>
              <div className="bg-[#0F0F10] border border-white/10 rounded-2xl p-6 text-left space-y-4">
                <h4 className="font-semibold text-white text-sm font-serif italic">CSV Format</h4>
                <div className="text-xs text-gray-400 space-y-3">
                  <p>First row mein column headers hone chahiye. Example: <strong>Email, Name, Company</strong></p>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl font-mono text-[10px] space-y-1">
                    <p className="text-gray-300">Email,Name,Company</p>
                    <p className="text-gray-500">user@gmail.com,Rahul,ACME</p>
                  </div>
                  <p className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                    Ya manual mode mein directly emails type karo — CSV ki zaroorat nahi.
                  </p>
                  <button type="button" onClick={() => setActiveTab('email')}
                    className="flex items-center gap-1.5 text-amber-500 font-bold hover:text-amber-400 transition-all pt-1">
                    Template Edit → <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <EmailEditor
                  template={template} onChange={setTemplate} availableFields={csvHeaders}
                  attachments={attachments} onAddAttachment={handleAddAttachment}
                  onRemoveAttachment={handleRemoveAttachment} sampleRecord={recipients[0]?.row}
                  recipientEmailField={emailFieldName} recipientNameField={nameFieldName}
                />
              </div>
              <div className="space-y-4">
                <TemplateManager currentTemplate={template} onLoad={setTemplate} />
                <div className="bg-[#0F0F10] border border-white/10 rounded-2xl p-5 text-left space-y-3">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <span className="text-amber-400 font-bold">Placeholders:</span> {'{Name}'}, {'{Company}'} jaise variables CSV columns se replace hote hain.
                  </p>
                  <button type="button" onClick={() => setActiveTab('queue')}
                    className="flex justify-center items-center gap-2 w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 px-4 rounded-xl transition-all cursor-pointer">
                    Send Queue → <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <CampaignQueue
              smtpConfig={smtpConfig} recipients={recipients} template={template}
              attachments={attachments} onUpdateRecipientStatus={handleUpdateRecipient}
              onResetRecipients={handleResetRecipientStatuses} onAddLog={addLog}
              logs={logs} clearLogs={() => setLogs([])} recipientEmailField={emailFieldName}
              authToken={authToken}
            />
          )}

          {activeTab === 'history' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CampaignHistory />
              <div className="bg-[#0F0F10] border border-white/10 rounded-2xl p-6 text-left space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  <h4 className="text-sm font-semibold text-white">About History</h4>
                </div>
                <div className="text-xs text-gray-400 space-y-3 leading-relaxed">
                  <p>Har campaign ka record Supabase mein save hota hai — sent/failed count, SMTP account used, aur individual email logs.</p>
                  <p className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                    Supabase configure karne ke baad sab auto-save hoga. Schema file se SQL Supabase dashboard mein run karo.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-[#0D0D0E] border-t border-white/10 py-5 mt-8 shrink-0 text-gray-500 text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>MailingEngine Pro v3.0 — Supabase + Auth + Auto-Rotation</p>
          <div className="flex gap-4">
            <span className="text-[10px] font-mono text-gray-600">Resend1 → Resend2 → Brevo1 → Brevo2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}