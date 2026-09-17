import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Image, ShoppingBag,
  Users, Star, LogOut, Settings, X, ShieldCheck, ScrollText
} from 'lucide-react'
import useAuthStore from '@/store/authStore'
import { getOrders, getAllReviews } from '@/services/api'

const ROLE_LABELS = { superadmin: 'Super Admin', manager: 'Manager', support: 'Support' }

export default function Sidebar({ mobileOpen, onClose }) {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  const [pendingOrders, setPendingOrders] = useState(0)
  const [pendingReviews, setPendingReviews] = useState(0)

  useEffect(() => {
    getOrders({ status: 'pending' }).then((o) => setPendingOrders(o.length))
    getAllReviews().then((r) => setPendingReviews(r.filter((x) => !x.isApproved).length))
  }, [])

  const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
    { to: '/admin/products',  label: 'Products',   icon: Package },
    { to: '/admin/banners',   label: 'Banners',    icon: Image },
    { to: '/admin/orders',    label: 'Orders',     icon: ShoppingBag,   badge: pendingOrders },
    { to: '/admin/customers', label: 'Customers',  icon: Users },
    { to: '/admin/reviews',   label: 'Reviews',    icon: Star,          badge: pendingReviews },
    // Staff management and the activity log expose who has access and what
    // they've changed — restricted to Super Admin only, both here and server-side.
    ...(user?.role === 'superadmin' ? [
      { to: '/admin/staff',        label: 'Staff',        icon: ShieldCheck },
      { to: '/admin/activity-log', label: 'Activity Log', icon: ScrollText },
    ] : []),
  ]

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  const content = (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
        <span className="text-xl font-black text-white tracking-tight">
          FOLD<span className="text-violet-400">X</span>
          <span className="ml-2 text-xs font-normal text-slate-400 tracking-normal">Admin</span>
        </span>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Admin info */}
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {user?.name?.[0] || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-slate-400 truncate">{ROLE_LABELS[user?.role] || user?.email}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {badge > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-1">
        <NavLink
          to="/admin/settings"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <Settings size={18} /> Settings
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-900/40 hover:text-red-400 transition-colors"
        >
          <LogOut size={18} /> Sign Out
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
