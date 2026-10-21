import { Link } from 'react-router-dom'
import useSettingsStore from '@/store/settingsStore'
import useDocumentMeta from '@/utils/useDocumentMeta'

const HERO = 'https://images.unsplash.com/photo-1727811641802-d28d9fb37e28?w=1800&q=85'

const STEPS = [
  { n: '01', title: 'Choose your bag', body: 'Pick any FoldX bag — a tote, sling, laptop bag, backpack, wallet or luggage piece.' },
  { n: '02', title: 'Pick the leather', body: 'On the product page, open "Customisation" and select the leather you would like it made in.' },
  { n: '03', title: 'We make it for you', body: 'Our workshop crafts your bag in that leather. No extra charge — the price stays the same.' },
]

// /customisation — explains the free leather change and lists the leathers
// currently offered (admin → Settings → Free Customisation)
export default function CustomisationPage() {
  const { customisationEnabled, customLeathers, customisationNote } = useSettingsStore()
  const leathers = String(customLeathers ?? '').split(',').map((l) => l.trim()).filter(Boolean)

  useDocumentMeta('Free Customisation · FoldX', 'Have any FoldX bag made in the leather you love — free of charge.')

  return (
    <div className="bg-cream">
      <section className="relative overflow-hidden bg-brown" style={{ height: 'min(60vh, 520px)' }}>
        <img src={HERO} alt="Leather bags in the FoldX workshop" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-cream px-6">
          <p className="text-[11px] tracking-[0.25em] font-sans uppercase text-cream/85 mb-4">Free of charge</p>
          <h1 className="font-serif text-4xl sm:text-6xl font-light">Your Bag, Your Leather</h1>
          <p className="mt-4 max-w-lg text-sm font-sans font-light text-cream/90">
            Love a design but want it in a different leather? We will make it for you — at no extra cost.
          </p>
        </div>
      </section>

      <section className="max-w-screen-xl mx-auto px-4 sm:px-8 py-16 lg:py-20">
        <h2 className="section-title mb-12">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-10 text-center">
          {STEPS.map((s) => (
            <div key={s.n}>
              <p className="font-serif text-4xl text-rust font-light">{s.n}</p>
              <p className="mt-3 text-[13px] tracking-[0.12em] font-sans uppercase text-brown">{s.title}</p>
              <p className="mt-2 text-[13px] font-sans font-light text-brown-mid leading-relaxed max-w-xs mx-auto">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-cream-dark">
        <div className="max-w-screen-md mx-auto px-6 py-16 text-center">
          <h2 className="section-title mb-8">Leathers to Choose From</h2>
          {customisationEnabled && leathers.length ? (
            <>
              <div className="flex flex-wrap justify-center gap-3">
                {leathers.map((l) => (
                  <span key={l} className="px-4 py-2 border border-brown/30 bg-cream text-[13px] font-sans text-brown">{l}</span>
                ))}
              </div>
              {customisationNote && <p className="mt-6 text-[13px] font-sans text-brown-mid">{customisationNote}</p>}
            </>
          ) : (
            <p className="text-sm font-sans text-brown-mid">Customisation is paused for now — please check back soon or contact us.</p>
          )}
        </div>
      </section>

      <section className="max-w-screen-md mx-auto px-6 py-16 text-center">
        <p className="font-serif text-2xl sm:text-3xl text-brown font-light">Start with a bag you love</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {[
            { label: "Women's Bags", href: '/products?gender=women' },
            { label: "Men's Bags", href: '/products?gender=men' },
            { label: 'Travel & Luggage', href: '/products?category=travel' },
          ].map((b) => (
            <Link key={b.href} to={b.href} className="px-6 py-3 bg-rust text-cream text-[11px] tracking-[0.18em] font-sans uppercase hover:bg-brown transition-colors">
              {b.label}
            </Link>
          ))}
        </div>
        <p className="mt-8 text-[13px] font-sans text-brown-mid">
          Questions about leathers or timing? <Link to="/contact" className="text-rust underline underline-offset-4">Contact us</Link>.
        </p>
      </section>
    </div>
  )
}
