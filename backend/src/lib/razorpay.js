const crypto = require('crypto')

// Live mode = both keys configured. Without them checkout runs in mock mode
// (no real money), which is only acceptable for local development.
function isLive() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

// Mock payments hand out orders without money changing hands — fine on a dev
// machine, never on a real deployment. Throws in production without keys.
function assertCheckoutAvailable() {
  if (!isLive() && process.env.NODE_ENV === 'production') {
    const err = new Error('Payments are not configured. Please try again later.')
    err.status = 503
    throw err
  }
}

function getClient() {
  if (!isLive()) return null
  const Razorpay = require('razorpay')
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
}

function verifySignature(razorpayOrderId, paymentId, signature) {
  if (!razorpayOrderId || !paymentId || !signature) return false
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(String(signature))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

module.exports = { isLive, getClient, verifySignature, assertCheckoutAvailable }
