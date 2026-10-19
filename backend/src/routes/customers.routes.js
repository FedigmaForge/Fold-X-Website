const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')
const { normaliseEmail, getProfile, ordersForEmail } = require('../lib/customers')

const router = Router()

// Money the customer has actually paid us: paid online, or cash collected on
// delivery; refunds taken off.
const COUNTED = ['paid', 'partially_refunded', 'refunded']
const refundOf = (o) => (o.paymentStatus === 'refunded' ? o.total : o.refundedAmount || 0)
const round2 = (n) => Math.round(n * 100) / 100

function summarise(orders) {
  const live = orders.filter((o) => o.status !== 'cancelled')
  const paid = orders.filter((o) => COUNTED.includes(o.paymentStatus))
  const spent = round2(paid.reduce((s, o) => s + o.total - refundOf(o), 0))
  const sorted = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  return {
    orderCount: live.length,
    cancelledCount: orders.length - live.length,
    totalSpent: spent,
    avgOrderValue: paid.length ? round2(spent / paid.length) : 0,
    refunded: round2(orders.reduce((s, o) => s + refundOf(o), 0)),
    firstOrderAt: sorted[0]?.createdAt ?? null,
    lastOrderAt: sorted.at(-1)?.createdAt ?? null,
    codOrders: orders.filter((o) => o.paymentMethod === 'cod').length,
    codRefusals: orders.filter((o) => o.codRefused).length,
  }
}

// GET /api/admin/customers?q=&filter=all|registered|guests|blocked
// Everyone who has an account or has ordered, one row per email.
router.get('/admin/customers', requireAdmin, asyncRoute(async (req, res) => {
  const [users, orders, profiles] = await Promise.all([
    prisma.user.findMany({ where: { role: 'customer' } }),
    prisma.order.findMany({
      select: { id: true, customerEmail: true, customerName: true, address: true, total: true, refundedAmount: true, paymentStatus: true, paymentMethod: true, status: true, codRefused: true, createdAt: true },
    }),
    prisma.customerProfile.findMany(),
  ])

  const rows = new Map()
  const row = (email) => {
    const key = normaliseEmail(email)
    if (!rows.has(key)) rows.set(key, { email: key, orders: [] })
    return rows.get(key)
  }
  for (const u of users) Object.assign(row(u.email), { user: u })
  for (const o of orders) row(o.customerEmail).orders.push(o)
  const profileBy = new Map(profiles.map((p) => [p.email, p]))

  let list = [...rows.values()].map((r) => {
    const latest = [...r.orders].sort((a, b) => b.createdAt - a.createdAt)[0]
    const profile = profileBy.get(r.email)
    return {
      email: r.email,
      name: r.user?.name ?? latest?.customerName ?? r.email,
      phone: r.user?.phone ?? latest?.address?.phone ?? null,
      city: latest?.address?.city ?? r.user?.city ?? null,
      registered: !!r.user,
      joinedAt: r.user?.createdAt ?? null,
      tags: profile?.tags ?? [],
      isBlocked: profile?.isBlocked ?? false,
      codDisabled: profile?.codDisabled ?? false,
      ...summarise(r.orders),
    }
  })

  const { q, filter } = req.query
  if (q) {
    const needle = String(q).toLowerCase()
    list = list.filter((c) => c.name.toLowerCase().includes(needle) || c.email.includes(needle) || (c.phone ?? '').includes(needle))
  }
  if (filter === 'registered') list = list.filter((c) => c.registered)
  if (filter === 'guests') list = list.filter((c) => !c.registered)
  if (filter === 'blocked') list = list.filter((c) => c.isBlocked)
  if (filter === 'repeat') list = list.filter((c) => c.orderCount > 1)

  list.sort((a, b) => new Date(b.lastOrderAt ?? b.joinedAt ?? 0) - new Date(a.lastOrderAt ?? a.joinedAt ?? 0))
  res.json(list)
}))

// GET /api/admin/customers/:email — full profile
router.get('/admin/customers/:email', requireAdmin, asyncRoute(async (req, res) => {
  const email = normaliseEmail(req.params.email)
  const [user, profile, orders] = await Promise.all([
    prisma.user.findFirst({ where: { email: { contains: email }, role: 'customer' } }).then((u) => (u && u.email.toLowerCase() === email ? u : null)),
    getProfile(prisma, email),
    ordersForEmail(prisma, email, {
      id: true, customerName: true, address: true, total: true, refundedAmount: true, paymentStatus: true, paymentMethod: true,
      status: true, codRefused: true, codConfirmedAt: true, discountCode: true, createdAt: true, items: { select: { quantity: true } },
    }),
  ])
  if (!user && orders.length === 0) throw new HttpError(404, 'Customer not found')

  const orderIds = orders.map((o) => o.id)
  const [returns, messages] = await Promise.all([
    prisma.returnRequest.findMany({ where: { orderId: { in: orderIds } }, select: { id: true, orderId: true, status: true, reason: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.contactMessage.findMany({ where: { email: { contains: email } }, select: { id: true, email: true, subject: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ])

  // Distinct delivery addresses, most recent first
  const seen = new Set()
  const addresses = []
  for (const o of [...orders].sort((a, b) => b.createdAt - a.createdAt)) {
    const a = o.address ?? {}
    const key = `${(a.line1 ?? '').toLowerCase()}|${a.pincode ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    addresses.push({ ...a, lastUsed: o.createdAt })
  }

  const latest = [...orders].sort((a, b) => b.createdAt - a.createdAt)[0]
  res.json({
    email,
    name: user?.name ?? latest?.customerName ?? email,
    phone: user?.phone ?? latest?.address?.phone ?? null,
    registered: !!user,
    accountActive: user?.isActive ?? null,
    joinedAt: user?.createdAt ?? null,
    profile: { notes: profile.notes, tags: profile.tags ?? [], isBlocked: profile.isBlocked, blockReason: profile.blockReason, codDisabled: profile.codDisabled },
    stats: summarise(orders),
    orders: orders
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ items, address, customerName, ...o }) => ({ ...o, units: items.reduce((s, i) => s + i.quantity, 0) })),
    addresses,
    returns,
    messages: messages.filter((m) => m.email.toLowerCase() === email),
  })
}))

// PUT /api/admin/customers/:email  { notes?, tags?, isBlocked?, blockReason?, codDisabled? }
// Any staff member can keep notes and tags; blocking and COD changes need a
// Manager or Super Admin.
router.put('/admin/customers/:email', requireAdmin, asyncRoute(async (req, res) => {
  const email = normaliseEmail(req.params.email)
  if (!email) throw new HttpError(400, 'Missing email')
  const current = await getProfile(prisma, email)
  const data = {}

  if (req.body.notes !== undefined) data.notes = String(req.body.notes ?? '').slice(0, 5000)
  if (req.body.tags !== undefined) {
    if (!Array.isArray(req.body.tags)) throw new HttpError(400, 'Tags must be a list')
    data.tags = [...new Set(req.body.tags.map((t) => String(t).trim().slice(0, 30)).filter(Boolean))].slice(0, 12)
  }
  const sensitive = ['isBlocked', 'blockReason', 'codDisabled'].some((k) => req.body[k] !== undefined)
  if (sensitive && !CATALOG_WRITE_ROLES.includes(req.user.role)) {
    throw new HttpError(403, 'Only a Manager or Super Admin can block customers or change cash on delivery')
  }
  if (req.body.isBlocked !== undefined) data.isBlocked = !!req.body.isBlocked
  if (req.body.blockReason !== undefined) data.blockReason = String(req.body.blockReason ?? '').trim().slice(0, 300)
  if (req.body.codDisabled !== undefined) data.codDisabled = !!req.body.codDisabled
  if (data.isBlocked && !(data.blockReason ?? current.blockReason)) throw new HttpError(400, 'Add a reason for blocking — it helps colleagues later')

  const profile = await prisma.$transaction(async (tx) => {
    const saved = await tx.customerProfile.upsert({
      where: { email },
      create: { email, tags: [], ...data },
      update: data,
    })
    // A blocked registered customer can't sign in either
    if (data.isBlocked !== undefined && data.isBlocked !== current.isBlocked) {
      const user = await tx.user.findFirst({ where: { email: { contains: email }, role: 'customer' } })
      if (user && user.email.toLowerCase() === email) await tx.user.update({ where: { id: user.id }, data: { isActive: !data.isBlocked } })
    }
    return saved
  })

  if (data.isBlocked !== undefined && data.isBlocked !== current.isBlocked) {
    await logAudit({ actor: req.user, action: data.isBlocked ? 'customer.block' : 'customer.unblock', entityType: 'Customer', entityId: email, summary: `${data.isBlocked ? 'Blocked' : 'Unblocked'} customer ${email}${data.isBlocked && profile.blockReason ? ` — ${profile.blockReason}` : ''}` })
  }
  if (data.codDisabled !== undefined && data.codDisabled !== current.codDisabled) {
    await logAudit({ actor: req.user, action: 'customer.cod', entityType: 'Customer', entityId: email, summary: `${data.codDisabled ? 'Turned off' : 'Turned on'} cash on delivery for ${email}` })
  }
  res.json({ notes: profile.notes, tags: profile.tags, isBlocked: profile.isBlocked, blockReason: profile.blockReason, codDisabled: profile.codDisabled })
}))

module.exports = router
