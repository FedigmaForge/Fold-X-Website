const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { seedAll, wipeAll } = require('../../prisma/seedData')

const router = Router()

// GET /api/admin/export — full JSON dump for backup/inspection (no password hashes)
router.get('/admin/export', requireAdmin, asyncRoute(async (req, res) => {
  const [products, banners, reviews, orders, customers] = await Promise.all([
    prisma.product.findMany(),
    prisma.banner.findMany(),
    prisma.review.findMany(),
    prisma.order.findMany({ include: { items: true } }),
    prisma.user.findMany({ where: { role: 'customer' }, select: { id: true, name: true, email: true, phone: true, city: true, isActive: true, createdAt: true } }),
  ])
  res.json({ products, banners, reviews, orders, customers })
}))

// POST /api/admin/import — replaces products/banners/reviews from a previous
// export. Orders/customers are NOT reimported (they involve real user
// accounts/passwords that can't be safely round-tripped through plain JSON) —
// see development.md.
// Replaces catalog content, so it needs the same roles as editing products directly
router.post('/admin/import', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const { products, banners, reviews } = req.body
  if (!products && !banners && !reviews) throw new HttpError(400, 'Nothing importable in this file')

  await prisma.$transaction(async (tx) => {
    if (reviews) await tx.review.deleteMany()
    if (products) await tx.product.deleteMany()
    if (banners) await tx.banner.deleteMany()

    if (products) {
      for (const p of products) {
        const { id, ...data } = p
        await tx.product.create({ data: { id, ...data } })
      }
    }
    if (banners) {
      for (const b of banners) {
        const { id, ...data } = b
        await tx.banner.create({ data: { id, ...data } })
      }
    }
    if (reviews) {
      for (const r of reviews) {
        const { id, ...data } = r
        await tx.review.create({ data: { id, ...data } })
      }
    }
  })

  res.json({
    success: true,
    imported: { products: !!products, banners: !!banners, reviews: !!reviews },
    skipped: ['orders', 'customers'],
  })
}))

// POST /api/admin/reset-demo-data — wipes and re-seeds from src/data/mockData.js
// Wipes every table (customers, orders, staff, audit log) — Super Admin only
router.post('/admin/reset-demo-data', requireRole('superadmin'), asyncRoute(async (req, res) => {
  await wipeAll(prisma)
  await seedAll(prisma)
  res.json({ success: true })
}))

module.exports = router
