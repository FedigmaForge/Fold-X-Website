import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import BannerSlider from '@/components/customer/BannerSlider'
import ProductCard from '@/components/customer/ProductCard'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { journalPosts } from '@/data/journalData'
import { formatDate } from '@/utils/formatDate'
import { getFeaturedProducts, getProducts, getBanners } from '@/services/api'
import useSiteContentStore from '@/store/siteContentStore'

const MARQUEE_TEXT = [
  'Handcrafted in India',
  'Full Grain Leather',
  'Free Shipping on ₹999+',
  'RFID Protected Wallets',
  '10-Day Easy Returns',
  'Lifetime Craft Guarantee',
]

const MATERIAL_PROMISE = [
  {
    title: 'Full Grain Leather',
    body: 'We use only the top layer of the hide — the strongest, most durable part. It develops a rich patina unique to its owner.',
  },
  {
    title: 'Hand-Finished Edges',
    body: 'Every edge is hand-burnished and sealed with natural wax for a smooth, rounded finish that lasts decades.',
  },
  {
    title: 'Lifetime Guarantee',
    body: 'We stand behind every stitch. If it fails due to craftsmanship, we repair or replace it — for life.',
  },
]

export default function HomePage() {
  const [banners, setBanners] = useState([])
  const [featured, setFeatured] = useState([])
  const [trending, setTrending] = useState([])
  const [loading, setLoading] = useState(true)
  // Category tiles + editorial block are editable from admin → Storefront
  const categoryTiles = useSiteContentStore((s) => s.homeTiles)
  const editorial = useSiteContentStore((s) => s.homeEditorial)

  useEffect(() => {
    getBanners().then(setBanners)
    Promise.all([
      getFeaturedProducts(),
      getProducts({ sort: 'rating' }),
    ]).then(([f, t]) => {
      const featuredSlice = f.slice(0, 4)
      const featuredIds = new Set(featuredSlice.map((p) => p.id))
      // "Trending" is meant to read differently from "Best Sellers" — exclude
      // whatever's already featured above so the two rows don't show the same cards.
      const trendingSlice = (Array.isArray(t) ? t : []).filter((p) => !featuredIds.has(p.id)).slice(0, 4)
      setFeatured(featuredSlice)
      setTrending(trendingSlice)
      setLoading(false)
    })
  }, [])

  return (
    <div className="bg-cream">
      {/* ── Hero Banner ─────────────────────────────── */}
      {banners.length === 0 ? (
        <div className="bg-cream-dark animate-pulse" style={{ height: 'min(90vh, 720px)' }} />
      ) : (
        <BannerSlider banners={banners} />
      )}

      {/* ── Marquee Strip ───────────────────────────── */}
      <div className="bg-brown py-3 overflow-hidden border-y border-brown-light">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...MARQUEE_TEXT, ...MARQUEE_TEXT].map((text, i) => (
            <span key={i} className="text-[10px] tracking-luxury font-sans font-light text-gold uppercase mx-8">
              {text} <span className="text-brown-mid mx-4">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Shop by Category ────────────────────────── */}
      <section className="py-20 px-6 max-w-screen-xl mx-auto">
        <ScrollReveal className="text-center mb-12">
          <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">Explore</p>
          <h2 className="font-serif text-4xl lg:text-5xl text-brown font-light">The Collections</h2>
        </ScrollReveal>
        <ScrollReveal delay={100} className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {categoryTiles.map((cat) => (
            <Link key={`${cat.label}-${cat.href}`} to={cat.href} className="group block relative overflow-hidden">
              <div className="relative overflow-hidden" style={{ aspectRatio: '2/3' }}>
                <img
                  src={cat.image}
                  alt={cat.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brown/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                  <p className="font-serif text-xl sm:text-2xl text-cream font-light leading-tight">{cat.label}</p>
                  <p className="text-[10px] tracking-luxury font-sans uppercase text-gold-light mt-1">{cat.sub}</p>
                </div>
              </div>
            </Link>
          ))}
        </ScrollReveal>
      </section>

      {/* ── New Collection Editorial (2-col) ────────── */}
      <section className="bg-cream-dark py-20">
        <ScrollReveal className="max-w-screen-xl mx-auto px-6 grid lg:grid-cols-2 gap-0 items-center">
          {/* Image */}
          <div className="relative overflow-hidden" style={{ aspectRatio: '4/5' }}>
            <img
              src={editorial.image}
              alt={editorial.title.replace(/\n/g, ' ')}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Text */}
          <div className="px-6 lg:px-16 py-12 lg:py-0">
            {editorial.eyebrow && (
              <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-5">{editorial.eyebrow}</p>
            )}
            <h2 className="font-serif text-4xl lg:text-5xl xl:text-6xl text-brown font-light leading-tight whitespace-pre-line">
              {editorial.title}
            </h2>
            <p className="mt-6 text-sm font-sans font-light text-brown-mid leading-relaxed max-w-sm whitespace-pre-line">
              {editorial.body}
            </p>
            <Link
              to={editorial.ctaHref}
              className="inline-block mt-8 text-[11px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5 hover:text-brown-mid hover:border-brown-mid transition-colors"
            >
              {editorial.ctaLabel}
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Best Sellers ────────────────────────────── */}
      <section className="py-20 px-6 max-w-screen-xl mx-auto">
        <ScrollReveal className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-2">Most Loved</p>
            <h2 className="font-serif text-4xl text-brown font-light">Best Sellers</h2>
          </div>
          <Link
            to="/products?badge=best-seller"
            className="text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5 hover:text-brown-mid hover:border-brown-mid transition-colors hidden sm:inline-block"
          >
            View All
          </Link>
        </ScrollReveal>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-cream-dark animate-pulse" style={{ aspectRatio: '3/4' }} />
            ))}
          </div>
        ) : (
          <ScrollReveal delay={100} className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </ScrollReveal>
        )}
      </section>

      {/* ── Brand Story ─────────────────────────────── */}
      <section className="py-24 px-6 bg-brown text-center">
        <ScrollReveal className="max-w-2xl mx-auto">
          <p className="text-[10px] tracking-luxury font-sans uppercase text-gold mb-6">Our Story</p>
          <blockquote className="font-serif text-2xl sm:text-3xl lg:text-4xl text-cream font-light leading-relaxed italic">
            "We believe a wallet is not just a utility — it is a daily ritual. Crafted to carry your world, and grow more beautiful the more it is used."
          </blockquote>
          <p className="mt-8 text-[11px] tracking-luxury font-sans uppercase text-brown-mid">— The FoldX Atelier, Bangalore</p>
          <Link
            to="/journal/inside-the-atelier"
            className="inline-block mt-10 text-[10px] tracking-luxury font-sans uppercase text-cream border-b border-cream pb-0.5 hover:text-gold hover:border-gold transition-colors"
          >
            Discover Our Craft
          </Link>
        </ScrollReveal>
      </section>

      {/* ── From the Journal ────────────────────────── */}
      <section className="py-20 px-6 max-w-screen-xl mx-auto">
        <ScrollReveal className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-2">Stories</p>
            <h2 className="font-serif text-4xl text-brown font-light">From the Journal</h2>
          </div>
          <Link
            to="/journal"
            className="text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5 hover:text-brown-mid hover:border-brown-mid transition-colors hidden sm:inline-block"
          >
            Read All Stories
          </Link>
        </ScrollReveal>
        <ScrollReveal delay={100} className="grid sm:grid-cols-3 gap-6 lg:gap-8">
          {journalPosts.map((post) => (
            <Link key={post.id} to={`/journal/${post.slug}`} className="group block">
              <div className="overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <p className="mt-4 text-[10px] tracking-luxury font-sans uppercase text-brown-mid">{formatDate(post.date)}</p>
              <h3 className="mt-2 font-serif text-lg text-brown font-light leading-snug group-hover:text-brown-mid transition-colors">
                {post.title}
              </h3>
            </Link>
          ))}
        </ScrollReveal>
      </section>

      {/* ── Material Promise ─────────────────────────── */}
      <section className="py-20 px-6 max-w-screen-xl mx-auto">
        <ScrollReveal className="text-center mb-14">
          <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">The FoldX Promise</p>
          <h2 className="font-serif text-4xl text-brown font-light">Why Our Leather?</h2>
        </ScrollReveal>
        <ScrollReveal delay={100} className="grid sm:grid-cols-3 gap-12">
          {MATERIAL_PROMISE.map((item) => (
            <div key={item.title} className="text-center">
              <div className="w-10 h-px bg-gold mx-auto mb-6" />
              <h3 className="font-serif text-xl text-brown font-light mb-3">{item.title}</h3>
              <p className="text-[12px] font-sans font-light text-brown-mid leading-relaxed">{item.body}</p>
            </div>
          ))}
        </ScrollReveal>
      </section>

      {/* ── Trending Now ────────────────────────────── */}
      <section className="py-20 px-6 bg-cream-dark">
        <div className="max-w-screen-xl mx-auto">
          <ScrollReveal className="flex items-end justify-between mb-10">
            <div>
              <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-2">Right Now</p>
              <h2 className="font-serif text-4xl text-brown font-light">Trending</h2>
            </div>
            <Link
              to="/products"
              className="text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5 hover:text-brown-mid hover:border-brown-mid transition-colors hidden sm:inline-block"
            >
              See Everything
            </Link>
          </ScrollReveal>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-cream animate-pulse" style={{ aspectRatio: '3/4' }} />
              ))}
            </div>
          ) : (
            <ScrollReveal delay={100} className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {(trending.length ? trending : featured).map((p) => <ProductCard key={p.id} product={p} />)}
            </ScrollReveal>
          )}
        </div>
      </section>

      {/* ── Offer strip ─────────────────────────────── */}
      <section className="py-14 px-6 text-center border-t border-border">
        <ScrollReveal>
          <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">First Order</p>
          <p className="font-serif text-3xl text-brown font-light">
            Use code <span className="text-gold">FOLDX10</span> for 10% off
          </p>
          <Link
            to="/products"
            className="inline-block mt-6 text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5 hover:text-brown-mid hover:border-brown-mid transition-colors"
          >
            Shop Now
          </Link>
        </ScrollReveal>
      </section>
    </div>
  )
}
