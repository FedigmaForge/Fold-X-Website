const { Router } = require('express')
const crypto = require('crypto')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')
const { normaliseCode, PAID } = require('../lib/discounts')

const router = Router()

const TYPES = ['percent', 'fixed', 'free_shipping']
const SCOPES = ['all', 'categories', 'products']

function optionalInt(v, label) {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `${label} must be a whole number of 1 or more (or blank for no limit)`)
  return n
}

function optionalDate(v, label) {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${label} is not a valid date`)
  return d
}

// Builds the Coupon columns from a request, merged over `current` for edits so
// cross-field rules (dates, percent caps) are checked on the final values.
async function parseCoupon(body, current = null) {
  const d = {}
  if (body.isAutomatic !== undefined) d.isAutomatic = !!body.isAutomatic
  const isAutomatic = d.isAutomatic ?? current?.isAutomatic ?? false

  if (body.description !== undefined) d.description = String(body.description ?? '').trim().slice(0, 80)
  if (isAutomatic && !(d.description ?? current?.description)) throw new HttpError(400, 'Give the automatic discount a name — shoppers see it at checkout')

  if (body.code !== undefined || !current) {
    const code = normaliseCode(body.code)
    if (isAutomatic && !code) d.code = `AUTO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    else if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new HttpError(400, 'Code must be 3–30 letters, numbers, dashes or underscores')
    else d.code = code
  }

  if (body.type !== undefined || !current) {
    if (!TYPES.includes(body.type)) throw new HttpError(400, 'Choose a discount type')
    d.type = body.type
  }
  const type = d.type ?? current.type
  if (body.value !== undefined || !current) {
    d.value = type === 'free_shipping' ? 0 : Number(body.value)
  }
  const value = d.value ?? current.value
  if (type === 'percent' && !(value > 0 && value <= 100)) throw new HttpError(400, 'Percentage must be between 1 and 100')
  if (type === 'fixed' && !(value > 0)) throw new HttpError(400, 'Amount off must be more than ₹0')

  if (body.maxDiscount !== undefined) {
    d.maxDiscount = body.maxDiscount === null || body.maxDiscount === '' ? null : Number(body.maxDiscount)
    if (d.maxDiscount !== null && !(d.maxDiscount > 0)) throw new HttpError(400, 'Maximum discount must be more than ₹0')
  }
  if (type !== 'percent') d.maxDiscount = null

  if (body.minSubtotal !== undefined) {
    d.minSubtotal = Number(body.minSubtotal || 0)
    if (!(d.minSubtotal >= 0)) throw new HttpError(400, 'Minimum order must be ₹0 or more')
  }

  if (body.appliesTo !== undefined || !current) {
    d.appliesTo = SCOPES.includes(body.appliesTo) ? body.appliesTo : 'all'
  }
  const appliesTo = d.appliesTo ?? current.appliesTo
  if (body.targetIds !== undefined || !current) {
    d.targetIds = appliesTo === 'all' ? [] : [...new Set((Array.isArray(body.targetIds) ? body.targetIds : []).map(String))]
  }
  const targetIds = d.targetIds ?? current.targetIds
  if (appliesTo !== 'all') {
    if (!targetIds.length) throw new HttpError(400, `Pick at least one ${appliesTo === 'categories' ? 'category' : 'product'}`)
    const found = appliesTo === 'categories'
      ? await prisma.category.count({ where: { id: { in: targetIds } } })
      : await prisma.product.count({ where: { id: { in: targetIds } } })
    if (found !== targetIds.length) throw new HttpError(400, `Some of the chosen ${appliesTo} no longer exist`)
  }

  const s = optionalDate(body.startsAt, 'Start date'); if (s !== undefined) d.startsAt = s
  const e = optionalDate(body.endsAt, 'End date'); if (e !== undefined) d.endsAt = e
  const startsAt = d.startsAt !== undefined ? d.startsAt : current?.startsAt
  const endsAt = d.endsAt !== undefined ? d.endsAt : current?.endsAt
  if (startsAt && endsAt && endsAt <= startsAt) throw new HttpError(400, 'End date must be after the start date')

  const u = optionalInt(body.usageLimit, 'Total uses'); if (u !== undefined) d.usageLimit = u
  const pc = optionalInt(body.perCustomerLimit, 'Uses per customer'); if (pc !== undefined) d.perCustomerLimit = pc
  if (body.firstOrderOnly !== undefined) d.firstOrderOnly = !!body.firstOrderOnly
  if (body.isActive !== undefined) d.isActive = !!body.isActive
  return d
}

function statusOf(c, now = new Date()) {
  if (!c.isActive) return 'disabled'
  if (c.endsAt && c.endsAt < now) return 'expired'
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return 'used_up'
  if (c.startsAt && c.startsAt > now) return 'scheduled'
  return 'active'
}

// GET /api/admin/coupons — with uses, discount given and sales they brought in
router.get('/admin/coupons', requireAdmin, asyncRoute(async (req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })
  const [given, sales] = await Promise.all([
    prisma.couponRedemption.groupBy({ by: ['couponId'], _sum: { discount: true } }),
    prisma.order.groupBy({ by: ['couponId'], where: { couponId: { not: null }, paymentStatus: { in: PAID }, status: { not: 'cancelled' } }, _sum: { total: true } }),
  ])
  const givenBy = new Map(given.map((g) => [g.couponId, g._sum.discount ?? 0]))
  const salesBy = new Map(sales.map((g) => [g.couponId, g._sum.total ?? 0]))
  res.json(coupons.map((c) => ({
    ...c,
    status: statusOf(c),
    discountGiven: Math.round((givenBy.get(c.id) ?? 0) * 100) / 100,
    sales: Math.round((salesBy.get(c.id) ?? 0) * 100) / 100,
  })))
}))

// POST /api/admin/coupons
router.post('/admin/coupons', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const data = await parseCoupon(req.body)
  if (await prisma.coupon.findUnique({ where: { code: data.code } })) throw new HttpError(409, `The code ${data.code} already exists`)
  const coupon = await prisma.coupon.create({ data })
  await logAudit({ actor: req.user, action: 'coupon.create', entityType: 'Coupon', entityId: coupon.id, summary: `Created ${coupon.isAutomatic ? 'automatic discount' : 'coupon'} ${coupon.isAutomatic ? `"${coupon.description}"` : coupon.code}` })
  res.status(201).json({ ...coupon, status: statusOf(coupon) })
}))

// PUT /api/admin/coupons/:id
router.put('/admin/coupons/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const current = await prisma.coupon.findUnique({ where: { id: req.params.id } })
  if (!current) throw new HttpError(404, 'Coupon not found')
  const data = await parseCoupon(req.body, current)
  if (data.code && data.code !== current.code) {
    if (current.usedCount > 0) throw new HttpError(409, "A code that's been used can't be renamed — create a new one instead")
    if (await prisma.coupon.findUnique({ where: { code: data.code } })) throw new HttpError(409, `The code ${data.code} already exists`)
  }
  const coupon = await prisma.coupon.update({ where: { id: current.id }, data })
  const what = data.isActive !== undefined && data.isActive !== current.isActive ? (data.isActive ? 'Enabled' : 'Disabled') : 'Updated'
  await logAudit({ actor: req.user, action: 'coupon.update', entityType: 'Coupon', entityId: coupon.id, summary: `${what} ${coupon.isAutomatic ? `automatic discount "${coupon.description}"` : `coupon ${coupon.code}`}` })
  res.json({ ...coupon, status: statusOf(coupon) })
}))

// DELETE /api/admin/coupons/:id — only if never used; otherwise disable it
router.delete('/admin/coupons/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const current = await prisma.coupon.findUnique({ where: { id: req.params.id } })
  if (!current) throw new HttpError(404, 'Coupon not found')
  if (await prisma.order.count({ where: { couponId: current.id } })) {
    throw new HttpError(409, 'This discount has been used on orders — disable it instead so order history stays intact')
  }
  await prisma.coupon.delete({ where: { id: current.id } })
  await logAudit({ actor: req.user, action: 'coupon.delete', entityType: 'Coupon', entityId: current.id, summary: `Deleted ${current.isAutomatic ? `automatic discount "${current.description}"` : `coupon ${current.code}`}` })
  res.status(204).end()
}))

module.exports = router
