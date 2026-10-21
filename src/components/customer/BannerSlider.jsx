import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play } from 'lucide-react'

// Full-bleed homepage slideshow (images from admin → Banners). The header
// floats over its top edge, so a soft dark gradient keeps the icons readable.
export default function BannerSlider({ banners = [] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => setCurrent((c) => (c + 1) % banners.length), [banners.length])

  useEffect(() => {
    if (banners.length <= 1 || paused) return
    const id = setInterval(next, 5500)
    return () => clearInterval(id)
  }, [next, banners.length, paused])

  if (!banners.length) return null

  return (
    <section
      className="relative w-full overflow-hidden bg-brown h-[78vh] sm:h-[calc(100vh-36px)] min-h-[440px] max-h-[920px]"
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      {banners.map((banner, i) => (
        <Link
          key={banner.id}
          to={banner.link || '/products'}
          className="absolute inset-0 hero-slide block"
          style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
          aria-hidden={i !== current}
          tabIndex={i === current ? 0 : -1}
        >
          <img
            src={banner.desktopImage}
            alt={banner.title.replace(/\n/g, ' ')}
            className={`hidden sm:block absolute inset-0 w-full h-full object-cover ${i === current ? 'hero-kenburns' : ''}`}
          />
          <img
            src={banner.mobileImage}
            alt={banner.title.replace(/\n/g, ' ')}
            className={`sm:hidden absolute inset-0 w-full h-full object-cover ${i === current ? 'hero-kenburns' : ''}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-black/25" />

          <div className="absolute inset-x-0 bottom-16 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 px-6 sm:px-16 lg:px-24 flex sm:justify-end" style={{ zIndex: 2 }}>
            <div className="text-cream text-center sm:text-right w-full sm:max-w-xl">
              {banner.label && (
                <p className="text-[10px] sm:text-[11px] tracking-[0.25em] font-sans uppercase text-cream/85 mb-3">{banner.label}</p>
              )}
              <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-light leading-tight whitespace-pre-line drop-shadow-sm">
                {banner.title}
              </h2>
            </div>
          </div>
        </Link>
      ))}

      {banners.length > 1 && (
        <div className="absolute bottom-6 inset-x-0 z-10 flex items-center justify-center gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === current}
              className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-cream' : 'bg-cream/45 hover:bg-cream/70'}`}
            />
          ))}
          <button
            onClick={() => setPaused((p) => !p)}
            className="ml-3 w-6 h-6 flex items-center justify-center text-cream/80 hover:text-cream"
            aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
          >
            {paused ? <Play size={12} strokeWidth={1.5} /> : <Pause size={12} strokeWidth={1.5} />}
          </button>
        </div>
      )}
    </section>
  )
}
