const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { isProductVisible } = require('../lib/visibility')
const { variantLabel } = require('../lib/stock')

const router = Router()

const TOKEN = /^cart_[0-9a-f-]{36}$/i
const ABANDONED_AFTER_MS = 30 * 60 * 1000 // a checkout idle this long counts as abandoned
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const str = (v, max) => String(v ?? '').trim().slice(0, max)

// Rebuilds bag lines from the database — names, prices and images in a saved
// cart never come from the browser.
async function snapshotItems(items) {
  const out = []
  for (const it of (Array.isArray(items) ? items : []).slice(0, 50)) {
    const productId = it?.product?.id ?? it?.productId
    const quantity = Math.min(20, Math.max(1, Math.floor(Number(it?.quantity) || 1)))
    if (!productId) continue
    const product = await prisma.product.findUnique({ where: { id: String(productId) }, include: { variants: { where: { isActive: true } } } })
    if (!product) continue
    const variant = it.variantId ? product.variants.find((v) => v.id === it.variantId) : null
    out.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.images?.[0] ?? null,
      variant: variant ? variantLabel(variant) : null,
    })
  }
  return out
}

// POST /api/carts/checkout  { token, email, name, phone, items }
// Called when a shopper reaches checkout with their email filled in. Saves
// (or refreshes) their bag so it can be recovered if they leave.
router.post('/carts/checkout', asyncRoute(async (req, res) => {
  const token = str(req.body.token, 60)
  const email = str(req.body.email, 120).toLowerCase()
  if (!TOKEN.test(token)) throw new HttpError(400, 'Invalid cart')
  if (!EMAIL.test(email)) return res.json({ ok: false }) // nothing to remind without an email
  const items = await snapshotItems(req.body.items)
  if (items.length === 0) return res.json({ ok: false })
  const subtotal = Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100
  const data = { email, name: str(req.body.name, 80), phone: str(req.body.phone, 20), items, subtotal, lastActivityAt: new Date() }

  const existing = await prisma.abandonedCart.findUnique({ where: { token } })
  if (existing?.recoveredAt) return res.json({ ok: true }) // already bought — don't resurrect it
  await prisma.abandonedCart.upsert({ where: { token }, create: { token, ...data }, update: data })
  purgeOldCarts().catch(() => {})
  res.json({ ok: true })
}))

// GET /api/carts/recover/:token → { items, email, name } to refill the bag
router.get('/carts/recover/:token', asyncRoute(async (req, res) => {
  const cart = TOKEN.test(req.params.token) ? await prisma.abandonedCart.findUnique({ where: { token: req.params.token } }) : null
  if (!cart) throw new HttpError(404, 'This link has expired')
  if (cart.recoveredAt) throw new HttpError(410, 'This order has already been placed')

  // Current product data, purchasable items only
  const items = []
  for (const line of cart.items) {
    const product = await prisma.product.findUnique({ where: { id: line.productId }, include: { variants: { where: { isActive: true } } } })
    if (!isProductVisible(product)) continue
    const variant = line.variantId ? product.variants.find((v) => v.id === line.variantId) : null
    if (product.variants.length && !variant) continue
    const { costPrice, lowStockThreshold, variants, ...publicProduct } = product
    items.push({
      product: publicProduct,
      quantity: line.quantity,
      variantId: variant?.id ?? null,
      variant: variant ? Object.fromEntries(Object.entries({ color: variant.color, size: variant.size }).filter(([, v]) => v)) : {},
    })
  }
  res.json({ items, email: cart.email, name: cart.name, token: cart.token })
}))

// Marks carts recovered when an order is placed: the one it came from (by
// token) and any other open carts with the same email.
async function markRecovered(tx, { token, email, orderId }) {
  const now = new Date()
  if (token && TOKEN.test(token)) {
    await tx.abandonedCart.updateMany({ where: { token, recoveredAt: null }, data: { recoveredAt: now, orderId } })
  }
  const key = String(email ?? '').trim().toLowerCase()
  if (key) await tx.abandonedCart.updateMany({ where: { email: key, recoveredAt: null }, data: { recoveredAt: now, orderId } })
}

// The privacy policy promises unfinished checkouts are kept for at most 90
// days. Recovered carts are just a pointer to the order, so they stay.
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000
function purgeOldCarts() {
  return prisma.abandonedCart.deleteMany({ where: { recoveredAt: null, lastActivityAt: { lt: new Date(Date.now() - RETENTION_MS) } } })
}

// GET /api/admin/carts?status=abandoned|recovered|all
router.get('/admin/carts', requireAdmin, asyncRoute(async (req, res) => {
  await purgeOldCarts()
  const status = req.query.status ?? 'abandoned'
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS)
  const where = status === 'recovered'
    ? { recoveredAt: { not: null } }
    : status === 'all' ? {} : { recoveredAt: null, lastActivityAt: { lt: cutoff } }
  const [carts, all] = await Promise.all([
    prisma.abandonedCart.findMany({ where, orderBy: { lastActivityAt: 'desc' }, take: 500 }),
    prisma.abandonedCart.findMany({ where: { OR: [{ recoveredAt: { not: null } }, { lastActivityAt: { lt: cutoff } }] }, select: { subtotal: true, recoveredAt: true, remindedAt: true } }),
  ])
  const abandoned = all.filter((c) => !c.recoveredAt)
  const recovered = all.filter((c) => c.recoveredAt)
  res.json({
    stats: {
      abandoned: abandoned.length,
      abandonedValue: Math.round(abandoned.reduce((s, c) => s + c.subtotal, 0)),
      recovered: recovered.length,
      recoveredValue: Math.round(recovered.reduce((s, c) => s + c.subtotal, 0)),
      recoveredAfterReminder: recovered.filter((c) => c.remindedAt && c.remindedAt <= c.recoveredAt).length,
      recoveryRate: all.length ? Math.round((recovered.length / all.length) * 1000) / 10 : 0,
    },
    carts,
  })
}))

// POST /api/admin/carts/:id/reminded  { channel } — staff sent a reminder (WhatsApp / email / link)
router.post('/admin/carts/:id/reminded', requireAdmin, asyncRoute(async (req, res) => {
  const cart = await prisma.abandonedCart.update({
    where: { id: req.params.id },
    data: { remindedAt: new Date(), reminderCount: { increment: 1 } },
  }).catch(() => null)
  if (!cart) throw new HttpError(404, 'Cart not found')
  res.json(cart)
}))

// DELETE /api/admin/carts/:id — dismiss (e.g. a test or a duplicate)
router.delete('/admin/carts/:id', requireAdmin, asyncRoute(async (req, res) => {
  await prisma.abandonedCart.deleteMany({ where: { id: req.params.id } })
  res.status(204).end()
}))

module.exports = router
module.exports.markRecovered = markRecovered
