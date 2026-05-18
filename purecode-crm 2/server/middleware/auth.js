// ═══════════════════════════════════════════════════════
// AUTH MIDDLEWARE — The Gatekeeper
// ═══════════════════════════════════════════════════════
// Every protected route goes through here.
// Checks JWT token, extracts role, blocks unauthorized.
// This is the REAL security — frontend hiding is cosmetic.
// ═══════════════════════════════════════════════════════

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION';

/**
 * Require a valid JWT token on the request
 * Adds req.user = { id, role, name, agentId }
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role, name, agentId }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired — please sign in again' });
  }
}

/**
 * Require admin role specifically
 * Must be used AFTER requireAuth
 */
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,          // 'admin' or 'agent'
      name: user.name,
      agentId: user.agentId,    // JustCall agent ID (for agents)
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}
