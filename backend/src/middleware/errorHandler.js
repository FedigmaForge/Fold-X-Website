// Central error → JSON response mapping. Route handlers can `throw` a plain
// Error (500) or an Error with a `.status` property (e.g. 404, 400) attached.
function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route: ${req.method} ${req.path}` })
}

const FIELD_LABELS = { sku: 'SKU', slug: 'URL slug', email: 'email' }

function errorHandler(err, req, res, _next) {
  // Prisma unique-constraint violation (e.g. a duplicate SKU) → readable 409
  if (err.code === 'P2002') {
    const fields = [].concat(err.meta?.target ?? [])
    const label = fields.map((f) => FIELD_LABELS[f] || f).join(', ') || 'value'
    return res.status(409).json({ error: `That ${label} is already in use` })
  }
  const status = err.status || 500
  if (status === 500) console.error(err)
  res.status(status).json({ error: err.message || 'Internal server error' })
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

module.exports = { notFoundHandler, errorHandler, asyncRoute, HttpError }
