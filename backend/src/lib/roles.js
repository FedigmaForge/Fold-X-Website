// Single source of truth for staff roles — used by auth middleware, the
// admin login route, and the staff-management routes so they can't drift.
const ADMIN_ROLES = ['support', 'manager', 'superadmin']

// Roles allowed to mutate catalog/content/settings (not just view them).
const CATALOG_WRITE_ROLES = ['manager', 'superadmin']

// Roles allowed to issue refunds — money leaves the business, so support can't.
const REFUND_ROLES = ['manager', 'superadmin']

const ROLE_LABELS = {
  support: 'Support',
  manager: 'Manager',
  superadmin: 'Super Admin',
}

module.exports = { ADMIN_ROLES, CATALOG_WRITE_ROLES, REFUND_ROLES, ROLE_LABELS }
