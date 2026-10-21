const { Router } = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const QRCode = require('qrcode')
const prisma = require('../lib/prisma')
const { signToken } = require('../lib/jwt')
const { requireAdmin, requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { ADMIN_ROLES } = require('../lib/roles')
const { logAudit } = require('../lib/audit')
const totp = require('../lib/totp')

const router = Router()

const toPublicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })

function logLogin(req, { user, email, success, reason }) {
  return prisma.staffLogin.create({
    data: {
      userId: user?.id ?? null,
      email: String(email ?? user?.email ?? '').slice(0, 120),
      success,
      reason,
      ip: String(req.ip ?? '').slice(0, 60),
      userAgent: String(req.get('user-agent') ?? '').slice(0, 300),
    },
  }).catch(() => {}) // logging must never block a sign-in
}

// ─── Login challenge ───────────────────────────────────────────────────────────
// After the password checks out, a staff member with two-step login gets a
// short-lived challenge token (not a session). It's swapped for a session
// only with a valid code. Each challenge allows 5 code attempts.

const CHALLENGE_TTL = '5m'
const attempts = new Map() // challenge jti → failed attempts (in memory; challenges expire in 5 min)

function signChallenge(user, mode) {
  return jwt.sign({ sub: user.id, purpose: 'staff-2fa', mode, jti: crypto.randomUUID() }, process.env.JWT_SECRET, { expiresIn: CHALLENGE_TTL })
}

async function readChallenge(token, mode) {
  let payload
  try {
    payload = jwt.verify(String(token ?? ''), process.env.JWT_SECRET)
  } catch {
    throw new HttpError(401, 'Your sign-in expired — please enter your password again')
  }
  if (payload.purpose !== 'staff-2fa' || payload.mode !== mode) throw new HttpError(401, 'Invalid sign-in step')
  if ((attempts.get(payload.jti) ?? 0) >= 5) throw new HttpError(429, 'Too many wrong codes — please sign in again')
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.isActive || !ADMIN_ROLES.includes(user.role)) throw new HttpError(401, 'Invalid sign-in')
  return { user, jti: payload.jti }
}

const failAttempt = (jti) => attempts.set(jti, (attempts.get(jti) ?? 0) + 1)

async function getSettings() {
  return prisma.settings.findUnique({ where: { id: 1 } })
}

// Accepts an authenticator code or an unused backup code (consumed on use)
async function checkSecondFactor(user, code) {
  const secret = user.twoFactorSecret ? totp.decrypt(user.twoFactorSecret) : null
  if (secret && totp.verifyCode(secret, code)) return 'authenticator'
  const given = String(code ?? '').trim().toLowerCase()
  if (/^[0-9a-f]{4}-?[0-9a-f]{4}$/.test(given)) {
    const normalised = given.includes('-') ? given : `${given.slice(0, 4)}-${given.slice(4)}`
    const hashes = Array.isArray(user.backupCodes) ? user.backupCodes : []
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(normalised, hashes[i])) {
        await prisma.user.update({ where: { id: user.id }, data: { backupCodes: hashes.filter((_, k) => k !== i) } })
        return 'backup code'
      }
    }
  }
  return null
}

async function newBackupCodes(userId) {
  const codes = totp.generateBackupCodes()
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 8)))
  await prisma.user.update({ where: { id: userId }, data: { backupCodes: hashes } })
  return codes
}

async function startSetup(user) {
  const secret = totp.generateSecret()
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorPending: totp.encrypt(secret) } })
  const otpauth = totp.otpauthUrl(secret, user.email)
  return { secret, otpauth, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) }
}

async function finishSetup(user, code) {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  if (!fresh.twoFactorPending) throw new HttpError(400, 'Start setup again — no QR code is waiting to be confirmed')
  const secret = totp.decrypt(fresh.twoFactorPending)
  if (!totp.verifyCode(secret, code)) return null
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, twoFactorSecret: fresh.twoFactorPending, twoFactorPending: null },
  })
  return newBackupCodes(user.id)
}

// POST /api/admin/auth/login  { email, password }
//  → { user, token }                                 (no two-step login)
//  → { twoFactorRequired: true, challenge }          (enter a code next)
//  → { twoFactorSetupRequired: true, challenge }     (Super Admin requires it; set it up now)
router.post('/admin/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) throw new HttpError(400, 'Email and password are required')

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new HttpError(401, 'Invalid credentials')
  }
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    await logLogin(req, { user, success: false, reason: 'wrong password' })
    throw new HttpError(401, 'Invalid credentials')
  }
  if (!user.isActive) {
    await logLogin(req, { user, success: false, reason: 'account deactivated' })
    throw new HttpError(401, 'This account has been deactivated')
  }

  if (user.twoFactorEnabled) return res.json({ twoFactorRequired: true, challenge: signChallenge(user, 'verify') })
  if ((await getSettings())?.require2FA) return res.json({ twoFactorSetupRequired: true, challenge: signChallenge(user, 'setup') })

  await logLogin(req, { user, success: true, reason: 'password only' })
  res.json({ user: toPublicUser(user), token: signToken(user) })
}))

// POST /api/admin/auth/2fa  { challenge, code } → { user, token }
router.post('/admin/auth/2fa', asyncRoute(async (req, res) => {
  const { user, jti } = await readChallenge(req.body.challenge, 'verify')
  const method = await checkSecondFactor(user, req.body.code)
  if (!method) {
    failAttempt(jti)
    await logLogin(req, { user, success: false, reason: 'wrong code' })
    throw new HttpError(401, "That code didn't work — check your authenticator app and try again")
  }
  attempts.delete(jti)
  await logLogin(req, { user, success: true, reason: method })
  res.json({ user: toPublicUser(user), token: signToken(user) })
}))

// POST /api/admin/auth/2fa/setup  { challenge } → { secret, otpauth, qr }   (forced setup during sign-in)
router.post('/admin/auth/2fa/setup', asyncRoute(async (req, res) => {
  const { user } = await readChallenge(req.body.challenge, 'setup')
  res.json(await startSetup(user))
}))

// POST /api/admin/auth/2fa/enable  { challenge, code } → { user, token, backupCodes }
router.post('/admin/auth/2fa/enable', asyncRoute(async (req, res) => {
  const { user, jti } = await readChallenge(req.body.challenge, 'setup')
  const backupCodes = await finishSetup(user, req.body.code)
  if (!backupCodes) {
    failAttempt(jti)
    throw new HttpError(400, "That code didn't match — make sure you scanned the QR code just shown")
  }
  await logLogin(req, { user, success: true, reason: 'set up two-step login' })
  await logAudit({ actor: user, action: 'staff.2fa_enable', entityType: 'Staff', entityId: user.id, summary: `${user.name} turned on two-step login` })
  res.json({ user: toPublicUser(user), token: signToken(user), backupCodes })
}))

// ─── My account ────────────────────────────────────────────────────────────────

// GET /api/admin/account — own security settings + recent sign-ins
router.get('/admin/account', requireAdmin, asyncRoute(async (req, res) => {
  const [settings, logins] = await Promise.all([
    getSettings(),
    prisma.staffLogin.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ])
  res.json({
    user: toPublicUser(req.user),
    twoFactorEnabled: req.user.twoFactorEnabled,
    backupCodesRemaining: Array.isArray(req.user.backupCodes) ? req.user.backupCodes.length : 0,
    require2FA: !!settings?.require2FA,
    logins,
  })
}))

// POST /api/admin/account/2fa/setup → { secret, otpauth, qr }
router.post('/admin/account/2fa/setup', requireAdmin, asyncRoute(async (req, res) => {
  if (req.user.twoFactorEnabled) throw new HttpError(400, 'Two-step login is already on')
  res.json(await startSetup(req.user))
}))

// POST /api/admin/account/2fa/enable  { code } → { backupCodes }
router.post('/admin/account/2fa/enable', requireAdmin, asyncRoute(async (req, res) => {
  const backupCodes = await finishSetup(req.user, req.body.code)
  if (!backupCodes) throw new HttpError(400, "That code didn't match — make sure you scanned the QR code just shown")
  await logAudit({ actor: req.user, action: 'staff.2fa_enable', entityType: 'Staff', entityId: req.user.id, summary: `${req.user.name} turned on two-step login` })
  res.json({ backupCodes })
}))

// POST /api/admin/account/2fa/backup-codes  { code } → { backupCodes }   (replaces the old set)
router.post('/admin/account/2fa/backup-codes', requireAdmin, asyncRoute(async (req, res) => {
  if (!req.user.twoFactorEnabled) throw new HttpError(400, 'Turn on two-step login first')
  if (!(await checkSecondFactor(req.user, req.body.code))) throw new HttpError(401, "That code didn't work")
  res.json({ backupCodes: await newBackupCodes(req.user.id) })
}))

// POST /api/admin/account/2fa/disable  { password, code }
router.post('/admin/account/2fa/disable', requireAdmin, asyncRoute(async (req, res) => {
  if ((await getSettings())?.require2FA) throw new HttpError(403, 'Two-step login is required for all staff and can’t be turned off')
  if (!(await bcrypt.compare(String(req.body.password ?? ''), req.user.passwordHash))) throw new HttpError(401, 'Wrong password')
  if (!(await checkSecondFactor(req.user, req.body.code))) throw new HttpError(401, "That code didn't work")
  await prisma.user.update({ where: { id: req.user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPending: null, backupCodes: null } })
  await logAudit({ actor: req.user, action: 'staff.2fa_disable', entityType: 'Staff', entityId: req.user.id, summary: `${req.user.name} turned off two-step login` })
  res.json({ ok: true })
}))

// ─── Super Admin ───────────────────────────────────────────────────────────────

// POST /api/admin/staff/:id/2fa/reset — for someone who lost their phone and backup codes
router.post('/admin/staff/:id/2fa/reset', requireRole('superadmin'), asyncRoute(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!target || !ADMIN_ROLES.includes(target.role)) throw new HttpError(404, 'Staff member not found')
  await prisma.user.update({ where: { id: target.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPending: null, backupCodes: null } })
  await logAudit({ actor: req.user, action: 'staff.2fa_reset', entityType: 'Staff', entityId: target.id, summary: `Reset two-step login for ${target.name}` })
  res.json({ ok: true })
}))

// GET /api/admin/security/logins — all staff sign-ins, newest first
router.get('/admin/security/logins', requireRole('superadmin'), asyncRoute(async (req, res) => {
  res.json(await prisma.staffLogin.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }))
}))

module.exports = router
