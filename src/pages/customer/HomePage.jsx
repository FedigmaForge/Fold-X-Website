import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import BannerSlider from '@/components/customer/BannerSlider'
import ScrollReveal from '@/components/ui/ScrollReveal'
import SocialIcon from '@/components/ui/SocialIcon'
import { getProducts, getBanners, getCollection } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import useSiteContentStore from '@/store/siteContentStore'
import { DEFAULT_HERO_BANNERS } from '@/data/siteContentDefaults'

// Homepage sections, in the order of the reference site (damilano.com):
// hero → shop by category → gift store → for her / for him → made for every
// moment → featured collection → trending now → your next stop → community.
// Every section is edited in admin → Storefront.

// Products behind a storefront link, so the featured-collection carousel
// always matches where its "Shop Now" button goes.
async function productsForLink(href) {
  const [path, query = ''] = href.split('?')
  const collection = path.match(/^\/collections\/([^/]+)$/)
  if (collection) {
    const c = await getCollection(decodeURIComponent(collection[1]))
    return c?.products ?? []
  }
  if (path !== '/products') return []
  const p = new URLSearchParams(query)
  const list = await getProducts({
    category: p.get('category') || p.get('gender') || undefined,
    type: p.get('type') || undefined,
    collection: p.get('collection') || undefined,
    sale: p.get('sale') || undefined,
    search: p.get('search') || undefined,
    sort: p.get('sort') || 'newest',
    minPrice: p.get('minPrice') || undefined,
    maxPrice: p.get('maxPrice') || undefined,
  })
  const badge = p.get('badge')
  return badge ? list.filter((x) => x.badge?.toLowerCase().replace(/\s/g, '-') === badge) : list
}

// Square image with an uppercase label underneath (category, moments, trending)
function LabelTile({ tile, aspect = '1/1' }) {
  return (
    <Link to={tile.href} className="group block">
      <div className="overflow-hidden bg-cream-dark" style={{ aspectRatio: aspect }}>
        <img src={tile.image} alt={tile.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
      </div>
      <p className="tile-label mt-4 group-hover:underline underline-offset-4">{tile.label}</p>
    </Link>
  )
}

// One product at a time, with arrows and dots — the right half of the
// featured-collection block
function ProductCarousel({ products }) {
  const [index, setIndex] = useState(0)
  const touchX = useRef(null)
  if (!products.length) return null
  const i = index % products.length
  const p = products[i]
  const go = (d) => setIndex((x) => (x + d + products.length) % products.length)

  return (
    <div
      className="flex flex-col items-center justify-center h-full px-6 py-12"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        touchX.current = null
      }}
    >
      <div className="flex items-center gap-4 sm:gap-8 w-full max-w-md">
        <button onClick={() => go(-1)} className="p-2 text-brown hover:text-rust shrink-0" aria-label="Previous product">
          <ChevronLeft size={22} strokeWidth={1.3} />
        </button>
        <Link to={`/products/${p.slug}`} className="block flex-1 group" key={p.id}>
          <div className="aspect-square overflow-hidden bg-cream route-fade">
            {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
          </div>
        </Link>
        <button onClick={() => go(1)} className="p-2 text-brown hover:text-rust shrink-0" aria-label="Next product">
          <ChevronRight size={22} strokeWidth={1.3} />
        </button>
      </div>
      <Link to={`/products/${p.slug}`} className="mt-6 text-center text-[13px] tracking-[0.08em] font-sans uppercase text-brown hover:text-rust">
        {p.name}
      </Link>
      <p className="mt-2 text-sm font-sans text-brown">{formatCurrency(p.price)}</p>
      {products.length > 1 && (
        <div className="flex gap-2 mt-5">
          {products.map((x, k) => (
            <button
              key={x.id}
              onClick={() => setIndex(k)}
              className={`w-2 h-2 rounded-full transition-colors ${k === i ? 'bg-rust' : 'bg-border hover:bg-brown-mid'}`}
              aria-label={`Show ${x.name}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// What each network offers, and its button wording — for the community cards
const NETWORK_COPY = {
  instagram: { blurb: 'New launches, styling ideas and behind the scenes from our workshop.', cta: 'Follow on Instagram' },
  facebook: { blurb: 'Offers, events and store news — and a place to share your FoldX.', cta: 'Like us on Facebook' },
  youtube: { blurb: 'Craft stories, bag guides and leather-care videos.', cta: 'Subscribe on YouTube' },
  linkedin: { blurb: 'Company news, careers and partnerships.', cta: 'Follow on LinkedIn' },
}

// One card per social account that has a link (footer → social links)
function SocialCards({ social }) {
  const linked = social.filter((s) => s.href)
  if (!linked.length) return null
  return (
    <div className={`grid gap-4 sm:gap-5 ${linked.length >= 3 ? 'sm:grid-cols-3' : linked.length === 2 ? 'sm:grid-cols-2 max-w-3xl mx-auto' : 'max-w-sm mx-auto'}`}>
      {linked.map((s) => {
        const copy = NETWORK_COPY[s.label.toLowerCase()] ?? { blurb: '', cta: `Visit ${s.label}` }
        return (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center text-center border border-border bg-cream px-6 py-8 hover:border-rust transition-colors"
          >
            <span className="w-14 h-14 rounded-full bg-rust text-cream flex items-center justify-center group-hover:bg-brown transition-colors">
              <SocialIcon name={s.label} className="w-6 h-6" />
            </span>
            <span className="mt-4 text-[13px] tracking-[0.14em] font-sans uppercase text-brown">{s.label}</span>
            {s.handle && <span className="mt-1 text-[13px] font-sans text-rust">{s.handle}</span>}
            {copy.blurb && <span className="mt-3 text-[13px] font-sans font-light text-brown-mid leading-relaxed max-w-[260px]">{copy.blurb}</span>}
            <span className="mt-5 inline-block px-5 py-2 border border-brown text-[11px] tracking-[0.16em] font-sans uppercase text-brown group-hover:bg-brown group-hover:text-cream transition-colors">
              {copy.cta}
            </span>
          </a>
        )
      })}
    </div>
  )
}

function CommunityStrip({ community }) {
  const ref = useRef(null)
  const scroll = (d) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  const tile = (src, i) => (
    <div key={i} className="shrink-0 w-[46%] sm:w-[23%] lg:w-[15.5%] aspect-square overflow-hidden bg-cream-dark snap-start">
      <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
    </div>
  )
  return (
    <div className="relative">
      <div ref={ref} className="flex gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {community.images.map((src, i) =>
          community.href
            ? <a key={i} href={community.href} target="_blank" rel="noopener noreferrer" className="contents">{tile(src, i)}</a>
            : tile(src, i)
        )}
      </div>
      {community.images.length > 6 && (
        <>
          <button onClick={() => scroll(-1)} className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-cream/90 shadow items-center justify-center text-brown" aria-label="Scroll left">
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <button onClick={() => scroll(1)} className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-cream/90 shadow items-center justify-center text-brown" aria-label="Scroll right">
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </>
      )}
    </div>
  )
}

export default function HomePage() {
  const [banners, setBanners] = useState(null)
  const [collectionProducts, setCollectionProducts] = useState([])
  const categoryTiles = useSiteContentStore((s) => s.homeTiles)
  const gifting = useSiteContentStore((s) => s.homeGifting)
  const moments = useSiteContentStore((s) => s.homeMoments)
  const featured = useSiteContentStore((s) => s.homeEditorial)
  const trending = useSiteContentStore((s) => s.homeTrending)
  const nextStop = useSiteContentStore((s) => s.homeClosing)
  const community = useSiteContentStore((s) => s.homeCommunity)
  const social = useSiteContentStore((s) => s.footer.social)

  useEffect(() => {
    // Never leave the homepage without a hero: the transparent header sits on it
    getBanners()
      .then((list) => setBanners(Array.isArray(list) && list.length ? list : DEFAULT_HERO_BANNERS))
      .catch(() => setBanners(DEFAULT_HERO_BANNERS))
  }, [])

  useEffect(() => {
    let cancelled = false
    productsForLink(featured.ctaHref)
      .then((list) => { if (!cancelled) setCollectionProducts(list.slice(0, 8)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [featured.ctaHref])

  const [giftStore, forHer, forHim] = gifting

  return (
    <div className="bg-cream">
      {/* ── Hero slideshow (header floats over it) ── */}
      {banners === null ? (
        // Dark while loading, so the white header over it stays readable
        <div className="bg-brown animate-pulse h-[78vh] sm:h-[calc(100vh-36px)] min-h-[440px] max-h-[920px]" />
      ) : (
        <BannerSlider banners={banners} />
      )}

      {/* ── Shop by category ── */}
      {categoryTiles.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 sm:px-8 pt-14 lg:pt-20">
          <ScrollReveal>
            <h2 className="section-title mb-8 lg:mb-12">Shop by Category</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8 lg:gap-x-5 lg:gap-y-10">
              {categoryTiles.map((t) => <LabelTile key={`${t.label}-${t.href}`} tile={t} />)}
            </div>
          </ScrollReveal>
        </section>
      )}

      {/* ── The gift store (full width) ── */}
      {giftStore && (
        <section className="pt-14 lg:pt-20">
          <Link to={giftStore.href} className="group relative block overflow-hidden h-44 sm:h-60 lg:h-[340px] bg-brown">
            <img src={giftStore.image} alt={giftStore.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-[1500ms]" loading="lazy" />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-cream px-6">
              <p className="font-serif italic text-4xl sm:text-6xl lg:text-7xl font-light">{giftStore.label}</p>
              {giftStore.sub && <p className="mt-2 text-[11px] sm:text-xs tracking-[0.2em] font-sans uppercase text-cream/90">{giftStore.sub}</p>}
            </div>
          </Link>
        </section>
      )}

      {/* ── For her / for him ── */}
      {(forHer || forHim) && (
        <section className="grid sm:grid-cols-2 gap-0 pt-4 sm:pt-6">
          {[forHer, forHim].filter(Boolean).map((t) => (
            <Link key={`${t.label}-${t.href}`} to={t.href} className="group relative block overflow-hidden aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5] max-h-[820px] w-full bg-cream-dark">
              <img src={t.image} alt={t.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-[1500ms]" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <span className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 text-cream text-base sm:text-lg tracking-[0.08em] font-sans uppercase border-b border-cream pb-0.5">
                {t.label}
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* ── Made for every moment ── */}
      {moments.items.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 sm:px-8 pt-16 lg:pt-24">
          <ScrollReveal>
            <h2 className="section-title mb-8 lg:mb-10">{moments.title}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
              {moments.items.map((t) => <LabelTile key={`${t.label}-${t.href}`} tile={t} />)}
            </div>
          </ScrollReveal>
        </section>
      )}

      {/* ── Featured collection: image + product carousel ── */}
      <section className="pt-16 lg:pt-24 grid lg:grid-cols-2">
        <Link to={featured.ctaHref} className="group relative block overflow-hidden aspect-square sm:aspect-[4/3] lg:aspect-auto lg:min-h-[640px] bg-cream-dark">
          <img src={featured.image} alt={featured.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-[1500ms]" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          <div className="absolute left-6 bottom-6 sm:left-8 sm:bottom-8">
            {featured.title && <p className="font-serif text-2xl sm:text-3xl text-cream font-light mb-3 drop-shadow-sm">{featured.title}</p>}
            <span className="inline-block bg-rust text-cream text-[12px] font-sans px-5 py-2 group-hover:bg-brown transition-colors">
              {featured.ctaLabel}
            </span>
          </div>
        </Link>
        <div className="bg-cream">
          <ProductCarousel products={collectionProducts} />
        </div>
      </section>

      {/* ── Trending now ── */}
      {trending.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 sm:px-8 pt-16 lg:pt-24">
          <ScrollReveal>
            <h2 className="section-title mb-8 lg:mb-10">Trending Now</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
              {trending.map((t) => <LabelTile key={`${t.label}-${t.href}`} tile={t} />)}
            </div>
          </ScrollReveal>
        </section>
      )}

      {/* ── Your next stop ── */}
      <section className="pt-16 lg:pt-24">
        <h2 className="section-title mb-8 px-4">{nextStop.title}</h2>
        <Link to={nextStop.ctaHref} className="group relative block overflow-hidden h-72 sm:h-[460px] lg:h-[560px] bg-brown">
          <img src={nextStop.image} alt={nextStop.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-[1500ms]" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 text-center text-cream">
            {nextStop.body && <p className="max-w-xl mx-auto text-sm font-sans font-light text-cream/90">{nextStop.body}</p>}
            <span className="inline-block mt-4 border border-cream px-6 py-2 text-[11px] tracking-[0.18em] font-sans uppercase group-hover:bg-cream group-hover:text-brown transition-colors">
              {nextStop.ctaLabel}
            </span>
          </div>
        </Link>
      </section>

      {/* ── Join our community: social accounts + photo strip ── */}
      {(community.images.length > 0 || social.some((s) => s.href)) && (
        <section className="bg-cream-dark/60 mt-16 lg:mt-24 py-16 lg:py-20">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-8">
            <ScrollReveal>
              <h2 className="section-title">{community.title}</h2>
              {community.intro && (
                <p className="mt-3 max-w-xl mx-auto text-center text-sm font-sans font-light text-brown-mid leading-relaxed">{community.intro}</p>
              )}
              <div className="mt-10">
                <SocialCards social={social} />
              </div>
            </ScrollReveal>
          </div>
          {community.images.length > 0 && (
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 mt-12">
              {community.handle && (
                community.href
                  ? <a href={community.href} target="_blank" rel="noopener noreferrer" className="block text-center mb-5 text-sm font-sans text-rust hover:underline">{community.handle} on Instagram</a>
                  : <p className="text-center mb-5 text-sm font-sans text-rust">{community.handle}</p>
              )}
              <CommunityStrip community={community} />
            </div>
          )}
        </section>
      )}
    </div>
  )
}
