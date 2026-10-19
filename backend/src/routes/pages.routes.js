const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')

const router = Router()

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

function parsePage(body, { creating }) {
  const data = {}
  if (creating || body.title !== undefined) {
    data.title = String(body.title ?? '').trim()
    if (!data.title || data.title.length > 100) throw new HttpError(400, 'Title is required (max 100 characters)')
  }
  if (creating || body.slug !== undefined) {
    data.slug = String(body.slug ?? '').trim().toLowerCase()
    if (!SLUG.test(data.slug) || data.slug.length > 60) throw new HttpError(400, 'URL must be lowercase letters, numbers and hyphens (e.g. "shipping-policy")')
  }
  if (body.body !== undefined) {
    data.body = String(body.body ?? '')
    if (data.body.length > 50000) throw new HttpError(400, 'Page text is too long (max 50,000 characters)')
  }
  if (body.metaDescription !== undefined) data.metaDescription = String(body.metaDescription ?? '').trim().slice(0, 170)
  if (body.isPublished !== undefined) data.isPublished = !!body.isPublished
  if (body.showInFooter !== undefined) data.showInFooter = !!body.showInFooter
  return data
}

// GET /api/pages — published pages for footer links
router.get('/pages', asyncRoute(async (req, res) => {
  const pages = await prisma.page.findMany({
    where: { isPublished: true },
    select: { slug: true, title: true, showInFooter: true },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(pages)
}))

// GET /api/pages/:slug — a published page (null if missing or unpublished)
router.get('/pages/:slug', asyncRoute(async (req, res) => {
  const page = await prisma.page.findUnique({ where: { slug: req.params.slug } })
  res.json(page?.isPublished ? { slug: page.slug, title: page.title, body: page.body, metaDescription: page.metaDescription, updatedAt: page.updatedAt } : null)
}))

// GET /api/admin/pages
router.get('/admin/pages', requireAdmin, asyncRoute(async (req, res) => {
  res.json(await prisma.page.findMany({ orderBy: { sortOrder: 'asc' } }))
}))

// PUT /api/admin/pages/reorder  { ids } — declared before /:id
router.put('/admin/pages/reorder', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  if (!Array.isArray(req.body.ids)) throw new HttpError(400, 'ids must be a list')
  await prisma.$transaction(req.body.ids.map((id, i) => prisma.page.updateMany({ where: { id }, data: { sortOrder: i } })))
  res.json({ ok: true })
}))

// GET /api/admin/pages/:id
router.get('/admin/pages/:id', requireAdmin, asyncRoute(async (req, res) => {
  const page = await prisma.page.findUnique({ where: { id: req.params.id } })
  if (!page) throw new HttpError(404, 'Page not found')
  res.json(page)
}))

// POST /api/admin/pages
router.post('/admin/pages', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const data = parsePage(req.body, { creating: true })
  if (await prisma.page.findUnique({ where: { slug: data.slug } })) throw new HttpError(409, `A page at /pages/${data.slug} already exists`)
  const last = await prisma.page.findFirst({ orderBy: { sortOrder: 'desc' } })
  const page = await prisma.page.create({ data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } })
  await logAudit({ actor: req.user, action: 'page.create', entityType: 'Page', entityId: page.id, summary: `Created page "${page.title}"` })
  res.status(201).json(page)
}))

// PUT /api/admin/pages/:id
router.put('/admin/pages/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const current = await prisma.page.findUnique({ where: { id: req.params.id } })
  if (!current) throw new HttpError(404, 'Page not found')
  const data = parsePage(req.body, { creating: false })
  if (data.slug && data.slug !== current.slug && await prisma.page.findUnique({ where: { slug: data.slug } })) {
    throw new HttpError(409, `A page at /pages/${data.slug} already exists`)
  }
  const page = await prisma.page.update({ where: { id: current.id }, data })
  const what = data.isPublished !== undefined && data.isPublished !== current.isPublished
    ? (data.isPublished ? 'Published' : 'Unpublished')
    : 'Updated'
  await logAudit({ actor: req.user, action: 'page.update', entityType: 'Page', entityId: page.id, summary: `${what} page "${page.title}"` })
  res.json(page)
}))

// DELETE /api/admin/pages/:id
router.delete('/admin/pages/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const page = await prisma.page.findUnique({ where: { id: req.params.id } })
  if (!page) throw new HttpError(404, 'Page not found')
  await prisma.page.delete({ where: { id: page.id } })
  await logAudit({ actor: req.user, action: 'page.delete', entityType: 'Page', entityId: page.id, summary: `Deleted page "${page.title}"` })
  res.status(204).end()
}))

module.exports = router
