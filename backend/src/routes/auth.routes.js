const { Router } = require('express')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/prisma')
const { signToken } = require('../lib/jwt')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')

const router = Router()

function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

// POST /api/auth/register
router.post('/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password, phone } = req.body
  if (!name || !email || !password) throw new HttpError(400, 'name, email and password are required')
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new HttpError(409, 'An account with this email already exists')

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role: 'customer' },
  })
  const token = signToken(user)
  res.status(201).json({ user: toPublicUser(user), token })
}))

// POST /api/auth/login
router.post('/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) throw new HttpError(400, 'email and password are required')

  const user = await prisma.user.findUnique({ where: { email } })
  // Staff must sign in through the admin login, which enforces two-step
  // login — otherwise this route would hand out a staff session without it
  if (!user || user.role !== 'customer') throw new HttpError(401, 'Invalid credentials')

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new HttpError(401, 'Invalid credentials')
  // Only after the password checks out, so this never reveals to a stranger
  // whether an account exists
  if (!user.isActive) throw new HttpError(403, 'This account has been suspended. Please contact us for help.')

  const token = signToken(user)
  res.json({ user: toPublicUser(user), token })
}))

// Staff sign-in (with two-step login) lives in staffAuth.routes.js

module.exports = router
