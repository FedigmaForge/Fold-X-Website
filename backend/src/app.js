const express = require('express')
const cors = require('cors')
const morgan = require('morgan')

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler')
const { UPLOAD_DIR } = require('./middleware/upload')

const authRoutes = require('./routes/auth.routes')
const productsCsvRoutes = require('./routes/productsCsv.routes')
const productRoutes = require('./routes/products.routes')
const categoryRoutes = require('./routes/categories.routes')
const bannerRoutes = require('./routes/banners.routes')
const orderRoutes = require('./routes/orders.routes')
const paymentRoutes = require('./routes/payments.routes')
const customerRoutes = require('./routes/customers.routes')
const reviewRoutes = require('./routes/reviews.routes')
const analyticsRoutes = require('./routes/analytics.routes')
const settingsRoutes = require('./routes/settings.routes')
const uploadRoutes = require('./routes/upload.routes')
const adminDataRoutes = require('./routes/adminData.routes')
const staffRoutes = require('./routes/staff.routes')
const auditLogRoutes = require('./routes/auditLog.routes')
const siteContentRoutes = require('./routes/siteContent.routes')
const reportsRoutes = require('./routes/reports.routes')
const pagesRoutes = require('./routes/pages.routes')
const { router: supportRoutes } = require('./routes/support.routes')
const couponsRoutes = require('./routes/coupons.routes')
const staffAuthRoutes = require('./routes/staffAuth.routes')
const financeRoutes = require('./routes/finance.routes')
const cartsRoutes = require('./routes/carts.routes')

const app = express()

// Vite auto-picks the next free port when 5173 is taken, so in addition to the
// explicit CORS_ORIGIN list, allow any http://localhost:<port> origin — this
// only affects local dev convenience, not production (set CORS_ORIGIN there).
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
}))
app.use(morgan('dev'))
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(UPLOAD_DIR))

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api', authRoutes)
app.use('/api', productsCsvRoutes) // before productRoutes: /admin/products/export.csv vs /:id
app.use('/api', productRoutes)
app.use('/api', categoryRoutes)
app.use('/api', bannerRoutes)
app.use('/api', orderRoutes)
app.use('/api', paymentRoutes)
app.use('/api', customerRoutes)
app.use('/api', reviewRoutes)
app.use('/api', analyticsRoutes)
app.use('/api', settingsRoutes)
app.use('/api', uploadRoutes)
app.use('/api', adminDataRoutes)
app.use('/api', staffRoutes)
app.use('/api', auditLogRoutes)
app.use('/api', siteContentRoutes)
app.use('/api', reportsRoutes)
app.use('/api', pagesRoutes)
app.use('/api', supportRoutes)
app.use('/api', couponsRoutes)
app.use('/api', staffAuthRoutes)
app.use('/api', financeRoutes)
app.use('/api', cartsRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

module.exports = app
