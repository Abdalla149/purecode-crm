// ═══════════════════════════════════════════════════════
// PURECODE CRM — Server Entry
// ═══════════════════════════════════════════════════════

// This is the backend. It sits between your React frontend
// and GHL/JustCall APIs. Agents never see GHL — they see
// "PureCode" everywhere. This server handles:
//   - Auth (login, JWT, role checking)
//   - Leads (CRUD via GHL API, filtered by role)
//   - Calls (trigger JustCall click-to-call)
//   - Activity feed (team wins for agents, everything for admin)
//   - Webhooks (JustCall call-end → update GHL contact)
// ═══════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Routes
import authRoutes from './routes/auth.js';
import leadsRoutes from './routes/leads.js';
import statsRoutes from './routes/stats.js';
import feedRoutes from './routes/feed.js';
import webhookRoutes from './routes/webhooks.js';
import justcallRoutes from './routes/justcall.js';
import callsRoutes from './routes/calls.js';
import emailsRoutes from './routes/emails.js';
import importRoutes from './routes/import.js';
import agentSessionRoutes from './routes/agentSession.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
// FRONTEND_URL may be comma-separated for multiple origins (e.g. Vercel preview + custom domain)
const _allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks)
    if (!origin) return callback(null, true);
    // Allow any *.vercel.app subdomain during deploy/preview
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (_allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// ── Request logging (dev only) ──
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    app: 'PureCode CRM',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/justcall', justcallRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/agent/session', agentSessionRoutes);

// ── Error handler — NEVER expose GHL/JustCall names to frontend ──
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.message);
  
  // Generic error for agents — never leak backend stack names
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong — contact David'
      : err.message
  });
});

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`
  ┌──────────────────────────────────────┐
  │   PURECODE CRM — Server Running      │
  │   Port: ${PORT}                          │
  │   GHL:  ${process.env.GHL_API_KEY ? '✓ Connected' : '✗ Missing API key'}           │
  │   JC:   ${process.env.JUSTCALL_API_KEY ? '✓ Connected' : '✗ Missing API key'}           │
  └──────────────────────────────────────┘
  `);
});
