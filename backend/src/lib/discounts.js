// Works out which discount an order gets. One discount per order: the code the
// customer entered, or the best automatic discount — whichever saves more.
//
// `lines` are pricing lines from quoteOrder ({ productId, categoryId,
// unitPrice, quantity }). All amounts are in rupees.

const PAID = ['paid', 'partially_refunded', 'refunded']
const round2 = (n) => Math.round(n * 100) / 100
const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const normaliseCode = (code) => String(code ?? '').trim().toUpperCase()

// Which lines a coupon applies to
function eligibleIndexes(coupon, lines) {
  const ids = Array.isArray(coupon.targetIds) ? coupon.targetIds : []
  return lines
    .map((l, i) => i)
    .filter((i) => {
      if (coupon.appliesTo === 'categories') return ids.includes(lines[i].categoryId)
      if (coupon.appliesTo === 'products') return ids.includes(lines[i].productId)
      return true
    })
}

// Splits a discount across lines in proportion to their value (the last line
// takes the rounding remainder) so per-item tax on the invoice is right.
function allocate(amount, lines, indexes) {
  const out = new Array(lines.length).fill(0)
  const base = indexes.reduce((s, i) => s + lines[i].unitPrice * lines[i].quantity, 0)
  if (!base || !amount) return out
  let left = amount
  indexes.forEach((i, k) => {
    const share = k === indexes.length - 1 ? left : round2((amount * lines[i].unitPrice * lines[i].quantity) / base)
    out[i] = share
    left = round2(left - share)
  })
  return out
}

// Checks every rule and returns either { ok: false, reason } (a sentence the
// shopper can read) or the discount it gives.
async function evaluate(db, coupon, { lines, subtotal, shipping, email, now = new Date() }) {
  if (!coupon || !coupon.isActive) return { ok: false, reason: "This code isn't valid" }
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, reason: "This code isn't active yet" }
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, reason: 'This code has expired' }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { ok: false, reason: 'This code has reached its usage limit' }
  if (subtotal < coupon.minSubtotal) return { ok: false, reason: `Add ${inr(coupon.minSubtotal - subtotal)} more to use this code (minimum ${inr(coupon.minSubtotal)})` }

  const mail = email ? String(email).trim().toLowerCase() : null
  if (mail && coupon.perCustomerLimit != null) {
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id, email: mail } })
    if (used >= coupon.perCustomerLimit) return { ok: false, reason: "You've already used this code" }
  }
  if (mail && coupon.firstOrderOnly) {
    // `contains` is a case-insensitive LIKE on SQLite; confirm exact match in JS
    const similar = await db.order.findMany({ where: { customerEmail: { contains: mail }, paymentStatus: { in: PAID } }, select: { customerEmail: true } })
    if (similar.some((o) => o.customerEmail.toLowerCase() === mail)) return { ok: false, reason: 'This code is for first orders only' }
  }

  const indexes = eligibleIndexes(coupon, lines)
  if (indexes.length === 0) return { ok: false, reason: "This code doesn't apply to the items in your bag" }
  const eligibleSubtotal = indexes.reduce((s, i) => s + lines[i].unitPrice * lines[i].quantity, 0)

  if (coupon.type === 'free_shipping') {
    if (!shipping) return { ok: false, reason: 'Your order already ships free' }
    return { ok: true, coupon, discount: 0, freeShipping: true, savings: shipping, lineDiscounts: new Array(lines.length).fill(0) }
  }

  let discount = coupon.type === 'percent' ? (eligibleSubtotal * coupon.value) / 100 : coupon.value
  if (coupon.type === 'percent' && coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount)
  // Whole rupees — the store shows prices without paise, so the total shown
  // must be exactly the amount charged
  discount = Math.round(Math.min(discount, eligibleSubtotal))
  if (discount <= 0) return { ok: false, reason: "This code doesn't apply to the items in your bag" }
  return { ok: true, coupon, discount, freeShipping: false, savings: discount, lineDiscounts: allocate(discount, lines, indexes) }
}

// Returns { applied, couponError, couponNotice }: applied is the winning
// evaluation (or null); couponError says why an entered code is unusable;
// couponNotice says a valid code lost to a better automatic discount.
async function chooseDiscount(db, { lines, subtotal, shipping, code, email }) {
  const now = new Date()
  const ctx = { lines, subtotal, shipping, email, now }
  let couponError = null
  let couponNotice = null
  const candidates = []

  const wanted = normaliseCode(code)
  if (wanted) {
    const coupon = await db.coupon.findUnique({ where: { code: wanted } })
    const result = coupon && !coupon.isAutomatic ? await evaluate(db, coupon, ctx) : { ok: false, reason: "This code isn't valid" }
    if (result.ok) candidates.push(result)
    else couponError = result.reason
  }

  const automatic = await db.coupon.findMany({ where: { isAutomatic: true, isActive: true } })
  for (const c of automatic) {
    const result = await evaluate(db, c, ctx)
    if (result.ok) candidates.push(result)
  }

  candidates.sort((a, b) => b.savings - a.savings)
  const applied = candidates[0] ?? null
  // The entered code was valid but an automatic discount beat it
  if (wanted && !couponError && applied && applied.coupon.code !== wanted) {
    couponNotice = `${wanted} saves less than the ${applied.coupon.description || 'automatic discount'} already applied`
  }
  return { applied, couponError, couponNotice }
}

module.exports = { chooseDiscount, evaluate, normaliseCode, PAID }
