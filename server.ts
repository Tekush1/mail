import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// ============================================
// ACCOUNT CONFIG — Brevo first, Resend fallback
// ============================================
const SMTP_ACCOUNTS = {
  brevo1: {
    pass: process.env.BREVO_API_KEY_1 || process.env.BREVO_SMTP_KEY_1 || '',
    senderEmail: process.env.BREVO_SENDER_EMAIL || '',
    senderName: process.env.SENDER_NAME || 'Campaign',
    label: 'Brevo Account 1',
    limit: 300,
    type: 'brevo',
  },
  brevo2: {
    pass: process.env.BREVO_API_KEY_2 || process.env.BREVO_SMTP_KEY_2 || '',
    senderEmail: process.env.BREVO_SENDER_EMAIL_2 || process.env.BREVO_SENDER_EMAIL || '',
    senderName: process.env.SENDER_NAME || 'Campaign',
    label: 'Brevo Account 2',
    limit: 300,
    type: 'brevo',
  },
  resend1: {
    pass: process.env.RESEND_API_KEY_1 || '',
    senderEmail: process.env.RESEND_SENDER_EMAIL || '',
    senderName: process.env.SENDER_NAME || 'Campaign',
    label: 'Resend Account 1',
    limit: 300,
    type: 'resend',
  },
  resend2: {
    pass: process.env.RESEND_API_KEY_2 || '',
    senderEmail: process.env.RESEND_SENDER_EMAIL || '',
    senderName: process.env.SENDER_NAME || 'Campaign',
    label: 'Resend Account 2',
    limit: 300,
    type: 'resend',
  },
};

const sessionCounters: Record<string, number> = {
  brevo1: 0,
  brevo2: 0,
  resend1: 0,
  resend2: 0,
};

type SlotKey = keyof typeof SMTP_ACCOUNTS;

// Always start with first account that has a key set
function getInitialSlot(): SlotKey {
  const order: SlotKey[] = ['brevo1', 'brevo2', 'resend1', 'resend2'];
  const found = order.find((s) => !!SMTP_ACCOUNTS[s].pass);
  console.log(`[SMTP] Initial slot: ${found || 'NONE — no keys found!'}`);
  return found || 'brevo1';
}

let currentSlot: SlotKey = getInitialSlot();

function getNextAvailableSlot(): SlotKey | null {
  const slots: SlotKey[] = ['brevo1', 'brevo2', 'resend1', 'resend2'];
  return slots.find((s) => SMTP_ACCOUNTS[s].pass && sessionCounters[s] < SMTP_ACCOUNTS[s].limit) || null;
}

function getActiveSmtpConfig() {
  const acc = SMTP_ACCOUNTS[currentSlot];
  if (!acc.pass || sessionCounters[currentSlot] >= acc.limit) {
    const next = getNextAvailableSlot();
    if (next) {
      currentSlot = next;
      console.log(`[SMTP] Rotated to ${SMTP_ACCOUNTS[currentSlot].label}`);
    } else {
      return null;
    }
  }
  return { slot: currentSlot, config: SMTP_ACCOUNTS[currentSlot] };
}

// ============================================
// AUTH
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

function requireAuth(req: any, res: any, next: any) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const decoded = Buffer.from(token as string, 'base64').toString('utf8');
    if (decoded.startsWith('auth:')) return next();
  } catch {}
  res.status(401).json({ success: false, message: 'Invalid token' });
}

// ============================================
// SMTP STATUS
// ============================================
app.get('/api/smtp/status', requireAuth, (req, res) => {
  const slots = ['brevo1', 'brevo2', 'resend1', 'resend2'] as SlotKey[];
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
  currentSlot = getInitialSlot();
  res.json({ success: true, message: 'Counters reset' });
});

// ============================================
// DEBUG ENDPOINT — check what keys are loaded
// ============================================
app.get('/api/debug/config', requireAuth, (req, res) => {
  res.json({
    currentSlot,
    accounts: Object.fromEntries(
      Object.entries(SMTP_ACCOUNTS).map(([k, v]) => [
        k,
        {
          hasKey: !!v.pass,
          keyPreview: v.pass ? v.pass.substring(0, 8) + '...' : 'NOT SET',
          senderEmail: v.senderEmail || 'NOT SET',
          type: v.type,
        },
      ])
    ),
    envKeys: {
      BREVO_API_KEY_1: process.env.BREVO_API_KEY_1 ? process.env.BREVO_API_KEY_1.substring(0, 8) + '...' : 'NOT SET',
      BREVO_SMTP_KEY_1: process.env.BREVO_SMTP_KEY_1 ? process.env.BREVO_SMTP_KEY_1.substring(0, 8) + '...' : 'NOT SET',
      BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || 'NOT SET',
      SENDER_NAME: process.env.SENDER_NAME || 'NOT SET',
      RESEND_API_KEY_1: process.env.RESEND_API_KEY_1 ? process.env.RESEND_API_KEY_1.substring(0, 8) + '...' : 'NOT SET',
    },
  });
});

// ============================================
// SEND — Brevo HTTP API
// ============================================
async function sendViaBrevo(config: any, emailData: any) {
  if (!config.pass) throw new Error('Brevo API key not set (BREVO_API_KEY_1 or BREVO_SMTP_KEY_1)');
  if (!config.senderEmail) throw new Error('Brevo sender email not set (BREVO_SENDER_EMAIL)');

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.pass,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: config.senderName || 'Campaign', email: config.senderEmail },
      to: [{ email: emailData.to }],
      subject: emailData.subject,
      htmlContent: emailData.body,
      ...(emailData.attachments?.length > 0 && {
        attachment: emailData.attachments.map((att: any) => ({
          name: att.name,
          content: att.content.split(';base64,').pop(),
        })),
      }),
    }),
  });

  const data = await response.json() as any;
  if (!response.ok) throw new Error(data.message || `Brevo error ${response.status}: ${JSON.stringify(data)}`);
  return { messageId: data.messageId };
}

// ============================================
// SEND — Resend HTTP API
// ============================================
async function sendViaResend(config: any, emailData: any) {
  if (!config.pass) throw new Error('Resend API key not set (RESEND_API_KEY_1)');
  if (!config.senderEmail) throw new Error('Resend sender email not set (RESEND_SENDER_EMAIL)');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.pass}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.senderName ? `${config.senderName} <${config.senderEmail}>` : config.senderEmail,
      to: [emailData.to],
      subject: emailData.subject,
      html: emailData.body,
    }),
  });

  const data = await response.json() as any;
  if (!response.ok) throw new Error(data.message || `Resend error ${response.status}: ${JSON.stringify(data)}`);
  return { messageId: data.id };
}

// ============================================
// SEND EMAIL ENDPOINT
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

  // Get active config
  let smtpConfig: any;
  let activeSlot = '';

  if (useAutoRotation) {
    const active = getActiveSmtpConfig();
    if (!active) {
      return res.status(429).json({ success: false, message: 'All accounts exhausted. Reset counters.' });
    }
    smtpConfig = active.config;
    activeSlot = active.slot;
  } else {
    // Manual mode — try to use server-side brevo config anyway
    const active = getActiveSmtpConfig();
    if (active) {
      smtpConfig = active.config;
      activeSlot = active.slot;
    } else {
      return res.status(500).json({ success: false, message: 'No accounts configured. Check env variables.' });
    }
  }

  const accountType = SMTP_ACCOUNTS[activeSlot as SlotKey]?.type || 'brevo';

  const trySend = async (slot: SlotKey): Promise<{ messageId?: string }> => {
    const cfg = SMTP_ACCOUNTS[slot];
    if (cfg.type === 'brevo') return sendViaBrevo(cfg, emailData);
    return sendViaResend(cfg, emailData);
  };

  try {
    let result: { messageId?: string };
    let usedSlot = activeSlot as SlotKey;

    try {
      result = await trySend(activeSlot as SlotKey);
    } catch (primaryErr: any) {
      console.warn(`[SMTP] ${SMTP_ACCOUNTS[activeSlot as SlotKey]?.label} failed: ${primaryErr.message}`);
      // Try next available slot as fallback
      const fallbackSlot = (['brevo1', 'brevo2', 'resend1', 'resend2'] as SlotKey[]).find(
        (s) => s !== activeSlot && SMTP_ACCOUNTS[s].pass && sessionCounters[s] < SMTP_ACCOUNTS[s].limit
      );
      if (!fallbackSlot) throw new Error(`Primary failed: ${primaryErr.message}. No fallback available.`);
      console.log(`[SMTP] Falling back to ${SMTP_ACCOUNTS[fallbackSlot].label}`);
      result = await trySend(fallbackSlot);
      usedSlot = fallbackSlot;
      currentSlot = fallbackSlot;
    }

    sessionCounters[usedSlot]++;
    console.log(`[SMTP] ✅ Sent to ${emailData.to} via ${SMTP_ACCOUNTS[usedSlot].label} (${sessionCounters[usedSlot]}/${SMTP_ACCOUNTS[usedSlot].limit})`);

    return res.json({
      success: true,
      messageId: result.messageId,
      message: `Sent to ${emailData.to}`,
      smtpAccount: SMTP_ACCOUNTS[usedSlot].label,
      currentSlot,
      counters: { ...sessionCounters },
    });
  } catch (error: any) {
    console.error(`[SMTP] ❌ All attempts failed for ${emailData.to}:`, error.message);
    return res.status(500).json({ success: false, message: error.message });
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
    const configured = Object.entries(SMTP_ACCOUNTS)
      .filter(([, v]) => v.pass)
      .map(([k, v]) => `${v.label} [${v.senderEmail || 'NO SENDER EMAIL'}]`)
      .join(', ');
    console.log(`📧 Configured: ${configured || '❌ NONE — check Railway env variables!'}`);
    console.log(`📤 Starting slot: ${SMTP_ACCOUNTS[currentSlot].label}`);
  });
}

startServer();