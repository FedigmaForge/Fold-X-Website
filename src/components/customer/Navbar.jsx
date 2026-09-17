import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ShoppingBag, User, Menu, X, Heart } from 'lucide-react'
import useCartStore from '@/store/cartStore'
import useAuthStore from '@/store/authStore'
import useSettingsStore from '@/store/settingsStore'
import useWishlistStore from '@/store/wishlistStore'

const NAV_ITEMS = [
  {
    label: 'Women',
    href: '/products?gender=women',
    sub: [
      { label: 'Tote Bags',     href: '/products?gender=women&type=tote-bags' },
      { label: 'Sling Bags',    href: '/products?gender=women&type=sling-bags' },
      { label: 'Clutches',      href: '/products?gender=women&type=clutches' },
      { label: 'Shoulder Bags', href: '/products?gender=women&type=shoulder-bags' },
      { label: 'Wallets',       href: '/products?gender=women&type=wallets' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=85',
      label: 'New Arrivals',
      href: '/products?gender=women&badge=new',
    },
  },
  {
    label: 'Men',
    href: '/products?gender=men',
    sub: [
      { label: 'Wallets',       href: '/products?gender=men&type=wallets' },
      { label: 'Card Holders',  href: '/products?gender=men&type=card-holders' },
      { label: 'Laptop Bags',   href: '/products?gender=men&type=laptop-bags' },
      { label: 'Briefcases',    href: '/products?gender=men&type=briefcases' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=85',
      label: 'Best Sellers',
      href: '/products?gender=men&badge=best-seller',
    },
  },
  {
    label: 'Travel',
    href: '/products?category=travel',
    sub: [
      { label: 'Passport Holders', href: '/products?category=travel&type=passport' },
      { label: 'Duffle Bags',      href: '/products?category=travel&type=duffle' },
      { label: 'Luggage Tags',     href: '/products?category=travel&type=luggage-tags' },
      { label: 'Travel Kits',      href: '/products?category=travel&type=travel-kits' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=400&q=85',
      label: 'Travel Edit',
      href: '/products?category=travel',
    },
  },
  {
    label: 'Collections',
    href: '/products?category=collections',
    sub: [
      { label: 'New Arrivals',      href: '/products?badge=new' },
      { label: 'Best Sellers',      href: '/products?badge=best-seller' },
      { label: 'Online Exclusive',  href: '/products?badge=online-exclusive' },
      { label: 'Limited Edition',   href: '/products?badge=limited-edition' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=85',
      label: 'Explore All',
      href: '/products',
    },
  },
  {
    label: 'Gifts',
    href: '/products?category=gifts',
    sub: [
      { label: 'Gift Sets',  href: '/products?category=gifts&type=gift-sets' },
      { label: 'Under ₹2,999', href: '/products?category=gifts&maxPrice=2999' },
      { label: 'Under ₹4,999', href: '/products?category=gifts&maxPrice=4999' },
      { label: 'Gift Cards', href: '/products?category=gifts&type=gift-cards' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400&q=85',
      label: 'Gift Guide',
      href: '/products?category=gifts',
    },
  },
]

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const menuTimerRef = useRef(null)
  const navigate = useNavigate()
  const { items, openCart } = useCartStore()
  const { isLoggedIn, user, isAdmin, logout } = useAuthStore()
  const announcementBar = useSettingsStore((s) => s.announcementBar)
  const wishlistCount = useWishlistStore((s) => s.items.length)

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setSearchOpen(false)
    }
  }

  const openMenu = (label) => {
    clearTimeout(menuTimerRef.current)
    setActiveMenu(label)
  }
  const closeMenu = () => {
    menuTimerRef.current = setTimeout(() => setActiveMenu(null), 120)
  }

  useEffect(() => () => clearTimeout(menuTimerRef.current), [])

  const activeItem = NAV_ITEMS.find((n) => n.label === activeMenu)

  return (
    <header className="sticky top-0 z-50 bg-cream">
      {/* Announcement bar */}
      <div className="bg-brown text-cream-dark text-center text-[11px] tracking-luxury py-2 font-sans font-light">
        {announcementBar}
      </div>

      {/* Main header */}
      <div className="border-b border-border">
        <div className="max-w-screen-xl mx-auto px-6 flex items-center h-16 gap-6">
          {/* Left nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-6 flex-1">
            {NAV_ITEMS.slice(0, 3).map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => openMenu(item.label)}
                onMouseLeave={closeMenu}
              >
                <Link
                  to={item.href}
                  className="nav-link text-[11px] tracking-luxury text-brown font-sans font-light uppercase py-5 flex items-center gap-0.5"
                >
                  {item.label}
                </Link>
              </div>
            ))}
          </nav>

          {/* Logo (centered) */}
          <div className="flex-1 lg:flex-none text-center">
            <Link to="/" className="inline-block">
              <span className="font-serif text-2xl tracking-[0.3em] text-brown font-light">FOLDX</span>
            </Link>
          </div>

          {/* Right nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-6 flex-1 justify-end">
            {NAV_ITEMS.slice(3).map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => openMenu(item.label)}
                onMouseLeave={closeMenu}
              >
                <Link
                  to={item.href}
                  className="nav-link text-[11px] tracking-luxury text-brown font-sans font-light uppercase py-5 flex items-center gap-0.5"
                >
                  {item.label}
                </Link>
              </div>
            ))}
          </nav>

          {/* Icons */}
          <div className="flex items-center gap-1 ml-auto lg:ml-0">
            {/* Search */}
            <button
              onClick={() => setSearchOpen((o) => !o)}
              className="p-2 text-brown hover:text-brown-mid transition-colors"
              aria-label="Search"
            >
              <Search size={18} strokeWidth={1.5} />
            </button>

            {/* Wishlist */}
            <Link to="/wishlist" className="relative p-2 text-brown hover:text-brown-mid transition-colors hidden sm:block" aria-label="Wishlist">
              <Heart size={18} strokeWidth={1.5} />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 bg-brown text-cream text-[9px] font-sans rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Account */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setAccountOpen((o) => !o)}
                className="p-2 text-brown hover:text-brown-mid transition-colors"
                aria-label="Account"
              >
                <User size={18} strokeWidth={1.5} />
              </button>
              {accountOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 bg-cream border border-border shadow-lg py-1 z-50"
                  onMouseLeave={() => setAccountOpen(false)}
                >
                  {isLoggedIn ? (
                    <>
                      <div className="px-4 py-2.5 border-b border-border">
                        <p className="text-[11px] tracking-wide text-brown-mid font-sans uppercase">{user?.name}</p>
                      </div>
                      <Link to="/account" onClick={() => setAccountOpen(false)} className="block px-4 py-2 text-xs tracking-wide text-brown font-sans uppercase hover:bg-cream-dark transition-colors">
                        My Orders
                      </Link>
                      {(isAdmin || user?.role === 'admin') && (
                        <Link to="/admin/dashboard" onClick={() => setAccountOpen(false)} className="block px-4 py-2 text-xs tracking-wide text-gold font-sans uppercase hover:bg-cream-dark transition-colors">
                          Admin Panel
                        </Link>
                      )}
                      <button onClick={() => { logout(); setAccountOpen(false) }} className="w-full text-left block px-4 py-2 text-xs tracking-wide text-brown-mid font-sans uppercase hover:bg-cream-dark transition-colors border-t border-border mt-1">
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link to="/account" onClick={() => setAccountOpen(false)} className="block px-4 py-2 text-xs tracking-wide text-brown font-sans uppercase hover:bg-cream-dark transition-colors">
                        Sign In
                      </Link>
                      <Link to="/admin/login" onClick={() => setAccountOpen(false)} className="block px-4 py-2 text-xs tracking-wide text-gold font-sans uppercase hover:bg-cream-dark transition-colors border-t border-border">
                        Admin Login
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Cart */}
            <button
              onClick={openCart}
              className="relative p-2 text-brown hover:text-brown-mid transition-colors"
              aria-label="Cart"
            >
              <ShoppingBag size={18} strokeWidth={1.5} />
              {itemCount > 0 && (
                <span className="absolute top-1 right-1 bg-brown text-cream text-[9px] font-sans rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="p-2 text-brown hover:text-brown-mid transition-colors lg:hidden"
            >
              {mobileOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mega menu dropdown */}
      {activeItem && (
        <div
          className="absolute top-full left-0 right-0 bg-cream border-b border-border shadow-xl z-40 hidden lg:block"
          onMouseEnter={() => openMenu(activeItem.label)}
          onMouseLeave={closeMenu}
        >
          <div className="max-w-screen-xl mx-auto px-6 py-8 flex gap-16">
            {/* Links */}
            <div className="flex-1">
              <p className="text-[10px] tracking-luxury text-brown-mid font-sans uppercase mb-4">{activeItem.label}</p>
              <ul className="space-y-3">
                {activeItem.sub.map((s) => (
                  <li key={s.label}>
                    <Link
                      to={s.href}
                      onClick={() => setActiveMenu(null)}
                      className="font-serif text-lg text-brown hover:text-brown-mid transition-colors leading-tight"
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to={activeItem.href}
                onClick={() => setActiveMenu(null)}
                className="inline-block mt-6 text-[10px] tracking-luxury text-brown font-sans uppercase border-b border-brown pb-0.5 hover:text-brown-mid hover:border-brown-mid transition-colors"
              >
                View All {activeItem.label}
              </Link>
            </div>

            {/* Featured image */}
            <div className="w-64 shrink-0">
              <Link to={activeItem.featured.href} onClick={() => setActiveMenu(null)} className="block group">
                <div className="overflow-hidden">
                  <img
                    src={activeItem.featured.image}
                    alt={activeItem.featured.label}
                    className="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <p className="mt-3 text-[10px] tracking-luxury text-brown font-sans uppercase">{activeItem.featured.label} →</p>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Search overlay */}
      {searchOpen && (
        <div className="border-b border-border bg-cream">
          <form onSubmit={handleSearch} className="max-w-screen-xl mx-auto px-6 py-4 flex items-center gap-4">
            <Search size={16} strokeWidth={1.5} className="text-brown-mid shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wallets, bags, accessories…"
              className="flex-1 bg-transparent outline-none text-sm font-sans font-light text-brown placeholder:text-brown-mid tracking-wide"
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="text-brown-mid hover:text-brown transition-colors"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </form>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-cream">
          {NAV_ITEMS.map((item) => (
            <div key={item.label} className="border-b border-border">
              <Link
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className="block px-6 py-4 text-[11px] tracking-luxury text-brown font-sans uppercase"
              >
                {item.label}
              </Link>
            </div>
          ))}
          <div className="px-6 py-4 border-b border-border flex flex-col gap-3">
            {isLoggedIn ? (
              <>
                <Link to="/account" onClick={() => setMobileOpen(false)} className="text-[11px] tracking-luxury text-brown font-sans uppercase">
                  My Account
                </Link>
                <button onClick={() => { logout(); setMobileOpen(false) }} className="text-left text-[11px] tracking-luxury text-brown-mid font-sans uppercase">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/account" onClick={() => setMobileOpen(false)} className="text-[11px] tracking-luxury text-brown font-sans uppercase">
                  Sign In
                </Link>
                <Link to="/admin/login" onClick={() => setMobileOpen(false)} className="text-[11px] tracking-luxury text-gold font-sans uppercase">
                  Admin Login
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
