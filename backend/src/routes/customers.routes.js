const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin } = require('../middleware/auth')
const { asyncRoute } = require('../middleware/errorHandler')

const router = Router()

// GET /api/admin/customers — orderCount/totalSpent aggregated from real orders,
// not stored/stale fields, so they can never drift from actual order data.
router.get('/admin/customers', requireAdmin, asyncRoute(async (req, res) => {
  const customers = await prisma.user.findMany({ where: { role: 'customer' }, orderBy: { createdAt: 'asc' } })

  const paidOrders = await prisma.order.findMany({
    where: { paymentStatus: 'paid', userId: { not: null } },
    select: { userId: true, total: true },
  })

  const statsByUser = new Map()
  for (const o of paidOrders) {
    const s = statsByUser.get(o.userId) ?? { orderCount: 0, totalSpent: 0 }
    s.orderCount += 1
    s.totalSpent += o.total
    statsByUser.set(o.userId, s)
  }

  res.json(
    customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      city: c.city,
      isActive: c.isActive,
      joinedAt: c.createdAt,
      orderCount: statsByUser.get(c.id)?.orderCount ?? 0,
      totalSpent: statsByUser.get(c.id)?.totalSpent ?? 0,
    }))
  )
}))

module.exports = router
