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
    id: 'agent_bruce',
    username: 'bruce',
    passwordHash: '$2a$10$jD4ig7DMhiTuQHC09h8IqeIdvCSEo3nb5Yf32h2ag74AdRT3.TLf2',
    role: 'agent',
    name: 'Bruce',
    ghlUserId: 'hHYQ1Yk7EZhxjjFYYGln',
    agentId: 'jc_bruce_id',
    justcallNumbers: [
      { id: 'bn1', number: '+18314014983', label: '#1' },
    ]
  },
  {
    id: 'agent_ana',
    username: 'ana',
    passwordHash: '$2a$10$w/2QJV7Bqr03RM5NSNuUyOqIp5fGrH3c4lmwSbOD4ORiL8xjHagF2',
    role: 'agent',
    name: 'Ana',
    ghlUserId: 'UZunnpAz8nu4GYTohYRW',
    agentId: null,        // TODO: set Ana's JustCall agent ID
    justcallNumbers: []   // TODO: assign JustCall number(s) so she can call
  },
  {
    id: 'agent_adam',
    username: 'adam',
    passwordHash: '$2a$10$CkNoPh7kMmURPsAoCE3ODuFWsp80OXKMWar7vpK67HdZ0OJaHXXjS',
    role: 'agent',
    name: 'Adam Black',
    ghlUserId: '07n150lGezYVHDmRy1Eu',
    agentId: null,        // TODO: set Adam's JustCall agent ID
    justcallNumbers: []   // TODO: assign JustCall number(s) so he can call
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
