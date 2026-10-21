import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, ChevronRight, ChevronLeft, Heart, User, Mail } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import useSiteContentStore from '@/store/siteContentStore'

// The ☰ menu (all screen sizes, as on the reference site). Tapping a menu with
// sub-links slides in its own panel with a "Back" link. Always mounted so it
// can animate.
export default function MobileMenu({ open, onClose, menu }) {
  const [activeLabel, setActiveLabel] = useState(null)
  const { isLoggedIn, user, logout } = useAuthStore()
  const social = useSiteContentStore((s) => s.footer.social)

  const active = menu.find((m) => m.label === activeLabel)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const close = () => {
    onClose()
    setActiveLabel(null)
  }

  const rowCls = 'flex items-center justify-between w-full px-8 py-4 border-b border-border text-[13px] tracking-[0.14em] font-sans uppercase text-rust hover:bg-cream-dark/60 transition-colors'
  const tab = open ? 0 : -1

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        className={`fixed top-0 right-0 bottom-0 w-[88%] max-w-md bg-cream z-[61] flex flex-col shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 h-16 border-b border-border shrink-0">
          <span className="font-serif text-xl tracking-[0.3em] text-brown font-light">FOLDX</span>
          <button onClick={close} className="p-1.5 text-brown" aria-label="Close menu" tabIndex={tab}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Two panels side by side; the track slides left to show a sub-menu */}
        <div className="relative flex-1 overflow-hidden">
          <div className={`absolute inset-0 flex w-[200%] transition-transform duration-300 ease-out ${active ? '-translate-x-1/2' : 'translate-x-0'}`}>
            {/* Root panel */}
            <nav className="w-1/2 h-full overflow-y-auto" aria-hidden={!!active}>
              {menu.map((item) => (
                item.sub?.length ? (
                  <button key={item.label} onClick={() => setActiveLabel(item.label)} className={rowCls} tabIndex={active ? -1 : tab}>
                    {item.label}
                    <ChevronRight size={16} strokeWidth={1.5} className="text-brown-mid" />
                  </button>
                ) : (
                  <Link key={item.label} to={item.href} onClick={close} className={rowCls} tabIndex={active ? -1 : tab}>
                    {item.label}
                  </Link>
                )
              ))}

              <div className="px-6 py-6 space-y-4 border-b border-border">
                <Link to="/account" onClick={close} className="flex items-center gap-3 text-[12px] font-sans text-brown" tabIndex={tab}>
                  <User size={16} strokeWidth={1.5} /> {isLoggedIn ? `My Account${user?.name ? ` · ${user.name.split(' ')[0]}` : ''}` : 'Log In / Register'}
                </Link>
                <Link to="/wishlist" onClick={close} className="flex items-center gap-3 text-[12px] font-sans text-brown" tabIndex={tab}>
                  <Heart size={16} strokeWidth={1.5} /> Wishlist
                </Link>
                <Link to="/contact" onClick={close} className="flex items-center gap-3 text-[12px] font-sans text-brown" tabIndex={tab}>
                  <Mail size={16} strokeWidth={1.5} /> Contact Us
                </Link>
                {isLoggedIn && (
                  <button onClick={() => { logout(); close() }} className="text-[11px] tracking-luxury font-sans uppercase text-brown-mid" tabIndex={tab}>
                    Sign Out
                  </button>
                )}
              </div>

              {social.length > 0 && (
                <div className="px-6 py-6">
                  <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">Find Us On</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {social.map((s) => s.href ? (
                      <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-[12px] font-sans text-brown" tabIndex={tab}>{s.label}</a>
                    ) : (
                      <span key={s.label} className="text-[12px] font-sans text-brown-mid">{s.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </nav>

            {/* Sub-menu panel */}
            <nav className="w-1/2 h-full overflow-y-auto" aria-hidden={!active}>
              {active && (
                <>
                  <button onClick={() => setActiveLabel(null)} className="flex items-center gap-1 px-6 py-4 border-b border-border text-[11px] tracking-luxury font-sans uppercase text-brown-mid w-full" tabIndex={tab}>
                    <ChevronLeft size={16} strokeWidth={1.5} /> Back
                  </button>
                  <p className="px-6 pt-6 pb-2 font-serif text-2xl text-brown font-light">{active.label}</p>
                  <Link to={active.href} onClick={close} className="block px-6 py-3 text-[11px] tracking-luxury font-sans uppercase text-brown underline underline-offset-4" tabIndex={tab}>
                    View All {active.label}
                  </Link>
                  {active.sub.map((s) => (
                    <Link key={s.label} to={s.href} onClick={close} className="block px-6 py-3.5 border-b border-border font-serif text-lg text-brown" tabIndex={tab}>
                      {s.label}
                    </Link>
                  ))}
                  {active.featured?.image && (
                    <Link to={active.featured.href} onClick={close} className="block px-6 py-6" tabIndex={tab}>
                      <img src={active.featured.image} alt={active.featured.label} className="w-full aspect-[4/3] object-cover" loading="lazy" />
                      <p className="mt-2 text-[10px] tracking-luxury font-sans uppercase text-brown">{active.featured.label} →</p>
                    </Link>
                  )}
                </>
              )}
            </nav>
          </div>
        </div>
      </aside>
    </>
  )
}
