export interface SMTPConfig {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  pass: string;
  senderName: string;
  senderEmail: string;
  isSimulation: boolean;
  simulationErrorRate: number;
}

export interface Recipient {
  id: string;
  email: string;
  row: Record<string, string>;
  status: 'idle' | 'sending' | 'success' | 'failed';
  errorMessage?: string;
  sentAt?: string;
}

export interface AttachmentFile {
  name: string;
  size: number;
  type: string;
  content: string; // Base64 Data URI
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error';
  text: string;
}

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  startTime?: number;
  elapsedTime: number;
}

// Which SMTP account slot is active (for auto-rotation)
export type SmtpSlot = 'resend1' | 'resend2' | 'brevo1' | 'brevo2' | 'manual';

export interface SmtpAccountStatus {
  slot: SmtpSlot;
  emailsSentInSlot: number;
  label: string;
}
