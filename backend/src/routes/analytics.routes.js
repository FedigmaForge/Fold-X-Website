const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin } = require('../middleware/auth')
const { asyncRoute } = require('../middleware/errorHandler')

const router = Router()

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pctGrowth(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

// GET /api/admin/analytics — everything here is computed from real DB rows,
// not static mock numbers. Growth % compares the trailing period to the one
// before it (best-effort — not a calendar "vs last month" comparison).
router.get('/admin/analytics', requireAdmin, asyncRoute(async (req, res) => {
  const [orders, customerCount, productCount] = await Promise.all([
    prisma.order.findMany({ include: { items: true } }),
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.product.count(),
  ])

  const paidOrders = orders.filter((o) => o.paymentStatus === 'paid')
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0)

  const now = Date.now()
  const last7 = paidOrders.filter((o) => now - new Date(o.createdAt).getTime() <= 7 * DAY_MS)
  const prev7 = paidOrders.filter((o) => {
    const age = now - new Date(o.createdAt).getTime()
    return age > 7 * DAY_MS && age <= 14 * DAY_MS
  })
  const revenueGrowth = pctGrowth(
    last7.reduce((s, o) => s + o.total, 0),
    prev7.reduce((s, o) => s + o.total, 0)
  )
  const ordersGrowth = pctGrowth(last7.length, prev7.length)

  const recentCustomers = await prisma.user.count({
    where: { role: 'customer', createdAt: { gte: new Date(now - 30 * DAY_MS) } },
  })
  const priorCustomers = await prisma.user.count({
    where: {
      role: 'customer',
      createdAt: { gte: new Date(now - 60 * DAY_MS), lt: new Date(now - 30 * DAY_MS) },
    },
  })
  const customersGrowth = pctGrowth(recentCustomers, priorCustomers)

  // Daily revenue/orders for the last 7 days
  const revenue = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now - i * DAY_MS)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart.getTime() + DAY_MS)
    const dayOrders = paidOrders.filter((o) => {
      const t = new Date(o.createdAt).getTime()
      return t >= dayStart.getTime() && t < dayEnd.getTime()
    })
    revenue.push({
      day: DAY_LABELS[dayStart.getDay()],
      revenue: dayOrders.reduce((s, o) => s + o.total, 0),
      orders: dayOrders.length,
    })
  }

  // Monthly revenue/orders for the last 7 months
  const monthly = []
  const base = new Date(now)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const monthOrders = paidOrders.filter((o) => {
      const oc = new Date(o.createdAt)
      return oc.getFullYear() === d.getFullYear() && oc.getMonth() === d.getMonth()
    })
    monthly.push({
      month: MONTH_LABELS[d.getMonth()],
      revenue: monthOrders.reduce((s, o) => s + o.total, 0),
      orders: monthOrders.length,
    })
  }

  // Top products by revenue across paid orders (aggregated from embedded snapshots)
  const productRevMap = {}
  paidOrders.forEach((o) => {
    o.items.forEach((item) => {
      const p = item.productSnapshot
      if (!p?.id) return
      productRevMap[p.id] = productRevMap[p.id] || { product: p, sold: 0, revenue: 0 }
      productRevMap[p.id].sold += item.quantity
      productRevMap[p.id].revenue += p.price * item.quantity
    })
  })
  const topProducts = Object.values(productRevMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(({ product, sold, revenue }) => ({ ...product, sold, revenue }))

  res.json({
    revenue,
    monthly,
    stats: {
      totalRevenue,
      totalOrders: orders.length,
      totalCustomers: customerCount,
      totalProducts: productCount,
      revenueGrowth,
      ordersGrowth,
      customersGrowth,
    },
    topProducts,
  })
}))

module.exports = router
