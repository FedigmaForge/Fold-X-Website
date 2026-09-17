import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react'
import BannerUploader from '@/components/admin/BannerUploader'
import Modal from '@/components/ui/Modal'
import { getAllBanners, saveBanner, deleteBanner } from '@/services/api'
import toast from 'react-hot-toast'

const emptyBanner = { title: '', label: '', link: '', desktopImage: null, mobileImage: null, isActive: true, order: 1 }

export default function BannersPage() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyBanner)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAllBanners().then((b) => { setBanners(b); setLoading(false) })
  }, [])

  const openNew = () => { setEditing(null); setForm(emptyBanner); setModalOpen(true) }
  const openEdit = (b) => {
    setEditing(b)
    setForm({
      ...emptyBanner,
      ...b,
      desktopImage: b.desktopImage ? { url: b.desktopImage, dimensionOk: true } : null,
      mobileImage: b.mobileImage ? { url: b.mobileImage, dimensionOk: true } : null,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Banner title is required'); return }
    setSaving(true)
    const payload = {
      ...(editing || {}),
      ...form,
      desktopImage: form.desktopImage?.url || form.desktopImage || '',
      mobileImage: form.mobileImage?.url || form.mobileImage || '',
    }
    const saved = await saveBanner(payload)
    if (editing) {
      setBanners((bs) => bs.map((b) => (b.id === editing.id ? { ...b, ...saved } : b)))
    } else {
      setBanners((bs) => [...bs, saved])
    }
    toast.success(editing ? 'Banner updated!' : 'Banner created!')
    setModalOpen(false)
    setSaving(false)
  }

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete banner "${title}"?`)) return
    await deleteBanner(id)
    setBanners((bs) => bs.filter((b) => b.id !== id))
    toast.success('Banner deleted')
  }

  const toggleActive = async (banner) => {
    const updated = { ...banner, isActive: !banner.isActive }
    await saveBanner(updated)
    setBanners((bs) => bs.map((b) => (b.id === banner.id ? updated : b)))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage homepage carousel banners</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Add Banner
        </button>
      </div>

      {/* Dimension guide */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm text-violet-700">
        <p className="font-semibold mb-1">📐 Banner Dimension Guide</p>
        <ul className="list-disc ml-4 space-y-0.5 text-violet-600">
          <li><strong>Desktop banner:</strong> 1920 × 720 px — ratio 8:3 (full-width hero, shown on laptop/desktop)</li>
          <li><strong>Mobile banner:</strong> 768 × 960 px — ratio 4:5 (portrait crop, shown on phones)</li>
          <li>Supported formats: JPG, PNG, WEBP · Focus subject in centre of image</li>
        </ul>
      </div>

      {/* Banner grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2,3].map((i) => <div key={i} className="h-40 bg-gray-200 animate-pulse rounded-2xl" />)}
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400 mb-3">No banners yet</p>
          <button onClick={openNew} className="text-sm text-violet-600 hover:underline">Add your first banner</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {banners.map((b) => (
            <div key={b.id} className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow ${b.isActive ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
              <div className="relative h-40">
                <img src={b.desktopImage} alt={b.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <p className="absolute bottom-3 left-3 text-white text-sm font-semibold">{b.title}</p>
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.isActive ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                    {b.isActive ? 'Active' : 'Hidden'}
                  </span>
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Order: #{b.order}</p>
                  {b.link && <p className="text-xs text-violet-600 truncate max-w-[140px]">{b.link}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => toggleActive(b)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title={b.isActive ? 'Hide' : 'Show'}>
                    {b.isActive ? <EyeOff size={15} className="text-gray-400" /> : <Eye size={15} className="text-green-500" />}
                  </button>
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-violet-100 text-violet-600 transition-colors">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(b.id, b.title)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Banner' : 'Add New Banner'} size="xl">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Banner Heading *</label>
              <textarea rows={2} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={'e.g. Crafted for Those\nWho Carry Their World'} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 resize-none" />
              <p className="text-[10px] text-gray-400 mt-1">Use a line break (Enter) for a two-line heading.</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Label / Sub-heading</label>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. New Collection 2024" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Link URL</label>
              <input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="/products?badge=new" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Display Order</label>
              <input type="number" min="1" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.isActive ? 'bg-violet-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
              <span className="text-sm text-gray-600 font-medium">{form.isActive ? 'Active' : 'Hidden'}</span>
            </div>
          </div>

          <BannerUploader
            desktopImage={form.desktopImage}
            mobileImage={form.mobileImage}
            onDesktopChange={(img) => setForm((f) => ({ ...f, desktopImage: img }))}
            onMobileChange={(img) => setForm((f) => ({ ...f, mobileImage: img }))}
          />

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
              {saving ? 'Saving…' : editing ? 'Update Banner' : 'Save Banner'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
