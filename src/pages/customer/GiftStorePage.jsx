import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Gift, PenLine, RotateCcw } from 'lucide-react'
import ProductCard from '@/components/customer/ProductCard'
import { getProducts } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import useSiteContentStore from '@/store/siteContentStore'
import useSettingsStore from '@/store/settingsStore'
import useDocumentMeta from '@/utils/useDocumentMeta'

// ?for= picks who the gift is for; ?under= a price ceiling. Both combine.
const RECIPIENTS = [
  { value: '',     label: 'All Gifts', category: undefined },
  { value: 'her',  label: 'For Her',   category: 'women' },
  { value: 'him',  label: 'For Him',   category: 'men' },
  { value: 'sets', label: 'Gift Sets', category: 'gifts' },
]
const PRICE_BANDS = [4999, 9999, 19999]

// /gifts — the gift store
export default function GiftStorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const hero = useSiteContentStore((s) => s.giftStore)
  const { giftWrapFee, returnWindowDays } = useSettingsStore()
  const [result, setResult] = useState({ key: null, products: [] })

  const recipient = RECIPIENTS.find((r) => r.value === searchParams.get('for')) ?? RECIPIENTS[0]
  const under = PRICE_BANDS.includes(Number(searchParams.get('under'))) ? Number(searchParams.get('under')) : null
  const key = `${recipient.value}|${under ?? ''}`

  useDocumentMeta('Gift Store · FoldX', 'Handcrafted leather gifts for her and for him — gift wrap and a personal note available at checkout.')

  useEffect(() => {
    let cancelled = false
    getProducts({ category: recipient.category, maxPrice: under ?? undefined, sort: 'rating' })
      .then((products) => { if (!cancelled) setResult({ key, products }) })
      .catch(() => { if (!cancelled) setResult({ key, products: [] }) })
    return () => { cancelled = true }
  }, [key, recipient.category, under])

  const loading = result.key !== key
  const products = result.products

  const setFilter = (name, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    setSearchParams(next, { replace: true })
  }

  const chip = (active) =>
    `px-4 py-2 text-[11px] tracking-wide font-sans border transition-colors whitespace-nowrap ${active ? 'bg-brown border-brown text-cream' : 'border-border text-brown hover:border-brown'}`

  return (
    <div className="bg-cream min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brown" style={{ height: 'min(60vh, 520px)' }}>
        <img src={hero.image} alt={hero.title} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-12 text-center text-cream">
          {hero.eyebrow && <p className="text-[10px] tracking-luxury font-sans uppercase text-gold-light mb-3">{hero.eyebrow}</p>}
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-tight whitespace-pre-line">{hero.title}</h1>
          {hero.body && <p className="mt-3 max-w-xl mx-auto text-sm font-sans font-light text-cream/85 whitespace-pre-line">{hero.body}</p>}
        </div>
      </section>

      {/* Gift services */}
      <section className="border-b border-border">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 grid sm:grid-cols-3 gap-6 text-center">
          <div>
            <Gift size={20} strokeWidth={1.25} className="mx-auto text-brown" />
            <p className="mt-3 text-[11px] tracking-luxury font-sans uppercase text-brown">Gift Wrapping</p>
            <p className="mt-1 text-[12px] font-sans font-light text-brown-mid">Signature wrap for {formatCurrency(giftWrapFee)}, chosen at checkout</p>
          </div>
          <div>
            <PenLine size={20} strokeWidth={1.25} className="mx-auto text-brown" />
            <p className="mt-3 text-[11px] tracking-luxury font-sans uppercase text-brown">A Personal Note</p>
            <p className="mt-1 text-[12px] font-sans font-light text-brown-mid">Add your message to any wrapped gift</p>
          </div>
          <div>
            <RotateCcw size={20} strokeWidth={1.25} className="mx-auto text-brown" />
            <p className="mt-3 text-[11px] tracking-luxury font-sans uppercase text-brown">Easy Returns</p>
            <p className="mt-1 text-[12px] font-sans font-light text-brown-mid">{returnWindowDays}-day returns after delivery</p>
          </div>
        </div>
      </section>

      {/* Filters + products */}
      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <div className="flex flex-col gap-4 items-center mb-10">
          <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-full -mx-4 px-4 sm:mx-0 sm:px-0">
            {RECIPIENTS.map((r) => (
              <button key={r.value || 'all'} onClick={() => setFilter('for', r.value)} className={chip(recipient.value === r.value)}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-full -mx-4 px-4 sm:mx-0 sm:px-0">
            <button onClick={() => setFilter('under', '')} className={chip(!under)}>Any Price</button>
            {PRICE_BANDS.map((p) => (
              <button key={p} onClick={() => setFilter('under', String(p))} className={chip(under === p)}>
                Under {formatCurrency(p)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-cream-dark animate-pulse" style={{ aspectRatio: '3/4' }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-serif text-2xl text-brown font-light mb-3">No gifts match just yet</p>
            <p className="text-[12px] font-sans text-brown-mid mb-6">Try another price or recipient.</p>
            <Link to="/gifts" onClick={() => setSearchParams({})} className="text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5">
              See All Gifts
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-sans text-brown-mid mb-6">{products.length} gift{products.length === 1 ? '' : 's'}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
