const { HttpError } = require('../middleware/errorHandler')

// Customers are identified by email (lower-cased) so guests and registered
// accounts share one profile and one order history.
const normaliseEmail = (email) => String(email ?? '').trim().toLowerCase()

const DEFAULT_PROFILE = { notes: '', tags: [], isBlocked: false, blockReason: '', codDisabled: false }

async function getProfile(db, email) {
  const key = normaliseEmail(email)
  if (!key) return { email: key, ...DEFAULT_PROFILE }
  return (await db.customerProfile.findUnique({ where: { email: key } })) ?? { email: key, ...DEFAULT_PROFILE }
}

// Orders whose email matches, ignoring case. SQLite's `contains` is a
// case-insensitive LIKE, so it's narrowed with an exact check in JS.
async function ordersForEmail(db, email, select) {
  const key = normaliseEmail(email)
  if (!key) return []
  const rows = await db.order.findMany({ where: { customerEmail: { contains: key } }, select: { ...select, customerEmail: true } })
  return rows.filter((o) => o.customerEmail.toLowerCase() === key)
}

async function assertCanOrder(db, email) {
  const profile = await getProfile(db, email)
  if (profile.isBlocked) {
    throw new HttpError(403, "We're unable to accept orders from this account. Please contact us if you think this is a mistake.")
  }
}

// Whether cash on delivery can be offered. Returns { available, reason } where
// reason is a sentence the shopper can read.
async function codEligibility(db, { email, orderTotal, settings }) {
  if (!settings?.codEnabled) return { available: false, reason: 'Cash on delivery isn’t available right now' }
  if (orderTotal > settings.codMaxOrder) {
    return { available: false, reason: `Cash on delivery is available on orders up to ₹${settings.codMaxOrder.toLocaleString('en-IN')}` }
  }
  if (!normaliseEmail(email)) return { available: true, reason: null } // checked again once the email is known
  const profile = await getProfile(db, email)
  if (profile.isBlocked || profile.codDisabled) return { available: false, reason: 'Cash on delivery isn’t available for this account' }

  const history = await ordersForEmail(db, email, { paymentMethod: true, codRefused: true, status: true })
  const cod = history.filter((o) => o.paymentMethod === 'cod')
  if (cod.filter((o) => o.codRefused).length >= settings.codMaxRefusals) {
    return { available: false, reason: 'Cash on delivery isn’t available for this account — please pay online' }
  }
  if (cod.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length >= settings.codMaxOpen) {
    return { available: false, reason: 'You already have cash-on-delivery orders on the way — please pay online for this one' }
  }
  return { available: true, reason: null }
}

module.exports = { normaliseEmail, getProfile, ordersForEmail, assertCanOrder, codEligibility, DEFAULT_PROFILE }
