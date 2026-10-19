import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import useSettingsStore from '@/store/settingsStore'
import useSiteContentStore from '@/store/siteContentStore'
import { getPublishedPages } from '@/services/api'

// Fixed help links; published content pages (About, FAQ, policies…) are
// appended after these. Shop links, social links and the blurb are edited in
// admin → Storefront → Footer.
const FIXED_HELP_LINKS = [
  { label: 'My Orders', href: '/account' },
  { label: 'Contact Us', href: '/contact' },
]

export default function Footer() {
  const [email, setEmail] = useState('')
  const { address, supportPhone, supportEmail } = useSettingsStore()
  const footer = useSiteContentStore((s) => s.footer)
  const [pages, setPages] = useState([])

  useEffect(() => {
    getPublishedPages().then((p) => setPages(p.filter((x) => x.showInFooter))).catch(() => {})
  }, [])

  const helpLinks = [...FIXED_HELP_LINKS, ...pages.map((p) => ({ label: p.title, href: `/pages/${p.slug}` }))]

  const handleSubscribe = (e) => {
    e.preventDefault()
    setEmail('')
  }

  return (
    <footer className="bg-brown text-cream-dark">
      {/* Newsletter strip */}
      <div className="border-b border-brown-light">
        <div className="max-w-screen-xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-serif text-2xl text-cream font-light">Stay in the Fold</p>
            <p className="text-[11px] tracking-wide font-sans font-light text-gold-light mt-1">New arrivals, exclusive offers & craft stories — straight to your inbox.</p>
          </div>
          <form onSubmit={handleSubscribe} className="flex items-end gap-0 w-full sm:w-auto max-w-sm">
            <div className="flex-1 border-b border-cream-dark pb-1">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                required
                className="w-full bg-transparent outline-none text-sm font-sans font-light text-cream placeholder:text-brown-mid tracking-wide"
              />
            </div>
            <button
              type="submit"
              className="ml-4 text-[10px] tracking-luxury font-sans uppercase text-cream border-b border-cream pb-1 hover:text-gold hover:border-gold transition-colors whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-screen-xl mx-auto px-6 py-14 grid grid-cols-2 sm:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="col-span-2 sm:col-span-1">
          <span className="font-serif text-2xl tracking-[0.3em] text-cream font-light">FOLDX</span>
          <p className="mt-4 text-[12px] font-sans font-light leading-relaxed text-brown-mid max-w-xs">
            {footer.blurb}
          </p>
          <div className="flex flex-col gap-2 mt-6">
            {footer.social.map((s) => {
              const content = <>{s.label}{s.handle && <> <span className="text-cream/40">·</span> {s.handle}</>}</>
              return s.href ? (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-[11px] tracking-wide font-sans text-brown-mid hover:text-gold transition-colors">
                  {content}
                </a>
              ) : (
                <span key={s.label} className="text-[11px] tracking-wide font-sans text-brown-mid">{content}</span>
              )
            })}
          </div>
        </div>

        {/* Shop */}
        <div>
          <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-5">Shop</p>
          <ul className="space-y-3">
            {footer.shopLinks.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.href}
                  className="text-[12px] font-sans font-light text-cream/70 hover:text-cream transition-colors tracking-wide"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Help */}
        <div>
          <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-5">Help</p>
          <ul className="space-y-3">
            {helpLinks.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className="text-[12px] font-sans font-light text-cream/70 hover:text-cream transition-colors tracking-wide"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-5">Contact</p>
          <ul className="space-y-3">
            {address && (
              <li className="text-[12px] font-sans font-light text-cream/70 leading-relaxed">
                {address}
              </li>
            )}
            {supportPhone && (
              <li>
                <a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`} className="text-[12px] font-sans font-light text-cream/70 hover:text-cream transition-colors">
                  {supportPhone}
                </a>
              </li>
            )}
            {supportEmail && (
              <li>
                <a href={`mailto:${supportEmail}`} className="text-[12px] font-sans font-light text-cream/70 hover:text-cream transition-colors">
                  {supportEmail}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-brown-light">
        <div className="max-w-screen-xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[10px] tracking-wide font-sans font-light text-brown-mid">
            © {new Date().getFullYear()} FoldX. All rights reserved.
          </p>
          <p className="text-[10px] tracking-wide font-sans font-light text-brown-mid">
            Payments secured by Razorpay &nbsp;·&nbsp; Made in India
          </p>
        </div>
      </div>
    </footer>
  )
}
