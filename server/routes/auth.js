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
    id: 'agent_lucas',
    username: 'lucas',
    passwordHash: '$2a$10$gWfKPfcYkNJa/2/7HBl15uVXIQrqUszU/ZH2b415vnpuoQE4S3tba',
    role: 'agent',
    name: 'Lucas',
    ghlUserId: '7c0sDQ3oEzttlQfa3jAA',
    agentId: 'jc_lucas_id',
    justcallNumbers: [
      { id: 'ln1', number: '+18314803557', label: '#1' },
    ]
  },
  {
    id: 'agent_harry',
    username: 'harry',
    passwordHash: '$2a$10$otXCrgayWdMhyoqH5j1JYOoQjmjNBvR02tER9DGkD7NrYqk3U5Ypq',
    role: 'agent',
    name: 'Harry',
    ghlUserId: 'EFYhirIwNFKAY04HjbbK',
    agentId: 'jc_harry_id',
    justcallNumbers: [
      { id: 'hn1', number: '+18312312281', label: '#1' },
    ]
  },
  {
    id: 'agent_jim',
    username: 'jim',
    passwordHash: '$2a$10$xbNf2DxsfD/UdKRNb7osAelvdhqi9UCtG7/haWdRYlzIB3DxT3Lcq',
    role: 'agent',
    name: 'Jim',
    ghlUserId: 'CUqipGSIfqu2o7bcWroN',
    agentId: 'jc_jim_id',
    justcallNumbers: [
      { id: 'jn1', number: '+18313370742', label: '#1' },
    ]
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
