const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')

const router = Router()

// GET /api/products/:id/reviews
router.get('/products/:id/reviews', asyncRoute(async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { productId: req.params.id, isApproved: true },
    orderBy: { date: 'desc' },
  })
  res.json(reviews)
}))

// GET /api/admin/reviews
router.get('/admin/reviews', requireAdmin, asyncRoute(async (req, res) => {
  const reviews = await prisma.review.findMany({ orderBy: { date: 'desc' } })
  res.json(reviews)
}))

// POST /api/reviews  { productId, rating, title, body, userName }
router.post('/reviews', asyncRoute(async (req, res) => {
  const { productId, rating, title, body, userName } = req.body
  if (!productId || !rating) throw new HttpError(400, 'productId and rating are required')

  const review = await prisma.review.create({
    data: {
      productId,
      rating: Number(rating),
      title,
      body,
      userName: userName || 'Anonymous',
      isApproved: false,
    },
  })
  res.status(201).json(review)
}))

// PUT /api/admin/reviews/:id/approve
router.put('/admin/reviews/:id/approve', requireAdmin, asyncRoute(async (req, res) => {
  const review = await prisma.review.update({ where: { id: req.params.id }, data: { isApproved: true } })
  const approved = await prisma.review.findMany({ where: { productId: review.productId, isApproved: true } })
  const rating = approved.reduce((s, r) => s + r.rating, 0) / approved.length
  await prisma.product.update({
    where: { id: review.productId },
    data: { rating, reviewCount: approved.length },
  })
  await logAudit({ actor: req.user, action: 'review.approve', entityType: 'Review', entityId: review.id, summary: `Approved review by ${review.userName}` })
  res.json({ id: review.id, isApproved: true })
}))

// DELETE /api/admin/reviews/:id
router.delete('/admin/reviews/:id', requireAdmin, asyncRoute(async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } })
  await prisma.review.delete({ where: { id: req.params.id } })
  if (review) await logAudit({ actor: req.user, action: 'review.delete', entityType: 'Review', entityId: review.id, summary: `Deleted review by ${review.userName}` })
  res.json({ success: true })
}))

module.exports = router
