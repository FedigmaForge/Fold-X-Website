import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Image, ShoppingBag,
  Users, Layers, MailPlus, Star, LogOut, Settings, X, ShieldCheck, ScrollText, LayoutTemplate, FolderTree, BarChart3, FileText, Inbox, Undo2, TicketPercent, Wallet, ShoppingCart
} from 'lucide-react'
import useAuthStore from '@/store/authStore'
import { usePermissions } from '@/utils/permissions'
import { getOrders, getAllReviews, getSupportCounts } from '@/services/api'

const ROLE_LABELS = { superadmin: 'Super Admin', manager: 'Manager', support: 'Support' }

// Matches the storefront's small tracked-uppercase nav, with a gold rule marking the active page
const NAV_ITEM = 'flex items-center gap-3 px-6 py-2.5 text-[11px] uppercase tracking-[0.2em] border-l-2 transition-colors'
const NAV_ACTIVE = 'border-gold bg-brown-light/40 text-cream'
const NAV_IDLE = 'border-transparent text-cream-dark/60 hover:text-gold-light'

export default function Sidebar({ mobileOpen, onClose }) {
  const { logout, user } = useAuthStore()
  const { canRefund: canSeeFinance } = usePermissions()
  const navigate = useNavigate()

  const [pendingOrders, setPendingOrders] = useState(0)
  const [pendingReviews, setPendingReviews] = useState(0)
  const [support, setSupport] = useState({ newMessages: 0, openReturns: 0 })

  useEffect(() => {
    getOrders({ status: 'pending' }).then((o) => setPendingOrders(o.length)).catch(() => {})
    getAllReviews().then((r) => setPendingReviews(r.filter((x) => !x.isApproved).length)).catch(() => {})
    getSupportCounts().then(setSupport).catch(() => {})
  }, [])

  // Grouped so the growing list stays scannable
  const navGroups = [
    { title: null, items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
      // Money pages: Managers and the Super Admin only (same as refunds)
      ...(canSeeFinance ? [{ to: '/admin/finance', label: 'Finance', icon: Wallet }] : []),
    ] },
    { title: 'Sales', items: [
      { to: '/admin/orders', label: 'Orders', icon: ShoppingBag, badge: pendingOrders },
      { to: '/admin/returns', label: 'Returns', icon: Undo2, badge: support.openReturns },
      { to: '/admin/carts', label: 'Abandoned carts', icon: ShoppingCart },
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/discounts', label: 'Discounts', icon: TicketPercent },
      { to: '/admin/subscribers', label: 'Subscribers', icon: MailPlus },
      { to: '/admin/inbox', label: 'Inbox', icon: Inbox, badge: support.newMessages },
    ] },
    { title: 'Catalog', items: [
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree },
      { to: '/admin/collections', label: 'Collections', icon: Layers },
      { to: '/admin/reviews', label: 'Reviews', icon: Star, badge: pendingReviews },
    ] },
    { title: 'Content', items: [
      { to: '/admin/storefront', label: 'Storefront', icon: LayoutTemplate },
      { to: '/admin/banners', label: 'Banners', icon: Image },
      { to: '/admin/pages', label: 'Pages', icon: FileText },
    ] },
    // Staff management and the activity log expose who has access and what
    // they've changed — restricted to Super Admin only, both here and server-side.
    ...(user?.role === 'superadmin' ? [{ title: 'Team', items: [
      { to: '/admin/staff', label: 'Staff', icon: ShieldCheck },
      { to: '/admin/activity-log', label: 'Activity Log', icon: ScrollText },
    ] }] : []),
  ]

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  const content = (
    <div className="flex flex-col h-full w-full bg-brown text-cream-dark">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-brown-light">
        <span className="flex flex-col">
          <span className="font-serif text-2xl tracking-[0.3em] text-cream font-light leading-none">FOLDX</span>
          <span className="mt-1.5 text-[9px] uppercase tracking-[0.35em] text-gold">Atelier Admin</span>
        </span>
        {onClose && (
          <button onClick={onClose} className="text-cream-dark/60 hover:text-cream lg:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Admin info */}
      <NavLink to="/admin/account" onClick={onClose} title="My account & security" className="block px-6 py-4 border-b border-brown-light hover:bg-brown-light/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-gold/60 flex items-center justify-center text-gold font-serif text-lg shrink-0">
            {user?.name?.[0] || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-cream truncate">{user?.name || 'Admin'}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-cream-dark/60 truncate mt-0.5">{ROLE_LABELS[user?.role] || user?.email}</p>
          </div>
        </div>
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi ? 'mt-3' : ''}>
            {group.title && <p className="px-6 pt-2 pb-1.5 text-[9px] uppercase tracking-[0.35em] text-gold/70">{group.title}</p>}
            {group.items.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `${NAV_ITEM} ${isActive ? NAV_ACTIVE : NAV_IDLE}`
            }
          >
            <Icon size={16} strokeWidth={1.5} />
            <span className="flex-1">{label}</span>
            {badge > 0 && (
              <span className="ml-auto bg-gold text-brown text-[10px] font-medium rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none tracking-normal">
                {badge}
              </span>
            )}
          </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="py-4 border-t border-brown-light space-y-0.5">
        <NavLink
          to="/admin/settings"
          onClick={onClose}
          className={({ isActive }) =>
            `${NAV_ITEM} ${isActive ? NAV_ACTIVE : NAV_IDLE}`
          }
        >
          <Settings size={16} strokeWidth={1.5} /> Settings
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-6 py-2.5 text-[11px] uppercase tracking-[0.2em] text-cream-dark/60 border-l-2 border-transparent hover:text-gold-light transition-colors"
        >
          <LogOut size={16} strokeWidth={1.5} /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-60 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-60 z-50 lg:hidden">
            {content}
          </aside>
        </>
      )}
    </>
  )
}
