const { verifyToken } = require('../lib/jwt')
const prisma = require('../lib/prisma')
const { ADMIN_ROLES } = require('../lib/roles')

// Verifies the JWT and attaches req.user = { id, role }. 401 if missing/invalid.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.isActive) return res.status(401).json({ error: 'Not authenticated' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Same as requireAuth, but also requires a staff role (support/manager/superadmin).
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Admin access required' })
    next()
  })
}

// Stricter than requireAdmin — only the given role(s) may proceed.
// e.g. requireRole('superadmin') for staff management and the audit log.
function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to do this' })
      next()
    })
  }
}

module.exports = { requireAuth, requireAdmin, requireRole }
