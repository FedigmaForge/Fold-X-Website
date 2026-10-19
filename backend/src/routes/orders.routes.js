const { Router } = require('express')
const prisma = require('../lib/prisma')
const { verifyToken } = require('../lib/jwt')
const { requireAuth, requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { REFUND_ROLES } = require('../lib/roles')
const { deductStock, restoreStock, findShortages, shortageMessage } = require('../lib/stock')
const { quoteOrder } = require('../lib/pricing')
const { toCsv } = require('../lib/csv')
const { returnEligibility } = require('./support.routes')
const { assertCanOrder } = require('../lib/customers')
const { recordCapture, recordRefund } = require('../lib/ledger')
const { markRecovered } = require('./carts.routes')
const { isLive, getClient, verifySignature, assertCheckoutAvailable } = require('../lib/razorpay')

const router = Router()

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']

function serializeOrder(order) {
  return {
    ...order,
    events: order.events?.map(({ orderId, ...e }) => e),
    items: order.items.map((i) => ({
      id: i.id,
      product: i.productSnapshot,
      quantity: i.quantity,
      variant: i.variant,
      variantId: i.variantId,
    })),
  }
}

// Customer-facing shape: drops staff-only fields (the cancel reason is written
// for colleagues, not customers; stockDeducted is internal bookkeeping).
function serializeCustomerOrder(order) {
  const { cancelReason, stockDeducted, ...rest } = serializeOrder(order)
  // The product snapshot carries FoldX's cost price for the profit view — never show it to customers
  rest.items = rest.items.map(({ product, ...item }) => {
    const { costPrice, ...publicProduct } = product ?? {}
    return { ...item, product: publicProduct }
  })
  return rest
}

// Records a coupon use. The conditional increment means two shoppers can't
// both take the last use of a limited code; if that happens after payment,
// the order still stands (they paid the discounted price) and is flagged.
async function redeemCoupon(tx, { couponId, orderId, email, discount }) {
  const coupon = await tx.coupon.findUnique({ where: { id: couponId } })
  if (!coupon) return
  const { count } = await tx.coupon.updateMany({
    where: { id: couponId, ...(coupon.usageLimit != null && { usedCount: { lt: coupon.usageLimit } }) },
    data: { usedCount: { increment: 1 } },
  })
  if (!count) {
    await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } })
    await tx.orderEvent.create({ data: { orderId, type: 'note', message: `⚠ Discount ${coupon.code} went over its usage limit with this order`, actorName: 'System' } })
  }
  await tx.couponRedemption.create({ data: { couponId, orderId, email: email.trim().toLowerCase(), discount } })
}

// Cancelling frees the coupon use again; un-cancelling takes it back
async function releaseCoupon(tx, orderId) {
  const redemptions = await tx.couponRedemption.findMany({ where: { orderId } })
  for (const r of redemptions) {
    await tx.couponRedemption.delete({ where: { id: r.id } })
    await tx.coupon.updateMany({ where: { id: r.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } })
  }
}

const orderLines = (items) => items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }))

function cleanAddress(a) {
  const field = (k, max = 120) => String(a?.[k] ?? '').trim().slice(0, max)
  const address = {
    name: field('name', 80), phone: field('phone', 20), email: field('email', 120),
    line1: field('line1', 200), city: field('city', 80), state: field('state', 60), pincode: field('pincode', 6),
  }
  if (!address.name || !address.line1 || !address.city || !address.state) throw new HttpError(400, 'Please complete your delivery address')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) throw new HttpError(400, 'Please enter a valid email address')
  if (!/^[0-9+\-\s]{10,15}$/.test(address.phone)) throw new HttpError(400, 'Please enter a valid phone number')
  if (!/^\d{6}$/.test(address.pincode)) throw new HttpError(400, 'Pincode must be 6 digits')
  return address
}

// POST /api/orders
//   { items, address, giftWrap, giftNote,
//     razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Auth optional — logged-in users get userId attached, guests can still check out.
//
// Nothing about money is taken from the client: the total is recomputed from
// the database, and in live mode the payment is verified here (signature +
// amount actually charged by Razorpay), so an order can only be created for a
// real, fully-paid payment.
router.post('/orders', asyncRoute(async (req, res) => {
  const isCod = req.body.paymentMethod === 'cod'
  if (!isCod) assertCheckoutAvailable()
  const giftWrap = !!req.body.giftWrap
  const giftNote = giftWrap ? String(req.body.giftNote ?? '').trim().slice(0, 200) || null : null
  const address = cleanAddress(req.body.address)
  await assertCanOrder(prisma, address.email)

  // Online orders are keyed by their Razorpay order id. COD orders have no
  // payment, so checkout sends a one-time key ("cod_<uuid>") instead — stored
  // in the same column so a double-submit returns the first order.
  const razorpayOrderId = isCod ? req.body.checkoutKey : (req.body.razorpay_order_id ?? req.body.razorpayOrderId)
  const paymentId = isCod ? null : (req.body.razorpay_payment_id ?? req.body.paymentId)
  const signature = req.body.razorpay_signature
  if (isCod && !/^cod_[0-9a-f-]{36}$/i.test(String(razorpayOrderId ?? ''))) throw new HttpError(400, 'Checkout session is missing — please try again')
  if (!isCod && (!razorpayOrderId || !paymentId)) throw new HttpError(400, 'Payment details are missing')

  // Idempotent: a retried/double-submitted checkout returns the order already
  // created for this payment instead of making (and charging stock for) a second one.
  const existing = await prisma.order.findFirst({ where: { razorpayOrderId }, include: { items: true } })
  if (existing) return res.status(200).json(serializeCustomerOrder(existing))

  // Re-priced with the same code. In live mode the amount check below catches
  // any difference from what was actually charged.
  const quote = await quoteOrder(prisma, {
    items: req.body.items, giftWrap, couponCode: req.body.couponCode, email: address.email, paymentMethod: isCod ? 'cod' : 'online',
  })

  if (isCod) {
    // Nothing has been paid, so refuse anything that doesn't check out rather
    // than flag it afterwards
    if (!quote.codAvailable) throw new HttpError(409, quote.codReason || 'Cash on delivery isn\u2019t available for this order')
    if (quote.couponError) throw new HttpError(409, quote.couponError)
    const shortages = await findShortages(prisma, quote.lines)
    if (shortages.length) throw new HttpError(409, `${shortageMessage(shortages)}. Please update your bag.`)
  } else if (isLive()) {
    if (!verifySignature(razorpayOrderId, paymentId, signature)) throw new HttpError(400, 'Payment could not be verified')
    const rzpOrder = await getClient().orders.fetch(razorpayOrderId)
    const expectedPaise = Math.round(quote.total * 100)
    if (Number(rzpOrder.amount_paid ?? rzpOrder.amount) !== expectedPaise) {
      // Paid amount doesn't match the bag (e.g. prices changed mid-checkout) —
      // don't create the order; staff can refund from the Razorpay dashboard.
      console.error(`[orders] amount mismatch for ${razorpayOrderId}: paid ${rzpOrder.amount_paid}, expected ${expectedPaise}`)
      throw new HttpError(409, 'The amount paid does not match your bag. Please contact support — you will be refunded.')
    }
  } else if (!String(razorpayOrderId).startsWith('order_mock_')) {
    throw new HttpError(400, 'Payment could not be verified')
  }

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

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        stockDeducted: true,
        customerName: address.name,
        customerEmail: address.email,
        subtotal: quote.subtotal,
        discount: quote.discount,
        discountCode: quote.discountCode,
        couponId: quote.couponId,
        paymentMethod: isCod ? 'cod' : 'online',
        codFee: quote.codFee,
        cartToken: /^cart_[0-9a-f-]{36}$/i.test(String(req.body.cartToken ?? '')) ? req.body.cartToken : null,
        shipping: quote.shipping,
        giftWrapFee: quote.giftWrapFee,
        total: quote.total,
        status: 'pending',
        paymentStatus: isCod ? 'pending' : 'paid',
        paymentId,
        razorpayOrderId,
        address,
        giftWrap,
        giftNote,
        items: {
          create: quote.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            productSnapshot: l.snapshot,
            quantity: l.quantity,
            variant: l.variantDisplay,
          })),
        },
        events: {
          create: {
            type: 'created',
            message: isCod
              ? `Cash-on-delivery order placed — ₹${quote.total.toLocaleString('en-IN')} to collect. Confirm with the customer before packing.`
              : `Order placed and payment received${isLive() ? '' : ' (mock payment)'}`,
            actorName: address.name,
          },
        },
      },
      include: { items: true },
    })
    if (quote.couponId) await redeemCoupon(tx, { couponId: quote.couponId, orderId: created.id, email: address.email, discount: quote.discount })
    await markRecovered(tx, { token: req.body.cartToken, email: address.email, orderId: created.id })
    // Online payments are captured now; COD is logged when the cash is collected
    if (!isCod) await recordCapture(tx, created, { actorName: address.name })
    const oversold = await deductStock(tx, quote.lines, { orderId: created.id, actorName: address.name })
    if (oversold.length) {
      // Payment is already captured, so the order stands — flag it for staff instead
      await tx.orderEvent.create({
        data: { orderId: created.id, type: 'note', message: `⚠ Oversold — stock ran out before this order was saved: ${oversold.join('; ')}. Restock or contact the customer.`, actorName: 'System' },
      })
    }
    return created
  })
  res.status(201).json(serializeCustomerOrder(order))
}))

// GET /api/orders/mine — scoped server-side by the JWT's user id
// Each order also says whether a return can be requested (worked out here so
// the timeline, which holds staff notes, never leaves the server).
router.get('/orders/mine', requireAuth, asyncRoute(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: { items: true, returns: { orderBy: { createdAt: 'desc' } }, events: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  const out = []
  for (const o of orders) {
    const eligibility = await returnEligibility(o)
    const { events, ...rest } = serializeCustomerOrder(o)
    out.push({
      ...rest,
      returns: o.returns.map(({ adminNote, restocked, ...r }) => r),
      canReturn: eligibility.ok,
      returnUntil: eligibility.until ?? null,
    })
  }
  res.json(out)
}))

// GET /api/orders/:id — public lookup, used as a refresh-safe fallback on the
// order confirmation page (no ownership check: the order id itself is the secret)
router.get('/orders/:id', asyncRoute(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } })
  if (!order) throw new HttpError(404, 'Order not found')
  res.json(serializeCustomerOrder(order))
}))

// Shared by the admin list and the CSV export so filters behave identically.
function buildAdminOrderWhere({ status, paymentStatus, paymentMethod, q, from, to }) {
  const where = {}
  if (status && status !== 'all') where.status = status
  if (paymentStatus && paymentStatus !== 'all') where.paymentStatus = paymentStatus
  if (paymentMethod === 'cod' || paymentMethod === 'online') where.paymentMethod = paymentMethod
  // COD orders nobody has confirmed with the customer yet
  if (paymentMethod === 'cod_unconfirmed') Object.assign(where, { paymentMethod: 'cod', codConfirmedAt: null, status: { notIn: ['cancelled'] } })
  if (q) {
    // SQLite's LIKE (what Prisma's `contains` compiles to) is already case-insensitive for ASCII
    where.OR = [{ id: { contains: q } }, { customerName: { contains: q } }, { customerEmail: { contains: q } }]
  }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(`${from}T00:00:00`)
    if (to) where.createdAt.lte = new Date(`${to}T23:59:59.999`) // inclusive of the whole "to" day
  }
  return where
}

async function findAdminOrder(id) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, events: { orderBy: { createdAt: 'desc' } }, returns: { orderBy: { createdAt: 'desc' } } },
  })
  if (!order) throw new HttpError(404, 'Order not found')
  return order
}

function addEvent(orderId, type, message, actor) {
  return prisma.orderEvent.create({ data: { orderId, type, message, actorName: actor?.name ?? null } })
}

// GET /api/admin/orders?status=&paymentStatus=&q=&from=&to=
router.get('/admin/orders', requireAdmin, asyncRoute(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: buildAdminOrderWhere(req.query),
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(orders.map(serializeOrder))
}))

// GET /api/admin/orders/export.csv — same filters as the list. Declared before
// /admin/orders/:id so "export.csv" isn't swallowed as an order id.
router.get('/admin/orders/export.csv', requireAdmin, asyncRoute(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: buildAdminOrderWhere(req.query),
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
  const header = [
    'Order ID', 'Date', 'Customer', 'Email', 'Phone', 'City', 'State', 'Pincode', 'Items', 'Units',
    'Subtotal', 'Discount', 'Discount Code', 'Shipping', 'Gift Wrap', 'COD Fee', 'Total', 'Refunded', 'Payment Method', 'Payment Status', 'Status', 'Courier', 'Tracking Number',
  ]
  const rows = orders.map((o) => [
    o.id, o.createdAt.toISOString(), o.customerName, o.customerEmail, o.address?.phone, o.address?.city,
    o.address?.state, o.address?.pincode,
    o.items.map((i) => `${i.productSnapshot?.name} x${i.quantity}`).join('; '),
    o.items.reduce((s, i) => s + i.quantity, 0),
    o.subtotal, o.discount, o.discountCode, o.shipping, o.giftWrapFee, o.codFee, o.total, o.refundedAmount, o.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online', o.paymentStatus, o.status, o.courier, o.trackingNumber,
  ])
  const csv = toCsv(header, rows) // escapes quotes, neutralises formula-like cells, adds a BOM for Excel
  await logAudit({ actor: req.user, action: 'order.export', entityType: 'Order', summary: `Exported ${orders.length} orders to CSV` })
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="foldx-orders-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(csv)
}))

// GET /api/admin/orders/:id — includes the timeline
router.get('/admin/orders/:id', requireAdmin, asyncRoute(async (req, res) => {
  res.json(serializeOrder(await findAdminOrder(req.params.id)))
}))

// PUT /api/admin/orders/:id/status  { status, cancelReason? }
router.put('/admin/orders/:id/status', requireAdmin, asyncRoute(async (req, res) => {
  const { status } = req.body
  const cancelReason = req.body.cancelReason?.trim() || null
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, 'Invalid status')
  const current = await findAdminOrder(req.params.id)
  if (current.status === status) return res.json(serializeOrder(current))

  const isCod = current.paymentMethod === 'cod'
  // A COD order isn't packed until someone has confirmed it with the customer
  if (isCod && !current.codConfirmedAt && ['processing', 'shipped', 'delivered'].includes(status)) {
    throw new HttpError(409, 'Confirm this cash-on-delivery order with the customer first')
  }
  const codRefused = isCod && status === 'cancelled' && !!req.body.codRefused
  const cashCollected = isCod && status === 'delivered' && current.paymentStatus === 'pending'

  const lines = orderLines(current.items)
  const cancelling = status === 'cancelled'
  const reopening = current.status === 'cancelled'

  await prisma.$transaction(async (tx) => {
    let stockDeducted = current.stockDeducted
    let stockNote = null
    if (cancelling && current.stockDeducted) {
      await restoreStock(tx, lines, { orderId: current.id, actorName: req.user.name, reason: 'cancel' })
      stockDeducted = false
      stockNote = 'Items returned to stock'
    } else if (reopening && !current.stockDeducted) {
      const oversold = await deductStock(tx, lines, { orderId: current.id, actorName: req.user.name, reason: 'sale' })
      stockDeducted = true
      stockNote = oversold.length ? `⚠ Not enough stock to re-reserve: ${oversold.join('; ')}` : 'Items deducted from stock again'
    }
    if (cancelling) await releaseCoupon(tx, current.id)
    if (reopening && current.couponId) {
      await redeemCoupon(tx, { couponId: current.couponId, orderId: current.id, email: current.customerEmail, discount: current.discount })
    }
    await tx.order.update({
      where: { id: current.id },
      data: {
        status,
        stockDeducted,
        ...(cancelling && { cancelReason }),
        ...(codRefused && { codRefused: true }),
        ...(cashCollected && { paymentStatus: 'paid' }),
      },
    })
    const reasonSuffix = cancelling && cancelReason ? ` — ${cancelReason}` : ''
    await tx.orderEvent.create({
      data: { orderId: current.id, type: 'status', message: `Status changed from ${current.status} to ${status}${reasonSuffix}`, actorName: req.user.name },
    })
    if (stockNote) {
      await tx.orderEvent.create({ data: { orderId: current.id, type: 'status', message: stockNote, actorName: req.user.name } })
    }
    if (cashCollected) {
      await recordCapture(tx, current, { actorName: req.user.name })
      await tx.orderEvent.create({ data: { orderId: current.id, type: 'status', message: `Cash collected on delivery — ₹${current.total.toLocaleString('en-IN')}`, actorName: req.user.name } })
    }
    if (codRefused) {
      await tx.orderEvent.create({ data: { orderId: current.id, type: 'note', message: 'Customer refused the cash-on-delivery parcel (RTO). Repeated refusals stop COD for this customer.', actorName: req.user.name } })
    }
  })
  await logAudit({ actor: req.user, action: 'order.status_update', entityType: 'Order', entityId: current.id, summary: `Set order ${current.id} to "${status}"` })
  res.json(serializeOrder(await findAdminOrder(current.id)))
}))

// POST /api/admin/orders/:id/cod/confirm  { note? }
// Staff confirmed the COD order with the customer (call / WhatsApp) — it can
// now be packed. Moves a pending order to processing.
router.post('/admin/orders/:id/cod/confirm', requireAdmin, asyncRoute(async (req, res) => {
  const current = await findAdminOrder(req.params.id)
  if (current.paymentMethod !== 'cod') throw new HttpError(400, 'This order was paid online')
  if (current.codConfirmedAt) return res.json(serializeOrder(current))
  if (current.status === 'cancelled') throw new HttpError(409, 'This order is cancelled')
  const note = String(req.body.note ?? '').trim().slice(0, 300)
  await prisma.$transaction([
    prisma.order.update({
      where: { id: current.id },
      data: { codConfirmedAt: new Date(), ...(current.status === 'pending' && { status: 'processing' }) },
    }),
    prisma.orderEvent.create({
      data: { orderId: current.id, type: 'status', message: `Cash-on-delivery order confirmed with the customer${note ? ` — ${note}` : ''}${current.status === 'pending' ? '; moved to processing' : ''}`, actorName: req.user.name },
    }),
  ])
  await logAudit({ actor: req.user, action: 'order.cod_confirm', entityType: 'Order', entityId: current.id, summary: `Confirmed COD order ${current.id}` })
  res.json(serializeOrder(await findAdminOrder(current.id)))
}))

// PUT /api/admin/orders/:id/shipping  { courier, trackingNumber }
router.put('/admin/orders/:id/shipping', requireAdmin, asyncRoute(async (req, res) => {
  const courier = req.body.courier?.trim() || null
  const trackingNumber = req.body.trackingNumber?.trim() || null
  const current = await findAdminOrder(req.params.id)

  await prisma.order.update({ where: { id: current.id }, data: { courier, trackingNumber } })
  const message = courier || trackingNumber
    ? `Shipping details set: ${[courier, trackingNumber].filter(Boolean).join(' · ')}`
    : 'Shipping details cleared'
  await addEvent(current.id, 'shipping', message, req.user)
  await logAudit({ actor: req.user, action: 'order.shipping_update', entityType: 'Order', entityId: current.id, summary: `Updated shipping for order ${current.id}` })
  res.json(serializeOrder(await findAdminOrder(current.id)))
}))

// POST /api/admin/orders/:id/notes  { note } — internal only, never shown to the customer
router.post('/admin/orders/:id/notes', requireAdmin, asyncRoute(async (req, res) => {
  const note = req.body.note?.trim()
  if (!note) throw new HttpError(400, 'Note cannot be empty')
  if (note.length > 2000) throw new HttpError(400, 'Note is too long (max 2000 characters)')
  const current = await findAdminOrder(req.params.id)
  await addEvent(current.id, 'note', note, req.user)
  res.status(201).json(serializeOrder(await findAdminOrder(current.id)))
}))

// POST /api/admin/orders/:id/refund  { amount, reason }
// Issues a real Razorpay refund when keys are configured and the order has a
// real payment id; otherwise records a mock refund (same pattern as checkout).
router.post('/admin/orders/:id/refund', requireRole(...REFUND_ROLES), asyncRoute(async (req, res) => {
  const amount = Math.round(Number(req.body.amount) * 100) / 100
  const reason = req.body.reason?.trim() || null
  const current = await findAdminOrder(req.params.id)

  if (!['paid', 'partially_refunded'].includes(current.paymentStatus)) {
    throw new HttpError(400, 'Only paid orders can be refunded')
  }
  const refundable = Math.round((current.total - current.refundedAmount) * 100) / 100
  if (!(amount > 0)) throw new HttpError(400, 'Refund amount must be greater than zero')
  if (amount > refundable) throw new HttpError(400, `Refund cannot exceed the remaining ₹${refundable.toFixed(2)}`)

  let refundRef = null
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env
  const isRealPayment = current.paymentMethod !== 'cod' && current.paymentId?.startsWith('pay_') && !String(current.razorpayOrderId).startsWith('order_mock_')
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && isRealPayment) {
    const Razorpay = require('razorpay')
    const client = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
    try {
      const refund = await client.payments.refund(current.paymentId, {
        amount: Math.round(amount * 100), // paise
        notes: { orderId: current.id, reason: reason ?? '' },
      })
      refundRef = refund.id
    } catch (err) {
      throw new HttpError(502, `Razorpay refund failed: ${err?.error?.description || err.message}`)
    }
  }

  const refundedAmount = Math.round((current.refundedAmount + amount) * 100) / 100
  const paymentStatus = refundedAmount >= current.total ? 'refunded' : 'partially_refunded'
  await prisma.$transaction([
    prisma.order.update({ where: { id: current.id }, data: { refundedAmount, paymentStatus } }),
    recordRefund(prisma, current, { amount, refundRef, actorName: req.user.name, reason: reason ?? '' }),
  ])
  // COD was paid in cash, so there's nothing to refund through Razorpay —
  // staff pay it back by UPI / bank transfer and this records that they did
  const refLabel = current.paymentMethod === 'cod'
    ? 'cash-on-delivery order — pay back by UPI or bank transfer'
    : refundRef ? `Razorpay ${refundRef}` : 'mock refund — no real money moved'
  await addEvent(current.id, 'refund', `Refunded ₹${amount.toFixed(2)} (${refLabel})${reason ? ` — ${reason}` : ''}`, req.user)
  await logAudit({ actor: req.user, action: 'order.refund', entityType: 'Order', entityId: current.id, summary: `Refunded ₹${amount.toFixed(2)} on order ${current.id}` })
  res.json(serializeOrder(await findAdminOrder(current.id)))
}))

module.exports = router
