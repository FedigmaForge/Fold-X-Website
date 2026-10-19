import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2, Download, Upload, AlertTriangle } from 'lucide-react'
import { DiscountBadge } from '@/components/ui/Badge'
import StarRating from '@/components/ui/StarRating'
import ProductImportModal from '@/components/admin/ProductImportModal'
import { formatCurrency } from '@/utils/formatCurrency'
import { getAllProducts, deleteProduct, downloadProductsCsv } from '@/services/api'
import toast from 'react-hot-toast'
import { usePermissions } from '@/utils/permissions'

function statusOf(p) {
  if (!p.isActive) return 'draft'
  if (p.publishAt && new Date(p.publishAt) > new Date()) return 'scheduled'
  return 'published'
}

const STATUS_STYLE = {
  published: ['Published', 'bg-green-100 text-green-700'],
  draft: ['Draft', 'bg-gray-100 text-gray-500'],
  scheduled: ['Scheduled', 'bg-blue-100 text-blue-700'],
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low stock' },
  { key: 'draft', label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
]

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const { canEditCatalog } = usePermissions()

  const load = () => getAllProducts().then((p) => { setProducts(p); setLoading(false) }).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])

  const counts = {
    all: products.length,
    low: products.filter((p) => p.lowStockCount > 0).length,
    draft: products.filter((p) => statusOf(p) === 'draft').length,
    scheduled: products.filter((p) => statusOf(p) === 'scheduled').length,
  }

  const q = search.toLowerCase()
  const filtered = products
    .filter((p) => tab === 'all' || (tab === 'low' ? p.lowStockCount > 0 : statusOf(p) === tab))
    .filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.variants?.some((v) => v.sku?.toLowerCase().includes(q))
    )

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await deleteProduct(id)
      setProducts((ps) => ps.filter((p) => p.id !== id))
      toast.success('Product deleted')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {products.length} total products{!canEditCatalog && ' · view only for your role'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadProductsCsv().catch((e) => toast.error(e.message))}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-violet-400 hover:text-violet-600"
          >
            <Download size={15} /> Export CSV
          </button>
          {canEditCatalog && (
            <>
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-violet-400 hover:text-violet-600"
              >
                <Upload size={15} /> Import CSV
              </button>
              <Link
                to="/admin/products/new"
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus size={16} /> Add Product
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
              {t.key !== 'all' && counts[t.key] > 0 && <span className={`ml-1.5 ${t.key === 'low' ? 'text-orange-600' : 'text-gray-400'}`}>{counts[t.key]}</span>}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, category or SKU…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-5 py-3">Product</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Price</th>
                <th className="text-left px-5 py-3">Stock</th>
                <th className="text-left px-5 py-3">Rating</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">{canEditCatalog && 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
                ))
              ) : filtered.map((p) => {
                const [statusLabel, statusCls] = STATUS_STYLE[statusOf(p)]
                const activeVariants = p.variants?.filter((v) => v.isActive) ?? []
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-xl object-cover bg-gray-50 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center text-[9px] text-gray-400">IMG</div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800 line-clamp-1">{p.name}</p>
                          <p className="text-xs text-gray-400">
                            {activeVariants.length ? `${activeVariants.length} variant${activeVariants.length === 1 ? '' : 's'}` : (p.sku || 'No variants')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {p.category}
                      {p.subcategory && <span className="block text-xs text-gray-400">{p.subcategory}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{formatCurrency(p.price)}</p>
                      {p.discount > 0 && <DiscountBadge discount={p.discount} />}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-medium ${p.stock === 0 ? 'text-red-500' : 'text-gray-700'}`}>{p.stock}</span>
                      {p.lowStockCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-orange-600 mt-0.5" title={`At or below ${p.lowStockThreshold}`}>
                          <AlertTriangle size={11} /> {activeVariants.length ? `${p.lowStockCount} variant${p.lowStockCount === 1 ? '' : 's'} low` : 'Low'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4"><StarRating rating={p.rating} size={13} showValue /></td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>{statusLabel}</span>
                      {statusOf(p) === 'scheduled' && (
                        <span className="block text-xs text-gray-400 mt-0.5">{new Date(p.publishAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canEditCatalog && (
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/admin/products/${p.id}/edit`} className="p-1.5 rounded-lg hover:bg-violet-100 text-violet-600 transition-colors" aria-label="Edit"><Edit2 size={15} /></Link>
                          <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors" aria-label="Delete"><Trash2 size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">{tab === 'low' ? 'Nothing is running low' : 'No products found'}</div>
        )}
      </div>

      {importOpen && <ProductImportModal onClose={() => setImportOpen(false)} onImported={() => { setImportOpen(false); load() }} />}
    </div>
  )
}
