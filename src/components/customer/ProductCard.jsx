import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'
import StarRating from '@/components/ui/StarRating'
import useCartStore from '@/store/cartStore'
import useWishlistStore from '@/store/wishlistStore'
import toast from 'react-hot-toast'

const BADGE_STYLES = {
  'BEST SELLER':      'bg-brown text-cream',
  'NEW':              'bg-gold text-brown',
  'ONLINE EXCLUSIVE': 'bg-cream-dark text-brown',
  'LIMITED EDITION':  'bg-brown-light text-cream',
}

export default function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem)
  const inWishlist = useWishlistStore((s) => s.isInWishlist(product.id))
  const toggleWishlist = useWishlistStore((s) => s.toggleItem)

  const handleAddToCart = (e) => {
    e.preventDefault()
    addItem(product, 1)
    toast.success(`${product.name} added to cart`, { style: { fontFamily: 'Jost, sans-serif', fontSize: '13px' } })
  }

  const handleToggleWishlist = (e) => {
    e.preventDefault()
    const added = toggleWishlist(product)
    toast(added ? 'Saved to wishlist' : 'Removed from wishlist', { style: { fontFamily: 'Jost, sans-serif', fontSize: '13px' } })
  }

  const imgs = product.images || []
  const primaryImage = imgs[0] || null
  const secondaryImage = imgs[1] || imgs[0] || null

  return (
    <Link to={`/products/${product.slug}`} className="group block">
      <div className="product-card-wrap">
        {/* Image block */}
        <div className="relative bg-cream-dark overflow-hidden" style={{ aspectRatio: '3/4' }}>
          {/* Placeholder when no image */}
          {!primaryImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-cream-dark">
              <span className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid">No Image</span>
            </div>
          )}
          {/* Primary image */}
          {primaryImage && (
            <img
              src={primaryImage}
              alt={product.name}
              className="product-img-primary absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          )}
          {/* Secondary image (hover swap) */}
          {secondaryImage && secondaryImage !== primaryImage && (
            <img
              src={secondaryImage}
              alt={product.name}
              className="product-img-secondary absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          )}

          {/* Badge */}
          {product.badge && (
            <div className="absolute top-3 left-3 z-10">
              <span className={`text-[9px] tracking-luxury font-sans px-2 py-1 ${BADGE_STYLES[product.badge] || 'bg-brown text-cream'}`}>
                {product.badge}
              </span>
            </div>
          )}

          {/* Wishlist */}
          <button
            onClick={handleToggleWishlist}
            className={`absolute top-3 right-3 z-10 w-8 h-8 bg-cream flex items-center justify-center transition-opacity duration-300 hover:bg-cream-dark ${inWishlist ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart size={14} strokeWidth={1.5} className="text-brown" fill={inWishlist ? '#2C1810' : 'none'} />
          </button>

          {/* Out of stock */}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-cream/70 flex items-center justify-center z-10">
              <span className="text-[10px] tracking-luxury font-sans text-brown uppercase">Sold Out</span>
            </div>
          )}

          {/* Quick Add — appears on hover at bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-10 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="w-full bg-brown text-cream text-[10px] tracking-luxury font-sans uppercase py-3 hover:bg-brown-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Quick Add
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="pt-3 pb-1">
          {/* Material */}
          {product.material && (
            <p className="text-[9px] tracking-luxury text-brown-mid font-sans uppercase mb-1.5">{product.material}</p>
          )}

          {/* Name */}
          <h3 className="font-serif text-base text-brown leading-snug line-clamp-2">{product.name}</h3>

          {/* Stars + count */}
          <div className="flex items-center gap-1.5 mt-1.5 mb-2">
            <StarRating rating={product.rating} size={11} />
            <span className="text-[10px] font-sans text-brown-mid">({product.reviewCount})</span>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2">
            <span className="font-sans text-sm text-brown font-light">{formatCurrency(product.price)}</span>
            {product.originalPrice > product.price && (
              <span className="text-[11px] font-sans text-brown-mid line-through">{formatCurrency(product.originalPrice)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
