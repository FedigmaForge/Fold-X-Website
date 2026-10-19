const { Router } = require('express')
const prisma = require('../lib/prisma')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { CATALOG_WRITE_ROLES } = require('../lib/roles')
const { csvToObjects, toCsv } = require('../lib/csv')
const { syncProductStock, recordMovements } = require('../lib/stock')
const { toSlug, parseGstRate, parseHsnCode, parseSku, parseStock, parsePublishAt } = require('../lib/productInput')

// Mounted before products.routes so "/admin/products/export.csv" isn't taken
// for a product id.
const router = Router()

// One row per variant (or one row for a product without variants). Product
// columns repeat on every row of the same handle; on import the first
// non-blank value wins.
const COLUMNS = [
  'handle', 'name', 'category_id', 'subcategory', 'price', 'mrp', 'cost_price', 'material', 'badge',
  'status', 'publish_at', 'featured', 'description', 'images', 'hsn_code', 'gst_rate',
  'low_stock_threshold', 'meta_title', 'meta_description',
  'variant_color', 'variant_size', 'variant_on_sale', 'sku', 'stock',
]
const MAX_ROWS = 5000
const yes = (v) => ['yes', 'y', 'true', '1'].includes(String(v).trim().toLowerCase())
const isBlank = (v) => v === undefined || v === null || String(v).trim() === ''

// GET /api/admin/products/export.csv
router.get('/admin/products/export.csv', requireAdmin, asyncRoute(async (req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'asc' },
    include: { variants: { orderBy: { sortOrder: 'asc' } } },
  })
  const rows = []
  for (const p of products) {
    const base = [
      p.slug, p.name, p.categoryId, p.subcategory ?? '', p.price, p.originalPrice ?? '', p.costPrice ?? '', p.material ?? '', p.badge ?? '',
      p.isActive ? 'published' : 'draft', p.publishAt ? p.publishAt.toISOString() : '', p.isFeatured ? 'yes' : 'no',
      p.description, (p.images ?? []).join(' | '), p.hsnCode ?? '', p.gstRate ?? '',
      p.lowStockThreshold, p.metaTitle, p.metaDescription,
    ]
    if (p.variants.length === 0) rows.push([...base, '', '', '', p.sku ?? '', p.stock])
    for (const v of p.variants) rows.push([...base, v.color, v.size, v.isActive ? 'yes' : 'no', v.sku ?? '', v.stock])
  }
  await logAudit({ actor: req.user, action: 'product.export', entityType: 'Product', summary: `Exported ${products.length} products to CSV` })
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="foldx-products-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(toCsv(COLUMNS, rows))
}))

// Turns one handle's rows into { fields, variants, plain } or throws HttpError
// with a message for the offending line.
function buildGroup(handle, rows, { existing, categories }) {
  const first = (col) => rows.find((r) => !isBlank(r.data[col]))?.data[col]
  const at = (line, fn) => {
    try { return fn() } catch (err) { throw Object.assign(err, { line }) }
  }
  const line0 = rows[0].line
  const fields = {}

  at(line0, () => {
    const name = first('name')
    if (name) fields.name = name.slice(0, 200)
    const categoryId = first('category_id')
    if (categoryId) {
      const cat = categories.get(categoryId)
      if (!cat) throw new HttpError(400, `Unknown category_id "${categoryId}"`)
      fields.categoryId = cat.id
      fields.category = cat.name
    }
    const sub = first('subcategory')
    if (sub) {
      const cat = categories.get(fields.categoryId ?? existing?.categoryId)
      if (cat && !(cat.sub ?? []).includes(sub)) throw new HttpError(400, `Subcategory "${sub}" isn't listed under ${cat.name}`)
      fields.subcategory = sub
    }
    const price = first('price')
    if (price !== undefined) {
      fields.price = Number(price)
      if (!(fields.price > 0)) throw new HttpError(400, 'price must be greater than 0')
    }
    const mrp = first('mrp')
    if (mrp !== undefined) {
      fields.originalPrice = Number(mrp)
      if (!(fields.originalPrice > 0)) throw new HttpError(400, 'mrp must be greater than 0')
    }
    const cost = first('cost_price')
    if (cost !== undefined) {
      fields.costPrice = Number(cost)
      if (!(fields.costPrice >= 0)) throw new HttpError(400, 'cost_price must be 0 or more')
    }
    const p = fields.price ?? existing?.price
    const m = fields.originalPrice ?? existing?.originalPrice
    if (p && m && m > p) fields.discount = Math.round(((m - p) / m) * 100)
    for (const [col, key, max] of [['material', 'material', 200], ['badge', 'badge', 40], ['description', 'description', 5000], ['meta_title', 'metaTitle', 70], ['meta_description', 'metaDescription', 170]]) {
      const v = first(col)
      if (v !== undefined) {
        if (v.length > max) throw new HttpError(400, `${col} is too long (max ${max})`)
        fields[key] = v
      }
    }
    const status = first('status')
    if (status !== undefined) {
      if (!['published', 'draft'].includes(status.toLowerCase())) throw new HttpError(400, 'status must be "published" or "draft"')
      fields.isActive = status.toLowerCase() === 'published'
    }
    const publishAt = first('publish_at'); if (publishAt !== undefined) fields.publishAt = parsePublishAt(publishAt)
    const featured = first('featured'); if (featured !== undefined) fields.isFeatured = yes(featured)
    const images = first('images')
    if (images !== undefined) {
      fields.images = images.split('|').map((u) => u.trim()).filter(Boolean)
      if (fields.images.some((u) => !/^https?:\/\//i.test(u))) throw new HttpError(400, 'images must be http(s) URLs separated by |')
    }
    const hsn = first('hsn_code'); if (hsn !== undefined) fields.hsnCode = parseHsnCode(hsn)
    const gst = first('gst_rate'); if (gst !== undefined) fields.gstRate = parseGstRate(gst)
    const low = first('low_stock_threshold'); if (low !== undefined) fields.lowStockThreshold = parseStock(low, 'low_stock_threshold')

    if (!existing) {
      if (!fields.name) throw new HttpError(400, 'name is required for a new product')
      if (!fields.price) throw new HttpError(400, 'price is required for a new product')
      if (!fields.categoryId) throw new HttpError(400, 'category_id is required for a new product')
    }
  })

  const variantRows = rows.filter((r) => !isBlank(r.data.variant_color) || !isBlank(r.data.variant_size))
  const plainRows = rows.filter((r) => !variantRows.includes(r))
  const seen = new Set()
  const variants = variantRows.map((r) => at(r.line, () => {
    const color = r.data.variant_color ?? ''
    const size = r.data.variant_size ?? ''
    if (color.length > 40 || size.length > 40) throw new HttpError(400, 'variant colour/size must be 40 characters or fewer')
    const key = `${color.toLowerCase()}|${size.toLowerCase()}`
    if (seen.has(key)) throw new HttpError(400, `Variant "${[color, size].filter(Boolean).join(' / ')}" appears twice`)
    seen.add(key)
    return {
      line: r.line, color, size,
      sku: isBlank(r.data.sku) ? undefined : parseSku(r.data.sku),
      stock: isBlank(r.data.stock) ? undefined : parseStock(r.data.stock),
      isActive: isBlank(r.data.variant_on_sale) ? undefined : yes(r.data.variant_on_sale),
    }
  }))

  let plain = null
  if (variants.length === 0 && plainRows.length) {
    const r = plainRows.find((x) => !isBlank(x.data.sku) || !isBlank(x.data.stock)) ?? plainRows[0]
    plain = at(r.line, () => ({
      sku: isBlank(r.data.sku) ? undefined : parseSku(r.data.sku),
      stock: isBlank(r.data.stock) ? undefined : parseStock(r.data.stock),
    }))
    if (!existing && plain.stock === undefined) plain.stock = 0
  }
  return { handle, line: line0, fields, variants, plain }
}

// POST /api/admin/products/import  { csv, dryRun }
// Always validates the whole file first. Any error → nothing is written and
// the errors are returned. dryRun → returns the plan without writing.
router.post('/admin/products/import', requireRole(...CATALOG_WRITE_ROLES), asyncRoute(async (req, res) => {
  let parsed
  try {
    parsed = csvToObjects(req.body.csv)
  } catch (err) {
    throw new HttpError(400, `Couldn't read the file: ${err.message}`)
  }
  const { headers, records } = parsed
  if (!headers.includes('handle') && !headers.includes('name')) throw new HttpError(400, 'The file needs a "handle" or "name" column — start from an export to get the right columns')
  if (records.length === 0) throw new HttpError(400, 'The file has no product rows')
  if (records.length > MAX_ROWS) throw new HttpError(400, `Too many rows (max ${MAX_ROWS})`)
  const unknown = headers.filter((h) => h && !COLUMNS.includes(h))

  const categories = new Map((await prisma.category.findMany()).map((c) => [c.id, c]))
  const groups = new Map()
  const errors = []
  for (const r of records) {
    const handle = toSlug(r.data.handle || r.data.name || '')
    if (!handle) { errors.push({ line: r.line, message: 'Row needs a handle or name' }); continue }
    if (!groups.has(handle)) groups.set(handle, [])
    groups.get(handle).push(r)
  }

  const existingBySlug = new Map(
    (await prisma.product.findMany({ where: { slug: { in: [...groups.keys()] } }, include: { variants: true } })).map((p) => [p.slug, p])
  )

  const plan = []
  for (const [handle, rows] of groups) {
    const existing = existingBySlug.get(handle)
    try {
      const g = buildGroup(handle, rows, { existing, categories })
      g.existing = existing
      if (existing && g.plain && existing.variants.some((v) => v.isActive)) {
        throw Object.assign(new HttpError(400, 'This product sells by variant — give each row a variant_color/variant_size'), { line: g.line })
      }
      plan.push(g)
    } catch (err) {
      errors.push({ line: err.line ?? rows[0].line, message: err.message })
    }
  }

  // SKUs must be unique across the whole catalogue, not just within the file
  const skuOwners = new Map()
  for (const g of plan) {
    for (const v of [...g.variants, ...(g.plain ? [g.plain] : [])]) {
      if (!v.sku) continue
      if (skuOwners.has(v.sku) && skuOwners.get(v.sku) !== `${g.handle}|${v.color ?? ''}|${v.size ?? ''}`) {
        errors.push({ line: v.line ?? g.line, message: `SKU "${v.sku}" is used more than once in the file` })
      }
      skuOwners.set(v.sku, `${g.handle}|${v.color ?? ''}|${v.size ?? ''}`)
    }
  }
  if (skuOwners.size) {
    const [prodSkus, varSkus] = await Promise.all([
      prisma.product.findMany({ where: { sku: { in: [...skuOwners.keys()] } }, select: { slug: true, sku: true } }),
      prisma.productVariant.findMany({ where: { sku: { in: [...skuOwners.keys()] } }, select: { sku: true, color: true, size: true, product: { select: { slug: true } } } }),
    ])
    for (const p of prodSkus) {
      if (skuOwners.get(p.sku) !== `${p.slug}||`) errors.push({ line: null, message: `SKU "${p.sku}" already belongs to product "${p.slug}"` })
    }
    for (const v of varSkus) {
      if (skuOwners.get(v.sku) !== `${v.product.slug}|${v.color}|${v.size}`) errors.push({ line: null, message: `SKU "${v.sku}" already belongs to a variant of "${v.product.slug}"` })
    }
  }

  const summary = {
    rows: records.length,
    create: plan.filter((g) => !g.existing).length,
    update: plan.filter((g) => g.existing).length,
    variants: plan.reduce((s, g) => s + g.variants.length, 0),
  }
  const preview = plan.slice(0, 200).map((g) => ({
    handle: g.handle,
    name: g.fields.name ?? g.existing?.name,
    action: g.existing ? 'update' : 'create',
    variants: g.variants.length,
  }))
  errors.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
  if (errors.length || req.body.dryRun) {
    return res.status(errors.length ? 422 : 200).json({ dryRun: true, summary, preview, errors, ignoredColumns: unknown })
  }

  const actor = req.user.name
  await prisma.$transaction(async (tx) => {
    for (const g of plan) {
      const movements = []
      let productId
      if (g.existing) {
        productId = g.existing.id
        if (Object.keys(g.fields).length) await tx.product.update({ where: { id: productId }, data: g.fields })
      } else {
        const created = await tx.product.create({
          data: { slug: g.handle, colors: [], features: [], images: [], description: '', ...g.fields },
        })
        productId = created.id
      }

      if (g.plain) {
        const data = {}
        if (g.plain.sku !== undefined) data.sku = g.plain.sku
        if (g.plain.stock !== undefined) data.stock = g.plain.stock
        if (Object.keys(data).length) await tx.product.update({ where: { id: productId }, data })
        const before = g.existing?.stock ?? 0
        if (g.plain.stock !== undefined && g.plain.stock !== before) {
          movements.push({ productId, change: g.plain.stock - before, reason: 'import', actorName: actor })
        }
      }

      if (g.variants.length) {
        const current = g.existing?.variants ?? []
        let order = current.length
        for (const v of g.variants) {
          const match = current.find((c) => c.color === v.color && c.size === v.size)
          if (match) {
            const data = {}
            if (v.sku !== undefined) data.sku = v.sku
            if (v.stock !== undefined) data.stock = v.stock
            if (v.isActive !== undefined) data.isActive = v.isActive
            if (Object.keys(data).length) await tx.productVariant.update({ where: { id: match.id }, data })
            if (v.stock !== undefined && v.stock !== match.stock) {
              movements.push({ productId, variantId: match.id, change: v.stock - match.stock, reason: 'import', actorName: actor })
            }
          } else {
            const created = await tx.productVariant.create({
              data: { productId, color: v.color, size: v.size, sku: v.sku ?? null, stock: v.stock ?? 0, isActive: v.isActive ?? true, sortOrder: order++ },
            })
            if (created.stock) movements.push({ productId, variantId: created.id, change: created.stock, reason: 'import', note: 'New variant', actorName: actor })
          }
        }
        const all = await tx.productVariant.findMany({ where: { productId, isActive: true } })
        await tx.product.update({ where: { id: productId }, data: { colors: [...new Set(all.map((x) => x.color).filter(Boolean))] } })
        await syncProductStock(tx, productId)
      }
      await recordMovements(tx, movements)
    }
  }, { timeout: 60000 })

  await logAudit({ actor: req.user, action: 'product.import', entityType: 'Product', summary: `Imported products from CSV: ${summary.create} created, ${summary.update} updated` })
  res.json({ dryRun: false, summary, preview, errors: [], ignoredColumns: unknown })
}))

module.exports = router
