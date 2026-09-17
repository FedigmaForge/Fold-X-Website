const { Router } = require('express')
const prisma = require('../lib/prisma')
const { asyncRoute } = require('../middleware/errorHandler')

const router = Router()

// GET /api/categories
router.get('/categories', asyncRoute(async (req, res) => {
  const categories = await prisma.category.findMany()
  const withCounts = await Promise.all(
    categories.map(async (c) => ({
      ...c,
      count: await prisma.product.count({ where: { categoryId: c.id, isActive: true } }),
    }))
  )
  res.json(withCounts)
}))

module.exports = router
