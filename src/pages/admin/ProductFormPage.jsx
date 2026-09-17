import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronLeft, Plus, X } from 'lucide-react'
import ImageUploader from '@/components/admin/ImageUploader'
import { getProductById, createProduct, updateProduct, getCategories } from '@/services/api'
import toast from 'react-hot-toast'

const BADGE_OPTIONS = ['', 'BEST SELLER', 'NEW', 'ONLINE EXCLUSIVE', 'LIMITED EDITION']

const emptyForm = {
  name: '', slug: '', categoryId: 'women', category: 'Women',
  price: '', originalPrice: '',
  material: '', badge: '',
  description: '', stock: '',
  tags: '',
  colors: [],
  features: [],
  images: [],
  isActive: true, isFeatured: false,
}

const toSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [newColor, setNewColor] = useState('')
  const [newFeature, setNewFeature] = useState('')

  useEffect(() => { getCategories().then(setCategories) }, [])

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
    if (!form.stock) { toast.error('Stock quantity is required'); return }

    setSaving(true)
    const catObj = categories.find((c) => c.id === form.categoryId)
    const payload = {
      ...form,
      price: Number(form.price),
      originalPrice: Number(form.originalPrice) || Number(form.price),
      stock: Number(form.stock),
      discount,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      slug: form.slug || toSlug(form.name),
      category: catObj?.name || form.category,
      images: form.images.map((img) => (typeof img === 'string' ? img : img.preview || img.url || img)),
      badge: form.badge || undefined,
    }
    try {
      if (isEdit) {
        await updateProduct(id, payload)
        toast.success('Product updated!')
      } else {
        await createProduct(payload)
        toast.success('Product created!')
      }
      navigate('/admin/products')
    } catch {
      toast.error('Failed to save product')
      setSaving(false)
    }
  }

  const addColor = () => {
    if (newColor.trim() && !form.colors.includes(newColor.trim())) {
      set('colors', [...form.colors, newColor.trim()])
      setNewColor('')
    }
  }
  const addFeature = () => {
    if (newFeature.trim()) {
      set('features', [...form.features, newFeature.trim()])
      setNewFeature('')
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 bg-white'
  const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'

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
                      setForm((f) => ({ ...f, categoryId: e.target.value, category: cat?.name || e.target.value }))
                    }}
                    className={inputCls}
                  >
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Stock Quantity *</label>
                  <input required type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)} placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Tags (comma-separated)</label>
                  <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="leather, wallet, gift" className={inputCls} />
                </div>
              </div>
            </Card>

            {/* Colors */}
            <Card title="Available Colors">
              <div className="flex flex-wrap gap-2 mb-3">
                {form.colors.map((c) => (
                  <span key={c} className="flex items-center gap-1 bg-gray-100 rounded-lg px-2.5 py-1 text-sm text-gray-700">
                    {c}
                    <button type="button" onClick={() => set('colors', form.colors.filter((x) => x !== c))}>
                      <X size={12} className="text-gray-400 hover:text-red-500" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="e.g. Dark Brown"
                  className={`${inputCls} flex-1`}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColor() } }}
                />
                <button type="button" onClick={addColor} className="px-3 bg-violet-100 text-violet-600 rounded-xl hover:bg-violet-200 transition-colors">
                  <Plus size={16} />
                </button>
              </div>
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
          </div>

          {/* ── Right: images + settings ───────────────────────── */}
          <div className="space-y-5">
            <Card title="Product Images">
              <ImageUploader images={form.images} onChange={(imgs) => set('images', imgs)} maxFiles={6} />
              <p className="text-xs text-gray-400 mt-2">First image = main · Second = hover image.</p>
            </Card>

            <Card title="Publish Settings">
              <Toggle
                label="Active"
                sub="Visible to customers"
                value={form.isActive}
                onChange={() => set('isActive', !form.isActive)}
              />
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
              {saving ? 'Saving…' : isEdit ? 'Update Product' : 'Publish Product'}
            </button>
            <Link to="/admin/products" className="block text-center text-sm text-gray-400 hover:text-gray-600">
              Cancel
            </Link>
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
