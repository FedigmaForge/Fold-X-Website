const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
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
    'supportEmail', 'supportPhone', 'address', 'instagramHandle', 'currency', 'razorpayKeyId', 'gstin', 'legalName', 'state', 'defaultHsnCode', 'defaultGstRate',
    'flatShippingFee', 'giftWrapFee', 'returnWindowDays',
    'codEnabled', 'codFee', 'codMaxOrder', 'codMaxRefusals', 'codMaxOpen',
    'shippingCostPerOrder', 'require2FA',
  ]) {
    if (req.body[key] !== undefined) data[key] = req.body[key]
  }
  if (data.freeShippingThreshold !== undefined) data.freeShippingThreshold = Number(data.freeShippingThreshold)
  if (data.codEnabled !== undefined) data.codEnabled = !!data.codEnabled
  if (data.require2FA !== undefined) {
    data.require2FA = !!data.require2FA
    // Forcing two-step login on everyone is a Super Admin decision; the
    // settings form sends the current value back, so only block real changes
    const current = await getOrCreateSettings()
    if (data.require2FA !== current.require2FA && req.user.role !== 'superadmin') {
      throw new HttpError(403, 'Only the Super Admin can change whether two-step login is required')
    }
  }
  for (const key of ['flatShippingFee', 'giftWrapFee', 'returnWindowDays', 'codFee', 'codMaxOrder', 'codMaxRefusals', 'codMaxOpen', 'shippingCostPerOrder']) {
    if (data[key] === undefined) continue
    data[key] = Number(data[key])
    if (!Number.isFinite(data[key]) || data[key] < 0) throw new HttpError(400, `${key} must be 0 or more`)
  }
  for (const key of ['returnWindowDays', 'codMaxRefusals', 'codMaxOpen']) {
    if (data[key] !== undefined) data[key] = Math.round(data[key])
  }
  if (data.defaultGstRate !== undefined) {
    data.defaultGstRate = Number(data.defaultGstRate)
    if (!Number.isFinite(data.defaultGstRate) || data.defaultGstRate < 0 || data.defaultGstRate > 100) {
      throw new HttpError(400, 'Default GST rate must be a percentage between 0 and 100')
    }
  }

  const updated = await prisma.settings.update({ where: { id: 1 }, data })
  await logAudit({ actor: req.user, action: 'settings.update', entityType: 'Settings', entityId: '1', summary: 'Updated store settings' })
  res.json(updated)
}))

module.exports = router
