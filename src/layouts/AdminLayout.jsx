import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Menu, Bell, ExternalLink } from 'lucide-react'
import Sidebar from '@/components/admin/Sidebar'
import useAuthStore from '@/store/authStore'

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAdmin, isLoggedIn } = useAuthStore()

  if (!isLoggedIn || !isAdmin) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <div className="flex-1" />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 transition-colors"
          >
            <ExternalLink size={14} /> View Store
          </a>
          <button className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell size={18} className="text-gray-500" />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: '12px', fontSize: '14px' },
          success: { iconTheme: { primary: '#7c3aed', secondary: '#fff' } },
        }}
      />
    </div>
  )
}
