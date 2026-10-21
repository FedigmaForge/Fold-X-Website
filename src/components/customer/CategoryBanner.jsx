import { Link } from 'react-router-dom'

// Da Milano-style category banner: photo on the left with a slanted edge,
// the title in large uppercase on a soft panel to the right
export function CategoryBanner({ image, title, sub, count }) {
  return (
    <section className="relative overflow-hidden bg-cream-dark h-[200px] sm:h-[320px] lg:h-[420px]" aria-label={title}>
      {image && (
        <>
          {/* thin light stripe along the slant, as on the reference site */}
          <div className="absolute inset-y-0 left-0 w-[64%] lg:w-[63%] bg-cream" style={{ clipPath: 'polygon(0 0, 100% 0, 92% 100%, 0 100%)' }} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[63%] lg:w-[62%] overflow-hidden" style={{ clipPath: 'polygon(0 0, 100% 0, 92% 100%, 0 100%)' }}>
            <img src={image} alt="" className="w-full h-full object-cover hero-kenburns" />
          </div>
        </>
      )}
      <div className={`absolute inset-y-0 right-0 flex flex-col items-center justify-center text-center px-3 sm:px-8 ${image ? 'w-[40%]' : 'w-full'}`}>
        <h1 className="font-sans font-normal uppercase tracking-[0.06em] text-brown leading-tight text-lg sm:text-3xl lg:text-[40px]">{title}</h1>
        {sub && <p className="hidden sm:block mt-3 text-[13px] font-sans font-light text-brown-mid max-w-xs">{sub}</p>}
        {count !== undefined && (
          <p className="mt-2 sm:mt-4 text-[10px] sm:text-[11px] tracking-[0.2em] font-sans uppercase text-brown-mid">
            {count} {count === 1 ? 'Bag' : 'Bags'}
          </p>
        )}
      </div>
    </section>
  )
}

// Row of round thumbnails for the bag types in the current category
export function SubcategoryStrip({ items, active, onPick }) {
  if (items.length < 2) return null
  return (
    <nav aria-label="Shop by type" className="flex gap-5 sm:gap-8 overflow-x-auto no-scrollbar justify-start sm:justify-center px-1 py-2">
      {items.map((it) => {
        const on = active && it.slug.startsWith(active)
        return (
          <button key={it.slug} onClick={() => onPick(on ? '' : it.slug)} className="group shrink-0 w-20 sm:w-24 text-center" aria-pressed={on}>
            <span className={`block mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-cream-dark ring-offset-2 ring-offset-cream transition ${on ? 'ring-2 ring-rust' : 'group-hover:ring-1 group-hover:ring-brown-mid'}`}>
              {it.image && <img src={it.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
            </span>
            <span className={`block mt-2 text-[11px] sm:text-[12px] font-sans leading-tight ${on ? 'text-rust' : 'text-brown'}`}>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function Breadcrumb({ trail }) {
  return (
    <p className="text-[11px] tracking-[0.06em] font-sans text-brown-mid">
      <Link to="/" className="hover:text-brown">Home</Link>
      {trail.map((t) => (
        <span key={t.label}>
          {' / '}
          {t.href ? <Link to={t.href} className="hover:text-brown">{t.label}</Link> : <span className="text-brown">{t.label}</span>}
        </span>
      ))}
    </p>
  )
}
