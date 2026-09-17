const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireRole } = require('../middleware/auth')
const { asyncRoute } = require('../middleware/errorHandler')

const router = Router()

// GET /api/admin/audit-log — superadmin-only, most recent first.
router.get('/admin/audit-log', requireRole('superadmin'), asyncRoute(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200)
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  res.json(entries)
}))

module.exports = router
