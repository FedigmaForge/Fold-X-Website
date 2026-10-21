const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')
const { visibleProductWhere, isProductVisible } = require('../lib/visibility')
const { syncProductStock, recordMovements, variantLabel } = require('../lib/stock')
const { toSlug, parseGstRate, parseHsnCode, parseSku, parseStock, parsePublishAt } = require('../lib/productInput')

const router = Router()


const activeVariants = { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }

// Storefront shape: no internal stock settings, and never the cost price
function toPublic(p) {
  const { lowStockThreshold, costPrice, ...rest } = p
  return rest
}

// GET /api/products?category=&type=&collection=&sale=&search=&sort=&minPrice=&maxPrice=
// SQLite has no case-insensitive `mode` in Prisma and the catalog is small, so
// text matching is done in JS.
router.get('/products', asyncRoute(async (req, res) => {
  const { category, type, collection, sale, search, sort, minPrice, maxPrice } = req.query
  let products = await prisma.product.findMany({ where: visibleProductWhere() })

  if (collection) products = products.filter((p) => p.collectionId === collection)
  // "Special prices": anything currently selling below its original price
  if (sale) products = products.filter((p) => p.originalPrice > p.price)

  if (category) {
    const c = category.toLowerCase()
    products = products.filter((p) => p.categoryId === category || p.category?.toLowerCase() === c)
  }
  // `type` is a subcategory slug from menu links, e.g. "tote-bags" or the
  // shorter "passport" for "Passport Holders"
  if (type) {
    const t = toSlug(type)
    products = products.filter((p) => p.subcategory && toSlug(p.subcategory).startsWith(t))
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

  res.json(products.map(toPublic))
}))

// GET /api/products/featured
router.get('/products/featured', asyncRoute(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { ...visibleProductWhere(), isFeatured: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(products.map(toPublic))
}))

// GET /api/products/:slug — with purchasable variants
router.get('/products/:slug', asyncRoute(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { slug: req.params.slug }, include: { variants: activeVariants } })
  res.json(isProductVisible(product) ? toPublic(product) : null)
}))

// ─── Admin ─────────────────────────────────────────────────────────────────────

// Low when any active variant (or the product itself, if it has none) is at or
// below the product's threshold
function lowStockOf(p) {
  const active = p.variants.filter((v) => v.isActive)
  if (active.length) return active.filter((v) => v.stock <= p.lowStockThreshold)
  return p.stock <= p.lowStockThreshold ? [null] : []
}

// GET /api/admin/products
router.get('/admin/products', requireAdmin, asyncRoute(async (req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { variants: { orderBy: { sortOrder: 'asc' } } },
  })
  res.json(products.map((p) => ({ ...p, lowStockCount: lowStockOf(p).length })))
}))

// GET /api/admin/inventory/low-stock — every product/variant at or below its threshold
router.get('/admin/inventory/low-stock', requireAdmin, asyncRoute(async (req, res) => {
  const products = await prisma.product.findMany({ include: { variants: { orderBy: { sortOrder: 'asc' } } } })
  const rows = []
  for (const p of products) {
    for (const v of lowStockOf(p)) {
      rows.push({
        productId: p.id, productName: p.name, image: p.images?.[0] ?? null, isActive: p.isActive,
        variantId: v?.id ?? null, variant: v ? variantLabel(v) : null, sku: v ? v.sku : p.sku,
        stock: v ? v.stock : p.stock, threshold: p.lowStockThreshold,
      })
    }
  }
  rows.sort((a, b) => a.stock - b.stock)
  res.json(rows)
}))

// GET /api/admin/products/:id
router.get('/admin/products/:id', requireAdmin, asyncRoute(async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { variants: { orderBy: { sortOrder: 'asc' } } },
  })
  res.json(product ?? null)
}))

// GET /api/admin/products/:id/stock-history — latest 100 movements
router.get('/admin/products/:id/stock-history', requireAdmin, asyncRoute(async (req, res) => {
  const movements = await prisma.stockMovement.findMany({
    where: { productId: req.params.id },
    include: { variant: { select: { color: true, size: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json(movements.map(({ variant, ...m }) => ({ ...m, variant: variant ? variantLabel(variant) : null })))
}))

// ─── Input validation ─────────────────────────────────────────────────────────

function parseVariants(list) {
  if (list === undefined) return undefined
  if (!Array.isArray(list)) throw new HttpError(400, 'Variants must be a list')
  if (list.length > 100) throw new HttpError(400, 'A product can have at most 100 variants')
  const seen = new Set()
  const skus = new Set()
  return list.map((v, i) => {
    const color = String(v?.color ?? '').trim()
    const size = String(v?.size ?? '').trim()
    const label = `Variant ${i + 1}`
    if (!color && !size) throw new HttpError(400, `${label} needs a colour or a size`)
    if (color.length > 40 || size.length > 40) throw new HttpError(400, `${label}: colour and size must be 40 characters or fewer`)
    const key = `${color.toLowerCase()}|${size.toLowerCase()}`
    if (seen.has(key)) throw new HttpError(400, `"${[color, size].filter(Boolean).join(' / ')}" is listed twice`)
    seen.add(key)
    const sku = parseSku(v?.sku, `${label} SKU`)
    if (sku) {
      if (skus.has(sku)) throw new HttpError(400, `SKU "${sku}" is used by two variants`)
      skus.add(sku)
    }
    return { id: v?.id || null, color, size, sku, stock: parseStock(v?.stock, `${label} stock`), isActive: v?.isActive ?? true, sortOrder: i }
  })
}

// Builds the Product columns from a request body. Unknown keys are ignored.
function parseProductFields(data, { creating }) {
  const out = {}
  const str = (k, max = 200) => {
    if (data[k] === undefined) return
    const v = data[k] === null ? null : String(data[k]).trim()
    if (v && v.length > max) throw new HttpError(400, `${k} is too long (max ${max})`)
    out[k] = v
  }
  if (creating || data.name !== undefined) {
    const name = String(data.name ?? '').trim()
    if (!name) throw new HttpError(400, 'Product name is required')
    out.name = name
  }
  if (creating || data.price !== undefined) {
    const price = Number(data.price)
    if (!(price > 0)) throw new HttpError(400, 'Price must be greater than 0')
    out.price = price
  }
  if (data.originalPrice !== undefined) out.originalPrice = data.originalPrice ? Number(data.originalPrice) : null
  if (data.discount !== undefined) out.discount = Number(data.discount) || 0
  for (const k of ['category', 'categoryId', 'subcategory', 'material', 'badge']) str(k)
  str('description', 5000)
  str('metaTitle', 70)
  str('metaDescription', 170)
  if (data.slug !== undefined) out.slug = toSlug(data.slug)
  if (data.images !== undefined) out.images = Array.isArray(data.images) ? data.images.filter((x) => typeof x === 'string') : []
  if (data.features !== undefined) out.features = Array.isArray(data.features) ? data.features : []
  if (data.colors !== undefined) out.colors = Array.isArray(data.colors) ? data.colors : []
  if (data.isFeatured !== undefined) out.isFeatured = !!data.isFeatured
  if (data.isActive !== undefined) out.isActive = !!data.isActive
  if (data.allowCustomisation !== undefined) out.allowCustomisation = !!data.allowCustomisation
  if (data.sku !== undefined) out.sku = parseSku(data.sku)
  if (data.stock !== undefined) out.stock = parseStock(data.stock)
  if (data.lowStockThreshold !== undefined) out.lowStockThreshold = parseStock(data.lowStockThreshold, 'Low-stock threshold')
  if (data.costPrice !== undefined) {
    out.costPrice = data.costPrice === null || data.costPrice === '' ? null : Number(data.costPrice)
    if (out.costPrice !== null && !(out.costPrice >= 0)) throw new HttpError(400, 'Cost price must be ₹0 or more')
  }
  const hsn = parseHsnCode(data.hsnCode); if (hsn !== undefined) out.hsnCode = hsn
  const gst = parseGstRate(data.gstRate); if (gst !== undefined) out.gstRate = gst
  const publishAt = parsePublishAt(data.publishAt); if (publishAt !== undefined) out.publishAt = publishAt
  if (data.collectionId !== undefined) out.collectionId = data.collectionId ? String(data.collectionId).trim() : null
  if (creating) {
    out.slug = out.slug || toSlug(out.name)
    out.category ??= ''
    out.categoryId ??= ''
  }
  if (out.slug === '') throw new HttpError(400, 'URL slug cannot be empty')
  return out
}

// Writes the variant list for a product inside a transaction: updates/creates
// the given ones, and for ones no longer listed deletes them — or, if past
// orders reference them, deactivates them so order history stays intact.
// Stock differences are logged as manual adjustments.
async function saveVariants(tx, productId, variants, actorName) {
  const existing = await tx.productVariant.findMany({ where: { productId }, include: { _count: { select: { orderItems: true } } } })
  const byId = new Map(existing.map((v) => [v.id, v]))
  const keptIds = new Set()
  const movements = []

  // Free up unique (productId,color,size) and sku slots held by rows that are
  // about to be removed or changed, so swaps don't collide mid-transaction.
  for (const v of existing) {
    await tx.productVariant.update({ where: { id: v.id }, data: { sku: null, color: `__tmp_${v.id}`, size: '' } })
  }

  for (const v of variants) {
    const prev = v.id ? byId.get(v.id) : null
    const data = { color: v.color, size: v.size, sku: v.sku, stock: v.stock, isActive: v.isActive, sortOrder: v.sortOrder }
    if (prev) {
      await tx.productVariant.update({ where: { id: prev.id }, data })
      keptIds.add(prev.id)
      if (v.stock !== prev.stock) movements.push({ productId, variantId: prev.id, change: v.stock - prev.stock, reason: 'adjustment', actorName })
    } else {
      const created = await tx.productVariant.create({ data: { ...data, productId } })
      keptIds.add(created.id)
      if (v.stock) movements.push({ productId, variantId: created.id, change: v.stock, reason: 'adjustment', note: 'New variant', actorName })
    }
  }

  for (const v of existing) {
    if (keptIds.has(v.id)) continue
    if (v._count.orderItems > 0) {
      // Keep for order history, out of sale, with its original label restored
      await tx.productVariant.update({ where: { id: v.id }, data: { isActive: false, color: `${v.color} (removed ${v.id.slice(-4)})`, size: v.size, stock: 0 } })
    } else {
      await tx.productVariant.delete({ where: { id: v.id } })
    }
    if (v.stock) movements.push({ productId, variantId: null, change: -v.stock, reason: 'adjustment', note: `Variant ${variantLabel(v)} removed`, actorName })
  }

  await recordMovements(tx, movements)
  if (variants.length) {
    // Colour list for storefront filters = colours that can actually be bought
    const colors = [...new Set(variants.filter((v) => v.isActive && v.color).map((v) => v.color))]
    await tx.product.update({ where: { id: productId }, data: { colors } })
    await syncProductStock(tx, productId)
  }
}

// A product can only join a collection that exists
async function assertCollection(fields) {
  if (!fields.collectionId) return
  if (!(await prisma.collection.findUnique({ where: { id: fields.collectionId } }))) {
    throw new HttpError(400, 'That collection no longer exists — pick another')
  }
}

function getProductFull(db, id) {
  return db.product.findUnique({ where: { id }, include: { variants: { orderBy: { sortOrder: 'asc' } } } })
}

// POST /api/admin/products
router.post('/admin/products', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const fields = parseProductFields(req.body, { creating: true })
  await assertCollection(fields)
  const variants = parseVariants(req.body.variants) ?? []
  if (await prisma.product.findUnique({ where: { slug: fields.slug } })) {
    throw new HttpError(409, `A product with URL slug "${fields.slug}" already exists`)
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({ data: { ...fields, colors: fields.colors ?? [], images: fields.images ?? [], features: fields.features ?? [] } })
    if (variants.length) {
      await saveVariants(tx, created.id, variants, req.user.name)
    } else if (created.stock) {
      await recordMovements(tx, [{ productId: created.id, change: created.stock, reason: 'adjustment', note: 'Opening stock', actorName: req.user.name }])
    }
    return getProductFull(tx, created.id)
  })
  await logAudit({ actor: req.user, action: 'product.create', entityType: 'Product', entityId: product.id, summary: `Created product "${product.name}"` })
  res.status(201).json(product)
}))

// PUT /api/admin/products/:id
router.put('/admin/products/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const current = await prisma.product.findUnique({ where: { id: req.params.id }, include: { variants: true } })
  if (!current) throw new HttpError(404, 'Product not found')
  const fields = parseProductFields(req.body, { creating: false })
  await assertCollection(fields)
  const variants = parseVariants(req.body.variants)
  if (fields.slug && fields.slug !== current.slug) {
    const taken = await prisma.product.findUnique({ where: { slug: fields.slug } })
    if (taken) throw new HttpError(409, `A product with URL slug "${fields.slug}" already exists`)
  }
  // With variants, stock is the sum of variant stock — ignore a direct value
  const hasVariants = variants ? variants.length > 0 : current.variants.length > 0
  if (hasVariants) delete fields.stock

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: current.id }, data: fields })
    if (variants !== undefined) await saveVariants(tx, current.id, variants, req.user.name)
    if (fields.stock !== undefined && fields.stock !== current.stock) {
      await recordMovements(tx, [{ productId: current.id, change: fields.stock - current.stock, reason: 'adjustment', actorName: req.user.name }])
    }
    return getProductFull(tx, current.id)
  })
  await logAudit({ actor: req.user, action: 'product.update', entityType: 'Product', entityId: product.id, summary: `Updated product "${product.name}"` })
  res.json(product)
}))

// DELETE /api/admin/products/:id — past orders keep their snapshot of it
router.delete('/admin/products/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!product) throw new HttpError(404, 'Product not found')
  await prisma.product.delete({ where: { id: req.params.id } })
  await logAudit({ actor: req.user, action: 'product.delete', entityType: 'Product', entityId: product.id, summary: `Deleted product "${product.name}"` })
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
