import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---- Templates ----
export interface DbTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export async function fetchTemplates(): Promise<DbTemplate[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveTemplate(name: string, subject: string, body: string): Promise<DbTemplate> {
  const { data, error } = await supabase
    .from('templates')
    .insert({ name, subject, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTemplate(id: string, name: string, subject: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('templates')
    .update({ name, subject, body, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw error;
}

// ---- Campaigns ----
export interface DbCampaign {
  id: string;
  name: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  status: string;
  smtp_account_used: string;
  created_at: string;
  completed_at: string | null;
}

export async function createCampaign(name: string, totalContacts: number, smtpAccount: string): Promise<string> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ name, total_contacts: totalContacts, smtp_account_used: smtpAccount, status: 'running' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateCampaignStats(id: string, sentCount: number, failedCount: number, status: string): Promise<void> {
  const update: any = { sent_count: sentCount, failed_count: failedCount, status };
  if (status === 'completed') update.completed_at = new Date().toISOString();
  const { error } = await supabase.from('campaigns').update(update).eq('id', id);
  if (error) console.error('Campaign update error:', error);
}

export async function fetchCampaigns(): Promise<DbCampaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

// ---- Email Logs ----
export async function logEmail(
  campaignId: string,
  recipientEmail: string,
  recipientName: string,
  subject: string,
  status: 'sent' | 'failed',
  smtpAccount: string,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase.from('email_logs').insert({
    campaign_id: campaignId,
    recipient_email: recipientEmail,
    recipient_name: recipientName,
    subject,
    status,
    smtp_account: smtpAccount,
    error_message: errorMessage || null,
  });
  if (error) console.error('Log email error:', error);
}

export async function fetchEmailLogs(campaignId: string) {
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
