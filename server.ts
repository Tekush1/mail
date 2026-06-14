import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// ============================================
// SMTP ACCOUNT ROTATION CONFIG
// Loaded from env - never exposed to frontend
// ============================================
const SMTP_ACCOUNTS = {
  resend1: {
    host: 'smtp.resend.com',
    port: 587,
    secure: false,
    user: 'resend',
    pass: process.env.RESEND_API_KEY_1 || '',
    senderEmail: process.env.RESEND_SENDER_EMAIL || '',
    senderName: process.env.RESEND_SENDER_NAME || '',
    label: 'Resend Account 1',
    limit: 300,
  },
  resend2: {
    host: 'smtp.resend.com',
    port: 587,
    secure: false,
    user: 'resend',
    pass: process.env.RESEND_API_KEY_2 || '',
    senderEmail: process.env.RESEND_SENDER_EMAIL || '',
    senderName: process.env.RESEND_SENDER_NAME || '',
    label: 'Resend Account 2',
    limit: 300,
  },
  brevo1: {
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    user: process.env.BREVO_SMTP_USER_1 || '',
    pass: process.env.BREVO_SMTP_KEY_1 || '',
    senderEmail: process.env.BREVO_SMTP_USER_1 || '',
    senderName: process.env.RESEND_SENDER_NAME || '',
    label: 'Brevo Account 1',
    limit: 300,
  },
  brevo2: {
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    user: process.env.BREVO_SMTP_USER_2 || '',
    pass: process.env.BREVO_SMTP_KEY_2 || '',
    senderEmail: process.env.BREVO_SMTP_USER_2 || '',
    senderName: process.env.RESEND_SENDER_NAME || '',
    label: 'Brevo Account 2',
    limit: 300,
  },
};

// Per-session counters (reset on server restart)
const sessionCounters: Record<string, number> = {
  resend1: 0,
  resend2: 0,
  brevo1: 0,
  brevo2: 0,
};

type SlotKey = keyof typeof SMTP_ACCOUNTS;
let currentSlot: SlotKey = 'resend1';

function getNextAvailableSlot(): SlotKey | null {
  const slots: SlotKey[] = ['resend1', 'resend2', 'brevo1', 'brevo2'];
  for (const slot of slots) {
    const acc = SMTP_ACCOUNTS[slot];
    if (acc.pass && sessionCounters[slot] < acc.limit) {
      return slot;
    }
  }
  return null;
}

function getActiveSmtpConfig() {
  // Check if current slot still has quota
  if (sessionCounters[currentSlot] >= SMTP_ACCOUNTS[currentSlot].limit) {
    const next = getNextAvailableSlot();
    if (next) {
      currentSlot = next;
      console.log(`[SMTP] Rotated to ${SMTP_ACCOUNTS[currentSlot].label}`);
    } else {
      return null; // All accounts exhausted
    }
  }
  return { slot: currentSlot, config: SMTP_ACCOUNTS[currentSlot] };
}

// ============================================
// AUTH — Simple password protection
// ============================================
const APP_PASSWORD = process.env.APP_PASSWORD || 'changeme123';

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.json({ success: true, token: Buffer.from(`auth:${Date.now()}`).toString('base64') });
  } else {
    res.status(401).json({ success: false, message: 'Wrong password' });
  }
});

// Simple auth middleware
function requireAuth(req: any, res: any, next: any) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  // Token is base64 of "auth:timestamp" - simple stateless check
  try {
    const decoded = Buffer.from(token as string, 'base64').toString('utf8');
    if (decoded.startsWith('auth:')) return next();
  } catch {}
  res.status(401).json({ success: false, message: 'Invalid token' });
}

// ============================================
// SMTP STATUS — Which account is active
// ============================================
app.get('/api/smtp/status', requireAuth, (req, res) => {
  const slots = ['resend1', 'resend2', 'brevo1', 'brevo2'] as SlotKey[];
  const status = slots.map((slot) => ({
    slot,
    label: SMTP_ACCOUNTS[slot].label,
    used: sessionCounters[slot],
    limit: SMTP_ACCOUNTS[slot].limit,
    active: slot === currentSlot,
    configured: !!SMTP_ACCOUNTS[slot].pass,
  }));
  res.json({ currentSlot, status });
});

app.post('/api/smtp/reset-counters', requireAuth, (req, res) => {
  Object.keys(sessionCounters).forEach((k) => (sessionCounters[k] = 0));
  currentSlot = 'resend1';
  res.json({ success: true, message: 'Counters reset' });
});

// ============================================
// TEST SMTP
// ============================================
app.post('/api/test-smtp', requireAuth, async (req, res) => {
  const { host, port, secure, user, pass, senderEmail } = req.body;
  if (!host || !port || !user || !pass) {
    return res.status(400).json({ success: false, message: 'Missing SMTP fields.' });
  }
  const transporter = nodemailer.createTransport({
    host, port: Number(port), secure: secure === true,
    auth: { user, pass }, timeout: 10000,
  } as any);
  try {
    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection verified!' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SEND EMAIL — with auto account rotation
// ============================================
app.post('/api/send-email', requireAuth, async (req, res) => {
  const { emailData, useAutoRotation, manualSmtpConfig } = req.body;

  if (!emailData?.to || !emailData?.subject || !emailData?.body) {
    return res.status(400).json({ success: false, message: 'Missing email data.' });
  }

  // Simulation mode
  if (manualSmtpConfig?.isSimulation) {
    const delay = Math.floor(Math.random() * 250) + 150;
    await new Promise((r) => setTimeout(r, delay));
    if (manualSmtpConfig.simulationErrorRate > 0 && Math.random() * 100 < manualSmtpConfig.simulationErrorRate) {
      return res.status(500).json({ success: false, message: 'Simulated bounce error' });
    }
    return res.json({ success: true, simulated: true, message: `Simulated send to ${emailData.to}` });
  }

  let smtpConfig: any;
  let activeSlot = '';

  if (useAutoRotation) {
    const active = getActiveSmtpConfig();
    if (!active) {
      return res.status(429).json({ success: false, message: 'All SMTP accounts exhausted. Reset counters or add more accounts.' });
    }
    smtpConfig = active.config;
    activeSlot = active.slot;
  } else {
    smtpConfig = manualSmtpConfig;
    activeSlot = 'manual';
  }

  // Use Resend HTTP API instead of SMTP (Railway blocks outbound SMTP)
  if (activeSlot.startsWith('resend') && smtpConfig.pass) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${smtpConfig.pass}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: smtpConfig.senderName
            ? `${smtpConfig.senderName} <${smtpConfig.senderEmail}>`
            : smtpConfig.senderEmail,
          to: [emailData.to],
          subject: emailData.subject,
          html: emailData.body,
        }),
      });
      const data = await response.json() as any;
      if (!response.ok) {
        return res.status(500).json({ success: false, message: data.message || 'Resend API error' });
      }
      if (useAutoRotation && activeSlot !== 'manual') sessionCounters[activeSlot]++;
      return res.json({
        success: true,
        messageId: data.id,
        message: `Sent to ${emailData.to}`,
        smtpAccount: SMTP_ACCOUNTS[activeSlot as SlotKey]?.label,
        currentSlot,
        counters: { ...sessionCounters },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: Number(smtpConfig.port),
    secure: smtpConfig.secure === true,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
  } as any);

  const attachments = (emailData.attachments || []).map((att: any) => {
    const base64Data = att.content.split(';base64,').pop();
    return { filename: att.name, content: Buffer.from(base64Data, 'base64'), contentType: att.type };
  });

  const mailOptions = {
    from: smtpConfig.senderName
      ? `"${smtpConfig.senderName}" <${smtpConfig.senderEmail || smtpConfig.user}>`
      : smtpConfig.senderEmail || smtpConfig.user,
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.body,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    // Increment counter
    if (useAutoRotation && activeSlot !== 'manual') {
      sessionCounters[activeSlot]++;
    }
    res.json({
      success: true,
      messageId: info.messageId,
      message: `Sent to ${emailData.to}`,
      smtpAccount: useAutoRotation ? SMTP_ACCOUNTS[activeSlot as SlotKey]?.label : 'Manual SMTP',
      currentSlot: useAutoRotation ? currentSlot : 'manual',
      counters: useAutoRotation ? { ...sessionCounters } : null,
    });
  } catch (error: any) {
    console.error('SMTP send error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VITE / STATIC
// ============================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Bulk Mailing System running at http://localhost:${PORT}`);
    console.log(`🔐 Auth: password protected`);
    console.log(`📧 SMTP Rotation: Resend1 → Resend2 → Brevo1 → Brevo2`);
  });
}

startServer();