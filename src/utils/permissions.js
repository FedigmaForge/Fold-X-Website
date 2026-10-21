import useAuthStore from '@/store/authStore'

// Mirrors backend/src/lib/roles.js. The backend is the real enforcement; this
// only hides controls a role would get a 403 from, so staff aren't offered
// buttons that can't work.
const CATALOG_WRITE_ROLES = ['manager', 'superadmin']
const REFUND_ROLES = ['manager', 'superadmin']

export function usePermissions() {
  const role = useAuthStore((s) => s.user?.role)
  return {
    canEditCatalog: CATALOG_WRITE_ROLES.includes(role), // products, banners, settings, import
    canRefund: REFUND_ROLES.includes(role),
    isSuperAdmin: role === 'superadmin', // staff, activity log, reset demo data
  }
}
