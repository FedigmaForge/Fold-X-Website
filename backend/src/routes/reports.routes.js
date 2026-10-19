const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')

const router = Router()

const DAY = 24 * 60 * 60 * 1000
const PAID = ['paid', 'partially_refunded', 'refunded']
const round2 = (n) => Math.round(n * 100) / 100
// A fully refunded order counts its whole total, even if refundedAmount wasn't
// recorded (orders created before partial refunds existed)
const refundOf = (o) => (o.paymentStatus === 'refunded' ? o.total : o.refundedAmount || 0)

function parseRange(from, to) {
  const start = from ? new Date(`${from}T00:00:00`) : new Date(Date.now() - 29 * DAY)
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new HttpError(400, 'Invalid date range')
  if (start > end) throw new HttpError(400, '"From" must be before "To"')
  if (end - start > 3 * 366 * DAY) throw new HttpError(400, 'Pick a range of 3 years or less')
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

// Day buckets up to ~2 months, weeks (from Monday) up to a year, then months
function bucketing(start, end) {
  const days = (end - start) / DAY
  if (days <= 62) return 'day'
  if (days <= 366) return 'week'
  return 'month'
}

function bucketStart(date, unit) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  if (unit === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  if (unit === 'month') d.setDate(1)
  return d
}

function nextBucket(d, unit) {
  const n = new Date(d)
  if (unit === 'day') n.setDate(n.getDate() + 1)
  if (unit === 'week') n.setDate(n.getDate() + 7)
  if (unit === 'month') n.setMonth(n.getMonth() + 1)
  return n
}

const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function summarise(orders) {
  const gross = orders.reduce((s, o) => s + o.total, 0)
  const refunds = orders.reduce((s, o) => s + refundOf(o), 0)
  const kept = orders.filter((o) => o.status !== 'cancelled')
  return {
    orders: orders.length,
    gross: round2(gross),
    refunds: round2(refunds),
    net: round2(gross - refunds),
    avgOrderValue: orders.length ? round2(gross / orders.length) : 0,
    discounts: round2(orders.reduce((s, o) => s + (o.discount || 0), 0)),
    units: kept.reduce((s, o) => s + o.items.reduce((u, i) => u + i.quantity, 0), 0),
    cancelled: orders.length - kept.length,
  }
}

function groupRows(orders, keyFn) {
  const map = new Map()
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    for (const k of [].concat(keyFn(o) ?? [])) {
      if (!k.key) continue
      const row = map.get(k.key) ?? { key: k.key, label: k.label ?? k.key, orders: new Set(), units: 0, revenue: 0 }
      row.orders.add(o.id)
      row.units += k.units ?? 0
      row.revenue += k.revenue ?? 0
      map.set(k.key, row)
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, orders: r.orders.size, revenue: round2(r.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
}

// GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
// Paid orders only (incl. later refunded). "Net" = order totals − refunds.
// Breakdowns use item sales (price × qty, before shipping/gift wrap) and leave
// out cancelled orders.
router.get('/admin/reports', requireAdmin, asyncRoute(async (req, res) => {
  const { start, end } = parseRange(req.query.from, req.query.to)
  const span = end - start
  const prevStart = new Date(start.getTime() - span)

  const all = await prisma.order.findMany({
    where: { paymentStatus: { in: PAID }, createdAt: { gte: prevStart, lte: end } },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  })
  const orders = all.filter((o) => o.createdAt >= start)
  const previous = all.filter((o) => o.createdAt < start)

  // Time series, zero-filled so gaps show as zero rather than vanishing
  const unit = bucketing(start, end)
  const buckets = new Map()
  for (let d = bucketStart(start, unit); d <= end; d = nextBucket(d, unit)) {
    buckets.set(keyOf(d), { date: keyOf(d), net: 0, orders: 0 })
  }
  for (const o of orders) {
    const b = buckets.get(keyOf(bucketStart(o.createdAt, unit)))
    if (!b) continue
    b.net = round2(b.net + o.total - refundOf(o))
    b.orders += 1
  }

  // Customers (by email — guests included). Repeat = has another paid order
  // on or before the end of the range.
  const emails = [...new Set(orders.map((o) => o.customerEmail.toLowerCase()))]
  const history = emails.length
    ? await prisma.order.findMany({
      where: { paymentStatus: { in: PAID }, createdAt: { lte: end } },
      select: { customerEmail: true, createdAt: true },
    })
    : []
  const byEmail = new Map()
  for (const h of history) {
    const e = h.customerEmail.toLowerCase()
    const cur = byEmail.get(e) ?? { count: 0, first: h.createdAt }
    cur.count += 1
    if (h.createdAt < cur.first) cur.first = h.createdAt
    byEmail.set(e, cur)
  }
  const returning = emails.filter((e) => (byEmail.get(e)?.count ?? 0) > 1).length
  const newCustomers = emails.filter((e) => (byEmail.get(e)?.first ?? start) >= start).length

  const lineRevenue = (i) => (i.productSnapshot?.price ?? 0) * i.quantity

  res.json({
    range: { from: keyOf(start), to: keyOf(end), unit },
    summary: {
      ...summarise(orders),
      customers: emails.length,
      newCustomers,
      repeatRate: emails.length ? Math.round((returning / emails.length) * 1000) / 10 : 0,
    },
    previous: summarise(previous),
    series: [...buckets.values()],
    byProduct: groupRows(orders, (o) => o.items.map((i) => ({
      key: i.productId ?? i.productSnapshot?.name,
      label: i.productSnapshot?.name ?? 'Deleted product',
      units: i.quantity,
      revenue: lineRevenue(i),
    }))).slice(0, 50),
    byCategory: groupRows(orders, (o) => o.items.map((i) => ({
      key: i.productSnapshot?.category || 'Uncategorised',
      units: i.quantity,
      revenue: lineRevenue(i),
    }))),
    byState: groupRows(orders, (o) => ({
      key: o.address?.state || 'Unknown',
      units: o.items.reduce((s, i) => s + i.quantity, 0),
      revenue: o.items.reduce((s, i) => s + lineRevenue(i), 0),
    })),
    byCity: groupRows(orders, (o) => ({
      key: (o.address?.city || 'Unknown').trim().toLowerCase(),
      label: o.address?.city?.trim() || 'Unknown',
      units: o.items.reduce((s, i) => s + i.quantity, 0),
      revenue: o.items.reduce((s, i) => s + lineRevenue(i), 0),
    })).slice(0, 50),
  })
}))

module.exports = router
