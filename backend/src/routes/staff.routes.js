const { Router } = require('express')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/prisma')
const { requireRole } = require('../middleware/auth')
const { asyncRoute, HttpError } = require('../middleware/errorHandler')
const { logAudit } = require('../lib/audit')
const { ADMIN_ROLES, ROLE_LABELS } = require('../lib/roles')

const router = Router()

function toPublicStaff(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt }
}

// Staff management is superadmin-only — a manager/support account should
// never be able to create, promote, or deactivate other staff.
router.use('/admin/staff', requireRole('superadmin'))

// GET /api/admin/staff
router.get('/admin/staff', asyncRoute(async (req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: { in: ADMIN_ROLES } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(staff.map(toPublicStaff))
}))

// POST /api/admin/staff  { name, email, password, role }
router.post('/admin/staff', asyncRoute(async (req, res) => {
  const { name, email, password, role } = req.body
  if (!name || !email || !password) throw new HttpError(400, 'name, email and password are required')
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters')
  if (!ADMIN_ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ADMIN_ROLES.join(', ')}`)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new HttpError(409, 'An account with this email already exists')

  const passwordHash = await bcrypt.hash(password, 10)
  const staff = await prisma.user.create({ data: { name, email, passwordHash, role } })

  await logAudit({
    actor: req.user, action: 'staff.create', entityType: 'Staff', entityId: staff.id,
    summary: `Added ${name} (${email}) as ${ROLE_LABELS[role]}`,
  })
  res.status(201).json(toPublicStaff(staff))
}))

// PUT /api/admin/staff/:id  { name, role, isActive }
router.put('/admin/staff/:id', asyncRoute(async (req, res) => {
  const { name, role, isActive } = req.body
  const target = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!target || !ADMIN_ROLES.includes(target.role)) throw new HttpError(404, 'Staff member not found')

  const changingOwnAccess = target.id === req.user.id && (
    (role !== undefined && role !== 'superadmin') || isActive === false
  )
  if (changingOwnAccess) throw new HttpError(400, 'You cannot remove your own admin access')

  if (role !== undefined && target.role === 'superadmin' && role !== 'superadmin') {
    const otherSuperadmins = await prisma.user.count({
      where: { role: 'superadmin', isActive: true, id: { not: target.id } },
    })
    if (otherSuperadmins === 0) throw new HttpError(400, 'At least one active Super Admin must remain')
  }
  if (isActive === false && target.role === 'superadmin') {
    const otherActiveSuperadmins = await prisma.user.count({
      where: { role: 'superadmin', isActive: true, id: { not: target.id } },
    })
    if (otherActiveSuperadmins === 0) throw new HttpError(400, 'At least one active Super Admin must remain')
  }

  const data = {}
  if (name !== undefined) data.name = name
  if (role !== undefined) {
    if (!ADMIN_ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ADMIN_ROLES.join(', ')}`)
    data.role = role
  }
  if (isActive !== undefined) data.isActive = !!isActive

  const updated = await prisma.user.update({ where: { id: target.id }, data })

  const changes = []
  if (role !== undefined && role !== target.role) changes.push(`role → ${ROLE_LABELS[role]}`)
  if (isActive !== undefined && isActive !== target.isActive) changes.push(isActive ? 'reactivated' : 'deactivated')
  await logAudit({
    actor: req.user, action: 'staff.update', entityType: 'Staff', entityId: updated.id,
    summary: `Updated ${updated.name} (${updated.email})${changes.length ? ': ' + changes.join(', ') : ''}`,
  })
  res.json(toPublicStaff(updated))
}))

module.exports = router
