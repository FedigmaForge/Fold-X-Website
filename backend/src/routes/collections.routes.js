const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')
const { visibleProductWhere } = require('../lib/visibility')

const router = Router()

// Storefront shape for products: same rule as products.routes — never the cost price
function toPublicProduct(p) {
  const { lowStockThreshold, costPrice, ...rest } = p
  return rest
}

function cleanText(value, field, max, { required = false } = {}) {
  const str = String(value ?? '').trim()
  if (required && !str) throw new HttpError(400, `${field} is required`)
  if (str.length > max) throw new HttpError(400, `${field} must be ${max} characters or fewer`)
  return str
}

function cleanImage(value, field) {
  const str = String(value ?? '').trim()
  if (str && !/^https?:\/\//i.test(str)) throw new HttpError(400, `${field} must be an http(s) URL`)
  return str
}

// Fields shared by create and update; only keys present in the body are returned
function parseFields(body, { creating }) {
  const data = {}
  if (creating || body.name !== undefined) data.name = cleanText(body.name, 'Name', 60, { required: true })
  if (body.tagline !== undefined) data.tagline = cleanText(body.tagline, 'Tagline', 120)
  if (body.description !== undefined) data.description = cleanText(body.description, 'Description', 1500)
  if (body.image !== undefined) data.image = cleanImage(body.image, 'Hero image')
  if (body.cardImage !== undefined) data.cardImage = cleanImage(body.cardImage, 'Card image')
  if (body.isActive !== undefined) data.isActive = !!body.isActive
  return data
}

// Optional `productIds`: the full membership list. Listed products join this
// collection (moving out of any other); unlisted members leave it.
function parseProductIds(body) {
  if (body.productIds === undefined) return undefined
  if (!Array.isArray(body.productIds)) throw new HttpError(400, 'productIds must be a list')
  return [...new Set(body.productIds.map(String))]
}

async function setMembers(tx, collectionId, productIds) {
  if (productIds === undefined) return
  await tx.product.updateMany({ where: { collectionId, id: { notIn: productIds } }, data: { collectionId: null } })
  if (productIds.length) await tx.product.updateMany({ where: { id: { in: productIds } }, data: { collectionId } })
}

async function withCounts(collections, productWhere) {
  return Promise.all(
    collections.map(async (c) => ({
      ...c,
      count: await prisma.product.count({ where: { ...productWhere, collectionId: c.id } }),
    }))
  )
}

// GET /api/collections — storefront: active collections, in admin order, with
// counts of products a shopper can actually see
router.get('/collections', asyncRoute(async (req, res) => {
  const collections = await prisma.collection.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  res.json(await withCounts(collections, visibleProductWhere()))
}))

// GET /api/collections/:id — one active collection with its visible products
router.get('/collections/:id', asyncRoute(async (req, res) => {
  const collection = await prisma.collection.findUnique({ where: { id: req.params.id } })
  if (!collection || !collection.isActive) return res.json(null)
  const products = await prisma.product.findMany({
    where: { ...visibleProductWhere(), collectionId: collection.id },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ ...collection, products: products.map(toPublicProduct) })
}))

// GET /api/admin/collections — all, incl. hidden, with total product counts
router.get('/admin/collections', requireAdmin, asyncRoute(async (req, res) => {
  const collections = await prisma.collection.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json(await withCounts(collections, {}))
}))

// POST /api/admin/collections  { id, name, tagline?, description?, image?, cardImage?, isActive? }
router.post('/admin/collections', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const id = String(req.body.id ?? '').trim().toLowerCase()
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new HttpError(400, 'URL name must be lowercase letters, numbers and hyphens (e.g. "heritage")')
  if (await prisma.collection.findUnique({ where: { id } })) throw new HttpError(409, `A collection with URL name "${id}" already exists`)

  const fields = parseFields(req.body, { creating: true })
  const productIds = parseProductIds(req.body)
  const last = await prisma.collection.findFirst({ orderBy: { sortOrder: 'desc' } })
  const collection = await prisma.$transaction(async (tx) => {
    const created = await tx.collection.create({ data: { id, ...fields, sortOrder: (last?.sortOrder ?? -1) + 1 } })
    await setMembers(tx, id, productIds)
    return created
  })
  await logAudit({ actor: req.user, action: 'collection.create', entityType: 'Collection', entityId: id, summary: `Created collection "${collection.name}"` })
  const count = await prisma.product.count({ where: { collectionId: id } })
  res.status(201).json({ ...collection, count })
}))

// PUT /api/admin/collections/reorder  { ids: [...] } — declared before /:id
router.put('/admin/collections/reorder', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids)) throw new HttpError(400, 'ids must be a list')
  await prisma.$transaction(ids.map((id, i) => prisma.collection.updateMany({ where: { id: String(id) }, data: { sortOrder: i } })))
  await logAudit({ actor: req.user, action: 'collection.reorder', entityType: 'Collection', summary: 'Reordered collections' })
  res.json({ ok: true })
}))

// PUT /api/admin/collections/:id — the id (URL name) can't change; storefront links point at it
router.put('/admin/collections/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const current = await prisma.collection.findUnique({ where: { id: req.params.id } })
  if (!current) throw new HttpError(404, 'Collection not found')
  const fields = parseFields(req.body, { creating: false })
  const productIds = parseProductIds(req.body)
  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.collection.update({ where: { id: current.id }, data: fields })
    await setMembers(tx, current.id, productIds)
    return c
  })
  await logAudit({ actor: req.user, action: 'collection.update', entityType: 'Collection', entityId: current.id, summary: `Updated collection "${updated.name}"` })
  const count = await prisma.product.count({ where: { collectionId: current.id } })
  res.json({ ...updated, count })
}))

// DELETE /api/admin/collections/:id — products in it simply leave the collection
router.delete('/admin/collections/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const current = await prisma.collection.findUnique({ where: { id: req.params.id } })
  if (!current) throw new HttpError(404, 'Collection not found')
  await prisma.$transaction([
    prisma.product.updateMany({ where: { collectionId: current.id }, data: { collectionId: null } }),
    prisma.collection.delete({ where: { id: current.id } }),
  ])
  await logAudit({ actor: req.user, action: 'collection.delete', entityType: 'Collection', entityId: current.id, summary: `Deleted collection "${current.name}"` })
  res.status(204).end()
}))

module.exports = router
