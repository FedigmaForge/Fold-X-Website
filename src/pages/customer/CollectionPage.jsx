import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import ProductCard from '@/components/customer/ProductCard'
import { getCollection } from '@/services/api'
import useDocumentMeta from '@/utils/useDocumentMeta'

const SORTS = {
  featured:     { label: 'Featured',           fn: null },
  'price-asc':  { label: 'Price: Low to High', fn: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price: High to Low', fn: (a, b) => b.price - a.price },
}

// /collections/:id — hero, story and every product in the collection
export default function CollectionPage() {
  const { id } = useParams()
  // `undefined` while loading, `null` when the collection doesn't exist
  const [loaded, setLoaded] = useState({ id: null, collection: undefined })
  const [sort, setSort] = useState('featured')

  useEffect(() => {
    let cancelled = false
    getCollection(id)
      .then((c) => { if (!cancelled) setLoaded({ id, collection: c }) })
      .catch(() => { if (!cancelled) setLoaded({ id, collection: null }) })
    return () => { cancelled = true }
  }, [id])

  const collection = loaded.id === id ? loaded.collection : undefined
  useDocumentMeta(collection ? `${collection.name} · FoldX` : null, collection?.tagline || collection?.description)

  if (collection === undefined) {
    return (
      <div className="bg-cream min-h-screen">
        <div className="bg-cream-dark animate-pulse" style={{ height: 'min(60vh, 520px)' }} />
      </div>
    )
  }

  if (collection === null) {
    return (
      <div className="bg-cream min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <p className="font-serif text-3xl text-brown font-light mb-3">Collection not found</p>
        <p className="text-sm font-sans text-brown-mid mb-6">It may have ended or moved.</p>
        <Link to="/collections" className="text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5">
          See All Collections
        </Link>
      </div>
    )
  }

  const products = SORTS[sort].fn ? [...collection.products].sort(SORTS[sort].fn) : collection.products

  return (
    <div className="bg-cream min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brown" style={{ height: 'min(60vh, 520px)' }}>
        {collection.image && (
          <img src={collection.image} alt={collection.name} className="absolute inset-0 w-full h-full object-cover hero-kenburns" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-12 text-center text-cream">
          <p className="text-[10px] tracking-luxury font-sans uppercase text-gold-light mb-3">
            <Link to="/collections" className="hover:text-cream transition-colors">Collections</Link>
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-tight">{collection.name}</h1>
          {collection.tagline && <p className="mt-3 text-sm font-sans font-light text-cream/85">{collection.tagline}</p>}
        </div>
      </section>

      {collection.description && (
        <section className="max-w-2xl mx-auto px-6 py-12 lg:py-16 text-center">
          <p className="font-serif text-xl sm:text-2xl text-brown font-light leading-relaxed whitespace-pre-line">{collection.description}</p>
        </section>
      )}

      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 pb-20">
        <div className="flex items-center justify-between border-t border-border pt-6 mb-8">
          <p className="text-[11px] font-sans text-brown-mid">{products.length} piece{products.length === 1 ? '' : 's'}</p>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none bg-transparent outline-none text-[10px] tracking-luxury font-sans uppercase text-brown cursor-pointer pr-4"
              aria-label="Sort"
            >
              {Object.entries(SORTS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ChevronDown size={11} strokeWidth={1.5} className="absolute right-0 top-1/2 -translate-y-1/2 text-brown pointer-events-none" />
          </div>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-serif text-2xl text-brown font-light mb-4">Pieces for this collection are coming soon</p>
            <Link to="/products" className="text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5">Shop All Products</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </div>
  )
}
