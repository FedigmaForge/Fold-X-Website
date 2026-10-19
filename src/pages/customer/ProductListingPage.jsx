import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import ProductCard from '@/components/customer/ProductCard'
import { getProducts, getCategories } from '@/services/api'

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest' },
  { value: 'price-asc',  label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating',     label: 'Top Rated' },
]

const MATERIALS = ['Full Grain Leather', 'Pebbled Leather', 'Croco Embossed Leather', 'Waxed Leather', 'Patent Leather', 'Vegetable Tanned Leather']

const COLORS = ['Black', 'Dark Brown', 'Tan', 'Cognac', 'Burgundy', 'Navy', 'Caramel', 'Forest Green', 'Champagne Gold', 'Nude']

const BADGES = [
  { value: 'best-seller',     label: 'Best Sellers' },
  { value: 'new',             label: 'New Arrivals' },
  { value: 'online-exclusive',label: 'Online Exclusive' },
  { value: 'limited-edition', label: 'Limited Edition' },
]

function FilterGroup({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border pb-5 mb-5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-[10px] tracking-luxury font-sans uppercase text-brown mb-3"
      >
        {title}
        <ChevronDown size={13} strokeWidth={1.5} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children}
    </div>
  )
}

export default function ProductListingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => { getCategories().then(setCategories) }, [])

  const category   = searchParams.get('category')  || ''
  const gender     = searchParams.get('gender')     || ''
  const type       = searchParams.get('type')       || '' // subcategory slug from menu links
  const search     = searchParams.get('search')     || ''
  const sort       = searchParams.get('sort')       || 'newest'
  const badge      = searchParams.get('badge')      || ''
  const material   = searchParams.get('material')   || ''
  const color      = searchParams.get('color')      || ''
  const minPrice   = searchParams.get('minPrice')   ? Number(searchParams.get('minPrice'))  : undefined
  const maxPrice   = searchParams.get('maxPrice')   ? Number(searchParams.get('maxPrice'))  : undefined

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const clearAll = () => setSearchParams({})

  const activeFilterCount = [category, gender, type, badge, material, color, minPrice, maxPrice]
    .filter(Boolean).length

  useEffect(() => {
    setLoading(true)
    getProducts({ category: category || gender, type, search, sort, minPrice, maxPrice }).then((data) => {
      let filtered = [...data]
      if (badge)    filtered = filtered.filter((p) => p.badge?.toLowerCase().replace(/\s/g, '-') === badge)
      if (material) filtered = filtered.filter((p) => p.material === material)
      if (color)    filtered = filtered.filter((p) => p.colors?.includes(color))
      setProducts(filtered)
      setLoading(false)
    })
  }, [category, gender, type, search, sort, badge, material, color, minPrice, maxPrice])

  const typeLabel = type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const baseTitle = search
    ? `Search: "${search}"`
    : gender
      ? gender === 'women' ? "Women's Collection" : "Men's Collection"
      : category
        ? categories.find((c) => c.id === category)?.name || category
        : 'All Products'
  const pageTitle = type && !search ? `${baseTitle} · ${typeLabel}` : baseTitle

  const renderFilterPanel = () => (
    <div>
      <FilterGroup title="Category">
        <div className="space-y-1">
          <button
            onClick={() => { setParam('category', ''); setParam('gender', '') }}
            className={`block w-full text-left text-[12px] font-sans py-1.5 transition-colors ${!category && !gender ? 'text-brown font-medium' : 'text-brown-mid hover:text-brown'}`}
          >
            All Products
          </button>
          <button
            onClick={() => { setParam('gender', 'women'); setParam('category', '') }}
            className={`block w-full text-left text-[12px] font-sans py-1.5 transition-colors ${gender === 'women' ? 'text-brown font-medium' : 'text-brown-mid hover:text-brown'}`}
          >
            Women
          </button>
          <button
            onClick={() => { setParam('gender', 'men'); setParam('category', '') }}
            className={`block w-full text-left text-[12px] font-sans py-1.5 transition-colors ${gender === 'men' ? 'text-brown font-medium' : 'text-brown-mid hover:text-brown'}`}
          >
            Men
          </button>
          {categories.filter((c) => !['women', 'men'].includes(c.id)).map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setParam('category', cat.id); setParam('gender', '') }}
              className={`flex items-center justify-between w-full text-left text-[12px] font-sans py-1.5 transition-colors ${category === cat.id ? 'text-brown font-medium' : 'text-brown-mid hover:text-brown'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Material">
        <div className="space-y-1">
          {MATERIALS.map((m) => (
            <button
              key={m}
              onClick={() => setParam('material', material === m ? '' : m)}
              className={`flex items-center gap-2 w-full text-left text-[12px] font-sans py-1.5 transition-colors ${material === m ? 'text-brown font-medium' : 'text-brown-mid hover:text-brown'}`}
            >
              <span className={`w-2.5 h-2.5 border border-brown-mid inline-block flex-shrink-0 ${material === m ? 'bg-brown border-brown' : ''}`} />
              {m}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Color">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setParam('color', color === c ? '' : c)}
              className={`text-[10px] tracking-wide font-sans px-2.5 py-1 border transition-colors ${color === c ? 'border-brown bg-brown text-cream' : 'border-border text-brown-mid hover:border-brown hover:text-brown'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Collection">
        <div className="space-y-1">
          {BADGES.map((b) => (
            <button
              key={b.value}
              onClick={() => setParam('badge', badge === b.value ? '' : b.value)}
              className={`block w-full text-left text-[12px] font-sans py-1.5 transition-colors ${badge === b.value ? 'text-brown font-medium' : 'text-brown-mid hover:text-brown'}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Price Range" defaultOpen={false}>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="number"
              placeholder="Min ₹"
              defaultValue={minPrice}
              onBlur={(e) => setParam('minPrice', e.target.value)}
              className="w-full border-b border-border bg-transparent outline-none text-[12px] font-sans text-brown py-1 placeholder:text-brown-mid"
            />
          </div>
          <span className="text-brown-mid text-[12px] font-sans self-end pb-1">–</span>
          <div className="flex-1">
            <input
              type="number"
              placeholder="Max ₹"
              defaultValue={maxPrice}
              onBlur={(e) => setParam('maxPrice', e.target.value)}
              className="w-full border-b border-border bg-transparent outline-none text-[12px] font-sans text-brown py-1 placeholder:text-brown-mid"
            />
          </div>
        </div>
      </FilterGroup>

      {activeFilterCount > 0 && (
        <button
          onClick={clearAll}
          className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid hover:text-brown transition-colors"
        >
          Clear All ({activeFilterCount})
        </button>
      )}
    </div>
  )

  return (
    <div className="bg-cream min-h-screen">
      {/* Page header */}
      <div className="border-b border-border py-10 px-6">
        <div className="max-w-screen-xl mx-auto">
          <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-2">
            <Link to="/" className="hover:text-brown transition-colors">Home</Link>
            {' / '}{pageTitle}
          </p>
          <h1 className="font-serif text-4xl text-brown font-light">{pageTitle}</h1>
          {!loading && (
            <p className="text-[11px] font-sans text-brown-mid mt-1">{products.length} pieces</p>
          )}
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-8 flex gap-10">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block w-52 shrink-0 sticky top-28 self-start">
          {renderFilterPanel()}
        </aside>

        {/* Products area */}
        <div className="flex-1 min-w-0">
          {/* Sort + mobile filter bar */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden flex items-center gap-1.5 text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5"
            >
              <SlidersHorizontal size={12} strokeWidth={1.5} />
              Filter {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </button>
            <div className="relative ml-auto">
              <select
                value={sort}
                onChange={(e) => setParam('sort', e.target.value)}
                className="appearance-none bg-transparent outline-none text-[10px] tracking-luxury font-sans uppercase text-brown cursor-pointer pr-4"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={11} strokeWidth={1.5} className="absolute right-0 top-1/2 -translate-y-1/2 text-brown pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-cream-dark animate-pulse" style={{ aspectRatio: '3/4' }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-28">
              <p className="font-serif text-2xl text-brown font-light mb-3">No pieces found</p>
              <p className="text-[12px] font-sans text-brown-mid mb-6">Try adjusting your filters or explore all products</p>
              <button
                onClick={clearAll}
                className="text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5 hover:text-brown-mid hover:border-brown-mid transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <>
          <div className="fixed inset-0 bg-brown/60 z-40" onClick={() => setFiltersOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-cream z-50 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] tracking-luxury font-sans uppercase text-brown">Filters</span>
              <button onClick={() => setFiltersOpen(false)}>
                <X size={16} strokeWidth={1.5} className="text-brown" />
              </button>
            </div>
            {renderFilterPanel()}
            <button
              onClick={() => setFiltersOpen(false)}
              className="w-full mt-6 bg-brown text-cream text-[10px] tracking-luxury font-sans uppercase py-3 hover:bg-brown-light transition-colors"
            >
              Show {products.length} Results
            </button>
          </div>
        </>
      )}
    </div>
  )
}
