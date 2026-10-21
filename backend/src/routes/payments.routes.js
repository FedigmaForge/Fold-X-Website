const { Router } = require('express')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const prisma = require('../lib/prisma')
const { findShortages, shortageMessage } = require('../lib/stock')
const { quoteOrder } = require('../lib/pricing')
const { isLive, getClient, verifySignature, assertCheckoutAvailable } = require('../lib/razorpay')
const { assertCanOrder } = require('../lib/customers')

const router = Router()

// Only what pricing needs from the request body
const quoteInput = (body) => ({
  items: body.items,
  giftWrap: !!body.giftWrap,
  couponCode: body.couponCode,
  email: body.email,
  paymentMethod: body.paymentMethod === 'cod' ? 'cod' : 'online',
})

// The public parts of a quote (lines stay server-side)
const quoteView = (q) => ({
  subtotal: q.subtotal,
  discount: q.discount,
  discountCode: q.discountCode,
  discountLabel: q.discountLabel,
  discountIsAutomatic: q.discountIsAutomatic,
  couponError: q.couponError,
  couponNotice: q.couponNotice,
  shipping: q.shipping,
  giftWrapFee: q.giftWrapFee,
  codFee: q.codFee,
  paymentMethod: q.paymentMethod,
  codAvailable: q.codAvailable,
  codReason: q.codReason,
  codFeeSetting: q.codFeeSetting,
  total: q.total,
})

// POST /api/orders/quote  { items, giftWrap, couponCode?, email? }
// Lets checkout show the exact amount the server will charge, including any
// discount (and why an entered code doesn't apply).
router.post('/orders/quote', asyncRoute(async (req, res) => {
  res.json(quoteView(await quoteOrder(prisma, quoteInput(req.body))))
}))

// POST /api/orders/create-razorpay-order  { items, giftWrap, couponCode?, email? }
// The amount is computed here from DB prices — any amount the client sends is
// ignored. Stock is checked before the customer is charged. Without Razorpay
// keys this returns a mock order id so checkout works in local dev.
router.post('/orders/create-razorpay-order', asyncRoute(async (req, res) => {
  assertCheckoutAvailable()
  await assertCanOrder(prisma, req.body.email)
  // Online payment only — COD orders skip Razorpay entirely
  const quote = await quoteOrder(prisma, { ...quoteInput(req.body), paymentMethod: 'online' })
  // Don't charge if the code they typed no longer works — they'd expect the discount
  if (quote.couponError) throw new HttpError(409, quote.couponError)
  const shortages = await findShortages(prisma, quote.lines)
  if (shortages.length) throw new HttpError(409, `${shortageMessage(shortages)}. Please update your bag.`)

  if (!isLive()) {
    console.warn('[payments] RAZORPAY_KEY_ID/SECRET not set — returning a mock order id')
    return res.json({ razorpayOrderId: `order_mock_${Date.now()}`, amount: quote.total, mock: true })
  }

  const order = await getClient().orders.create({
    amount: Math.round(quote.total * 100), // paise
    currency: 'INR',
    receipt: `receipt_${Date.now()}`,
  })
  res.json({ razorpayOrderId: order.id, amount: quote.total, mock: false })
}))

// POST /api/orders/verify-payment  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Optional early check for the checkout UI. POST /orders verifies again itself,
// so skipping this call can't be used to get an unpaid order.
router.post('/orders/verify-payment', asyncRoute(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
  if (!isLive()) return res.json({ verified: true, mock: true })
  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    throw new HttpError(400, 'Payment signature verification failed')
  }
  res.json({ verified: true, mock: false })
}))

module.exports = router
