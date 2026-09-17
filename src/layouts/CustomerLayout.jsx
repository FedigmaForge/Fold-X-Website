import { Outlet, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import CartDrawer from '@/components/customer/CartDrawer'

export default function CustomerLayout() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <Navbar />
      <CartDrawer />
      <main className="flex-1">
        <div key={location.pathname} className="route-fade">
          <Outlet />
        </div>
      </main>
      <Footer />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: '2px', fontSize: '13px', fontFamily: 'Jost, sans-serif', background: '#2C1810', color: '#FAF7F4' },
          success: { iconTheme: { primary: '#C9A84C', secondary: '#FAF7F4' } },
        }}
      />
    </div>
  )
}
