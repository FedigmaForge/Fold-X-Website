import { useState, useEffect } from 'react'
import {
  IndianRupee, ShoppingBag, Users, Package, RotateCcw,
  Plus, Eye, EyeOff, Edit2, Trash2, X, Monitor, Smartphone,
  ExternalLink, ImagePlus, CheckCircle, Loader2
} from 'lucide-react'
import StatCard from '@/components/admin/StatCard'
import SalesChart from '@/components/admin/SalesChart'
import RecentOrdersTable from '@/components/admin/RecentOrdersTable'
import { getAnalytics, getOrders, getAllBanners, saveBanner, deleteBanner, uploadImage, resetDemoData } from '@/services/api'
import { formatNumber } from '@/utils/formatCurrency'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  title: '', label: '', link: '',
  desktopImage: null, mobileImage: null,
  isActive: true, order: 1,
}

// ── Small image drop zone ────────────────────────────────────────────────────
function DropZone({ label, icon: Icon, dimHint, value, onChange }) {
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url } = await uploadImage(file)
      onChange(url)
    } catch (err) {
      toast.error(err.message || 'Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleChange = (e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={14} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="ml-auto text-[10px] text-gray-400">{dimHint}</span>
      </div>
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group">
          <img src={value} alt={label} className="w-full h-28 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <label className="cursor-pointer bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              <ImagePlus size={12} /> Change
              <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
            </label>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={10} />
          </button>
          <span className="absolute bottom-1.5 left-1.5 bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle size={8} /> Uploaded
          </span>
        </div>
      ) : uploading ? (
        <div className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-gray-200">
          <Loader2 size={20} className="text-violet-400 animate-spin mb-1.5" />
          <span className="text-xs text-gray-400">Uploading…</span>
        </div>
      ) : (
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition-colors cursor-pointer"
        >
          <ImagePlus size={22} className="text-gray-300 mb-1.5" />
          <span className="text-xs text-gray-400 text-center leading-tight px-2">
            Click or drag to upload<br />
            <span className="text-[10px] text-gray-300">{dimHint}</span>
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
        </label>
      )}
    </div>
  )
}

// ── Banner form modal ────────────────────────────────────────────────────────
function BannerModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(editing
        ? { ...EMPTY_FORM, ...editing }
        : { ...EMPTY_FORM, order: 1 }
      )
    }
  }, [open, editing])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Banner heading is required'); return }
    if (!form.desktopImage) { toast.error('Desktop image is required'); return }
    if (!form.mobileImage)  { toast.error('Mobile image is required'); return }
    setSaving(true)
    const payload = {
      ...(editing || {}),
      ...form,
    }
    const saved = await saveBanner(payload)
    onSave(saved, !!editing)
    setSaving(false)
    onClose()
    toast.success(editing ? 'Banner updated!' : 'Banner added! It\'s now live on the homepage.')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900">{editing ? 'Edit Banner' : 'Add Hero Banner'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload images and text — changes appear on the homepage immediately</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Live preview hint */}
          <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl p-3">
            <ExternalLink size={14} className="text-violet-500 shrink-0 mt-0.5" />
            <p className="text-xs text-violet-600 leading-relaxed">
              After saving, open <a href="/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">the homepage</a> to see your banner live in the hero slideshow.
            </p>
          </div>

          {/* Images */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Banner Images *</p>
            <div className="flex gap-4">
              <DropZone
                label="Desktop Image"
                icon={Monitor}
                dimHint="1920 × 720 px"
                value={form.desktopImage}
                onChange={(v) => set('desktopImage', v)}
              />
              <DropZone
                label="Mobile Image"
                icon={Smartphone}
                dimHint="768 × 960 px"
                value={form.mobileImage}
                onChange={(v) => set('mobileImage', v)}
              />
            </div>
          </div>

          {/* Text fields */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Banner Text</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Heading * <span className="text-gray-400">(shown large on the banner)</span></label>
                <textarea
                  rows={2}
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder={'e.g. Crafted for Those\nWho Carry Their World'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Press Enter for a two-line heading.</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sub-label <span className="text-gray-400">(small gold text above heading)</span></label>
                <input
                  value={form.label}
                  onChange={(e) => set('label', e.target.value)}
                  placeholder="e.g. New Collection · 2024"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Shop Now link <span className="text-gray-400">(where the button goes)</span></label>
                <input
                  value={form.link}
                  onChange={(e) => set('link', e.target.value)}
                  placeholder="/products or /products?badge=new"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                />
              </div>
            </div>
          </div>

          {/* Settings row */}
          <div className="flex items-center gap-6 pt-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => set('isActive', !form.isActive)}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${form.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.isActive ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
              <span className="text-sm text-gray-700">{form.isActive ? 'Active — visible on homepage' : 'Hidden — not shown on homepage'}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-gray-500">Order</label>
              <input
                type="number"
                min={1}
                value={form.order}
                onChange={(e) => set('order', Number(e.target.value))}
                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-violet-400 text-center"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Update Banner' : '✓ Add to Homepage'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [analytics, setAnalytics]   = useState(null)
  const [orders, setOrders]         = useState([])
  const [banners, setBanners]       = useState([])
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState(null)

  const activeBanners = [...banners].sort((a, b) => a.order - b.order)

  const loadAnalytics = () => {
    Promise.all([getAnalytics(), getOrders()]).then(([a, o]) => {
      setAnalytics(a)
      setOrders(o.slice(0, 6))
    })
  }
  const loadBanners = () => getAllBanners().then(setBanners)

  useEffect(() => { loadAnalytics(); loadBanners() }, [])

  const openAdd  = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (b) => { setEditing(b);   setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSaved = () => {
    loadBanners()
  }

  const handleToggle = async (banner) => {
    const updated = { ...banner, isActive: !banner.isActive }
    await saveBanner(updated)
    await loadBanners()
    toast.success(updated.isActive ? 'Banner is now live!' : 'Banner hidden from homepage')
  }

  const handleDelete = async (id, title) => {
    if (!confirm(`Remove banner "${title}" from the homepage?`)) return
    await deleteBanner(id)
    await loadBanners()
    toast.success('Banner removed')
  }

  const handleReset = async () => {
    if (!confirm('Reset all store data to demo defaults? This cannot be undone.')) return
    await resetDemoData()
    loadAnalytics()
    loadBanners()
    toast.success('Store reset to defaults')
  }

  const s = analytics?.stats

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Changes here reflect on the frontend immediately.</p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <RotateCcw size={12} /> Reset Demo Data
        </button>
      </div>

      {/* ── HERO BANNER SECTION ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div>
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
              Hero Section — Homepage Slideshow
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeBanners.filter((b) => b.isActive).length} active banner{activeBanners.filter((b) => b.isActive).length !== 1 ? 's' : ''} showing on homepage ·{' '}
              <a href="/" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline">
                Preview site <ExternalLink size={10} className="inline" />
              </a>
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={15} /> Add Banner
          </button>
        </div>

        {/* Banner grid */}
        <div className="p-5">
          {activeBanners.length === 0 ? (
            <button
              onClick={openAdd}
              className="w-full h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-violet-400 hover:bg-violet-50 transition-colors group"
            >
              <ImagePlus size={32} className="text-gray-300 group-hover:text-violet-400 transition-colors mb-2" />
              <p className="text-sm text-gray-400 group-hover:text-violet-500">Click to add your first hero banner</p>
              <p className="text-xs text-gray-300 mt-1">Desktop: 1920×720 px · Mobile: 768×960 px</p>
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeBanners.map((b) => (
                <div
                  key={b.id}
                  className={`relative rounded-xl overflow-hidden group border-2 transition-all ${
                    b.isActive ? 'border-transparent' : 'border-gray-200 opacity-60'
                  }`}
                >
                  {/* Image */}
                  <div className="relative h-44 bg-gray-100">
                    {b.desktopImage ? (
                      <img src={b.desktopImage} alt={b.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImagePlus size={28} className="text-gray-300" />
                      </div>
                    )}
                    {/* Dark gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {/* Status badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.isActive ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
                        {b.isActive ? '● Live' : '○ Hidden'}
                      </span>
                      <span className="text-[10px] bg-black/40 text-white px-2 py-0.5 rounded-full">#{b.order}</span>
                    </div>

                    {/* Action buttons (top-right, shown on hover) */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleToggle(b)}
                        title={b.isActive ? 'Hide from homepage' : 'Show on homepage'}
                        className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center shadow-sm transition-colors"
                      >
                        {b.isActive ? <EyeOff size={13} className="text-gray-500" /> : <Eye size={13} className="text-green-500" />}
                      </button>
                      <button
                        onClick={() => openEdit(b)}
                        title="Edit banner"
                        className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center shadow-sm transition-colors"
                      >
                        <Edit2 size={13} className="text-violet-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id, b.title)}
                        title="Delete banner"
                        className="w-7 h-7 rounded-lg bg-white/90 hover:bg-red-50 flex items-center justify-center shadow-sm transition-colors"
                      >
                        <Trash2 size={13} className="text-red-500" />
                      </button>
                    </div>

                    {/* Text overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      {b.label && <p className="text-[10px] text-yellow-300 uppercase tracking-widest mb-0.5">{b.label}</p>}
                      <p className="text-white text-sm font-semibold leading-snug line-clamp-2">{b.title || <span className="text-white/50 italic">No heading set</span>}</p>
                      {b.link && (
                        <p className="text-white/50 text-[10px] mt-1 truncate">→ {b.link}</p>
                      )}
                    </div>
                  </div>

                  {/* Mobile preview strip */}
                  <div className="bg-gray-50 border-t border-gray-100 px-3 py-2 flex items-center gap-2">
                    <Smartphone size={11} className="text-gray-400 shrink-0" />
                    {b.mobileImage ? (
                      <div className="flex items-center gap-2">
                        <img src={b.mobileImage} alt="mobile" className="w-8 h-8 object-cover rounded" />
                        <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                          <CheckCircle size={10} /> Mobile image set
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-orange-500">⚠ Mobile image missing</span>
                    )}
                    <button
                      onClick={() => openEdit(b)}
                      className="ml-auto text-[10px] text-violet-500 hover:text-violet-700 font-medium"
                    >
                      Edit →
                    </button>
                  </div>
                </div>
              ))}

              {/* Add new tile */}
              <button
                onClick={openAdd}
                className="h-44 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-violet-400 hover:bg-violet-50 transition-colors group"
              >
                <Plus size={24} className="text-gray-300 group-hover:text-violet-400 transition-colors mb-1.5" />
                <p className="text-xs text-gray-400 group-hover:text-violet-500 font-medium">Add Banner</p>
                <p className="text-[10px] text-gray-300 mt-0.5">1920×720 + 768×960 px</p>
              </button>
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1">
            Banners cycle automatically every 5.5 seconds on the homepage.
            Use the eye icon to show/hide without deleting. Order #1 shows first.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={s ? `₹${formatNumber(s.totalRevenue)}` : '—'} growth={s?.revenueGrowth} icon={IndianRupee} color="violet" />
        <StatCard title="Total Orders"  value={s ? formatNumber(s.totalOrders)  : '—'} growth={s?.ordersGrowth}   icon={ShoppingBag} color="blue"   />
        <StatCard title="Customers"     value={s ? formatNumber(s.totalCustomers): '—'} growth={s?.customersGrowth} icon={Users}       color="green"  />
        <StatCard title="Products"      value={s ? s.totalProducts               : '—'}                             icon={Package}     color="orange" />
      </div>

      {/* Chart */}
      {analytics && <SalesChart data={analytics.revenue} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2">
          <RecentOrdersTable orders={orders} />
        </div>

        {/* Top products */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Top Products</h3>
          {analytics?.topProducts?.length > 0 ? (
            <div className="space-y-4">
              {analytics.topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-xl object-cover bg-gray-50 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 line-clamp-1">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sold} sold</p>
                  </div>
                  <span className="text-xs font-bold text-gray-900">₹{formatNumber(p.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No sales data yet</p>
          )}
        </div>
      </div>

      {/* Banner modal */}
      <BannerModal
        open={modalOpen}
        editing={editing}
        onClose={closeModal}
        onSave={handleSaved}
      />
    </div>
  )
}
