const { HttpError } = require('../middleware/errorHandler')

// Free leather customisation: Settings.customLeathers is a comma-separated
// list (a Json default can't be declared on SQLite), so it's parsed here.

const MAX_LEATHERS = 12

function parseLeathers(text) {
  const seen = new Set()
  const out = []
  for (const raw of String(text ?? '').split(/[,\n]/)) {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push(name)
  }
  return out
}

// Admin input → stored text; refuses lists the storefront couldn't show
function cleanLeathers(value) {
  const list = parseLeathers(Array.isArray(value) ? value.join(',') : value)
  if (list.length > MAX_LEATHERS) throw new HttpError(400, `Offer at most ${MAX_LEATHERS} leathers`)
  if (list.some((n) => n.length > 40)) throw new HttpError(400, 'Leather names must be 40 characters or fewer')
  return list.join(', ')
}

// The leather a shopper picked for a line, checked against what the store and
// this product currently offer. Returns null when no change was asked for.
function resolveLeather(requested, { product, settings }) {
  const wanted = typeof requested === 'string' ? requested.trim() : ''
  if (!wanted) return null
  if (!settings.customisationEnabled || !product.allowCustomisation) {
    throw new HttpError(409, `Leather customisation is no longer offered on ${product.name}. Please remove it from your bag and add it again.`)
  }
  const match = parseLeathers(settings.customLeathers).find((n) => n.toLowerCase() === wanted.toLowerCase())
  if (!match) throw new HttpError(409, `"${wanted}" is no longer one of our leathers. Please choose another for ${product.name}.`)
  return match
}

module.exports = { parseLeathers, cleanLeathers, resolveLeather }
