const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')

const router = Router()

async function getOrCreateSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } })
  if (existing) return existing
  return prisma.settings.create({ data: { id: 1 } })
}

// GET /api/settings — public subset the storefront needs (Navbar/Footer/checkout)
router.get('/settings', asyncRoute(async (req, res) => {
  const s = await getOrCreateSettings()
  const { razorpayKeyId, ...publicSettings } = s
  res.json(publicSettings)
}))

// GET /api/admin/settings — full settings including razorpayKeyId
router.get('/admin/settings', requireAdmin, asyncRoute(async (req, res) => {
  res.json(await getOrCreateSettings())
}))

// PUT /api/admin/settings
router.put('/admin/settings', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  await getOrCreateSettings()
  // Whitelist fields explicitly — the settings store's client-side state
  // carries extra keys (e.g. `hydrated`) that aren't real Settings columns,
  // and Prisma throws on unknown keys rather than silently ignoring them.
  const data = {}
  for (const key of [
    'storeName', 'tagline', 'announcementBar', 'freeShippingThreshold',
    'supportEmail', 'supportPhone', 'address', 'instagramHandle', 'currency', 'razorpayKeyId',
  ]) {
    if (req.body[key] !== undefined) data[key] = req.body[key]
  }
  if (data.freeShippingThreshold !== undefined) data.freeShippingThreshold = Number(data.freeShippingThreshold)

  const updated = await prisma.settings.update({ where: { id: 1 }, data })
  await logAudit({ actor: req.user, action: 'settings.update', entityType: 'Settings', entityId: '1', summary: 'Updated store settings' })
  res.json(updated)
}))

module.exports = router
