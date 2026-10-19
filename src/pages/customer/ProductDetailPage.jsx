import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShoppingCart, Zap, Heart, CheckCircle, Truck, ZoomIn, X, ChevronLeft, ChevronRight } from 'lucide-react'
import StarRating from '@/components/ui/StarRating'
import { DiscountBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/utils/formatCurrency'
import { getProductBySlug, getReviewsByProduct, submitReview, getProducts } from '@/services/api'
import useCartStore from '@/store/cartStore'
import useAuthStore from '@/store/authStore'
import useWishlistStore from '@/store/wishlistStore'
import ProductCard from '@/components/customer/ProductCard'
import toast from 'react-hot-toast'
import useDocumentMeta from '@/utils/useDocumentMeta'
import useSettingsStore from '@/store/settingsStore'

// Care guidance by material — genuine, general leather-care knowledge rather
// than fabricated per-product specifics (there's no real data source for the
// latter, and inventing precise numbers is the same mistake as the old
// fabricated reviewCount field).
const CARE_BY_MATERIAL = {
  'Full Grain Leather': [
    'Wipe with a soft, dry cloth after each use to remove dust and oils',
    'Condition every 3–6 months with a leather conditioner to prevent drying',
    'Keep away from direct sunlight and prolonged moisture',
    'Store stuffed with paper to hold its shape when not in use',
  ],
  'Pebbled Leather': [
    'Wipe clean with a soft, dry cloth — avoid harsh chemical cleaners',
    'Condition occasionally to maintain the grain texture',
    'Avoid prolonged exposure to direct sunlight',
    'Store in the dust bag provided when not in use',
  ],
  'Croco Embossed Leather': [
    'Wipe gently with a dry cloth — avoid rubbing the embossed texture',
    'Keep away from water; blot (never rub) if it gets wet',
    'Condition sparingly, testing on a small area first',
    'Store away from direct heat and sunlight',
  ],
  'Patent Leather': [
    'Wipe with a soft, slightly damp cloth to keep the glossy finish',
    'Avoid contact with alcohol-based products, which can dull the shine',
    'Store flat or upright, away from other items that could scratch it',
  ],
  'Waxed Leather': [
    'Buff gently with a soft cloth to refresh the natural wax sheen',
    'Water beads on the surface — wipe off promptly rather than letting it soak in',
    'Re-wax occasionally if the surface starts to look dry',
  ],
  'Vegetable Tanned Leather': [
    'Handle with clean, dry hands — this leather develops a natural patina over time',
    'Avoid excess water and direct sunlight, which can darken it unevenly',
    'Condition lightly every few months to keep it supple',
  ],
}

const DEFAULT_CARE = [
  'Wipe with a soft, dry cloth after use',
  'Keep away from direct sunlight and moisture',
  'Store in a cool, dry place when not in use',
]

export default function ProductDetailPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [mainImg, setMainImg] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState({})
  const [qty, setQty] = useState(1)
  const [tab, setTab] = useState('description')
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', body: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const ctaRef = useRef(null)

  const { addItem, openCart } = useCartStore()
  const { isLoggedIn, user } = useAuthStore()
  const inWishlist = useWishlistStore((s) => (product ? s.isInWishlist(product.id) : false))
  const storeName = useSettingsStore((s) => s.storeName)
  // Search-engine title/description, editable per product in the admin
  useDocumentMeta(
    product ? `${product.metaTitle || product.name} | ${storeName}` : null,
    product ? (product.metaDescription || product.description) : null,
  )
  const toggleWishlist = useWishlistStore((s) => s.toggleItem)

  useEffect(() => {
    setLoading(true)
    setRelated([])
    getProductBySlug(slug).then((p) => {
      setProduct(p)
      if (p) {
        // Fetched alongside product load, not after — keeps the review count
        // shown next to the star rating in sync with the Reviews tab count
        // instead of a stale/fabricated reviewCount field flashing first.
        getReviewsByProduct(p.id).then((r) => {
          setReviews(r)
          setLoading(false)
        })
        // Default selection: the first variant that's in stock (else the first)
        const vs = p.variants ?? []
        const first = vs.find((v) => v.stock > 0) ?? vs[0]
        setSelectedVariant(first ? { color: first.color, size: first.size } : (p.colors?.length ? { color: p.colors[0] } : {}))
        setQty(1)
        // "Complete the Look" — other pieces from the same category, not the product itself
        getProducts({ category: p.categoryId }).then((all) => {
          setRelated((Array.isArray(all) ? all : []).filter((x) => x.id !== p.id).slice(0, 4))
        })
      } else {
        setLoading(false)
      }
    })
    setMainImg(0)
  }, [slug])

  // Sticky mobile "Add to Bag" bar — shown once the real CTA row has scrolled
  // past the top of the viewport, hidden again if it's still below (initial load).
  useEffect(() => {
    const el = ctaRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [product])

  useEffect(() => {
    if (!lightboxOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxOpen(false)
      if (e.key === 'ArrowRight') setMainImg((i) => Math.min((product?.images?.length || 1) - 1, i + 1))
      if (e.key === 'ArrowLeft') setMainImg((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightboxOpen, product])

  const handleToggleWishlist = () => {
    const added = toggleWishlist(product)
    toast.success(added ? 'Saved to wishlist' : 'Removed from wishlist')
  }

  // ── Variants ── each colour/size combination has its own stock
  const variants = product?.variants ?? []
  const hasVariants = variants.length > 0
  const colorOptions = hasVariants ? [...new Set(variants.map((v) => v.color).filter(Boolean))] : (product?.colors ?? [])
  const sizeOptions = [...new Set(variants.map((v) => v.size).filter(Boolean))]
  const chosen = hasVariants
    ? variants.find((v) => v.color === (selectedVariant.color ?? '') && v.size === (selectedVariant.size ?? ''))
    : null
  const available = hasVariants ? (chosen?.stock ?? 0) : (product?.stock ?? 0)
  const inStockWith = (match) => variants.some((v) => match(v) && v.stock > 0)

  const chooseColor = (color) => {
    // Keep the size if that combination exists, else jump to the best size for this colour
    const sameSize = variants.find((v) => v.color === color && v.size === (selectedVariant.size ?? ''))
    const fallback = variants.find((v) => v.color === color && v.stock > 0) ?? variants.find((v) => v.color === color)
    const next = sameSize ?? fallback
    setSelectedVariant(next ? { color: next.color, size: next.size } : { ...selectedVariant, color })
    setQty(1)
  }
  const chooseSize = (size) => {
    setSelectedVariant((v) => ({ ...v, size }))
    setQty(1)
  }

  // Only the attributes that matter, e.g. { color: 'Tan' } — shown in the bag
  const variantForCart = hasVariants
    ? Object.fromEntries(Object.entries({ color: chosen?.color, size: chosen?.size }).filter(([, v]) => v))
    : selectedVariant

  const addToBag = () => addItem(product, Math.min(qty, available), variantForCart, chosen?.id)

  const handleAddToCart = () => {
    addToBag()
    openCart()
    toast.success('Added to cart!')
  }

  const handleBuyNow = () => {
    addToBag()
    window.location.href = '/checkout'
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (!isLoggedIn) { toast.error('Please sign in to leave a review'); return }
    setSubmittingReview(true)
    try {
      await submitReview({ productId: product.id, userName: user?.name, ...reviewForm })
      toast.success('Review submitted! It will appear after moderation.')
      setReviewForm({ rating: 5, title: '', body: '' })
    } catch (err) {
      toast.error(err.message || 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (loading) return (
    <div className="max-w-screen-xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-10">
      <div className="aspect-square bg-cream-dark animate-pulse" />
      <div className="space-y-4">
        {[1,2,3,4,5].map(i => <div key={i} className={`bg-cream-dark animate-pulse ${i===1?'h-8':'h-4'}`} />)}
      </div>
    </div>
  )

  if (!product) return (
    <div className="text-center py-24">
      <p className="text-brown-mid font-sans font-light">Product not found</p>
      <Link to="/products" className="text-brown border-b border-brown pb-0.5 text-[11px] tracking-luxury font-sans uppercase mt-4 inline-block hover:text-brown-mid hover:border-brown-mid transition-colors">Browse All Products</Link>
    </div>
  )

  const imgs = product.images || []

  return (
    <>
    <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-14">
      {/* Breadcrumb */}
      <nav className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid">
        <Link to="/" className="hover:text-brown transition-colors">Home</Link>
        {' / '}
        <Link to={`/products?category=${product.categoryId}`} className="hover:text-brown transition-colors">{product.category}</Link>
        {' / '}
        <span className="text-brown">{product.name}</span>
      </nav>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
        {/* Image gallery — thumbnail rail (left on desktop, below on mobile) + zoomable main image */}
        {(() => {
          const imgs = product.images || []
          const currentSrc = imgs[mainImg] || null
          return (
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              {imgs.length > 1 && (
                <div className="flex sm:flex-col gap-2 sm:w-20 shrink-0">
                  {imgs.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setMainImg(i)}
                      className={`w-16 h-16 sm:w-full sm:h-20 overflow-hidden border transition-colors shrink-0 ${i === mainImg ? 'border-brown' : 'border-border hover:border-brown-mid'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => currentSrc && setLightboxOpen(true)}
                className="group relative flex-1 aspect-square overflow-hidden bg-cream-dark border border-border cursor-zoom-in"
                aria-label="View larger image"
              >
                {currentSrc ? (
                  <img src={currentSrc} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[11px] tracking-luxury font-sans uppercase text-brown-mid">No Image</span>
                  </div>
                )}
                {currentSrc && (
                  <span className="absolute bottom-3 right-3 w-9 h-9 bg-cream/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn size={16} className="text-brown" />
                  </span>
                )}
              </button>
            </div>
          )
        })()}

        {/* Product info */}
        <div className="space-y-6">
          <div>
            <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-2">{product.category}</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-brown font-light leading-snug">{product.name}</h1>
          </div>

          <div className="flex items-center gap-3">
            <StarRating rating={product.rating} size={16} showValue />
            <span className="text-xs font-sans text-brown-mid">({reviews.length} review{reviews.length === 1 ? '' : 's'})</span>
            {available > 0 ? (
              <span className="text-xs font-sans text-brown-mid flex items-center gap-1">
                <CheckCircle size={13} /> {available <= 5 ? `Only ${available} left` : 'In Stock'}
              </span>
            ) : (
              <span className="text-xs font-sans text-red-500">{hasVariants && product.stock > 0 ? 'This option is sold out' : 'Out of Stock'}</span>
            )}
          </div>

          <div className="flex items-end gap-3">
            <span className="font-sans text-2xl text-brown font-light">{formatCurrency(product.price)}</span>
            {product.originalPrice > product.price && (
              <>
                <span className="text-base font-sans text-brown-mid line-through">{formatCurrency(product.originalPrice)}</span>
                <DiscountBadge discount={product.discount} />
              </>
            )}
          </div>
          {product.originalPrice > product.price && (
            <p className="text-xs font-sans text-brown-mid -mt-4">
              You save {formatCurrency(product.originalPrice - product.price)}
            </p>
          )}

          {/* Variants */}
          {colorOptions.length > 0 && (
            <div>
              <p className="label-brand">
                Color — <span className="normal-case text-brown">{selectedVariant.color}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((c) => {
                  const soldOut = hasVariants && !inStockWith((v) => v.color === c)
                  return (
                    <button
                      key={c}
                      onClick={() => chooseColor(c)}
                      title={soldOut ? 'Sold out' : undefined}
                      className={`px-3 py-1.5 border text-xs font-sans transition-colors ${selectedVariant.color === c ? 'border-brown bg-brown text-cream' : 'border-border text-brown hover:border-brown-mid'} ${soldOut ? 'line-through opacity-50' : ''}`}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {sizeOptions.length > 0 && (
            <div>
              <p className="label-brand">
                Size — <span className="normal-case text-brown">{selectedVariant.size}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((sz) => {
                  const exists = variants.some((v) => v.size === sz && v.color === (selectedVariant.color ?? ''))
                  const soldOut = !inStockWith((v) => v.size === sz && v.color === (selectedVariant.color ?? ''))
                  return (
                    <button
                      key={sz}
                      onClick={() => chooseSize(sz)}
                      disabled={!exists}
                      title={!exists ? 'Not available in this colour' : soldOut ? 'Sold out' : undefined}
                      className={`min-w-10 h-10 px-2 border text-xs font-sans transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${selectedVariant.size === sz ? 'border-brown bg-brown text-cream' : 'border-border text-brown hover:border-brown-mid'} ${soldOut && exists ? 'line-through opacity-50' : ''}`}
                    >
                      {sz}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-3">
            <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid">Quantity</p>
            <div className="flex items-center border border-border">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-cream-dark text-brown transition-colors">−</button>
              <span className="px-4 py-2 text-sm font-sans border-x border-border text-brown">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(available, q + 1))} className="px-3 py-2 hover:bg-cream-dark text-brown transition-colors">+</button>
            </div>
            <span className="text-[11px] font-sans text-brown-mid">{available} available</span>
          </div>

          {/* CTA buttons */}
          <div ref={ctaRef} className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={available === 0}
              className="flex-1 flex items-center justify-center gap-2 btn-brand-secondary"
            >
              <ShoppingCart size={16} /> Add to Cart
            </button>
            <button
              onClick={handleBuyNow}
              disabled={available === 0}
              className="flex-1 flex items-center justify-center gap-2 btn-brand-primary"
            >
              <Zap size={16} /> Buy Now
            </button>
            <button
              onClick={handleToggleWishlist}
              className="p-3 border border-border hover:border-brown transition-colors"
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={16} className="text-brown transition-colors" fill={inWishlist ? '#2C1810' : 'none'} />
            </button>
          </div>

          {/* Delivery info */}
          <div className="bg-cream-dark p-4 space-y-2 border border-border">
            <div className="flex items-center gap-2 text-xs font-sans text-brown-mid">
              <Truck size={15} className="text-brown" />
              <span>Free delivery on orders above ₹999</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-sans text-brown-mid">
              <CheckCircle size={15} className="text-brown" />
              <span>10-day easy returns</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex border-b border-border">
          {['description', 'features', 'care', 'reviews'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-[11px] tracking-luxury font-sans uppercase transition-colors border-b-2 -mb-px ${tab === t ? 'border-brown text-brown' : 'border-transparent text-brown-mid hover:text-brown'}`}
            >
              {t}{t === 'reviews' && ` (${reviews.length})`}
            </button>
          ))}
        </div>

        <div className="py-8">
          {tab === 'description' && (
            <p className="font-sans font-light text-brown-mid leading-relaxed max-w-2xl">{product.description}</p>
          )}
          {tab === 'features' && (
            <ul className="space-y-3 max-w-md">
              {product.features?.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm font-sans font-light text-brown-mid">
                  <CheckCircle size={15} className="text-brown shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          )}
          {tab === 'care' && (
            <div className="max-w-md space-y-4">
              {product.material && (
                <p className="text-xs font-sans text-brown-mid">Care guide for <span className="text-brown">{product.material}</span></p>
              )}
              <ul className="space-y-3">
                {(CARE_BY_MATERIAL[product.material] || DEFAULT_CARE).map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm font-sans font-light text-brown-mid">
                    <CheckCircle size={15} className="text-brown shrink-0 mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === 'reviews' && (
            <div className="space-y-8 max-w-2xl">
              {reviews.length === 0 ? (
                <p className="text-brown-mid font-sans font-light text-sm">No reviews yet. Be the first!</p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-sans text-brown">{r.userName}</p>
                        <StarRating rating={r.rating} size={13} />
                      </div>
                      <p className="text-xs font-sans text-brown-mid">{r.date}</p>
                    </div>
                    <p className="text-sm font-sans text-brown mb-1">{r.title}</p>
                    <p className="text-sm font-sans font-light text-brown-mid">{r.body}</p>
                  </div>
                ))
              )}

              {/* Review form */}
              <div className="border border-border p-5">
                <h4 className="font-serif text-lg text-brown mb-4">Write a Review</h4>
                <form onSubmit={handleReviewSubmit} className="space-y-3">
                  <div>
                    <p className="label-brand">Your Rating</p>
                    <StarRating
                      rating={reviewForm.rating}
                      size={22}
                      interactive
                      onChange={(r) => setReviewForm((f) => ({ ...f, rating: r }))}
                    />
                  </div>
                  <input
                    required
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Review title"
                    className="input-brand"
                  />
                  <textarea
                    required
                    rows={3}
                    value={reviewForm.body}
                    onChange={(e) => setReviewForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder="Share your experience with this product…"
                    className="input-brand resize-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="btn-brand-primary"
                  >
                    {submittingReview ? 'Submitting…' : 'Submit Review'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Complete the Look */}
      {related.length > 0 && (
        <div>
          <div className="text-center mb-8">
            <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-2">You May Also Like</p>
            <h2 className="font-serif text-3xl text-brown font-light">Complete the Look</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>

    {/* Lightbox */}
    {lightboxOpen && (
      <div className="fixed inset-0 z-[60] bg-brown/95 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
        <button
          onClick={() => setLightboxOpen(false)}
          className="absolute top-5 right-5 text-cream hover:text-gold transition-colors"
          aria-label="Close"
        >
          <X size={28} strokeWidth={1.5} />
        </button>
        {imgs.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); setMainImg((i) => Math.max(0, i - 1)) }}
            disabled={mainImg === 0}
            className="absolute left-4 sm:left-8 text-cream hover:text-gold transition-colors disabled:opacity-30"
            aria-label="Previous image"
          >
            <ChevronLeft size={32} strokeWidth={1.5} />
          </button>
        )}
        <img
          src={imgs[mainImg]}
          alt={product.name}
          onClick={(e) => e.stopPropagation()}
          className="max-w-[85vw] max-h-[85vh] object-contain"
        />
        {imgs.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); setMainImg((i) => Math.min(imgs.length - 1, i + 1)) }}
            disabled={mainImg === imgs.length - 1}
            className="absolute right-4 sm:right-8 text-cream hover:text-gold transition-colors disabled:opacity-30"
            aria-label="Next image"
          >
            <ChevronRight size={32} strokeWidth={1.5} />
          </button>
        )}
        {imgs.length > 1 && (
          <span className="absolute bottom-6 text-[11px] tracking-luxury font-sans text-cream/70">
            {mainImg + 1} / {imgs.length}
          </span>
        )}
      </div>
    )}

    {/* Sticky mobile add-to-bag bar */}
    {showStickyBar && (
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-cream border-t border-border px-4 py-3 flex items-center gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-sans text-brown truncate">{product.name}</p>
          <p className="text-sm font-sans text-brown">{formatCurrency(product.price)}</p>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={available === 0}
          className="btn-brand-primary flex items-center gap-2 shrink-0"
        >
          <ShoppingCart size={15} /> Add to Cart
        </button>
      </div>
    )}
    </>
  )
}
