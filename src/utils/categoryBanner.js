// Helpers for the listing-page category banners (see components/customer/CategoryBanner)

// Same slug rule as the backend's toSlug — subcategory names → ?type= values
export const toSlug = (name) => String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// "gender" and "category" both pick the category on listing pages
const KEY_ALIASES = { gender: 'category' }
const MATCH_KEYS = ['category', 'type', 'badge', 'sale', 'collection']

function filtersOf(params) {
  const out = {}
  for (const [k, v] of params) {
    const key = KEY_ALIASES[k] ?? k
    if (MATCH_KEYS.includes(key) && v) out[key] = v.toLowerCase()
  }
  return out
}

// The banner for a listing page: the one whose link matches the most of the
// page's filters (a bag type counts extra, so "Tote Bags" beats "Women" on
// /products?gender=women&type=tote-bags). "/products" alone matches anything.
export function pickBanner(banners, searchParams) {
  const page = filtersOf(searchParams)
  let best = null
  let bestScore = -1
  for (const b of banners ?? []) {
    const [path, query = ''] = b.link.split('?')
    if (path !== '/products') continue
    const want = filtersOf(new URLSearchParams(query))
    const keys = Object.keys(want)
    // ?type=luggage also covers "luggage-trolleys", like the product filter
    const ok = keys.every((k) => (k === 'type' ? page.type?.startsWith(want.type) : page[k] === want[k]))
    if (!ok) continue
    const score = keys.length + (want.type ? 0.5 : 0)
    if (score > bestScore) { best = b; bestScore = score }
  }
  return best
}
