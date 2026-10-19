const { HttpError } = require('../middleware/errorHandler')

// Field parsers shared by the product form API and the CSV importer, so both
// accept exactly the same values.

const toSlug = (name) => String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function parseGstRate(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new HttpError(400, 'GST rate must be a percentage between 0 and 100')
  return rate
}

function parseHsnCode(value) {
  if (value === undefined) return undefined
  const code = String(value ?? '').trim()
  if (code && !/^\d{4,8}$/.test(code)) throw new HttpError(400, 'HSN code must be 4–8 digits')
  return code || null
}

function parseSku(value, label = 'SKU') {
  const sku = String(value ?? '').trim()
  if (!sku) return null
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(sku)) throw new HttpError(400, `${label} may only use letters, numbers, dots, dashes and underscores (max 40)`)
  return sku
}

function parseStock(value, label = 'Stock') {
  const n = Number(value ?? 0)
  if (!Number.isInteger(n) || n < 0) throw new HttpError(400, `${label} must be a whole number of 0 or more`)
  return n
}

function parsePublishAt(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Publish date is not a valid date')
  return d
}

module.exports = { toSlug, parseGstRate, parseHsnCode, parseSku, parseStock, parsePublishAt }
