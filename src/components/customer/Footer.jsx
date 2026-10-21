import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import useSettingsStore from '@/store/settingsStore'
import useSiteContentStore from '@/store/siteContentStore'
import { getPublishedPages, subscribeNewsletter } from '@/services/api'
import toast from 'react-hot-toast'
import SocialIcon from '@/components/ui/SocialIcon'

// Light footer in the reference site's layout: brand + social, newsletter,
// then Account / Shop / Customer Service columns. Shop links, social links and
// the blurb are edited in admin → Storefront → Footer; Customer Service lists
// the pages published under admin → Pages.

const ACCOUNT_LINKS = [
  { label: 'My Account', href: '/account' },
  { label: 'Track Your Order', href: '/account' },
  { label: 'Create a Return', href: '/account' },
  { label: 'Wishlist', href: '/wishlist' },
]

const KNOWN_NETWORKS = ['instagram', 'facebook', 'linkedin', 'youtube']

function FooterColumn({ title, links }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.2em] font-sans uppercase text-brown mb-5">{title}</p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={`${l.label}-${l.href}`}>
            <Link to={l.href} className="text-[13px] font-sans text-brown-light hover:text-rust transition-colors">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Footer() {
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | done
  const { supportPhone, supportEmail, storeName, address, gstin } = useSettingsStore()
  const footer = useSiteContentStore((s) => s.footer)
  const [pages, setPages] = useState([])

  useEffect(() => {
    getPublishedPages().then((p) => setPages(p.filter((x) => x.showInFooter))).catch(() => {})
  }, [])

  const serviceLinks = [{ label: 'Contact Us', href: '/contact' }, ...pages.map((p) => ({ label: p.title, href: `/pages/${p.slug}` }))]

  const handleSubscribe = async (e) => {
    e.preventDefault()
    setStatus('sending')
    try {
      await subscribeNewsletter(email, honeypot)
      setEmail('')
      setStatus('done')
    } catch (err) {
      toast.error(err.message)
      setStatus('idle')
    }
  }

  return (
    <footer className="bg-cream border-t border-border text-brown">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-8 py-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.4fr_1fr_1fr_1fr]">
        {/* Brand + social */}
        <div className="text-center sm:text-left">
          <p className="font-serif text-3xl tracking-[0.3em] font-light text-brown">FOLDX</p>
          <p className="mt-1 text-[8px] tracking-[0.6em] font-sans uppercase text-brown-mid">Leather Bags</p>
          {footer.blurb && <p className="mt-4 text-[12px] font-sans text-brown-light leading-relaxed max-w-xs mx-auto sm:mx-0">{footer.blurb}</p>}
          {footer.social.length > 0 && (
            <>
              <p className="mt-6 mb-3 text-[11px] tracking-[0.2em] font-sans uppercase text-brown">Find Us On</p>
              <div className="flex gap-4 justify-center sm:justify-start">
                {footer.social.map((s) => {
                  // Known networks get their icon; anything else shows its name
                  const icon = KNOWN_NETWORKS.includes(s.label.toLowerCase())
                    ? <SocialIcon name={s.label} />
                    : <span className="text-[12px] font-sans">{s.label}</span>
                  const label = `${s.label}${s.handle ? ` ${s.handle}` : ''}`
                  return s.href ? (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="text-brown hover:text-rust transition-colors">{icon}</a>
                  ) : (
                    <span key={s.label} aria-label={label} title={label} className="text-brown">{icon}</span>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Newsletter */}
        <div className="text-center sm:text-left">
          <p className="text-[11px] tracking-[0.2em] font-sans uppercase text-brown">Stay Updated</p>
          <p className="mt-3 font-sans text-2xl text-brown">Newsletter</p>
          <p className="mt-2 text-[13px] font-sans text-brown-light">Get new launches and offers straight to your inbox.</p>
          {status === 'done' ? (
            <p className="mt-5 text-[13px] font-sans text-rust" role="status">Thank you — you're on the list.</p>
          ) : (
            <form onSubmit={handleSubscribe} className="mt-5 flex items-center border-b border-brown max-w-sm mx-auto sm:mx-0">
              {/* Honeypot: hidden from people, often filled by bots */}
              <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                aria-label="Email address"
                className="flex-1 min-w-0 bg-transparent outline-none py-2 text-[13px] font-sans text-brown placeholder:text-brown-mid"
              />
              <button type="submit" disabled={status === 'sending'} className="p-2 text-brown hover:text-rust disabled:opacity-50" aria-label="Subscribe">
                <Mail size={18} strokeWidth={1.4} />
              </button>
            </form>
          )}
        </div>

        <FooterColumn title="Account" links={ACCOUNT_LINKS} />
        <FooterColumn title="Shop" links={footer.shopLinks} />
        <div>
          <FooterColumn title="Customer Service" links={serviceLinks} />
          {(supportPhone || supportEmail) && (
            <div className="mt-4 space-y-1 text-[13px] font-sans text-brown-light">
              {supportPhone && <a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`} className="block hover:text-rust">{supportPhone}</a>}
              {supportEmail && <a href={`mailto:${supportEmail}`} className="block hover:text-rust break-all">{supportEmail}</a>}
            </div>
          )}
        </div>
      </div>

      {/* Business details: trading name, registered address and GSTIN */}
      {(address || gstin) && (
        <p className="px-6 pb-3 text-center text-[11px] font-sans text-brown-light">
          {[storeName || 'FoldX', address, gstin && `GSTIN: ${gstin}`].filter(Boolean).join(' · ')}
        </p>
      )}
      <p className="pb-8 text-center text-[11px] font-sans text-brown-mid">
        © {new Date().getFullYear()} {storeName || 'FoldX'}. All rights reserved. · Payments secured by Razorpay · Made in India
      </p>
      <p className="-mt-5 pb-8 text-center text-[11px] font-sans text-brown-mid">
        Developed and designed by{' '}
        <a href="https://fedigmaforge.com" target="_blank" rel="noopener noreferrer" className="text-brown underline underline-offset-2 hover:text-rust">
          Fedigma
        </a>
      </p>
    </footer>
  )
}
