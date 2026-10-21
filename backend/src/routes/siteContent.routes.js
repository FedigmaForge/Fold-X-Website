const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')

const router = Router()

// ─── Validation ────────────────────────────────────────────────────────────────
// Content is rendered straight into the storefront, so every field is checked
// and rebuilt from scratch (unknown keys dropped) rather than stored as sent.

function text(value, field, { max = 120, required = true } = {}) {
  const str = typeof value === 'string' ? value.trim() : ''
  if (required && !str) throw new HttpError(400, `${field} is required`)
  if (str.length > max) throw new HttpError(400, `${field} must be ${max} characters or fewer`)
  return str
}

// Internal paths ("/products?...") or absolute http(s) URLs only — never
// javascript: or other schemes.
function link(value, field) {
  const str = text(value, field, { max: 300 })
  if (!str.startsWith('/') && !/^https?:\/\//i.test(str)) {
    throw new HttpError(400, `${field} must start with "/" or "https://"`)
  }
  if (str.startsWith('//')) throw new HttpError(400, `${field} must start with "/" or "https://"`)
  return str
}

function image(value, field) {
  const str = text(value, field, { max: 500 })
  if (!/^https?:\/\//i.test(str)) throw new HttpError(400, `${field} must be an http(s) image URL`)
  return str
}

function list(value, field, max) {
  if (!Array.isArray(value)) throw new HttpError(400, `${field} must be a list`)
  if (value.length > max) throw new HttpError(400, `${field} can have at most ${max} entries`)
  return value
}

// Optional link: blank stays blank
function optionalLink(value, field) {
  return value && String(value).trim() ? link(value, field) : ''
}

// Image + title + link tiles (category tiles, gifting banners, "moments" cards)
function tiles(v, field, max) {
  return list(v, field, max).map((tile, i) => {
    const n = `${field} ${i + 1}`
    return {
      label: text(tile?.label, `${n} title`, { max: 40 }),
      sub: text(tile?.sub, `${n} subtitle`, { max: 60, required: false }),
      href: link(tile?.href, `${n} link`),
      image: image(tile?.image, `${n} image`),
    }
  })
}

// Image-led banner with copy and a button (editorial, closing banner)
function bannerBlock(v) {
  return {
    image: image(v?.image, 'Image'),
    eyebrow: text(v?.eyebrow, 'Small heading', { max: 60, required: false }),
    title: text(v?.title, 'Title', { max: 80 }),
    body: text(v?.body, 'Body text', { max: 600, required: false }),
    ctaLabel: text(v?.ctaLabel, 'Button text', { max: 40 }),
    ctaHref: link(v?.ctaHref, 'Button link'),
  }
}

const VALIDATORS = {
  navMenu: (v) => list(v, 'Menu', 10).map((item, i) => {
    const n = `Menu item ${i + 1}`
    // The featured image is optional; when it's blank the menu drops down
    // with links only (or not at all, if there are no sub-links either)
    const hasFeatured = !!String(item?.featured?.image ?? '').trim()
    return {
      label: text(item?.label, `${n} label`, { max: 30 }),
      href: link(item?.href, `${n} link`),
      sub: list(item?.sub ?? [], `${n} sub-links`, 10).map((s, j) => ({
        label: text(s?.label, `${n} sub-link ${j + 1} label`, { max: 40 }),
        href: link(s?.href, `${n} sub-link ${j + 1} link`),
      })),
      featured: hasFeatured
        ? {
            image: image(item.featured.image, `${n} featured image`),
            label: text(item.featured.label, `${n} featured caption`, { max: 40 }),
            href: link(item.featured.href, `${n} featured link`),
          }
        : { image: '', label: '', href: '' },
    }
  }),

  announcements: (v) => list(v, 'Announcements', 6).map((a, i) => ({
    text: text(a?.text, `Announcement ${i + 1}`, { max: 120 }),
    href: optionalLink(a?.href, `Announcement ${i + 1} link`),
  })),

  homeTiles: (v) => tiles(v, 'Tile', 8),

  homeGifting: (v) => tiles(v, 'Gifting banner', 3),

  homeMoments: (v) => ({
    title: text(v?.title, 'Section title', { max: 60 }),
    items: tiles(v?.items ?? [], 'Card', 6),
  }),

  homeClosing: bannerBlock,

  homeTrending: (v) => tiles(v, 'Trending tile', 8),

  homeCommunity: (v) => ({
    title: text(v?.title, 'Section title', { max: 60 }),
    intro: text(v?.intro, 'Intro text', { max: 240, required: false }),
    handle: text(v?.handle, 'Handle', { max: 40, required: false }),
    href: optionalLink(v?.href, 'Profile link'),
    images: list(v?.images ?? [], 'Photos', 12).map((u, i) => image(u, `Photo ${i + 1}`)),
  }),

  categoryBanners: (v) => list(v, 'Category banners', 40).map((b, i) => {
    const n = `Banner ${i + 1}`
    const href = link(b?.link, `${n} page link`)
    if (!href.startsWith('/products')) throw new HttpError(400, `${n} page link must be a /products… listing link`)
    return {
      link: href,
      title: text(b?.title, `${n} title`, { max: 40 }),
      sub: text(b?.sub, `${n} subtitle`, { max: 80, required: false }),
      image: image(b?.image, `${n} image`),
    }
  }),

  giftStore: (v) => ({
    image: image(v?.image, 'Hero image'),
    eyebrow: text(v?.eyebrow, 'Small heading', { max: 60, required: false }),
    title: text(v?.title, 'Title', { max: 80 }),
    body: text(v?.body, 'Intro text', { max: 600, required: false }),
  }),

  footer: (v) => ({
    blurb: text(v?.blurb, 'About text', { max: 300, required: false }),
    shopLinks: list(v?.shopLinks ?? [], 'Shop links', 12).map((l, i) => ({
      label: text(l?.label, `Shop link ${i + 1} label`, { max: 40 }),
      href: link(l?.href, `Shop link ${i + 1} link`),
    })),
    social: list(v?.social ?? [], 'Social links', 6).map((s, i) => ({
      label: text(s?.label, `Social ${i + 1} name`, { max: 30 }),
      handle: text(s?.handle, `Social ${i + 1} handle`, { max: 40, required: false }),
      // Optional: without a URL the entry shows as plain text
      href: s?.href && String(s.href).trim() ? link(s.href, `Social ${i + 1} link`) : '',
    })),
  }),

  homeEditorial: bannerBlock,
}

const LABELS = {
  navMenu: 'navbar menu',
  announcements: 'announcement bar',
  homeTiles: 'homepage category tiles',
  homeGifting: 'homepage gifting banners',
  homeMoments: 'homepage "moments" cards',
  homeEditorial: 'homepage featured collection',
  homeClosing: 'homepage "your next stop" banner',
  homeTrending: 'homepage trending tiles',
  homeCommunity: 'homepage community photos',
  categoryBanners: 'category page banners',
  giftStore: 'gift store page',
  footer: 'footer',
}

function checkKey(key) {
  if (!VALIDATORS[key]) throw new HttpError(404, 'Unknown content section')
}

// GET /api/site-content — every saved section as { [key]: value }. Sections
// never saved are absent; the storefront uses its built-in defaults for those.
router.get('/site-content', asyncRoute(async (req, res) => {
  const rows = await prisma.siteContent.findMany()
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])))
}))

// PUT /api/admin/site-content/:key  { value }
router.put('/admin/site-content/:key', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const { key } = req.params
  checkKey(key)
  const value = VALIDATORS[key](req.body.value)
  await prisma.siteContent.upsert({ where: { key }, create: { key, value }, update: { value } })
  await logAudit({ actor: req.user, action: 'content.update', entityType: 'SiteContent', entityId: key, summary: `Updated the ${LABELS[key]}` })
  res.json(value)
}))

// DELETE /api/admin/site-content/:key — back to the built-in defaults
router.delete('/admin/site-content/:key', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  const { key } = req.params
  checkKey(key)
  await prisma.siteContent.deleteMany({ where: { key } })
  await logAudit({ actor: req.user, action: 'content.reset', entityType: 'SiteContent', entityId: key, summary: `Reset the ${LABELS[key]} to defaults` })
  res.status(204).end()
}))

module.exports = router
