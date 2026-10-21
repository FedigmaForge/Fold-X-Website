// A product is visible on the storefront when it's published (isActive) and
// either has no scheduled publish time or that time has passed. Hiding a
// category only removes it from menus/filters — its products stay reachable
// through search and direct links.
function visibleProductWhere(now = new Date()) {
  return { isActive: true, OR: [{ publishAt: null }, { publishAt: { lte: now } }] }
}

function isProductVisible(product, now = new Date()) {
  return !!product?.isActive && (!product.publishAt || new Date(product.publishAt) <= now)
}

module.exports = { visibleProductWhere, isProductVisible }
