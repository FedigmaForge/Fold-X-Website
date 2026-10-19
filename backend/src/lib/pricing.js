const { HttpError } = require('../middleware/errorHandler')
const { isProductVisible } = require('./visibility')
const { variantLabel } = require('./stock')
const { chooseDiscount } = require('./discounts')
const { codEligibility } = require('./customers')

const MAX_QTY_PER_LINE = 20
const round2 = (n) => Math.round(n * 100) / 100

// Products without variants can still show a colour choice (it doesn't affect
// price or stock) — keep it as a short plain-text label for the packer.
function displayOnlyVariant(v) {
  const out = {}
  for (const k of ['color', 'size']) {
    if (typeof v?.[k] === 'string' && v[k].trim()) out[k] = v[k].trim().slice(0, 40)
  }
  return out
}

async function getSettings(db) {
  return (await db.settings.findUnique({ where: { id: 1 } })) ?? { freeShippingThreshold: 999, flatShippingFee: 99, giftWrapFee: 149, codEnabled: false, codFee: 0, codMaxOrder: 0, codMaxRefusals: 2, codMaxOpen: 2 }
}

// Works out an order entirely from the database. The client only says WHAT it
// wants (product, variant, quantity, gift wrap) — prices, fees and totals sent
// by the browser are ignored, so they can't be tampered with.
//
// items: [{ product: { id }, quantity, variantId?, variant?: { color, size } }]
// (variant colour/size is accepted as a fallback for carts saved before
// variant ids existed)
async function quoteOrder(db, { items, giftWrap = false, couponCode = null, email = null, paymentMethod = 'online' }) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your bag is empty')
  if (items.length > 50) throw new HttpError(400, 'Too many items in one order')

  const lines = []
  for (const item of items) {
    const productId = item?.product?.id ?? item?.productId
    const quantity = Number(item?.quantity)
    if (!productId) throw new HttpError(400, 'An item in your bag is missing its product')
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) {
      throw new HttpError(400, `Quantity must be between 1 and ${MAX_QTY_PER_LINE}`)
    }

    const product = await db.product.findUnique({ where: { id: productId }, include: { variants: { where: { isActive: true } } } })
    if (!isProductVisible(product)) throw new HttpError(409, 'An item in your bag is no longer available. Please remove it and try again.')

    let variant = null
    if (product.variants.length) {
      const wanted = item.variant ?? {}
      variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : product.variants.find((v) => v.color === (wanted.color ?? '') && v.size === (wanted.size ?? ''))
      if (!variant) throw new HttpError(409, `Please choose an available option for ${product.name}`)
    }

    lines.push({
      productId: product.id,
      categoryId: product.categoryId,
      variantId: variant?.id ?? null,
      quantity,
      unitPrice: product.price,
      variantDisplay: variant
        ? { ...(variant.color && { color: variant.color }), ...(variant.size && { size: variant.size }) }
        : displayOnlyVariant(item.variant),
      // Frozen copy for the order: what was bought, at what price and tax class
      snapshot: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        originalPrice: product.originalPrice,
        images: (product.images ?? []).slice(0, 1),
        category: product.category,
        hsnCode: product.hsnCode,
        gstRate: product.gstRate,
        sku: variant?.sku ?? product.sku ?? null,
        variant: variant ? variantLabel(variant) : null,
        costPrice: product.costPrice ?? null, // for the profit view; stripped from customer-facing responses
      },
    })
  }

  const settings = await getSettings(db)
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  // Free-shipping threshold is judged on the subtotal before any discount
  let shipping = subtotal >= settings.freeShippingThreshold ? 0 : settings.flatShippingFee
  const giftWrapFee = giftWrap ? settings.giftWrapFee : 0

  const { applied, couponError, couponNotice } = await chooseDiscount(db, { lines, subtotal, shipping, code: couponCode, email })
  const discount = applied?.discount ?? 0
  if (applied?.freeShipping) shipping = 0
  // Each line keeps its share of the discount so the invoice taxes the
  // amount actually paid
  lines.forEach((l, i) => { l.snapshot.lineDiscount = applied?.lineDiscounts[i] ?? 0 })

  // Cash on delivery: offered only when eligible, and adds its fee
  const beforeCod = round2(subtotal - discount + shipping + giftWrapFee)
  const cod = await codEligibility(db, { email, orderTotal: beforeCod, settings })
  const wantsCod = paymentMethod === 'cod' && cod.available
  const codFee = wantsCod ? settings.codFee : 0

  return {
    lines,
    subtotal,
    discount,
    discountCode: applied?.coupon.code ?? null,
    discountLabel: applied ? (applied.coupon.description || applied.coupon.code) : null,
    discountIsAutomatic: applied?.coupon.isAutomatic ?? false,
    couponId: applied?.coupon.id ?? null,
    couponError,
    couponNotice,
    shipping,
    giftWrapFee,
    codFee,
    paymentMethod: wantsCod ? 'cod' : 'online',
    codAvailable: cod.available,
    codReason: cod.reason,
    codFeeSetting: settings.codEnabled ? settings.codFee : 0,
    total: round2(beforeCod + codFee),
  }
}

module.exports = { quoteOrder }
