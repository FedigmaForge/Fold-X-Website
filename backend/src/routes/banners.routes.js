const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')

const router = Router()

// GET /api/banners (active only, sorted by order)
router.get('/banners', asyncRoute(async (req, res) => {
  const banners = await prisma.banner.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } })
  res.json(banners)
}))

// GET /api/admin/banners
router.get('/admin/banners', requireAdmin, asyncRoute(async (req, res) => {
  const banners = await prisma.banner.findMany({ orderBy: { order: 'asc' } })
  res.json(banners)
}))

// POST/PUT /api/admin/banners
router.post('/admin/banners', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const { id, ...data } = req.body
  if (id) {
    const banner = await prisma.banner.update({ where: { id }, data })
    await logAudit({ actor: req.user, action: 'banner.update', entityType: 'Banner', entityId: banner.id, summary: `Updated banner "${banner.title}"` })
    return res.json(banner)
  }
  const banner = await prisma.banner.create({ data })
  await logAudit({ actor: req.user, action: 'banner.create', entityType: 'Banner', entityId: banner.id, summary: `Created banner "${banner.title}"` })
  res.status(201).json(banner)
}))

// DELETE /api/admin/banners/:id
router.delete('/admin/banners/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const banner = await prisma.banner.findUnique({ where: { id: req.params.id } })
  await prisma.banner.delete({ where: { id: req.params.id } })
  if (banner) await logAudit({ actor: req.user, action: 'banner.delete', entityType: 'Banner', entityId: banner.id, summary: `Deleted banner "${banner.title}"` })
  res.json({ success: true })
}))

module.exports = router
