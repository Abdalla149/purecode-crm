// ═══════════════════════════════════════════════════════
// AUTH ROUTES — Login + User Management
// ═══════════════════════════════════════════════════════

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ─── Users database (start simple — move to Supabase later) ───
// In production, these live in Supabase. For now, hardcode to get
// the system working. Passwords are hashed with bcrypt.
//
// TO ADD A NEW AGENT:
// 1. Hash their password: node -e "import('bcryptjs').then(b=>b.default.hash('their_password',10).then(console.log))"
// 2. Add them to this array with their JustCall agent ID
// 3. Restart the server

const USERS = [
  {
    id: 'admin_david',
    username: 'david',
    passwordHash: '$2a$10$tTwAoNIPJBkioV76ZgX/ve7YMcwBszubcbn63.R/l4IHqIqwQpTcu',
    role: 'admin',
    name: 'David',
    agentId: null,
    justcallNumbers: [],
  },
  {
    id: 'agent_khalid',
    username: 'khalid',
    passwordHash: '$2a$10$b8MlvE2ccVGnM6Lcuv/4i.TfefzOgmK5BwOKH1cR9m/rVUzQiCnVm',
    role: 'agent',
    name: 'Khalid',
    ghlUserId: 'mwhEdKvuwIUFFujKry9y',
    agentId: 'jc_khalid_id',   // ← Replace with real JustCall agent ID
    justcallNumbers: [
      { id: 'n1', number: '(714) 555-0101', label: '#1' },
      { id: 'n2', number: '(949) 555-0102', label: '#2' },
      { id: 'n3', number: '(657) 555-0103', label: '#3' },
    ]
  },
  {
    id: 'agent_omar',
    username: 'omar',
    passwordHash: '$2a$10$X1SWRNBlZppa8Qe8y1AsWek.ActWGB6FOXz/AFVZJuu4tLvNsrKpq',
    role: 'agent',
    name: 'Omar',
    ghlUserId: '3zHvVi4Kee0XV8Y8A4aI',
    agentId: 'jc_omar_id',     // ← Replace with real JustCall agent ID
    justcallNumbers: [
      { id: 'n4', number: '(714) 555-0201', label: '#1' },
      { id: 'n5', number: '(949) 555-0202', label: '#2' },
      { id: 'n6', number: '(657) 555-0203', label: '#3' },
    ]
  },
  {
    id: 'agent_sara',
    username: 'sara',
    passwordHash: '$2a$10$gFXlqrvFS1EcmmQH0mvigeUIeyFJJXF4LfL6QNHAOwr233Ck.BGkO',
    role: 'agent',
    name: 'Sara',
    ghlUserId: '9OcAH0DjAFvzWChwnxKq',
    agentId: 'jc_sara_id',     // ← Replace with real JustCall agent ID
    justcallNumbers: [
      { id: 'n7', number: '(714) 555-0301', label: '#1' },
      { id: 'n8', number: '(949) 555-0302', label: '#2' },
      { id: 'n9', number: '(657) 555-0303', label: '#3' },
    ]
  }
];


// ═══════════ POST /api/auth/login ═══════════
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = USERS.find(u => u.username === username.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        // Only send numbers to agents (admin doesn't need them)
        ...(user.role === 'agent' && { 
          phoneNumbers: user.justcallNumbers 
        })
      }
    });
  } catch (err) {
    console.error('[AUTH ERROR]', err);
    res.status(500).json({ error: 'Login failed — try again' });
  }
});


// ═══════════ GET /api/auth/me ═══════════
// Verify token is still valid + get current user info
router.get('/me', requireAuth, (req, res) => {
  const user = USERS.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    name: user.name,
    role: user.role,
    ...(user.role === 'agent' && { 
      phoneNumbers: user.justcallNumbers 
    })
  });
});


// ═══════════ GET /api/auth/agents ═══════════
// Admin only — list all agents (for assignment dropdowns)
router.get('/agents', requireAuth, requireAdmin, (req, res) => {
  const agents = USERS
    .filter(u => u.role === 'agent')
    .map(u => ({
      id:         u.id,
      name:       u.name,
      ghlUserId:  u.ghlUserId,
      agentId:    u.agentId,
    }));

  res.json({ agents });
});


export default router;
