import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import ProductCard from '@/components/customer/ProductCard'
import useWishlistStore from '@/store/wishlistStore'

export default function WishlistPage() {
  const items = useWishlistStore((s) => s.items)

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-2">Saved For Later</p>
        <h1 className="font-serif text-4xl text-brown font-light">Your Wishlist</h1>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={32} strokeWidth={1} className="mx-auto text-brown-mid mb-4" />
          <p className="text-sm font-sans font-light text-brown-mid mb-6">Nothing saved yet — tap the heart on any piece to keep it here.</p>
          <Link to="/products" className="btn-brand-secondary inline-block">
            Explore The Collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  )
}
