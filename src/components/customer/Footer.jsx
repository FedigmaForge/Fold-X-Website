import { useState } from 'react'
import { Link } from 'react-router-dom'
import useSettingsStore from '@/store/settingsStore'

const SHOP_LINKS = [
  { label: 'Women',       href: '/products?gender=women' },
  { label: 'Men',         href: '/products?gender=men' },
  { label: 'Travel',      href: '/products?category=travel' },
  { label: 'Accessories', href: '/products?category=accessories' },
  { label: 'Gift Sets',   href: '/products?category=gifts' },
  { label: 'New Arrivals',href: '/products?badge=new' },
  { label: 'The Journal', href: '/journal' },
]

const HELP_LINKS = [
  'My Orders', 'Returns & Refunds', 'Shipping Policy', 'FAQ', 'Privacy Policy', 'Terms of Service',
]

const SOCIAL = [
  { label: 'Instagram', handle: '@foldx.in' },
  { label: 'Pinterest', handle: '@foldx' },
  { label: 'Facebook',  handle: 'FoldX' },
]

export default function Footer() {
  const [email, setEmail] = useState('')
  const { address, supportPhone, supportEmail } = useSettingsStore()

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
            Handcrafted leather goods made with full-grain hides and time-honoured techniques. Designed to age beautifully and last a lifetime.
          </p>
          <div className="flex flex-col gap-2 mt-6">
            {SOCIAL.map((s) => (
              <a key={s.label} href="#" className="text-[11px] tracking-wide font-sans text-brown-mid hover:text-gold transition-colors">
                {s.label} <span className="text-cream/40">·</span> {s.handle}
              </a>
            ))}
          </div>
        </div>

        {/* Shop */}
        <div>
          <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-5">Shop</p>
          <ul className="space-y-3">
            {SHOP_LINKS.map((item) => (
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
            {HELP_LINKS.map((item) => (
              <li key={item}>
                <a
                  href="#"
                  className="text-[12px] font-sans font-light text-cream/70 hover:text-cream transition-colors tracking-wide"
                >
                  {item}
                </a>
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
