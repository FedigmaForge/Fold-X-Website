import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import CustomerLayout from '@/layouts/CustomerLayout'
import AdminLayout from '@/layouts/AdminLayout'
import useSettingsStore from '@/store/settingsStore'
import useSiteContentStore from '@/store/siteContentStore'

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
const CollectionsPage = lazy(() => import('@/pages/customer/CollectionsPage'))
const CollectionPage = lazy(() => import('@/pages/customer/CollectionPage'))
const GiftStorePage = lazy(() => import('@/pages/customer/GiftStorePage'))
const CustomisationPage = lazy(() => import('@/pages/customer/CustomisationPage'))

// Admin pages
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'))
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'))
const ProductsPage = lazy(() => import('@/pages/admin/ProductsPage'))
const ProductFormPage = lazy(() => import('@/pages/admin/ProductFormPage'))
const BannersPage = lazy(() => import('@/pages/admin/BannersPage'))
const StorefrontPage = lazy(() => import('@/pages/admin/StorefrontPage'))
const CategoriesPage = lazy(() => import('@/pages/admin/CategoriesPage'))
const AdminCollectionsPage = lazy(() => import('@/pages/admin/CollectionsPage'))
const SubscribersPage = lazy(() => import('@/pages/admin/SubscribersPage'))
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'))
const PagesPage = lazy(() => import('@/pages/admin/PagesPage'))
const ContentPage = lazy(() => import('@/pages/customer/ContentPage'))
const ContactPage = lazy(() => import('@/pages/customer/ContactPage'))
const InboxPage = lazy(() => import('@/pages/admin/InboxPage'))
const CouponsPage = lazy(() => import('@/pages/admin/CouponsPage'))
const FinancePage = lazy(() => import('@/pages/admin/FinancePage'))
const AbandonedCartsPage = lazy(() => import('@/pages/admin/AbandonedCartsPage'))
const AccountSecurityPage = lazy(() => import('@/pages/admin/AccountSecurityPage'))
const CartRecoverPage = lazy(() => import('@/pages/customer/CartRecoverPage'))
const ReturnsPage = lazy(() => import('@/pages/admin/ReturnsPage'))
const OrdersPage = lazy(() => import('@/pages/admin/OrdersPage'))
const OrderDetailPage = lazy(() => import('@/pages/admin/OrderDetailPage'))
const InvoicePage = lazy(() => import('@/pages/admin/InvoicePage'))
const CustomersPage = lazy(() => import('@/pages/admin/CustomersPage'))
const CustomerDetailPage = lazy(() => import('@/pages/admin/CustomerDetailPage'))
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
    useSiteContentStore.getState().hydrate().catch(() => {
      // Same fallback: last cached menu/homepage content, else built-in defaults.
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
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collections/:id" element={<CollectionPage />} />
            <Route path="/gifts" element={<GiftStorePage />} />
            <Route path="/customisation" element={<CustomisationPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/journal/:slug" element={<JournalPostPage />} />
            <Route path="/pages/:slug" element={<ContentPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/cart/recover/:token" element={<CartRecoverPage />} />
          </Route>

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          {/* Outside AdminLayout so it prints without the sidebar */}
          <Route path="/admin/orders/:id/invoice" element={<InvoicePage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id/edit" element={<ProductFormPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="collections" element={<AdminCollectionsPage />} />
            <Route path="subscribers" element={<SubscribersPage />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="storefront" element={<StorefrontPage />} />
            <Route path="pages" element={<PagesPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="discounts" element={<CouponsPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="carts" element={<AbandonedCartsPage />} />
            <Route path="account" element={<AccountSecurityPage />} />
            <Route path="returns" element={<ReturnsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:email" element={<CustomerDetailPage />} />
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
