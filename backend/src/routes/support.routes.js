const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { restoreStock } = require('../lib/stock')

const router = Router()

const DAY = 24 * 60 * 60 * 1000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const str = (v, max) => String(v ?? '').trim().slice(0, max)

// ─── Contact form ──────────────────────────────────────────────────────────────

const SUBJECTS = ['Order question', 'Returns & refunds', 'Product question', 'Feedback', 'Other']

// Simple in-memory throttle: 5 messages per IP per 10 minutes. Enough to stop
// casual spam on a single server; use a shared store if this ever scales out.
const recent = new Map()
function throttled(ip) {
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000)
  if (hits.length >= 5) return true
  hits.push(now)
  recent.set(ip, hits)
  return false
}

// POST /api/contact  { name, email, phone?, orderId?, subject, message, website? }
router.post('/contact', asyncRoute(async (req, res) => {
  // Honeypot: real visitors never see or fill "website" — bots usually do.
  // Pretend it worked so they don't retry.
  if (req.body.website) return res.status(201).json({ ok: true })
  if (throttled(req.ip)) throw new HttpError(429, 'Too many messages — please try again in a few minutes')

  const data = {
    name: str(req.body.name, 80),
    email: str(req.body.email, 120),
    phone: str(req.body.phone, 20) || null,
    orderId: str(req.body.orderId, 40) || null,
    subject: SUBJECTS.includes(req.body.subject) ? req.body.subject : 'Other',
    message: str(req.body.message, 4000),
  }
  if (!data.name) throw new HttpError(400, 'Please enter your name')
  if (!EMAIL.test(data.email)) throw new HttpError(400, 'Please enter a valid email address')
  if (data.message.length < 10) throw new HttpError(400, 'Please write a little more so we can help')

  await prisma.contactMessage.create({ data })
  res.status(201).json({ ok: true })
}))

// GET /api/admin/support/counts — sidebar badges
router.get('/admin/support/counts', requireAdmin, asyncRoute(async (req, res) => {
  const [newMessages, openReturns] = await Promise.all([
    prisma.contactMessage.count({ where: { status: 'new' } }),
    prisma.returnRequest.count({ where: { status: { in: ['requested', 'approved'] } } }),
  ])
  res.json({ newMessages, openReturns })
}))

// GET /api/admin/messages?status=new|open|closed|all
router.get('/admin/messages', requireAdmin, asyncRoute(async (req, res) => {
  const { status } = req.query
  const messages = await prisma.contactMessage.findMany({
    where: status && status !== 'all' ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  // Link messages that quote a real order number
  const ids = [...new Set(messages.map((m) => m.orderId).filter(Boolean))]
  const known = new Set((await prisma.order.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((o) => o.id))
  res.json(messages.map((m) => ({ ...m, orderExists: !!m.orderId && known.has(m.orderId) })))
}))

// PUT /api/admin/messages/:id  { status?, internalNote? }
router.put('/admin/messages/:id', requireAdmin, asyncRoute(async (req, res) => {
  const current = await prisma.contactMessage.findUnique({ where: { id: req.params.id } })
  if (!current) throw new HttpError(404, 'Message not found')
  const data = {}
  if (req.body.status !== undefined) {
    if (!['new', 'open', 'closed'].includes(req.body.status)) throw new HttpError(400, 'Invalid status')
    data.status = req.body.status
  }
  if (req.body.internalNote !== undefined) data.internalNote = str(req.body.internalNote, 4000)
  const updated = await prisma.contactMessage.update({ where: { id: current.id }, data })
  if (data.status && data.status !== current.status) {
    await logAudit({ actor: req.user, action: 'message.status', entityType: 'ContactMessage', entityId: current.id, summary: `Marked message from ${current.name} as ${data.status}` })
  }
  res.json(updated)
}))

// ─── Returns ───────────────────────────────────────────────────────────────────

const RETURN_REASONS = ['Damaged or defective', 'Wrong item received', 'Not as described', 'Changed my mind', 'Other']
const OPEN = ['requested', 'approved']

// When the order was delivered: the latest "→ delivered" timeline event, else
// the last update (orders delivered before the timeline existed).
function deliveredAt(order) {
  const ev = order.events?.filter((e) => e.type === 'status' && /to delivered/.test(e.message)).at(-1)
  return ev ? ev.createdAt : order.updatedAt
}

// Quantities per order item already covered by approved/received/closed returns
function alreadyReturned(returns) {
  const used = new Map()
  for (const r of returns) {
    if (!['approved', 'received', 'closed'].includes(r.status)) continue
    for (const it of r.items) used.set(it.itemId, (used.get(it.itemId) || 0) + it.quantity)
  }
  return used
}

async function returnEligibility(order) {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } })
  const windowDays = settings?.returnWindowDays ?? 10
  if (order.status !== 'delivered') return { ok: false, reason: 'Returns can be requested once the order has been delivered', windowDays }
  const until = new Date(new Date(deliveredAt(order)).getTime() + windowDays * DAY)
  if (Date.now() > until.getTime()) return { ok: false, reason: `The ${windowDays}-day return window has closed`, windowDays, until }
  if (order.returns.some((r) => OPEN.includes(r.status))) return { ok: false, reason: 'A return for this order is already in progress', windowDays, until }
  return { ok: true, windowDays, until }
}

// POST /api/orders/:id/returns  { items: [{ itemId, quantity }], reason, details }
// Customers can only request returns on their own orders.
router.post('/orders/:id/returns', requireAuth, asyncRoute(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true, returns: true, events: { orderBy: { createdAt: 'asc' } } },
  })
  if (!order || order.userId !== req.user.id) throw new HttpError(404, 'Order not found')

  const eligibility = await returnEligibility(order)
  if (!eligibility.ok) throw new HttpError(409, eligibility.reason)

  const reason = RETURN_REASONS.includes(req.body.reason) ? req.body.reason : null
  if (!reason) throw new HttpError(400, 'Please choose a reason')
  const details = str(req.body.details, 2000)
  if (reason === 'Other' && details.length < 5) throw new HttpError(400, 'Please tell us a bit more')

  const used = alreadyReturned(order.returns)
  const items = []
  for (const it of Array.isArray(req.body.items) ? req.body.items : []) {
    const line = order.items.find((i) => i.id === it.itemId)
    const qty = Number(it.quantity)
    if (!line || !Number.isInteger(qty) || qty < 1) continue
    const remaining = line.quantity - (used.get(line.id) || 0)
    if (qty > remaining) throw new HttpError(400, `You can return at most ${remaining} of ${line.productSnapshot?.name}`)
    items.push({ itemId: line.id, name: line.productSnapshot?.name ?? 'Item', variant: line.variant ?? {}, quantity: qty })
  }
  if (items.length === 0) throw new HttpError(400, 'Choose at least one item to return')

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.returnRequest.create({ data: { orderId: order.id, userId: req.user.id, items, reason, details } })
    await tx.orderEvent.create({
      data: { orderId: order.id, type: 'status', message: `Return requested: ${items.map((i) => `${i.name} ×${i.quantity}`).join(', ')} — ${reason}`, actorName: req.user.name },
    })
    return created
  })
  const { adminNote, restocked, ...publicFields } = request
  res.status(201).json(publicFields)
}))

// GET /api/admin/returns?status=
router.get('/admin/returns', requireAdmin, asyncRoute(async (req, res) => {
  const { status } = req.query
  const where = status === 'open' ? { status: { in: OPEN } } : status && status !== 'all' ? { status } : undefined
  const returns = await prisma.returnRequest.findMany({
    where,
    include: { order: { select: { id: true, customerName: true, customerEmail: true, total: true, paymentStatus: true, refundedAmount: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  res.json(returns)
}))

// What each status may move to. "received" = parcel back with us; "closed" =
// done (usually after the refund is issued from the order page).
const TRANSITIONS = {
  requested: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  received: ['closed'],
  rejected: [],
  closed: [],
}
const STATUS_TEXT = { approved: 'approved', rejected: 'rejected', received: 'marked as received', closed: 'closed' }

// PUT /api/admin/returns/:id  { status?, adminNote?, restock? }
router.put('/admin/returns/:id', requireAdmin, asyncRoute(async (req, res) => {
  const current = await prisma.returnRequest.findUnique({ where: { id: req.params.id }, include: { order: { include: { items: true } } } })
  if (!current) throw new HttpError(404, 'Return not found')

  const data = {}
  if (req.body.adminNote !== undefined) data.adminNote = str(req.body.adminNote, 2000)
  const next = req.body.status
  if (next !== undefined && next !== current.status) {
    if (!(TRANSITIONS[current.status] ?? []).includes(next)) throw new HttpError(400, `A ${current.status} return can't be ${STATUS_TEXT[next] ?? next}`)
    data.status = next
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Put returned items back on sale when the parcel arrives (optional — e.g.
    // damaged goods shouldn't be restocked)
    if (data.status === 'received' && req.body.restock && !current.restocked) {
      const lines = current.items
        .map((it) => {
          const line = current.order.items.find((i) => i.id === it.itemId)
          return line?.productId ? { productId: line.productId, variantId: line.variantId, quantity: it.quantity } : null
        })
        .filter(Boolean)
      await restoreStock(tx, lines, { orderId: current.orderId, actorName: req.user.name, reason: 'return' })
      data.restocked = true
    }
    const r = await tx.returnRequest.update({ where: { id: current.id }, data })
    if (data.status) {
      await tx.orderEvent.create({
        data: {
          orderId: current.orderId,
          type: 'status',
          message: `Return ${STATUS_TEXT[data.status]}${data.restocked ? ' and items restocked' : ''}${data.adminNote ? ` — ${data.adminNote}` : ''}`,
          actorName: req.user.name,
        },
      })
    }
    return r
  })
  if (data.status) {
    await logAudit({ actor: req.user, action: 'return.status', entityType: 'ReturnRequest', entityId: current.id, summary: `Return on order ${current.orderId} ${STATUS_TEXT[data.status]}` })
  }
  res.json(updated)
}))

module.exports = { router, returnEligibility, RETURN_REASONS }
