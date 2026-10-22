/**
 * API Service Layer
 * ------------------
 * Talks to the real Express/Prisma backend in backend/ over HTTP. Every
 * function here is a thin wrapper around a REST call — see backend/src/routes
 * for the actual implementation and development.md for the full endpoint list.
 *
 * The JWT (if any) is read directly from localStorage (where zustand's
 * `persist` middleware puts authStore's state) rather than importing
 * authStore itself — authStore's login actions call into this file, so
 * importing it back here would create a circular module dependency.
 */
// Empty string = same origin (production Docker build, where nginx proxies /api).
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

function getStoredToken() {
  try {
    const raw = localStorage.getItem('foldx-auth')
    return raw ? JSON.parse(raw)?.state?.token ?? null : null
  } catch {
    return null
  }
}

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {}
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isFormData && body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  })

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  // A token we sent was rejected → the session is over. Login endpoints are
  // excluded: a wrong password there is a normal 401, not an expired session.
  if (res.status === 401 && token && !path.includes('/auth/')) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    throw new Error('Your session has expired — please sign in again')
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

// Fired when the server rejects our token; authStore listens and signs out.
export const SESSION_EXPIRED_EVENT = 'foldx:session-expired'

function qs(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, v)
  })
  const str = search.toString()
  return str ? `?${str}` : ''
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export async function registerCustomer({ name, email, password, phone }) {
  // POST /api/auth/register
  return request('/auth/register', { method: 'POST', body: { name, email, password, phone } })
}

export async function loginCustomer(email, password) {
  // POST /api/auth/login
  return request('/auth/login', { method: 'POST', body: { email, password } })
}

export async function loginAdmin(email, password) {
  // POST /api/admin/auth/login → { user, token } | { twoFactorRequired, challenge } | { twoFactorSetupRequired, challenge }
  return request('/admin/auth/login', { method: 'POST', body: { email, password } })
}

// ─── Two-step login (staff) ────────────────────────────────────────────────────

export async function verifyAdmin2fa(challenge, code) {
  // POST /api/admin/auth/2fa → { user, token } (code = authenticator code or backup code)
  return request('/admin/auth/2fa', { method: 'POST', body: { challenge, code } })
}

export async function startForced2faSetup(challenge) {
  // POST /api/admin/auth/2fa/setup → { secret, otpauth, qr } — when the Super Admin requires two-step login
  return request('/admin/auth/2fa/setup', { method: 'POST', body: { challenge } })
}

export async function finishForced2faSetup(challenge, code) {
  // POST /api/admin/auth/2fa/enable → { user, token, backupCodes }
  return request('/admin/auth/2fa/enable', { method: 'POST', body: { challenge, code } })
}

export async function getMyAccount() {
  // GET /api/admin/account → { user, twoFactorEnabled, backupCodesRemaining, require2FA, logins }
  return request('/admin/account')
}

export async function start2faSetup() {
  // POST /api/admin/account/2fa/setup → { secret, otpauth, qr }
  return request('/admin/account/2fa/setup', { method: 'POST' })
}

export async function enable2fa(code) {
  // POST /api/admin/account/2fa/enable → { backupCodes }
  return request('/admin/account/2fa/enable', { method: 'POST', body: { code } })
}

export async function disable2fa(password, code) {
  // POST /api/admin/account/2fa/disable
  return request('/admin/account/2fa/disable', { method: 'POST', body: { password, code } })
}

export async function regenerateBackupCodes(code) {
  // POST /api/admin/account/2fa/backup-codes → { backupCodes }
  return request('/admin/account/2fa/backup-codes', { method: 'POST', body: { code } })
}

export async function resetStaff2fa(staffId) {
  // POST /api/admin/staff/:id/2fa/reset (Super Admin)
  return request(`/admin/staff/${encodeURIComponent(staffId)}/2fa/reset`, { method: 'POST' })
}

export async function getStaffLogins() {
  // GET /api/admin/security/logins (Super Admin)
  return request('/admin/security/logins')
}

// ─── Products ──────────────────────────────────────────────────────────────────

export async function getProducts({ category, type, collection, sale, search, sort, minPrice, maxPrice } = {}) {
  // GET /api/products — `type` is a subcategory slug, e.g. "tote-bags";
  // `collection` a collection id; `sale` = only items below their original price
  return request(`/products${qs({ category, type, collection, sale, search, sort, minPrice, maxPrice })}`)
}

export async function getLowStock() {
  // GET /api/admin/inventory/low-stock → [{ productId, productName, variant, sku, stock, threshold }]
  return request('/admin/inventory/low-stock')
}

export async function getStockHistory(productId) {
  // GET /api/admin/products/:id/stock-history → latest 100 movements
  return request(`/admin/products/${encodeURIComponent(productId)}/stock-history`)
}

export async function getAllProducts() {
  // GET /api/admin/products
  return request('/admin/products')
}

export async function getProductBySlug(slug) {
  // GET /api/products/:slug
  return request(`/products/${encodeURIComponent(slug)}`)
}

export async function getProductById(id) {
  // GET /api/admin/products/:id
  return request(`/admin/products/${encodeURIComponent(id)}`)
}

export async function getFeaturedProducts() {
  // GET /api/products/featured
  return request('/products/featured')
}

export async function createProduct(data) {
  // POST /api/admin/products
  return request('/admin/products', { method: 'POST', body: data })
}

export async function updateProduct(id, data) {
  // PUT /api/admin/products/:id
  return request(`/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: data })
}

export async function deleteProduct(id) {
  // DELETE /api/admin/products/:id
  return request(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function toggleProductActive(id) {
  // PATCH /api/admin/products/:id/toggle-active
  return request(`/admin/products/${encodeURIComponent(id)}/toggle-active`, { method: 'PATCH' })
}

// ─── Categories ────────────────────────────────────────────────────────────────

export async function getCategories() {
  // GET /api/categories — storefront: active only, in display order
  return request('/categories')
}

export async function getAdminCategories() {
  // GET /api/admin/categories — incl. hidden, with product counts + subUsage
  return request('/admin/categories')
}

export async function createCategory(data) {
  // POST /api/admin/categories  { id, name, image, sub, isActive }
  return request('/admin/categories', { method: 'POST', body: data })
}

export async function updateCategory(id, data) {
  // PUT /api/admin/categories/:id  { name?, image?, sub?, isActive? }
  return request(`/admin/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: data })
}

export async function deleteCategory(id) {
  // DELETE /api/admin/categories/:id — 409 while products use it
  return request(`/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function reorderCategories(ids) {
  // PUT /api/admin/categories/reorder  { ids }
  return request('/admin/categories/reorder', { method: 'PUT', body: { ids } })
}

// ─── Collections ───────────────────────────────────────────────────────────────

export async function getCollections() {
  // GET /api/collections — storefront: active only, in display order, with counts
  return request('/collections')
}

export async function getCollection(id) {
  // GET /api/collections/:id → { ...collection, products } or null when hidden/missing
  return request(`/collections/${encodeURIComponent(id)}`)
}

export async function getAdminCollections() {
  // GET /api/admin/collections — incl. hidden, with product counts
  return request('/admin/collections')
}

export async function createCollection(data) {
  // POST /api/admin/collections  { id, name, tagline, description, image, cardImage, isActive }
  return request('/admin/collections', { method: 'POST', body: data })
}

export async function updateCollection(id, data) {
  // PUT /api/admin/collections/:id
  return request(`/admin/collections/${encodeURIComponent(id)}`, { method: 'PUT', body: data })
}

export async function deleteCollection(id) {
  // DELETE /api/admin/collections/:id — its products leave the collection
  return request(`/admin/collections/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function reorderCollections(ids) {
  // PUT /api/admin/collections/reorder  { ids }
  return request('/admin/collections/reorder', { method: 'PUT', body: { ids } })
}

// ─── Newsletter ────────────────────────────────────────────────────────────────

export async function subscribeNewsletter(email, website = '') {
  // POST /api/newsletter  { email, website (honeypot) }
  return request('/newsletter', { method: 'POST', body: { email, website } })
}

export async function getSubscribers() {
  // GET /api/admin/newsletter
  return request('/admin/newsletter')
}

export async function deleteSubscriber(id) {
  // DELETE /api/admin/newsletter/:id
  return request(`/admin/newsletter/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function exportSubscribersCsv() {
  // GET /api/admin/newsletter/export.csv
  return downloadFile('/admin/newsletter/export.csv', 'subscribers.csv')
}

// ─── Banners ───────────────────────────────────────────────────────────────────

export async function getBanners() {
  // GET /api/banners (active only, sorted by order)
  return request('/banners')
}

export async function getAllBanners() {
  // GET /api/admin/banners
  return request('/admin/banners')
}

export async function saveBanner(banner) {
  // POST /api/admin/banners (creates or updates depending on whether `id` is present)
  return request('/admin/banners', { method: 'POST', body: banner })
}

export async function deleteBanner(id) {
  // DELETE /api/admin/banners/:id
  return request(`/admin/banners/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ─── Orders ────────────────────────────────────────────────────────────────────

export async function getOrders({ status, paymentStatus, paymentMethod, q, from, to, customised } = {}) {
  // GET /api/admin/orders?status=&paymentStatus=&paymentMethod=online|cod|cod_unconfirmed&q=&from=&to=&customised=1|open
  return request(`/admin/orders${qs({ status, paymentStatus, paymentMethod, q, from, to, customised })}`)
}

// Fetches an authenticated file and saves it. Done manually (not via
// request()) because the response is a file and needs the auth header, so a
// plain <a href> download won't work.
async function downloadFile(path, fallbackName) {
  const token = getStoredToken()
  const res = await fetch(`${API_URL}/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (res.status === 401 && token) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  if (!res.ok) throw new Error(`Export failed (${res.status})`)
  const blob = await res.blob()
  const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Finance ───────────────────────────────────────────────────────────────────

export async function getPayments(filters = {}) {
  // GET /api/admin/finance/payments?from&to&type&method&status → { totals, rows }
  return request(`/admin/finance/payments${qs(filters)}`)
}

export async function downloadPaymentsCsv(filters = {}) {
  // GET /api/admin/finance/payments.csv
  return downloadFile(`/admin/finance/payments.csv${qs(filters)}`, 'payments.csv')
}

export async function getSettlements() {
  // GET /api/admin/finance/settlements → { imports, overdue, live }
  return request('/admin/finance/settlements')
}

export async function importSettlementReport({ csv, fileName, paise }) {
  // POST /api/admin/finance/settlements/import → the import record (matched / unmatched lines)
  return request('/admin/finance/settlements/import', { method: 'POST', body: { csv, fileName, paise } })
}

export async function syncSettlements(date) {
  // POST /api/admin/finance/settlements/sync  { date } — needs live Razorpay keys
  return request('/admin/finance/settlements/sync', { method: 'POST', body: { date } })
}

export async function recordCodRemittance({ ids, reference, fee }) {
  // POST /api/admin/finance/cod-remittance
  return request('/admin/finance/cod-remittance', { method: 'POST', body: { ids, reference, fee } })
}

export async function getProfit({ from, to }) {
  // GET /api/admin/finance/profit?from&to
  return request(`/admin/finance/profit${qs({ from, to })}`)
}

// ─── Abandoned carts ───────────────────────────────────────────────────────────

export async function saveCheckoutCart({ token, email, name, phone, items }) {
  // POST /api/carts/checkout — saves the bag so it can be recovered if the shopper leaves
  return request('/carts/checkout', { method: 'POST', body: { token, email, name, phone, items } })
}

export async function recoverCart(token) {
  // GET /api/carts/recover/:token → { items, email, name, token }
  return request(`/carts/recover/${encodeURIComponent(token)}`)
}

export async function getAbandonedCarts(status = 'abandoned') {
  // GET /api/admin/carts?status=abandoned|recovered|all → { stats, carts }
  return request(`/admin/carts${qs({ status })}`)
}

export async function markCartReminded(id, channel) {
  // POST /api/admin/carts/:id/reminded
  return request(`/admin/carts/${encodeURIComponent(id)}/reminded`, { method: 'POST', body: { channel } })
}

export async function dismissCart(id) {
  // DELETE /api/admin/carts/:id
  return request(`/admin/carts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function downloadOrdersCsv(filters = {}) {
  // GET /api/admin/orders/export.csv
  return downloadFile(`/admin/orders/export.csv${qs(filters)}`, 'orders.csv')
}

export async function downloadProductsCsv() {
  // GET /api/admin/products/export.csv — one row per variant
  return downloadFile('/admin/products/export.csv', 'products.csv')
}

export async function importProductsCsv(csv, { dryRun }) {
  // POST /api/admin/products/import  { csv, dryRun } → { summary, preview, errors, ignoredColumns }
  // A file with errors comes back as 422 with the per-line errors, which the
  // caller needs to show — so this returns that body instead of throwing.
  const token = getStoredToken()
  const res = await fetch(`${API_URL}/api/admin/products/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ csv, dryRun }),
  })
  const data = await res.json().catch(() => null)
  if (res.status === 401 && token) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  if (res.status === 422 && data?.errors) return data
  if (!res.ok) throw new Error(data?.error || `Import failed (${res.status})`)
  return data
}

export async function getOrderById(id) {
  // GET /api/admin/orders/:id
  return request(`/admin/orders/${encodeURIComponent(id)}`)
}

export async function getMyOrders() {
  // GET /api/orders/mine — scoped server-side to the logged-in customer
  return request('/orders/mine')
}

export async function getOrderPublic(id) {
  // GET /api/orders/:id — public lookup used as a refresh-safe fallback on the
  // order confirmation page
  return request(`/orders/${encodeURIComponent(id)}`)
}

export async function updateOrderStatus(id, status, cancelReason, { codRefused } = {}) {
  // PUT /api/admin/orders/:id/status  { status, cancelReason?, codRefused? } → full order
  return request(`/admin/orders/${encodeURIComponent(id)}/status`, { method: 'PUT', body: { status, cancelReason, codRefused } })
}

export async function confirmCodOrder(id, note) {
  // POST /api/admin/orders/:id/cod/confirm  { note? } → full order (pending → processing)
  return request(`/admin/orders/${encodeURIComponent(id)}/cod/confirm`, { method: 'POST', body: { note } })
}

export async function updateOrderShipping(id, { courier, trackingNumber }) {
  // PUT /api/admin/orders/:id/shipping  { courier, trackingNumber } → full order
  return request(`/admin/orders/${encodeURIComponent(id)}/shipping`, { method: 'PUT', body: { courier, trackingNumber } })
}

export async function addOrderNote(id, note) {
  // POST /api/admin/orders/:id/notes  { note } → full order
  return request(`/admin/orders/${encodeURIComponent(id)}/notes`, { method: 'POST', body: { note } })
}

export async function refundOrder(id, { amount, reason }) {
  // POST /api/admin/orders/:id/refund  { amount, reason } → full order (manager/superadmin only)
  return request(`/admin/orders/${encodeURIComponent(id)}/refund`, { method: 'POST', body: { amount, reason } })
}

export async function placeOrder(orderData) {
  // POST /api/orders  { items, address, giftWrap, giftNote, razorpay_order_id, razorpay_payment_id, razorpay_signature }
  return request('/orders', { method: 'POST', body: orderData })
}

// ─── Payments (Razorpay) ───────────────────────────────────────────────────────

export async function getOrderQuote({ items, giftWrap, couponCode, email, paymentMethod }) {
  // POST /api/orders/quote → { subtotal, discount, discountLabel, couponError, couponNotice, shipping, giftWrapFee, total }
  // priced server-side, including the best discount (entered code or automatic)
  return request('/orders/quote', { method: 'POST', body: { items, giftWrap, couponCode, email, paymentMethod } })
}

export async function createRazorpayOrder({ items, giftWrap, couponCode, email }) {
  // POST /api/orders/create-razorpay-order  { items, giftWrap } → { razorpayOrderId, amount, mock }
  // The amount is computed by the server. 409 if anything is out of stock —
  // checked before the customer is charged.
  return request('/orders/create-razorpay-order', { method: 'POST', body: { items, giftWrap, couponCode, email } })
}

export async function verifyPayment(payload) {
  // POST /api/orders/verify-payment  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
  return request('/orders/verify-payment', { method: 'POST', body: payload })
}

// ─── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers({ q, filter } = {}) {
  // GET /api/admin/customers?q=&filter=all|registered|guests|repeat|blocked — one row per email (guests included)
  return request(`/admin/customers${qs({ q, filter })}`)
}

export async function getCustomer(email) {
  // GET /api/admin/customers/:email — profile, stats, orders, addresses, returns, messages
  return request(`/admin/customers/${encodeURIComponent(email)}`)
}

export async function updateCustomer(email, data) {
  // PUT /api/admin/customers/:email  { notes?, tags?, isBlocked?, blockReason?, codDisabled? }
  return request(`/admin/customers/${encodeURIComponent(email)}`, { method: 'PUT', body: data })
}

// ─── Reviews ───────────────────────────────────────────────────────────────────

export async function getReviewsByProduct(productId) {
  // GET /api/products/:id/reviews
  return request(`/products/${encodeURIComponent(productId)}/reviews`)
}

export async function getAllReviews() {
  // GET /api/admin/reviews
  return request('/admin/reviews')
}

export async function approveReview(id) {
  // PUT /api/admin/reviews/:id/approve
  return request(`/admin/reviews/${encodeURIComponent(id)}/approve`, { method: 'PUT' })
}

export async function deleteReview(id) {
  // DELETE /api/admin/reviews/:id
  return request(`/admin/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function submitReview(review) {
  // POST /api/reviews  { productId, rating, title, body, userName }
  return request('/reviews', { method: 'POST', body: review })
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

export async function getReports({ from, to }) {
  // GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
  return request(`/admin/reports${qs({ from, to })}`)
}

export async function getAnalytics() {
  // GET /api/admin/analytics
  return request('/admin/analytics')
}

// ─── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings() {
  // GET /api/settings (public subset)
  return request('/settings')
}

export async function getAdminSettings() {
  // GET /api/admin/settings (full, includes razorpayKeyId)
  return request('/admin/settings')
}

export async function updateSettings(data) {
  // PUT /api/admin/settings
  return request('/admin/settings', { method: 'PUT', body: data })
}

// ─── Uploads ───────────────────────────────────────────────────────────────────

export async function uploadImage(file) {
  // POST /api/admin/upload (multipart) → { url }
  const formData = new FormData()
  formData.append('file', file)
  return request('/admin/upload', { method: 'POST', body: formData, isFormData: true })
}

// ─── Storefront content (navbar menu, homepage tiles/editorial) ───────────────

export async function getSiteContent() {
  // GET /api/site-content → { navMenu?, homeTiles?, … } (only customised sections)
  return request('/site-content')
}

export async function saveSiteContent(key, value) {
  // PUT /api/admin/site-content/:key  { value } → the cleaned, saved value
  return request(`/admin/site-content/${encodeURIComponent(key)}`, { method: 'PUT', body: { value } })
}

export async function resetSiteContent(key) {
  // DELETE /api/admin/site-content/:key — storefront goes back to built-in defaults
  return request(`/admin/site-content/${encodeURIComponent(key)}`, { method: 'DELETE' })
}

// ─── Coupons & discounts ───────────────────────────────────────────────────────

export async function getCoupons() {
  // GET /api/admin/coupons → coupons with status, usedCount, discountGiven, sales
  return request('/admin/coupons')
}

export async function saveCoupon(coupon) {
  // POST /api/admin/coupons or PUT /api/admin/coupons/:id
  return coupon.id
    ? request(`/admin/coupons/${encodeURIComponent(coupon.id)}`, { method: 'PUT', body: coupon })
    : request('/admin/coupons', { method: 'POST', body: coupon })
}

export async function deleteCoupon(id) {
  // DELETE /api/admin/coupons/:id — refused once used (disable instead)
  return request(`/admin/coupons/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ─── Support: contact messages & returns ───────────────────────────────────────

export async function sendContactMessage(data) {
  // POST /api/contact  { name, email, phone, orderId, subject, message, website(honeypot) }
  return request('/contact', { method: 'POST', body: data })
}

export async function requestReturn(orderId, { items, reason, details }) {
  // POST /api/orders/:id/returns — customer's own delivered order, inside the return window
  return request(`/orders/${encodeURIComponent(orderId)}/returns`, { method: 'POST', body: { items, reason, details } })
}

export async function getSupportCounts() {
  // GET /api/admin/support/counts → { newMessages, openReturns }
  return request('/admin/support/counts')
}

export async function getMessages(status) {
  // GET /api/admin/messages?status=new|open|closed|all
  return request(`/admin/messages${qs({ status })}`)
}

export async function updateMessage(id, data) {
  // PUT /api/admin/messages/:id  { status?, internalNote? }
  return request(`/admin/messages/${encodeURIComponent(id)}`, { method: 'PUT', body: data })
}

export async function getReturns(status) {
  // GET /api/admin/returns?status=open|requested|approved|received|rejected|closed|all
  return request(`/admin/returns${qs({ status })}`)
}

export async function updateReturn(id, data) {
  // PUT /api/admin/returns/:id  { status?, adminNote?, restock? }
  return request(`/admin/returns/${encodeURIComponent(id)}`, { method: 'PUT', body: data })
}

// ─── Content pages ─────────────────────────────────────────────────────────────

export async function getPublishedPages() {
  // GET /api/pages → [{ slug, title, showInFooter }] (published only)
  return request('/pages')
}

export async function getPage(slug) {
  // GET /api/pages/:slug → published page or null
  return request(`/pages/${encodeURIComponent(slug)}`)
}

export async function getAdminPages() {
  // GET /api/admin/pages
  return request('/admin/pages')
}

export async function savePage(page) {
  // POST /api/admin/pages or PUT /api/admin/pages/:id
  return page.id
    ? request(`/admin/pages/${encodeURIComponent(page.id)}`, { method: 'PUT', body: page })
    : request('/admin/pages', { method: 'POST', body: page })
}

export async function deletePage(id) {
  // DELETE /api/admin/pages/:id
  return request(`/admin/pages/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function reorderPages(ids) {
  // PUT /api/admin/pages/reorder  { ids }
  return request('/admin/pages/reorder', { method: 'PUT', body: { ids } })
}

// ─── Data management (Settings page: export / import / reset) ─────────────────

export async function exportData() {
  // GET /api/admin/export
  return request('/admin/export')
}

export async function importData(data) {
  // POST /api/admin/import — replaces products/banners/reviews (orders/customers are not reimported)
  return request('/admin/import', { method: 'POST', body: data })
}

export async function resetDemoData() {
  // POST /api/admin/reset-demo-data
  return request('/admin/reset-demo-data', { method: 'POST' })
}

// ─── Staff & permissions (superadmin only) ─────────────────────────────────────

export async function getStaff() {
  // GET /api/admin/staff
  return request('/admin/staff')
}

export async function createStaff(data) {
  // POST /api/admin/staff  { name, email, password, role }
  return request('/admin/staff', { method: 'POST', body: data })
}

export async function updateStaff(id, data) {
  // PUT /api/admin/staff/:id  { name, role, isActive }
  return request(`/admin/staff/${encodeURIComponent(id)}`, { method: 'PUT', body: data })
}

export async function getAuditLog(limit = 100) {
  // GET /api/admin/audit-log
  return request(`/admin/audit-log?limit=${limit}`)
}
