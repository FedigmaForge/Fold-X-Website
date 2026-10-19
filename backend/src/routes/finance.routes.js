const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { REFUND_ROLES } = require('../lib/roles')
const { csvToObjects, toCsv } = require('../lib/csv')
const { getClient, isLive } = require('../lib/razorpay')

// Money pages are for Managers and the Super Admin (same people who can refund)
const FINANCE_ROLES = REFUND_ROLES
const router = Router()
const round2 = (n) => Math.round(n * 100) / 100
const DAY = 24 * 60 * 60 * 1000

function range(from, to) {
  const start = from ? new Date(`${from}T00:00:00`) : new Date(Date.now() - 29 * DAY)
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new HttpError(400, 'Invalid date range')
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

// ─── Payment log ───────────────────────────────────────────────────────────────

function paymentWhere(q) {
  const { start, end } = range(q.from, q.to)
  const where = { createdAt: { gte: start, lte: end } }
  if (['capture', 'refund'].includes(q.type)) where.type = q.type
  if (['online', 'cod'].includes(q.method)) where.method = q.method
  if (['pending', 'settled', 'na'].includes(q.status)) where.settlementStatus = q.status
  return where
}

// GET /api/admin/finance/payments?from&to&type&method&status
router.get('/admin/finance/payments', requireRole(...FINANCE_ROLES), asyncRoute(async (req, res) => {
  const rows = await prisma.paymentTransaction.findMany({
    where: paymentWhere(req.query),
    include: { order: { select: { id: true, customerName: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })
  const sum = (list) => round2(list.reduce((s, r) => s + r.amount, 0))
  const captures = rows.filter((r) => r.type === 'capture')
  const refunds = rows.filter((r) => r.type === 'refund')
  const pendingOnline = rows.filter((r) => r.method === 'online' && r.settlementStatus === 'pending')
  const pendingCod = rows.filter((r) => r.method === 'cod' && r.type === 'capture' && r.settlementStatus === 'pending')
  res.json({
    totals: {
      received: sum(captures),
      refunded: sum(refunds),
      net: round2(sum(captures) - sum(refunds)),
      fees: round2(rows.reduce((s, r) => s + (r.fee ?? 0) + (r.tax ?? 0), 0)),
      awaitingSettlement: round2(pendingOnline.reduce((s, r) => s + (r.type === 'capture' ? r.amount : -r.amount), 0)),
      awaitingCodRemittance: sum(pendingCod),
    },
    rows,
  })
}))

// GET /api/admin/finance/payments.csv
router.get('/admin/finance/payments.csv', requireRole(...FINANCE_ROLES), asyncRoute(async (req, res) => {
  const rows = await prisma.paymentTransaction.findMany({ where: paymentWhere(req.query), orderBy: { createdAt: 'desc' } })
  const csv = toCsv(
    ['Date', 'Order', 'Type', 'Method', 'Amount (INR)', 'Reference', 'Settlement', 'Settled on', 'Settlement ID', 'UTR', 'Fee', 'Tax on fee', 'Notes'],
    rows.map((r) => [r.createdAt.toISOString(), r.orderId, r.type, r.method, r.type === 'refund' ? -r.amount : r.amount, r.gatewayRef, r.settlementStatus, r.settledAt?.toISOString(), r.settlementId, r.settlementUtr, r.fee, r.tax, r.notes]),
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="foldx-payments-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(csv)
}))

// ─── Settlement matching ──────────────────────────────────────────────────────

const num = (v) => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(/[₹,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}
const pick = (row, ...names) => {
  for (const n of names) if (row[n] !== undefined && row[n] !== '') return row[n]
  return undefined
}

// Normalises a Razorpay settlement-report line (CSV headers or API fields)
// into { ref, type, amount, fee, tax, settlementId, utr, settledAt }
function normaliseLine(row, { paise }) {
  const scale = paise ? 0.01 : 1
  const amount = num(pick(row, 'amount', 'credit', 'debit'))
  const settled = pick(row, 'settled_at', 'settled_on', 'settlement_date', 'settled at')
  let settledAt = null
  if (settled !== undefined) {
    const n = Number(settled)
    settledAt = Number.isFinite(n) && n > 1e9 ? new Date(n * 1000) : new Date(settled)
    if (Number.isNaN(settledAt.getTime())) settledAt = null
  }
  return {
    ref: String(pick(row, 'entity_id', 'payment_id', 'id') ?? '').trim(),
    type: String(pick(row, 'type', 'entity_type') ?? '').trim().toLowerCase(),
    amount: amount === null ? null : round2(Math.abs(amount) * scale),
    fee: num(pick(row, 'fee', 'fees')) === null ? null : round2(num(pick(row, 'fee', 'fees')) * scale),
    tax: num(pick(row, 'tax', 'gst')) === null ? null : round2(num(pick(row, 'tax', 'gst')) * scale),
    settlementId: String(pick(row, 'settlement_id') ?? '').trim() || null,
    utr: String(pick(row, 'settlement_utr', 'utr') ?? '').trim() || null,
    settledAt,
  }
}

// Matches report lines to the payment log. Already-settled entries count as
// matched, so importing the same report twice is harmless.
async function applySettlementLines(lines, { source, label, actorName }) {
  let matched = 0
  const unmatched = []
  for (const line of lines) {
    if (!line.ref) { unmatched.push({ ...line, reason: 'No payment or refund id on this line' }); continue }
    const isRefund = line.type === 'refund' || line.ref.startsWith('rfnd_')
    const isPayment = line.type === 'payment' || line.ref.startsWith('pay_')
    if (!isRefund && !isPayment) { unmatched.push({ ...line, reason: `"${line.type || 'unknown'}" line — not a payment or refund (e.g. an adjustment)` }); continue }

    const entry = await prisma.paymentTransaction.findFirst({ where: { gatewayRef: line.ref, type: isRefund ? 'refund' : 'capture' } })
    if (!entry) { unmatched.push({ ...line, reason: `No ${isRefund ? 'refund' : 'payment'} in the log with this id` }); continue }

    const amountNote = line.amount !== null && Math.abs(line.amount - entry.amount) > 0.01
      ? `Report amount ₹${line.amount} differs from logged ₹${entry.amount}`
      : null
    if (amountNote) unmatched.push({ ...line, reason: `${amountNote} (marked settled anyway — check it)` })
    await prisma.paymentTransaction.update({
      where: { id: entry.id },
      data: {
        settlementStatus: 'settled',
        settledAt: line.settledAt ?? entry.settledAt ?? new Date(),
        settlementId: line.settlementId ?? entry.settlementId,
        settlementUtr: line.utr ?? entry.settlementUtr,
        fee: line.fee ?? entry.fee,
        tax: line.tax ?? entry.tax,
        ...(amountNote && { notes: [entry.notes, amountNote].filter(Boolean).join(' — ') }),
      },
    })
    matched++
  }
  const record = await prisma.settlementImport.create({
    data: { source, label, rows: lines.length, matched, unmatched: unmatched.map((u) => ({ ref: u.ref, type: u.type, amount: u.amount, reason: u.reason })), actorName },
  })
  return record
}

// POST /api/admin/finance/settlements/import  { csv, fileName, paise? }
// The "Settlement recon" report from the Razorpay dashboard. Amounts there are
// in rupees; tick paise for exports that use paise.
router.post('/admin/finance/settlements/import', requireRole(...FINANCE_ROLES), asyncRoute(async (req, res) => {
  let parsed
  try {
    parsed = csvToObjects(req.body.csv)
  } catch (err) {
    throw new HttpError(400, `Couldn't read the file: ${err.message}`)
  }
  if (!parsed.headers.some((h) => ['entity_id', 'payment_id', 'id'].includes(h))) {
    throw new HttpError(400, 'This doesn’t look like a Razorpay settlement report — it needs an entity_id (or payment_id) column')
  }
  if (parsed.records.length > 20000) throw new HttpError(400, 'Too many rows (max 20,000) — import a shorter date range')
  const lines = parsed.records.map((r) => normaliseLine(r.data, { paise: !!req.body.paise }))
  const record = await applySettlementLines(lines, { source: 'csv', label: String(req.body.fileName ?? 'settlement report').slice(0, 120), actorName: req.user.name })
  await logAudit({ actor: req.user, action: 'finance.settlement_import', entityType: 'Settlement', entityId: record.id, summary: `Imported settlement report: ${record.matched} of ${record.rows} lines matched` })
  res.json(record)
}))

// POST /api/admin/finance/settlements/sync  { date: 'YYYY-MM-DD' }
// Pulls the same recon data straight from Razorpay (live keys only).
router.post('/admin/finance/settlements/sync', requireRole(...FINANCE_ROLES), asyncRoute(async (req, res) => {
  if (!isLive()) throw new HttpError(400, 'Add your Razorpay keys first — until then, upload the settlement report CSV instead')
  const d = req.body.date ? new Date(`${req.body.date}T00:00:00`) : new Date(Date.now() - DAY)
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid date')
  const client = getClient()
  const items = []
  try {
    for (let skip = 0; skip < 10000; skip += 1000) {
      const page = await client.settlements.reports({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), count: 1000, skip })
      items.push(...(page.items ?? []))
      if ((page.items ?? []).length < 1000) break
    }
  } catch (err) {
    throw new HttpError(502, `Razorpay settlement sync failed: ${err?.error?.description || err.message}`)
  }
  const lines = items.map((it) => normaliseLine(it, { paise: true })) // the API reports in paise
  const record = await applySettlementLines(lines, { source: 'razorpay', label: d.toISOString().slice(0, 10), actorName: req.user.name })
  await logAudit({ actor: req.user, action: 'finance.settlement_sync', entityType: 'Settlement', entityId: record.id, summary: `Synced Razorpay settlements for ${record.label}: ${record.matched} of ${record.rows} matched` })
  res.json(record)
}))

// GET /api/admin/finance/settlements — import history + online payments still
// unsettled after 4 days (Razorpay normally settles in T+2 working days)
router.get('/admin/finance/settlements', requireRole(...FINANCE_ROLES), asyncRoute(async (req, res) => {
  const [imports, overdue] = await Promise.all([
    prisma.settlementImport.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.paymentTransaction.findMany({
      where: { method: 'online', settlementStatus: 'pending', createdAt: { lt: new Date(Date.now() - 4 * DAY) } },
      include: { order: { select: { id: true, customerName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  res.json({ imports, overdue, live: isLive() })
}))

// POST /api/admin/finance/cod-remittance  { ids: [...], reference, fee? }
// The courier paid us the COD cash it collected. Fee = courier's COD charge
// for the batch, split evenly across the orders.
router.post('/admin/finance/cod-remittance', requireRole(...FINANCE_ROLES), asyncRoute(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : []
  const reference = String(req.body.reference ?? '').trim().slice(0, 80)
  if (!ids.length) throw new HttpError(400, 'Choose at least one COD payment')
  if (!reference) throw new HttpError(400, 'Add the remittance reference (UTR or courier statement id)')
  const entries = await prisma.paymentTransaction.findMany({ where: { id: { in: ids }, method: 'cod', type: 'capture', settlementStatus: 'pending' } })
  if (!entries.length) throw new HttpError(400, 'None of those are COD payments awaiting remittance')
  const totalFee = num(req.body.fee) ?? 0
  const share = round2(totalFee / entries.length)
  await prisma.$transaction(entries.map((e) => prisma.paymentTransaction.update({
    where: { id: e.id },
    data: { settlementStatus: 'settled', settledAt: new Date(), settlementId: reference, fee: share || null },
  })))
  const amount = round2(entries.reduce((s, e) => s + e.amount, 0))
  await logAudit({ actor: req.user, action: 'finance.cod_remittance', entityType: 'Settlement', summary: `Recorded COD remittance ${reference}: ${entries.length} orders, ₹${amount}` })
  res.json({ updated: entries.length, amount })
}))

// ─── Profit ────────────────────────────────────────────────────────────────────

// GET /api/admin/finance/profit?from&to
// Estimated gross profit on orders paid in the range:
//   item sales excl. GST (after discounts, less refunds)
// + shipping / gift-wrap / COD fees charged, excl. GST
// − cost of goods (cost price at the time of sale; restocked returns added back)
// − payment gateway fees (as settled so far)
// − estimated courier cost per order (Settings)
router.get('/admin/finance/profit', requireRole(...FINANCE_ROLES), asyncRoute(async (req, res) => {
  const { start, end } = range(req.query.from, req.query.to)
  const [orders, settings, products] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, paymentStatus: { in: ['paid', 'partially_refunded', 'refunded'] } },
      include: { items: true, payments: true, returns: { where: { restocked: true } } },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.product.findMany({ select: { id: true, name: true, costPrice: true } }),
  ])
  const productById = new Map(products.map((p) => [p.id, p]))
  const defaultRate = settings?.defaultGstRate ?? 18
  const shipCost = settings?.shippingCostPerOrder ?? 0
  const exGst = (amount, rate) => amount / (1 + rate / 100)

  const totals = { orders: 0, itemSales: 0, otherIncome: 0, cogs: 0, gatewayFees: 0, shippingCost: 0 }
  const byProduct = new Map()
  const missingCost = new Map()

  for (const o of orders) {
    const refundRatio = o.total > 0 ? Math.min(1, (o.paymentStatus === 'refunded' ? o.total : o.refundedAmount || 0) / o.total) : 0
    const keep = 1 - refundRatio
    totals.orders++
    let maxRate = 0

    // Units returned and put back on sale aren't a cost
    const restockedQty = new Map()
    for (const r of o.returns) for (const it of r.items ?? []) restockedQty.set(it.itemId, (restockedQty.get(it.itemId) ?? 0) + it.quantity)

    for (const line of o.items) {
      const snap = line.productSnapshot ?? {}
      const rate = snap.gstRate ?? defaultRate
      maxRate = Math.max(maxRate, rate)
      const sales = exGst(snap.price * line.quantity - (snap.lineDiscount || 0), rate) * keep
      const unitCost = snap.costPrice ?? productById.get(line.productId)?.costPrice ?? null
      const soldQty = o.status === 'cancelled' ? 0 : line.quantity - (restockedQty.get(line.id) ?? 0)
      const cost = unitCost === null ? 0 : unitCost * Math.max(0, soldQty)
      if (unitCost === null && soldQty > 0) missingCost.set(line.productId ?? snap.name, snap.name)

      totals.itemSales += sales
      totals.cogs += cost
      const key = line.productId ?? snap.name
      const row = byProduct.get(key) ?? { productId: line.productId, name: snap.name, units: 0, sales: 0, cogs: 0, costKnown: true }
      row.units += Math.max(0, soldQty)
      row.sales += sales
      row.cogs += cost
      if (unitCost === null) row.costKnown = false
      byProduct.set(key, row)
    }
    totals.otherIncome += exGst((o.shipping || 0) + (o.giftWrapFee || 0) + (o.codFee || 0), maxRate || defaultRate) * keep
    totals.gatewayFees += o.payments.reduce((s, p) => s + (p.fee ?? 0) + (p.tax ?? 0), 0)
    if (o.status !== 'cancelled') totals.shippingCost += shipCost
  }

  for (const k of Object.keys(totals)) if (k !== 'orders') totals[k] = round2(totals[k])
  const revenue = round2(totals.itemSales + totals.otherIncome)
  const grossProfit = round2(revenue - totals.cogs - totals.gatewayFees - totals.shippingCost)
  res.json({
    range: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
    totals: { ...totals, revenue, grossProfit, margin: revenue ? Math.round((grossProfit / revenue) * 1000) / 10 : 0 },
    shippingCostPerOrder: shipCost,
    byProduct: [...byProduct.values()]
      .map((r) => ({ ...r, sales: round2(r.sales), cogs: round2(r.cogs), profit: round2(r.sales - r.cogs), margin: r.sales ? Math.round(((r.sales - r.cogs) / r.sales) * 1000) / 10 : 0 }))
      .sort((a, b) => b.sales - a.sales),
    missingCost: [...missingCost.entries()].map(([id, name]) => ({ productId: id, name })),
  })
}))

module.exports = router
