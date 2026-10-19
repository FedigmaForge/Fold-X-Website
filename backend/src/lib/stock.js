// Stock bookkeeping. All functions take a Prisma client or transaction client
// (`db`) so callers can run them inside $transaction.
//
// `lines` is [{ productId, variantId?, quantity }]. A line with a variantId
// draws from that variant; otherwise from Product.stock. For products with
// variants, Product.stock is kept equal to the sum of their active variants'
// stock (see syncProductStock), so listings and low-stock checks can keep
// reading one number.

const lineKey = (l) => (l.variantId ? `v:${l.variantId}` : `p:${l.productId}`)

function sumLines(lines) {
  const totals = new Map()
  for (const l of lines) {
    if (!l.productId || !(l.quantity > 0)) continue
    const key = lineKey(l)
    const prev = totals.get(key)
    totals.set(key, { productId: l.productId, variantId: l.variantId || null, quantity: (prev?.quantity || 0) + l.quantity })
  }
  return [...totals.values()]
}

const variantLabel = (v) => [v.color, v.size].filter(Boolean).join(' / ')

async function syncProductStock(db, productId) {
  // Only while the product sells by variant. If every variant was removed (and
  // kept inactive just for order history), Product.stock is managed directly.
  const active = await db.productVariant.findMany({ where: { productId, isActive: true }, select: { stock: true } })
  if (active.length === 0) return
  const total = active.reduce((s, v) => s + v.stock, 0)
  await db.product.update({ where: { id: productId }, data: { stock: total } })
}

function recordMovements(db, rows) {
  if (rows.length === 0) return
  return db.stockMovement.createMany({ data: rows })
}

// Returns [{ productId, variantId, name, available, requested }] for every line
// that can't be fulfilled. Missing/unpublished products and variants count as 0.
async function findShortages(db, lines) {
  const shortages = []
  for (const line of sumLines(lines)) {
    const product = await db.product.findUnique({ where: { id: line.productId }, select: { name: true, stock: true, isActive: true } })
    let available = product?.isActive ? product.stock : 0
    let name = product?.name ?? 'An item'
    if (line.variantId) {
      const v = await db.productVariant.findUnique({ where: { id: line.variantId } })
      available = product?.isActive && v?.isActive && v.productId === line.productId ? v.stock : 0
      if (v) name = `${name} (${variantLabel(v)})`
    }
    if (available < line.quantity) shortages.push({ ...line, name, available, requested: line.quantity })
  }
  return shortages
}

// Subtracts stock. Each decrement is a conditional updateMany, so two
// simultaneous checkouts can't both take the last unit. If stock ran out after
// payment was captured, the order must still go through: stock is floored at 0
// and a description is returned so the caller can flag the order as oversold.
async function deductStock(db, lines, { orderId = null, actorName = null, reason = 'sale' } = {}) {
  const oversold = []
  const movements = []
  const touched = new Set()
  for (const line of sumLines(lines)) {
    const qty = line.quantity
    if (line.variantId) {
      const { count } = await db.productVariant.updateMany({
        where: { id: line.variantId, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      })
      let taken = qty
      if (count === 0) {
        const v = await db.productVariant.findUnique({ where: { id: line.variantId }, include: { product: { select: { name: true } } } })
        if (!v) continue
        oversold.push(`${v.product.name} (${variantLabel(v)}) — needed ${qty}, had ${v.stock}`)
        taken = v.stock
        await db.productVariant.update({ where: { id: v.id }, data: { stock: 0 } })
      }
      touched.add(line.productId)
      if (taken) movements.push({ productId: line.productId, variantId: line.variantId, change: -taken, reason, orderId, actorName })
    } else {
      const { count } = await db.product.updateMany({
        where: { id: line.productId, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      })
      let taken = qty
      if (count === 0) {
        const p = await db.product.findUnique({ where: { id: line.productId }, select: { name: true, stock: true } })
        if (!p) continue
        oversold.push(`${p.name} — needed ${qty}, had ${p.stock}`)
        taken = p.stock
        await db.product.update({ where: { id: line.productId }, data: { stock: 0 } })
      }
      if (taken) movements.push({ productId: line.productId, variantId: null, change: -taken, reason, orderId, actorName })
    }
  }
  for (const productId of touched) await syncProductStock(db, productId)
  await recordMovements(db, movements)
  return oversold
}

async function restoreStock(db, lines, { orderId = null, actorName = null, reason = 'cancel', note = null } = {}) {
  const movements = []
  const touched = new Set()
  for (const line of sumLines(lines)) {
    if (line.variantId) {
      // updateMany so a since-deleted variant is skipped instead of throwing
      const { count } = await db.productVariant.updateMany({ where: { id: line.variantId }, data: { stock: { increment: line.quantity } } })
      if (!count) continue
      touched.add(line.productId)
    } else {
      const { count } = await db.product.updateMany({ where: { id: line.productId }, data: { stock: { increment: line.quantity } } })
      if (!count) continue
    }
    movements.push({ productId: line.productId, variantId: line.variantId, change: line.quantity, reason, orderId, actorName, note })
  }
  for (const productId of touched) await syncProductStock(db, productId)
  await recordMovements(db, movements)
}

function shortageMessage(shortages) {
  return shortages
    .map((s) => (s.available === 0 ? `${s.name} is out of stock` : `Only ${s.available} left of ${s.name}`))
    .join('. ')
}

module.exports = { findShortages, deductStock, restoreStock, shortageMessage, syncProductStock, recordMovements, variantLabel }
