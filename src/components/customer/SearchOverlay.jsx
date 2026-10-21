import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, X, ArrowRight } from 'lucide-react'
import { getProducts } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import useSiteContentStore from '@/store/siteContentStore'

const POPULAR = ['Tote Bags', 'Laptop Bags', 'Sling Bags', 'Backpacks', 'Luggage', 'Wallets']
const MAX_RESULTS = 8

// Full-width search panel that drops down over the page, with live results
// as you type. Always mounted so it can animate in and out.
export default function SearchOverlay({ open, onClose }) {
  const [query, setQuery] = useState('')
  // Results are tagged with the term they answer, so "searching" is simply
  // "the latest results are for a different term"
  const [found, setFound] = useState({ term: '', list: [], total: 0 })
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const categoryTiles = useSiteContentStore((s) => s.homeTiles)

  const term = query.trim()

  // Focus on open, lock page scroll, close on Escape
  useEffect(() => {
    if (!open) return
    // Focus straight away (no delay) so the first keystrokes aren't lost
    inputRef.current?.focus({ preventScroll: true })
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // Debounced live search; a newer keystroke cancels the older response
  useEffect(() => {
    if (term.length < 2) return
    let stale = false
    const t = setTimeout(() => {
      getProducts({ search: term })
        .then((list) => { if (!stale) setFound({ term, list: list.slice(0, MAX_RESULTS), total: list.length }) })
        .catch(() => { if (!stale) setFound({ term, list: [], total: 0 }) })
    }, 250)
    return () => { stale = true; clearTimeout(t) }
  }, [term])

  const close = () => {
    onClose()
    setQuery('')
    setFound({ term: '', list: [], total: 0 })
  }

  const goToAll = (q = term) => {
    if (!q) return
    navigate(`/products?search=${encodeURIComponent(q)}`)
    close()
  }

  const showResults = term.length >= 2
  const loading = showResults && found.term !== term
  const { list: results, total } = found

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={close}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        aria-hidden={!open}
        className={`fixed top-0 left-0 right-0 z-[61] bg-cream max-h-[90vh] overflow-y-auto shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-6 pb-10">
          <form
            onSubmit={(e) => { e.preventDefault(); goToAll() }}
            className="flex items-center gap-4 border-b border-brown pb-3"
          >
            <Search size={20} strokeWidth={1.5} className="text-brown-mid shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are you looking for?"
              className="flex-1 min-w-0 bg-transparent outline-none font-serif text-2xl sm:text-3xl font-light text-brown placeholder:text-brown-mid/60"
              tabIndex={open ? 0 : -1}
            />
            <button type="button" onClick={close} className="p-1 text-brown-mid hover:text-brown" aria-label="Close search" tabIndex={open ? 0 : -1}>
              <X size={22} strokeWidth={1.5} />
            </button>
          </form>

          {!showResults ? (
            <div className="grid sm:grid-cols-2 gap-10 mt-8">
              <div>
                <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-4">Popular Searches</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToAll(p)}
                      className="px-4 py-2 border border-border text-[12px] font-sans text-brown hover:border-brown transition-colors"
                      tabIndex={open ? 0 : -1}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-4">Shop by Category</p>
                <ul className="grid grid-cols-2 gap-y-2.5 gap-x-6">
                  {categoryTiles.map((c) => (
                    <li key={`${c.label}-${c.href}`}>
                      <Link to={c.href} onClick={close} className="font-serif text-lg text-brown hover:text-brown-mid" tabIndex={open ? 0 : -1}>
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid">
                  {loading ? 'Searching…' : `${total} result${total === 1 ? '' : 's'} for “${term}”`}
                </p>
                {!loading && total > 0 && (
                  <button type="button" onClick={() => goToAll()} className="inline-flex items-center gap-1.5 text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5">
                    View All <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {!loading && total === 0 ? (
                <p className="font-serif text-xl text-brown font-light py-6">
                  Nothing matched “{term}”. Try a broader word, like “wallet” or “bag”.
                </p>
              ) : (
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
                  {results.map((p) => (
                    <Link key={p.id} to={`/products/${p.slug}`} onClick={close} className="group block" tabIndex={open ? 0 : -1}>
                      <div className="bg-cream-dark overflow-hidden" style={{ aspectRatio: '1/1' }}>
                        {p.images?.[0] && (
                          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                        )}
                      </div>
                      <p className="mt-3 font-serif text-base text-brown leading-snug line-clamp-2">{p.name}</p>
                      <p className="mt-1 text-sm font-sans font-light text-brown">{formatCurrency(p.price)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
