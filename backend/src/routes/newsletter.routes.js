const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { toCsv } = require('../lib/csv')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')

const router = Router()

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Same in-memory throttle as the contact form: 5 sign-ups per IP per 10 minutes
const recent = new Map()
function throttled(ip) {
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000)
  if (hits.length >= 5) return true
  hits.push(now)
  recent.set(ip, hits)
  return false
}

// POST /api/newsletter  { email, website? } — signing up twice is not an error
router.post('/newsletter', asyncRoute(async (req, res) => {
  // Honeypot, as on the contact form: pretend it worked
  if (req.body.website) return res.status(201).json({ ok: true })
  if (throttled(req.ip)) throw new HttpError(429, 'Too many attempts — please try again in a few minutes')

  const email = String(req.body.email ?? '').trim().toLowerCase().slice(0, 120)
  if (!EMAIL.test(email)) throw new HttpError(400, 'Please enter a valid email address')

  await prisma.newsletterSubscriber.upsert({ where: { email }, create: { email }, update: {} })
  res.status(201).json({ ok: true })
}))

// GET /api/admin/newsletter — newest first
router.get('/admin/newsletter', requireAdmin, asyncRoute(async (req, res) => {
  res.json(await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 }))
}))

// GET /api/admin/newsletter/export.csv — declared before /:id
router.get('/admin/newsletter/export.csv', requireAdmin, asyncRoute(async (req, res) => {
  const subs = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' } })
  const csv = toCsv(['Email', 'Signed up', 'Source'], subs.map((s) => [s.email, s.createdAt.toISOString(), s.source]))
  await logAudit({ actor: req.user, action: 'newsletter.export', entityType: 'NewsletterSubscriber', summary: `Exported ${subs.length} newsletter subscribers` })
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="foldx-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(csv)
}))

// DELETE /api/admin/newsletter/:id — e.g. when someone asks to be removed
router.delete('/admin/newsletter/:id', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const sub = await prisma.newsletterSubscriber.findUnique({ where: { id: req.params.id } })
  if (!sub) throw new HttpError(404, 'Subscriber not found')
  await prisma.newsletterSubscriber.delete({ where: { id: sub.id } })
  await logAudit({ actor: req.user, action: 'newsletter.delete', entityType: 'NewsletterSubscriber', entityId: sub.id, summary: `Removed newsletter subscriber ${sub.email}` })
  res.status(204).end()
}))

module.exports = router
