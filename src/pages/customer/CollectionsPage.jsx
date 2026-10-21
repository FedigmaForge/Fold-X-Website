import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { getCollections } from '@/services/api'
import useDocumentMeta from '@/utils/useDocumentMeta'

// /collections — every active collection as a large image card
export default function CollectionsPage() {
  const [collections, setCollections] = useState(null)

  useDocumentMeta('Collections · FoldX', 'Explore FoldX collections — handcrafted leather lines, each with its own character.')

  useEffect(() => {
    getCollections().then(setCollections).catch(() => setCollections([]))
  }, [])

  return (
    <div className="bg-cream min-h-screen">
      <div className="border-b border-border py-12 px-4 sm:px-6 text-center">
        <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">
          <Link to="/" className="hover:text-brown transition-colors">Home</Link> / Collections
        </p>
        <h1 className="font-serif text-4xl lg:text-5xl text-brown font-light">The Collections</h1>
        <p className="mt-3 text-sm font-sans font-light text-brown-mid max-w-lg mx-auto">
          Each line has its own character — find the one that fits the way you carry.
        </p>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        {collections === null ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-cream-dark animate-pulse" style={{ aspectRatio: '4/5' }} />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-serif text-2xl text-brown font-light mb-4">New collections are on their way</p>
            <Link to="/products" className="text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5">
              Shop All Products
            </Link>
          </div>
        ) : (
          <ScrollReveal className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {collections.map((c) => (
              <Link key={c.id} to={`/collections/${c.id}`} className="group block">
                <div className="relative overflow-hidden bg-cream-dark" style={{ aspectRatio: '4/5' }}>
                  {(c.cardImage || c.image) && (
                    <img
                      src={c.cardImage || c.image}
                      alt={c.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-cream">
                    <p className="font-serif text-3xl font-light leading-tight">{c.name}</p>
                    {c.tagline && <p className="mt-1.5 text-[12px] font-sans font-light text-cream/85">{c.tagline}</p>}
                    <p className="mt-4 text-[10px] tracking-luxury font-sans uppercase">
                      {c.count} piece{c.count === 1 ? '' : 's'} · Discover →
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </ScrollReveal>
        )}
      </div>
    </div>
  )
}
