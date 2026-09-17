const { Router } = require('express')
const { requireAdmin } = require('../middleware/auth')
const { upload } = require('../middleware/upload')
const { HttpError } = require('../middleware/errorHandler')

const router = Router()

// POST /api/admin/upload (multipart, field name "file") → { url }
// Returns an absolute URL (not "/uploads/xxx") so the frontend — served from a
// different origin/port in dev — can render it directly without knowing the
// backend's base URL.
router.post('/admin/upload', requireAdmin, upload.single('file'), (req, res, next) => {
  if (!req.file) return next(new HttpError(400, 'No file uploaded'))
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`
  res.status(201).json({ url: `${base}/uploads/${req.file.filename}` })
})

module.exports = router
