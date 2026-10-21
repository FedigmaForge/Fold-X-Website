const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')
const { visibleProductWhere } = require('../lib/visibility')

const router = Router()

async function withCounts(categories, productWhere) {
  return Promise.all(
    categories.map(async (c) => ({
      ...c,
      count: await prisma.product.count({ where: { ...productWhere, categoryId: c.id } }),
    }))
  )
}

// Subcategory names → how many products use each, so the admin can see what a
// rename/removal would affect (and the API can refuse to orphan products).
async function subcategoryUsage(categoryId) {
  const rows = await prisma.product.groupBy({
    by: ['subcategory'],
    where: { categoryId, subcategory: { not: null } },
    _count: true,
  })
  return Object.fromEntries(rows.map((r) => [r.subcategory, r._count]))
}

function cleanSubs(sub) {
  if (!Array.isArray(sub)) throw new HttpError(400, 'Subcategories must be a list')
  const names = sub.map((s) => String(s ?? '').trim()).filter(Boolean)
  if (names.some((n) => n.length > 40)) throw new HttpError(400, 'Subcategory names must be 40 characters or fewer')
  const seen = new Set()
  for (const n of names) {
    const key = n.toLowerCase()
    if (seen.has(key)) throw new HttpError(400, `Subcategory "${n}" is listed twice`)
    seen.add(key)
  }
  if (names.length > 20) throw new HttpError(400, 'A category can have at most 20 subcategories')
  return names
}

function cleanImage(image) {
  const str = String(image ?? '').trim()
  if (str && !/^https?:\/\//i.test(str)) throw new HttpError(400, 'Image must be an http(s) URL')
  return str
}

// GET /api/categories — storefront: active only, in admin-defined order, with
// counts of products a shopper can actually see
router.get('/categories', asyncRoute(async (req, res) => {
  const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  res.json(await withCounts(categories, visibleProductWhere()))
}))

// GET /api/admin/categories — all categories incl. hidden, with total product
// counts and per-subcategory usage
router.get('/admin/categories', requireAdmin, asyncRoute(async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } })
  const counted = await withCounts(categories, {})
  res.json(await Promise.all(counted.map(async (c) => ({ ...c, subUsage: await subcategoryUsage(c.id) }))))
}))

// POST /api/admin/categories  { id, name, image, sub, isActive }
router.post('/admin/categories', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const id = String(req.body.id ?? '').trim().toLowerCase()
  const name = String(req.body.name ?? '').trim()
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new HttpError(400, 'URL name must be lowercase letters, numbers and hyphens (e.g. "home-decor")')
  if (!name || name.length > 40) throw new HttpError(400, 'Name is required (max 40 characters)')
  if (await prisma.category.findUnique({ where: { id } })) throw new HttpError(409, `A category with URL name "${id}" already exists`)

  const last = await prisma.category.findFirst({ orderBy: { sortOrder: 'desc' } })
  const category = await prisma.category.create({
    data: {
      id, name,
      image: cleanImage(req.body.image),
      sub: cleanSubs(req.body.sub ?? []),
      isActive: req.body.isActive ?? true,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })
  await logAudit({ actor: req.user, action: 'category.create', entityType: 'Category', entityId: id, summary: `Created category "${name}"` })
  res.status(201).json(category)
}))

// PUT /api/admin/categories/reorder  { ids: [...] } — declared before /:id
router.put('/admin/categories/reorder', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids)) throw new HttpError(400, 'ids must be a list')
  await prisma.$transaction(ids.map((id, i) => prisma.category.updateMany({ where: { id }, data: { sortOrder: i } })))
  await logAudit({ actor: req.user, action: 'category.reorder', entityType: 'Category', summary: 'Reordered categories' })
  res.json({ ok: true })
}))

// PUT /api/admin/categories/:id  { name?, image?, sub?, subRenames?, isActive? }
// subRenames ({ "Old name": "New name" }) moves products to the renamed subcategory.
// The id (URL name) can't change — products and storefront links point at it.
router.put('/admin/categories/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const current = await prisma.category.findUnique({ where: { id: req.params.id } })
  if (!current) throw new HttpError(404, 'Category not found')

  const data = {}
  if (req.body.name !== undefined) {
    data.name = String(req.body.name).trim()
    if (!data.name || data.name.length > 40) throw new HttpError(400, 'Name is required (max 40 characters)')
  }
  if (req.body.image !== undefined) data.image = cleanImage(req.body.image)
  if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive
  const renames = Object.entries(req.body.subRenames ?? {})
    .map(([from, to]) => [String(from).trim(), String(to ?? '').trim()])
    .filter(([from, to]) => from && to && from !== to)
  if (req.body.sub !== undefined) {
    data.sub = cleanSubs(req.body.sub)
    for (const [, to] of renames) {
      if (!data.sub.includes(to)) throw new HttpError(400, `Renamed subcategory "${to}" must be in the list`)
    }
    // Refuse to drop a subcategory products still use — they'd silently fall
    // out of every subcategory filter. Renamed ones carry their products over.
    const usage = await subcategoryUsage(current.id)
    const kept = new Set([...data.sub, ...renames.map(([from]) => from)])
    const orphaned = Object.entries(usage).filter(([name]) => !kept.has(name))
    if (orphaned.length) {
      const list = orphaned.map(([name, n]) => `"${name}" (${n} product${n === 1 ? '' : 's'})`).join(', ')
      throw new HttpError(409, `Move these products to another subcategory first: ${list}`)
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cat = await tx.category.update({ where: { id: current.id }, data })
    for (const [from, to] of renames) {
      await tx.product.updateMany({ where: { categoryId: current.id, subcategory: from }, data: { subcategory: to } })
    }
    // Products store the category name alongside the id — keep it in step
    if (data.name && data.name !== current.name) {
      await tx.product.updateMany({ where: { categoryId: current.id }, data: { category: data.name } })
    }
    return cat
  })
  await logAudit({ actor: req.user, action: 'category.update', entityType: 'Category', entityId: current.id, summary: `Updated category "${updated.name}"` })
  res.json(updated)
}))

// DELETE /api/admin/categories/:id — only when no products use it
router.delete('/admin/categories/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const current = await prisma.category.findUnique({ where: { id: req.params.id } })
  if (!current) throw new HttpError(404, 'Category not found')
  const inUse = await prisma.product.count({ where: { categoryId: current.id } })
  if (inUse) throw new HttpError(409, `${inUse} product${inUse === 1 ? ' is' : 's are'} in this category. Move or delete them first, or hide the category instead.`)
  await prisma.category.delete({ where: { id: current.id } })
  await logAudit({ actor: req.user, action: 'category.delete', entityType: 'Category', entityId: current.id, summary: `Deleted category "${current.name}"` })
  res.status(204).end()
}))

module.exports = router
