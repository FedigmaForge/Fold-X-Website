import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronLeft, Plus, X } from 'lucide-react'
import ImageUploader from '@/components/admin/ImageUploader'
import VariantsEditor from '@/components/admin/VariantsEditor'
import StockHistory from '@/components/admin/StockHistory'
import { getProductById, createProduct, updateProduct, getAdminCategories } from '@/services/api'
import toast from 'react-hot-toast'
import { usePermissions } from '@/utils/permissions'

const BADGE_OPTIONS = ['', 'BEST SELLER', 'NEW', 'ONLINE EXCLUSIVE', 'LIMITED EDITION']

const emptyForm = {
  name: '', slug: '', categoryId: 'women', category: 'Women',
  price: '', originalPrice: '',
  material: '', badge: '',
  description: '', stock: '',
  subcategory: '', sku: '', lowStockThreshold: '5', costPrice: '',
  variants: [],
  status: 'published', publishAt: '', // status: published | draft | scheduled
  metaTitle: '', metaDescription: '',
  hsnCode: '', gstRate: '',
  tags: '',
  colors: [],
  features: [],
  images: [],
  isActive: true, isFeatured: false,
}

const toSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm"
const toLocalInput = (d) => {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function statusOf(p) {
  if (!p.isActive) return 'draft'
  if (p.publishAt && new Date(p.publishAt) > new Date()) return 'scheduled'
  return 'published'
}

const toFormVariants = (variants) =>
  (variants ?? []).map(({ id, color, size, sku, stock, isActive }) => ({ id, color, size, sku: sku ?? '', stock, isActive }))

export default function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const [newFeature, setNewFeature] = useState('')
  const { canEditCatalog } = usePermissions()

  // Admin list includes hidden categories, so products can still be filed under them
  useEffect(() => { getAdminCategories().then(setCategories).catch(() => {}) }, [])

  useEffect(() => {
    if (isEdit) {
      getProductById(id).then((p) => {
        if (p) {
          setForm({
            ...emptyForm,
            ...p,
            price: String(p.price),
            originalPrice: String(p.originalPrice || ''),
            stock: String(p.stock),
            tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
            colors: p.colors || p.variants?.colors || [],
            features: p.features || [],
            images: p.images || [],
            badge: p.badge || '',
            material: p.material || '',
            hsnCode: p.hsnCode || '',
            gstRate: p.gstRate ?? '',
            subcategory: p.subcategory || '',
            sku: p.sku || '',
            lowStockThreshold: String(p.lowStockThreshold ?? 5),
            costPrice: p.costPrice ?? '',
            variants: toFormVariants(p.variants),
            status: statusOf(p),
            publishAt: p.publishAt ? toLocalInput(p.publishAt) : '',
            metaTitle: p.metaTitle || '',
            metaDescription: p.metaDescription || '',
          })
        }
        setLoading(false)
      })
    }
  }, [id, isEdit])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleNameChange = (e) => {
    const name = e.target.value
    setForm((f) => ({ ...f, name, slug: toSlug(name) }))
  }

  const discount = form.price && form.originalPrice && Number(form.originalPrice) > Number(form.price)
    ? Math.round(((Number(form.originalPrice) - Number(form.price)) / Number(form.originalPrice)) * 100)
    : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    if (!form.price) { toast.error('Price is required'); return }
    const hasVariants = form.variants.length > 0
    if (!hasVariants && form.stock === '') { toast.error('Stock quantity is required'); return }
    if (form.status === 'scheduled' && (!form.publishAt || new Date(form.publishAt) <= new Date())) {
      toast.error('Pick a future date and time to schedule publishing'); return
    }

    setSaving(true)
    const catObj = categories.find((c) => c.id === form.categoryId)
    const { status, ...rest } = form
    const payload = {
      ...rest,
      price: Number(form.price),
      originalPrice: Number(form.originalPrice) || Number(form.price),
      discount,
      isActive: status !== 'draft',
      publishAt: status === 'scheduled' ? new Date(form.publishAt).toISOString() : null,
      lowStockThreshold: Number(form.lowStockThreshold) || 0,
      costPrice: form.costPrice === '' ? null : Number(form.costPrice),
      subcategory: form.subcategory || null,
      // With variants the server derives stock and colours from them
      ...(hasVariants
        ? { variants: form.variants.map((v) => ({ ...v, stock: Number(v.stock) || 0 })), stock: undefined, sku: null }
        : { variants: [], stock: Number(form.stock), colors: [] }),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      slug: form.slug || toSlug(form.name),
      category: catObj?.name || form.category,
      images: form.images.map((img) => (typeof img === 'string' ? img : img.preview || img.url || img)),
      badge: form.badge || undefined,
      // Blank → null, so the product follows the store-wide default in Settings
      hsnCode: form.hsnCode.trim() || null,
      gstRate: form.gstRate === '' ? null : Number(form.gstRate),
    }
    try {
      if (isEdit) {
        const saved = await updateProduct(id, payload)
        toast.success('Product updated!')
        // Stay on the page so the variant ids and stock history reflect the save
        setForm((f) => ({ ...f, variants: toFormVariants(saved.variants), stock: String(saved.stock) }))
        setHistoryKey((k) => k + 1)
        setSaving(false)
      } else {
        const created = await createProduct(payload)
        toast.success('Product created!')
        navigate(`/admin/products/${created.id}/edit`, { replace: true })
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save product')
      setSaving(false)
    }
  }

  const subOptions = categories.find((c) => c.id === form.categoryId)?.sub ?? []
  const variantTotal = form.variants.filter((v) => v.isActive).reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
  const addFeature = () => {
    if (newFeature.trim()) {
      set('features', [...form.features, newFeature.trim()])
      setNewFeature('')
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 bg-white'
  const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'

  if (!canEditCatalog) return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-4">Only a Manager or Super Admin can add or edit products.</p>
      <Link to="/admin/products" className="text-sm text-violet-600 hover:underline">Back to products</Link>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
  )

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/products" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Product' : 'New Product'}</h1>
          <p className="text-sm text-gray-400">{isEdit ? `Editing: ${form.name}` : 'Fill in product details'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: main fields ─────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Basic info */}
            <Card title="Basic Information">
              <div>
                <label className={labelCls}>Product Name *</label>
                <input required value={form.name} onChange={handleNameChange} placeholder="e.g. Classic Structured Tote" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>URL Slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  placeholder="auto-generated from name"
                  className={`${inputCls} font-mono text-xs`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Category *</label>
                  <select
                    required
                    value={form.categoryId}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value)
                      setForm((f) => ({ ...f, categoryId: e.target.value, category: cat?.name || e.target.value, subcategory: '' }))
                    }}
                    className={inputCls}
                  >
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive ? '' : ' (hidden)'}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Subcategory</label>
                  <select value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)} className={inputCls}>
                    <option value="">— None —</option>
                    {/* Keep a value that's no longer in the category's list selectable */}
                    {[...new Set([...subOptions, ...(form.subcategory ? [form.subcategory] : [])])].map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Material</label>
                  <input
                    value={form.material}
                    onChange={(e) => set('material', e.target.value)}
                    placeholder="e.g. Full Grain Leather"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Badge</label>
                <select value={form.badge} onChange={(e) => set('badge', e.target.value)} className={inputCls}>
                  {BADGE_OPTIONS.map((b) => <option key={b} value={b}>{b || '— No Badge —'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Description *</label>
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Describe the product in detail…"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </Card>

            {/* Pricing & Stock */}
            <Card title="Pricing & Stock">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Selling Price (₹) *</label>
                  <input required type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>MRP (₹)</label>
                  <input type="number" min="0" value={form.originalPrice} onChange={(e) => set('originalPrice', e.target.value)} placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Discount</label>
                  <div className="flex items-center h-[42px] border border-gray-200 rounded-xl px-3 bg-gray-50">
                    <span className={`text-sm font-semibold ${discount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {discount > 0 ? `${discount}% OFF` : '—'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Cost price (₹)</label>
                  <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} placeholder="What one unit costs you" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Margin (staff only)</label>
                  <div className="flex items-center h-[42px] border border-gray-200 rounded-xl px-3 bg-gray-50 text-sm text-gray-600">
                    {form.costPrice !== '' && Number(form.price) > 0
                      ? (() => {
                          // Selling price is GST-inclusive; margin is on the price excluding GST
                          const exGst = Number(form.price) / (1 + (form.gstRate === '' ? 18 : Number(form.gstRate)) / 100)
                          const profit = exGst - Number(form.costPrice)
                          return `₹${Math.round(profit).toLocaleString('en-IN')} per unit · ${Math.round((profit / exGst) * 100)}% of the price excl. GST`
                        })()
                      : 'Add a cost price to see the margin — used by Finance → Profit'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Stock Quantity{form.variants.length ? ' (from variants)' : ' *'}</label>
                  {form.variants.length ? (
                    <div className="flex items-center h-[42px] border border-gray-200 rounded-xl px-3 bg-gray-50 text-sm text-gray-700">{variantTotal}</div>
                  ) : (
                    <input type="number" min="0" step="1" value={form.stock} onChange={(e) => set('stock', e.target.value)} placeholder="0" className={inputCls} />
                  )}
                </div>
                <div>
                  <label className={labelCls}>SKU{form.variants.length ? ' (per variant)' : ''}</label>
                  <input value={form.variants.length ? '' : form.sku} onChange={(e) => set('sku', e.target.value)} disabled={form.variants.length > 0} placeholder={form.variants.length ? '—' : 'e.g. FX-TOTE-01'} className={`${inputCls} font-mono disabled:bg-gray-50`} />
                </div>
                <div>
                  <label className={labelCls}>Low-stock alert at</label>
                  <input type="number" min="0" step="1" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <div>
                  <label className={labelCls}>Tags (comma-separated)</label>
                  <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="leather, wallet, gift" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>HSN Code</label>
                  <input
                    value={form.hsnCode}
                    onChange={(e) => set('hsnCode', e.target.value.replace(/\D/g, '').slice(0, 8))}
                    inputMode="numeric"
                    placeholder="Store default"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>GST Rate (%)</label>
                  <select value={form.gstRate} onChange={(e) => set('gstRate', e.target.value)} className={inputCls}>
                    <option value="">Store default</option>
                    {[0, 3, 5, 12, 18, 28, 40].map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">Leave blank to use the defaults from Settings. Prices above are GST-inclusive; invoices back the tax out.</p>
            </Card>

            {/* Variants */}
            <Card title="Variants (colours & sizes)">
              <VariantsEditor
                value={form.variants}
                onChange={(v) => set('variants', v)}
                lowStockThreshold={Number(form.lowStockThreshold) || 0}
              />
            </Card>

            {/* Features */}
            <Card title="Key Features">
              <div className="space-y-2">
                {form.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="flex-1 text-sm text-gray-700">{f}</span>
                    <button type="button" onClick={() => set('features', form.features.filter((_, j) => j !== i))}>
                      <X size={14} className="text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="e.g. Full Grain Leather"
                    className={`${inputCls} flex-1`}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }}
                  />
                  <button type="button" onClick={addFeature} className="px-3 bg-violet-100 text-violet-600 rounded-xl hover:bg-violet-200 transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </Card>

            {/* SEO */}
            <Card title="Search engine listing">
              <div>
                <label className={labelCls}>Page title <span className="text-gray-400">({form.metaTitle.length}/70)</span></label>
                <input value={form.metaTitle} maxLength={70} onChange={(e) => set('metaTitle', e.target.value)} placeholder={form.name || 'Defaults to the product name'} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Meta description <span className="text-gray-400">({form.metaDescription.length}/170)</span></label>
                <textarea rows={3} value={form.metaDescription} maxLength={170} onChange={(e) => set('metaDescription', e.target.value)} placeholder="Defaults to the start of the description" className={`${inputCls} resize-none`} />
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400 mb-1">Search result preview</p>
                <p className="text-[15px] text-blue-700 truncate">{form.metaTitle || form.name || 'Product name'} | FoldX</p>
                <p className="text-xs text-green-700 truncate">/products/{form.slug || toSlug(form.name || 'product')}</p>
                <p className="text-xs text-gray-600 line-clamp-2">{form.metaDescription || form.description || 'Product description…'}</p>
              </div>
            </Card>
          </div>

          {/* ── Right: images + settings ───────────────────────── */}
          <div className="space-y-5">
            <Card title="Product Images">
              <ImageUploader images={form.images} onChange={(imgs) => set('images', imgs)} maxFiles={6} />
              <p className="text-xs text-gray-400 mt-2">First image = main · Second = hover image.</p>
            </Card>

            <Card title="Publish Settings">
              <div className="space-y-2">
                {[
                  { value: 'published', label: 'Published', sub: 'Visible in the store now' },
                  { value: 'draft', label: 'Draft', sub: 'Hidden — only staff can see it' },
                  { value: 'scheduled', label: 'Scheduled', sub: 'Goes live automatically at a set time' },
                ].map((o) => (
                  <label key={o.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.status === o.value ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="status" value={o.value} checked={form.status === o.value} onChange={() => set('status', o.value)} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-gray-700">{o.label}</span>
                      <span className="block text-xs text-gray-400">{o.sub}</span>
                    </span>
                  </label>
                ))}
                {form.status === 'scheduled' && (
                  <input type="datetime-local" value={form.publishAt} onChange={(e) => set('publishAt', e.target.value)} className={inputCls} />
                )}
              </div>
              <Toggle
                label="Featured"
                sub="Show on homepage"
                value={form.isFeatured}
                onChange={() => set('isFeatured', !form.isFeatured)}
              />
            </Card>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : form.status === 'published' ? 'Publish Product' : 'Save Product'}
            </button>
            <Link to="/admin/products" className="block text-center text-sm text-gray-400 hover:text-gray-600">
              {isEdit ? 'Back to products' : 'Cancel'}
            </Link>

            {isEdit && (
              <Card title="Stock history">
                <StockHistory productId={id} refreshKey={historyKey} />
              </Card>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <h2 className="font-semibold text-gray-800">{title}</h2>
      {children}
    </div>
  )
}

function Toggle({ label, sub, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-violet-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
