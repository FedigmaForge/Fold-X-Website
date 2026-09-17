const prisma = require('./prisma')

// Fire-and-forget logging — a failed audit write should never break the
// actual admin action it's describing, so errors are swallowed (not thrown).
async function logAudit({ actor, action, entityType, entityId, summary }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? 'Unknown',
        actorRole: actor?.role ?? 'unknown',
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        summary,
      },
    })
  } catch (err) {
    console.error('audit log write failed:', err.message)
  }
}

module.exports = { logAudit }
