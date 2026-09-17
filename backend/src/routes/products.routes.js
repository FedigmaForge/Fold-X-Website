const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')

const router = Router()

// GET /api/products
// SQLite has no case-insensitive `mode` in Prisma, and the dataset here is small,
// so category/search matching is done in JS the same way the old mock layer did it.
router.get('/products', asyncRoute(async (req, res) => {
  const { category, search, sort, minPrice, maxPrice } = req.query
  let products = await prisma.product.findMany({ where: { isActive: true } })

  if (category) {
    const c = category.toLowerCase()
    products = products.filter((p) => p.categoryId === category || p.category?.toLowerCase() === c)
  }
  if (search) {
    const s = search.toLowerCase()
    products = products.filter(
      (p) => p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s)
    )
  }
  if (minPrice !== undefined) products = products.filter((p) => p.price >= Number(minPrice))
  if (maxPrice !== undefined) products = products.filter((p) => p.price <= Number(maxPrice))

  if (sort === 'price-asc') products = products.sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') products = products.sort((a, b) => b.price - a.price)
  if (sort === 'rating') products = products.sort((a, b) => b.rating - a.rating)
  if (sort === 'newest') products = products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  res.json(products)
}))

// GET /api/products/featured
router.get('/products/featured', asyncRoute(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isFeatured: true, isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(products)
}))

// GET /api/products/:slug
router.get('/products/:slug', asyncRoute(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { slug: req.params.slug } })
  res.json(product ?? null)
}))

// GET /api/admin/products
router.get('/admin/products', requireAdmin, asyncRoute(async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(products)
}))

// GET /api/admin/products/:id
router.get('/admin/products/:id', requireAdmin, asyncRoute(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } })
  res.json(product ?? null)
}))

function toSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// POST /api/admin/products
router.post('/admin/products', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const data = req.body
  if (!data.name || !data.price) throw new HttpError(400, 'name and price are required')

  const slug = data.slug || toSlug(data.name)
  const existing = await prisma.product.findUnique({ where: { slug } })
  if (existing) throw new HttpError(409, `A product with slug "${slug}" already exists`)

  const product = await prisma.product.create({
    data: {
      name: data.name,
      slug,
      category: data.category ?? '',
      categoryId: data.categoryId ?? '',
      subcategory: data.subcategory,
      material: data.material,
      price: Number(data.price),
      originalPrice: data.originalPrice ? Number(data.originalPrice) : null,
      discount: Number(data.discount ?? 0),
      stock: Number(data.stock ?? 0),
      badge: data.badge,
      colors: data.colors ?? [],
      images: data.images ?? [],
      description: data.description ?? '',
      features: data.features ?? [],
      isFeatured: !!data.isFeatured,
      isActive: data.isActive ?? true,
    },
  })
  await logAudit({ actor: req.user, action: 'product.create', entityType: 'Product', entityId: product.id, summary: `Created product "${product.name}"` })
  res.status(201).json(product)
}))

// PUT /api/admin/products/:id
router.put('/admin/products/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const data = req.body
  if (data.slug) {
    const existing = await prisma.product.findUnique({ where: { slug: data.slug } })
    if (existing && existing.id !== req.params.id) {
      throw new HttpError(409, `A product with slug "${data.slug}" already exists`)
    }
  }
  // Whitelist fields explicitly — the admin form sends extra client-only
  // fields (e.g. `tags`) that don't exist on the Product model, and Prisma
  // throws on unknown keys rather than silently ignoring them.
  const updatable = {}
  for (const key of [
    'name', 'slug', 'category', 'categoryId', 'subcategory', 'material',
    'badge', 'colors', 'images', 'description', 'features', 'isFeatured', 'isActive',
  ]) {
    if (data[key] !== undefined) updatable[key] = data[key]
  }
  if (data.price !== undefined) updatable.price = Number(data.price)
  if (data.originalPrice !== undefined) updatable.originalPrice = Number(data.originalPrice)
  if (data.discount !== undefined) updatable.discount = Number(data.discount)
  if (data.stock !== undefined) updatable.stock = Number(data.stock)

  const product = await prisma.product.update({ where: { id: req.params.id }, data: updatable })
  await logAudit({ actor: req.user, action: 'product.update', entityType: 'Product', entityId: product.id, summary: `Updated product "${product.name}"` })
  res.json(product)
}))

// DELETE /api/admin/products/:id
router.delete('/admin/products/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } })
  await prisma.product.delete({ where: { id: req.params.id } })
  if (product) await logAudit({ actor: req.user, action: 'product.delete', entityType: 'Product', entityId: product.id, summary: `Deleted product "${product.name}"` })
  res.json({ success: true })
}))

// PATCH /api/admin/products/:id/toggle-active
router.patch('/admin/products/:id/toggle-active', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!product) throw new HttpError(404, 'Product not found')
  const updated = await prisma.product.update({
    where: { id: req.params.id },
    data: { isActive: !product.isActive },
  })
  await logAudit({ actor: req.user, action: 'product.toggle_active', entityType: 'Product', entityId: product.id, summary: `${updated.isActive ? 'Activated' : 'Deactivated'} product "${product.name}"` })
  res.json({ success: true, isActive: updated.isActive })
}))

module.exports = router
