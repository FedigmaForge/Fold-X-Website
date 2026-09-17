import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import CustomerLayout from '@/layouts/CustomerLayout'
import AdminLayout from '@/layouts/AdminLayout'
import useSettingsStore from '@/store/settingsStore'

// Customer pages
const HomePage = lazy(() => import('@/pages/customer/HomePage'))
const ProductListingPage = lazy(() => import('@/pages/customer/ProductListingPage'))
const ProductDetailPage = lazy(() => import('@/pages/customer/ProductDetailPage'))
const CheckoutPage = lazy(() => import('@/pages/customer/CheckoutPage'))
const WishlistPage = lazy(() => import('@/pages/customer/WishlistPage'))
const OrderConfirmationPage = lazy(() => import('@/pages/customer/OrderConfirmationPage'))
const AccountPage = lazy(() => import('@/pages/customer/AccountPage'))
const JournalPage = lazy(() => import('@/pages/customer/JournalPage'))
const JournalPostPage = lazy(() => import('@/pages/customer/JournalPostPage'))

// Admin pages
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'))
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'))
const ProductsPage = lazy(() => import('@/pages/admin/ProductsPage'))
const ProductFormPage = lazy(() => import('@/pages/admin/ProductFormPage'))
const BannersPage = lazy(() => import('@/pages/admin/BannersPage'))
const OrdersPage = lazy(() => import('@/pages/admin/OrdersPage'))
const CustomersPage = lazy(() => import('@/pages/admin/CustomersPage'))
const ReviewsPage = lazy(() => import('@/pages/admin/ReviewsPage'))
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'))
const StaffPage = lazy(() => import('@/pages/admin/StaffPage'))
const ActivityLogPage = lazy(() => import('@/pages/admin/ActivityLogPage'))

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <span className="font-serif text-xl tracking-[0.3em] text-brown-mid animate-pulse">FOLDX</span>
    </div>
  )
}

export default function App() {
  useEffect(() => {
    useSettingsStore.getState().hydrate().catch(() => {
      // Backend unreachable — fall back to the last cached/default settings.
    })
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Customer site */}
          <Route element={<CustomerLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductListingPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/journal/:slug" element={<JournalPostPage />} />
          </Route>

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id/edit" element={<ProductFormPage />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="activity-log" element={<ActivityLogPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
