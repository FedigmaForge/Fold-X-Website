const { Router } = require('express')
const prisma = require('../lib/prisma')
const { verifyToken } = require('../lib/jwt')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')

const router = Router()

function serializeOrder(order) {
  return {
    ...order,
    items: order.items.map((i) => ({
      product: i.productSnapshot,
      quantity: i.quantity,
      variant: i.variant,
    })),
  }
}

// POST /api/orders  { items, address, paymentId, razorpayOrderId, subtotal, shipping, total }
// Auth optional — logged-in users get userId attached, guests can still check out.
router.post('/orders', asyncRoute(async (req, res) => {
  const {
    items, address, paymentId, razorpayOrderId, subtotal, shipping = 0, total,
    giftWrap = false, giftNote, giftWrapFee = 0,
  } = req.body
  if (!items?.length) throw new HttpError(400, 'items are required')
  if (!address?.name || !address?.phone || !address?.email) throw new HttpError(400, 'address is incomplete')

  let userId = null
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    try {
      const payload = verifyToken(token)
      const user = await prisma.user.findUnique({ where: { id: payload.sub } })
      if (user) userId = user.id
    } catch {
      // invalid/expired token on a guest-allowed route — just proceed as guest
    }
  }

  const order = await prisma.order.create({
    data: {
      userId,
      customerName: address.name,
      customerEmail: address.email,
      subtotal: subtotal ?? items.reduce((s, i) => s + i.product.price * i.quantity, 0),
      shipping,
      giftWrapFee,
      total: total ?? items.reduce((s, i) => s + i.product.price * i.quantity, 0) + shipping + giftWrapFee,
      status: 'pending',
      paymentStatus: 'paid',
      paymentId,
      razorpayOrderId,
      address,
      giftWrap: !!giftWrap,
      giftNote: giftWrap ? (giftNote || null) : null,
      items: {
        create: items.map((i) => ({
          productId: i.product?.id,
          productSnapshot: i.product,
          quantity: i.quantity,
          variant: i.variant ?? {},
        })),
      },
    },
    include: { items: true },
  })
  res.status(201).json(serializeOrder(order))
}))

// GET /api/orders/mine — scoped server-side by the JWT's user id
router.get('/orders/mine', requireAuth, asyncRoute(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(orders.map(serializeOrder))
}))

// GET /api/orders/:id — public lookup, used as a refresh-safe fallback on the
// order confirmation page (no ownership check: the order id itself is the secret)
router.get('/orders/:id', asyncRoute(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } })
  if (!order) throw new HttpError(404, 'Order not found')
  res.json(serializeOrder(order))
}))

// GET /api/admin/orders
router.get('/admin/orders', requireAdmin, asyncRoute(async (req, res) => {
  const { status } = req.query
  const orders = await prisma.order.findMany({
    where: status && status !== 'all' ? { status } : undefined,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(orders.map(serializeOrder))
}))

// GET /api/admin/orders/:id
router.get('/admin/orders/:id', requireAdmin, asyncRoute(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } })
  res.json(order ? serializeOrder(order) : null)
}))

// PUT /api/admin/orders/:id/status  { status }
router.put('/admin/orders/:id/status', requireAdmin, asyncRoute(async (req, res) => {
  const { status } = req.body
  const order = await prisma.order.update({ where: { id: req.params.id }, data: { status } })
  await logAudit({ actor: req.user, action: 'order.status_update', entityType: 'Order', entityId: order.id, summary: `Set order ${order.id} to "${status}"` })
  res.json({ id: order.id, status: order.status })
}))

module.exports = router
