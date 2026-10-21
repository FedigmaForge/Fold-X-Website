import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Search, ShoppingBag, User, Menu, Heart } from 'lucide-react'
import useCartStore from '@/store/cartStore'
import useAuthStore from '@/store/authStore'
import useSettingsStore from '@/store/settingsStore'
import useWishlistStore from '@/store/wishlistStore'
import useSiteContentStore from '@/store/siteContentStore'
import { getCollections } from '@/services/api'
import SearchOverlay from '@/components/customer/SearchOverlay'
import MobileMenu from '@/components/customer/MobileMenu'

// Rotating messages (admin → Storefront → Announcement bar). Falls back to
// the single announcement in admin → Settings when the list is empty.
function AnnouncementBar() {
  const announcements = useSiteContentStore((s) => s.announcements)
  const fallback = useSettingsStore((s) => s.announcementBar)
  const messages = announcements?.length ? announcements : fallback ? [{ text: fallback, href: '' }] : []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = messages.length

  useEffect(() => {
    if (count <= 1 || paused) return
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 4500)
    return () => clearInterval(id)
  }, [count, paused])

  if (!count) return null
  const current = index % count

  return (
    <div className="bg-rust text-cream h-9 relative overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-live="polite">
      {messages.map((m, i) => {
        const cls = 'absolute inset-0 flex items-center justify-center text-center px-4 text-[10px] sm:text-[11px] font-sans font-medium uppercase tracking-[0.12em] transition-opacity duration-500'
        const style = { opacity: i === current ? 1 : 0, pointerEvents: i === current ? 'auto' : 'none' }
        return m.href ? (
          <Link key={i} to={m.href} className={`${cls} hover:underline underline-offset-4`} style={style} tabIndex={i === current ? 0 : -1}>
            <span className="line-clamp-2 leading-tight">{m.text}</span>
          </Link>
        ) : (
          <p key={i} className={cls} style={style} aria-hidden={i !== current}>
            <span className="line-clamp-2 leading-tight">{m.text}</span>
          </p>
        )
      })}
    </div>
  )
}

function CountBadge({ count }) {
  if (!count) return null
  return (
    <span className="absolute top-0.5 right-0.5 bg-rust text-cream text-[9px] font-sans rounded-full min-w-4 h-4 px-1 flex items-center justify-center leading-none">
      {count}
    </span>
  )
}

// Da Milano-style header: "+ Contact Us" · logo · search/account/wishlist/bag/☰.
// On the homepage it floats transparent over the hero slideshow and turns solid
// once the page scrolls; everywhere else it's solid. All navigation lives in
// the ☰ drawer.
export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [collections, setCollections] = useState([])
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState(false)
  const accountRef = useRef(null)
  const location = useLocation()
  const { items, openCart } = useCartStore()
  const { isLoggedIn, user, isAdmin, logout } = useAuthStore()
  const wishlistCount = useWishlistStore((s) => s.items.length)
  const navMenu = useSiteContentStore((s) => s.navMenu)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const isHome = location.pathname === '/'

  useEffect(() => {
    getCollections().then(setCollections).catch(() => {})
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A "/collections" menu with no sub-links lists the live collections
  const menu = navMenu.map((item) =>
    item.href === '/collections' && !item.sub?.length
      ? { ...item, sub: collections.map((c) => ({ label: c.name, href: `/collections/${c.id}` })) }
      : item
  )

  // Close the account drop-down when the page changes
  const path = location.pathname + location.search
  const [lastPath, setLastPath] = useState(path)
  if (path !== lastPath) {
    setLastPath(path)
    setAccountOpen(false)
  }

  useEffect(() => {
    if (!accountOpen) return
    const onDown = (e) => { if (!accountRef.current?.contains(e.target)) setAccountOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [accountOpen])

  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  // Transparent only on the homepage, at the top, with nothing open over it
  const transparent = isHome && !scrolled && !hovered && !accountOpen
  const tone = transparent ? 'text-cream' : 'text-brown'
  const iconBtn = `relative p-2 transition-colors ${transparent ? 'text-cream hover:text-gold-light' : 'text-brown hover:text-brown-mid'}`

  const headerRow = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${isHome ? 'absolute inset-x-0 top-full' : ''} transition-colors duration-300 ${transparent ? 'bg-gradient-to-b from-black/35 to-transparent' : 'bg-cream border-b border-border shadow-[0_1px_0_rgba(0,0,0,0.02)]'}`}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 lg:px-12 grid grid-cols-[1fr_auto_1fr] items-center h-16 lg:h-20">
        {/* Left: + Contact Us (desktop) · logo sits here on phones */}
        <div className="flex items-center">
          <Link to="/contact" className={`hidden lg:inline text-[11px] font-sans font-medium uppercase tracking-[0.1em] ${tone} hover:opacity-80`}>
            + Contact Us
          </Link>
          <Link to="/" className="lg:hidden" aria-label="FoldX home">
            <span className={`font-serif text-2xl tracking-[0.25em] font-light ${tone}`}>FOLDX</span>
          </Link>
        </div>

        {/* Centre logo (desktop) */}
        <Link to="/" className="hidden lg:block justify-self-center text-center" aria-label="FoldX home">
          <span className={`block font-serif text-[32px] leading-none tracking-[0.3em] font-light ${tone}`}>FOLDX</span>
          <span className={`block mt-1 text-[8px] tracking-[0.6em] font-sans uppercase ${transparent ? 'text-cream/80' : 'text-brown-mid'}`}>Leather Bags</span>
        </Link>
        <span className="lg:hidden" />

        {/* Right: icons + menu */}
        <div className="flex items-center justify-end gap-0 sm:gap-1">
          <button onClick={() => setSearchOpen(true)} className={iconBtn} aria-label="Search">
            <Search size={20} strokeWidth={1.4} />
          </button>

          <div className="relative hidden sm:block" ref={accountRef}>
            <button onClick={() => setAccountOpen((o) => !o)} className={iconBtn} aria-label="Account" aria-expanded={accountOpen}>
              <User size={20} strokeWidth={1.4} />
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-cream border border-border shadow-lg py-1 z-50 text-brown">
                {isLoggedIn ? (
                  <>
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="text-[11px] tracking-wide text-brown-mid font-sans uppercase truncate">{user?.name}</p>
                    </div>
                    <Link to="/account" className="block px-4 py-2 text-xs tracking-wide font-sans uppercase hover:bg-cream-dark">My Orders</Link>
                    {(isAdmin || user?.role === 'admin') && (
                      <Link to="/admin/dashboard" className="block px-4 py-2 text-xs tracking-wide text-gold font-sans uppercase hover:bg-cream-dark">Admin Panel</Link>
                    )}
                    <button onClick={() => { logout(); setAccountOpen(false) }} className="w-full text-left block px-4 py-2 text-xs tracking-wide text-brown-mid font-sans uppercase hover:bg-cream-dark border-t border-border mt-1">
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/account" className="block px-4 py-2 text-xs tracking-wide font-sans uppercase hover:bg-cream-dark">Log In / Register</Link>
                    <Link to="/admin/login" className="block px-4 py-2 text-xs tracking-wide text-gold font-sans uppercase hover:bg-cream-dark border-t border-border">Admin Login</Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Link to="/wishlist" className={`${iconBtn} hidden sm:block`} aria-label="Wishlist">
            <Heart size={20} strokeWidth={1.4} />
            <CountBadge count={wishlistCount} />
          </Link>

          <button onClick={openCart} className={iconBtn} aria-label={`Bag, ${itemCount} item${itemCount === 1 ? '' : 's'}`}>
            <ShoppingBag size={20} strokeWidth={1.4} />
            <CountBadge count={itemCount} />
          </button>

          <button onClick={() => setMenuOpen(true)} className={`${iconBtn} ml-1 sm:ml-3`} aria-label="Open menu">
            <Menu size={24} strokeWidth={1.2} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <header className="sticky top-0 z-50">
        <AnnouncementBar />
        {headerRow}
      </header>

      <SearchOverlay open={searchOpen} onClose={closeSearch} />
      <MobileMenu open={menuOpen} onClose={closeMenu} menu={menu} />
    </>
  )
}
