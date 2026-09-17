import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'

export default function BannerSlider({ banners = [] }) {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent((c) => (c + 1) % banners.length), [banners.length])

  useEffect(() => {
    if (banners.length <= 1) return
    const id = setInterval(next, 5500)
    return () => clearInterval(id)
  }, [next, banners.length])

  if (!banners.length) return null

  return (
    <div className="relative w-full overflow-hidden bg-brown" style={{ height: 'min(90vh, 720px)' }}>
      {/* Crossfade slides */}
      {banners.map((banner, i) => (
        <div
          key={banner.id}
          className="absolute inset-0 hero-slide"
          style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
          aria-hidden={i !== current}
        >
          {/* Desktop image */}
          <img
            src={banner.desktopImage}
            alt={banner.title}
            className={`hidden sm:block absolute inset-0 w-full h-full object-cover ${i === current ? 'hero-kenburns' : ''}`}
          />
          {/* Mobile image */}
          <img
            src={banner.mobileImage}
            alt={banner.title}
            className={`sm:hidden absolute inset-0 w-full h-full object-cover ${i === current ? 'hero-kenburns' : ''}`}
          />
          {/* Dark gradient overlay — subtle, on left side */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />

          {/* Text overlay — top-left, luxury minimal */}
          <div className="absolute inset-0 flex items-end sm:items-center px-8 sm:px-16 lg:px-24 pb-16 sm:pb-0" style={{ zIndex: 2 }}>
            <div className="text-cream max-w-lg">
              {banner.label && (
                <p className="text-[10px] tracking-luxury text-gold font-sans uppercase mb-4">{banner.label}</p>
              )}
              <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-tight whitespace-pre-line">
                {banner.title}
              </h2>
              <Link
                to={banner.link || '/products'}
                className="inline-block mt-8 text-[11px] tracking-luxury text-cream font-sans uppercase border-b border-cream pb-0.5 hover:text-gold hover:border-gold transition-colors duration-300"
              >
                Shop Now →
              </Link>
            </div>
          </div>
        </div>
      ))}

      {/* Dot navigation — thin lines */}
      {banners.length > 1 && (
        <div className="absolute bottom-8 left-8 sm:left-16 lg:left-24 flex gap-2 z-10">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Slide ${i + 1}`}
              className="block transition-all duration-300"
              style={{
                width: i === current ? 32 : 16,
                height: 1,
                background: i === current ? '#FAF7F4' : 'rgba(250,247,244,0.4)',
              }}
            />
          ))}
        </div>
      )}

      {/* Slide counter */}
      {banners.length > 1 && (
        <div className="absolute bottom-8 right-8 sm:right-16 lg:right-24 z-10 text-[10px] tracking-luxury text-cream/60 font-sans">
          {String(current + 1).padStart(2, '0')} / {String(banners.length).padStart(2, '0')}
        </div>
      )}
    </div>
  )
}
