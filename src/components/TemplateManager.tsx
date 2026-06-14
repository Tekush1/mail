import React, { useState, useEffect } from 'react';
import { fetchTemplates, saveTemplate, updateTemplate, deleteTemplate, DbTemplate } from '../lib/supabase';
import { EmailTemplate } from '../types';
import { BookOpen, Plus, Trash2, Edit3, Check, X, Save } from 'lucide-react';

interface TemplateManagerProps {
  currentTemplate: EmailTemplate;
  onLoad: (template: EmailTemplate) => void;
}

export default function TemplateManager({ currentTemplate, onLoad }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [supabaseReady, setSupabaseReady] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (err: any) {
      // Supabase not configured — gracefully hide
      if (err?.message?.includes('invalid') || err?.message?.includes('Failed')) {
        setSupabaseReady(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!saveName.trim()) return alert('Template ka naam daalo!');
    setSaving(true);
    try {
      await saveTemplate(saveName.trim(), currentTemplate.subject, currentTemplate.body);
      setSaveName('');
      load();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Template delete karna chahte ho?')) return;
    try {
      await deleteTemplate(id);
      load();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const t = templates.find(t => t.id === id)!;
      await updateTemplate(id, editName.trim(), t.subject, t.body);
      setEditId(null);
      load();
    } catch {}
  };

  if (!supabaseReady) {
    return (
      <div className="bg-[#0F0F10] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-white">Saved Templates</span>
        </div>
        <p className="text-xs text-gray-500">
          Supabase configure nahi hai. .env.local mein VITE_SUPABASE_URL aur VITE_SUPABASE_ANON_KEY daalo.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#0F0F10] border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-white">Saved Templates</span>
      </div>

      {/* Save Current */}
      <div className="flex gap-2">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Template naam..."
          className="flex-1 bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-500 transition-all"
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
        >
          <Save className="w-3 h-3" />
          {saving ? '...' : 'Save'}
        </button>
      </div>

      {/* Templates List */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-gray-500 py-4 text-center">Loading...</p>
        ) : templates.length === 0 ? (
          <p className="text-xs text-gray-600 py-4 text-center italic">Koi saved template nahi hai</p>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className="p-3 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl transition-all group"
            >
              {editId === t.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-white/5 border border-amber-500/40 text-white rounded-lg px-2 py-1 text-xs outline-none"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(t.id)}
                  />
                  <button type="button" onClick={() => handleRename(t.id)} className="text-emerald-400 hover:text-emerald-300 p-1">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setEditId(null)} className="text-gray-400 hover:text-white p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onLoad({ subject: t.subject, body: t.body })}
                    className="text-left flex-1 min-w-0"
                  >
                    <p className="text-xs font-semibold text-white truncate group-hover:text-amber-400 transition-all">
                      {t.name}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">{t.subject}</p>
                  </button>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button
                      type="button"
                      onClick={() => { setEditId(t.id); setEditName(t.name); }}
                      className="p-1 hover:text-amber-400 text-gray-500 transition-all"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="p-1 hover:text-rose-400 text-gray-500 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
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
