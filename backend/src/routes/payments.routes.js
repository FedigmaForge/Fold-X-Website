const { Router } = require('express')
const crypto = require('crypto')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')

const router = Router()

function getRazorpayClient() {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null
  const Razorpay = require('razorpay')
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
}

// POST /api/orders/create-razorpay-order  { amount }
// Falls back to a mock order id when RAZORPAY_KEY_ID/SECRET aren't configured,
// so checkout works end-to-end in local dev without real payment credentials.
router.post('/orders/create-razorpay-order', asyncRoute(async (req, res) => {
  const { amount } = req.body
  if (!amount || amount <= 0) throw new HttpError(400, 'A positive amount is required')

  const client = getRazorpayClient()
  if (!client) {
    console.warn('[payments] RAZORPAY_KEY_ID/SECRET not set — returning a mock order id')
    return res.json({ razorpayOrderId: `order_mock_${Date.now()}`, mock: true })
  }

  const order = await client.orders.create({
    amount: Math.round(amount * 100), // paise
    currency: 'INR',
    receipt: `receipt_${Date.now()}`,
  })
  res.json({ razorpayOrderId: order.id, mock: false })
}))

// POST /api/orders/verify-payment  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/orders/verify-payment', asyncRoute(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

  const { RAZORPAY_KEY_SECRET } = process.env
  if (!RAZORPAY_KEY_SECRET || String(razorpay_order_id).startsWith('order_mock_')) {
    return res.json({ verified: true, mock: true })
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new HttpError(400, 'Missing Razorpay verification fields')
  }

  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  const verified = expected === razorpay_signature
  if (!verified) throw new HttpError(400, 'Payment signature verification failed')
  res.json({ verified: true, mock: false })
}))

module.exports = router
