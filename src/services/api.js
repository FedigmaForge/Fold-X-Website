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
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

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

  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

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
  // POST /api/admin/auth/login
  return request('/admin/auth/login', { method: 'POST', body: { email, password } })
}

// ─── Products ──────────────────────────────────────────────────────────────────

export async function getProducts({ category, search, sort, minPrice, maxPrice } = {}) {
  // GET /api/products
  return request(`/products${qs({ category, search, sort, minPrice, maxPrice })}`)
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
  // GET /api/categories
  return request('/categories')
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

export async function getOrders({ status } = {}) {
  // GET /api/admin/orders
  return request(`/admin/orders${qs({ status })}`)
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

export async function updateOrderStatus(id, status) {
  // PUT /api/admin/orders/:id/status  { status }
  return request(`/admin/orders/${encodeURIComponent(id)}/status`, { method: 'PUT', body: { status } })
}

export async function placeOrder(orderData) {
  // POST /api/orders  { items, address, paymentId, razorpayOrderId, subtotal, shipping, total }
  return request('/orders', { method: 'POST', body: orderData })
}

// ─── Payments (Razorpay) ───────────────────────────────────────────────────────

export async function createRazorpayOrder(amount) {
  // POST /api/orders/create-razorpay-order  { amount } → { razorpayOrderId }
  return request('/orders/create-razorpay-order', { method: 'POST', body: { amount } })
}

export async function verifyPayment(payload) {
  // POST /api/orders/verify-payment  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
  return request('/orders/verify-payment', { method: 'POST', body: payload })
}

// ─── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers() {
  // GET /api/admin/customers
  return request('/admin/customers')
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
