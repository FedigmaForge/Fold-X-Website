import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, ExternalLink, Search } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import ImageUploader from '@/components/admin/ImageUploader'
import {
  getAdminCollections, createCollection, updateCollection, deleteCollection, reorderCollections, getAllProducts,
} from '@/services/api'
import { usePermissions } from '@/utils/permissions'
import toast from 'react-hot-toast'

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 bg-white'
const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'
const toSlug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function CollectionModal({ collection, products, onClose, onSaved }) {
  const isNew = !collection
  const [form, setForm] = useState({
    name: collection?.name ?? '',
    tagline: collection?.tagline ?? '',
    description: collection?.description ?? '',
    image: collection?.image ?? '',
    cardImage: collection?.cardImage ?? '',
    isActive: collection?.isActive ?? true,
  })
  const [id, setId] = useState(collection?.id ?? '')
  const [idTouched, setIdTouched] = useState(false)
  const [members, setMembers] = useState(() => new Set(products.filter((p) => collection && p.collectionId === collection.id).map((p) => p.id)))
  const [productQuery, setProductQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const toggle = (pid) => setMembers((m) => {
    const next = new Set(m)
    if (next.has(pid)) next.delete(pid)
    else next.add(pid)
    return next
  })

  const q = productQuery.trim().toLowerCase()
  // Members first, then the rest, each alphabetical
  const shown = products
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => (members.has(b.id) - members.has(a.id)) || a.name.localeCompare(b.name))

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = { ...form, productIds: [...members] }
      if (isNew) await createCollection({ id: id || toSlug(form.name), ...body })
      else await updateCollection(collection.id, body)
      toast.success(isNew ? 'Collection created' : 'Collection saved')
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'New collection' : `Edit ${collection.name}`} size="lg">
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Name</label>
            <input
              value={form.name}
              onChange={(e) => { set({ name: e.target.value }); if (isNew && !idTouched) setId(toSlug(e.target.value)) }}
              placeholder="e.g. The Heritage Collection"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>URL name</label>
            <input
              value={id}
              onChange={(e) => { setId(toSlug(e.target.value)); setIdTouched(true) }}
              disabled={!isNew}
              className={`${inputCls} font-mono disabled:bg-gray-50 disabled:text-gray-500`}
            />
            <p className="text-xs text-gray-400 mt-1">
              {isNew ? 'Page address: ' : "Can't be changed — links use it: "}/collections/{id || '…'}
            </p>
          </div>
        </div>

        <div>
          <label className={labelCls}>Tagline</label>
          <input value={form.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="One line under the name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Story</label>
          <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="A short paragraph shown under the collection's hero image" className={`${inputCls} resize-none`} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Hero image (wide, about 16:9)</label>
            <ImageUploader images={form.image ? [form.image] : []} onChange={(imgs) => set({ image: imgs[0] || '' })} maxFiles={1} />
          </div>
          <div>
            <label className={labelCls}>Card image (portrait, 4:5) — optional</label>
            <ImageUploader images={form.cardImage ? [form.cardImage] : []} onChange={(imgs) => set({ cardImage: imgs[0] || '' })} maxFiles={1} />
            <p className="text-xs text-gray-400 mt-1">Used on the Collections page; falls back to the hero image.</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls}>Products ({members.size})</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Find a product" className="border border-gray-200 rounded-lg pl-7 pr-2 py-1 text-xs outline-none focus:border-violet-400" />
            </div>
          </div>
          <div className="border border-gray-100 rounded-xl max-h-60 overflow-y-auto divide-y divide-gray-50">
            {shown.map((p) => {
              const elsewhere = p.collectionId && p.collectionId !== collection?.id && !members.has(p.id)
              return (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={members.has(p.id)} onChange={() => toggle(p.id)} />
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-50" />
                    : <div className="w-8 h-8 rounded-lg bg-gray-100" />}
                  <span className="flex-1 text-sm text-gray-700 truncate">{p.name}</span>
                  {!p.isActive && <span className="text-[10px] text-gray-400">Draft</span>}
                  {elsewhere && <span className="text-[10px] text-amber-600">in “{p.collectionId}”</span>}
                </label>
              )
            })}
            {shown.length === 0 && <p className="px-3 py-4 text-xs text-gray-400">No products match.</p>}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">A product belongs to one collection at a time — ticking one that's in another collection moves it here.</p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
          Show on the storefront
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || (isNew && !id)}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isNew ? 'Create collection' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function CollectionsPage() {
  const { canEditCatalog } = usePermissions()
  const [collections, setCollections] = useState(null)
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, object = edit

  const load = () => {
    getAdminCollections().then(setCollections).catch((e) => toast.error(e.message))
    getAllProducts().then(setProducts).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const move = async (i, dir) => {
    const next = [...collections]
    const j = i + dir
    ;[next[i], next[j]] = [next[j], next[i]]
    setCollections(next)
    try {
      await reorderCollections(next.map((c) => c.id))
    } catch (e) {
      toast.error(e.message)
      load()
    }
  }

  const toggleActive = async (c) => {
    try {
      await updateCollection(c.id, { isActive: !c.isActive })
      setCollections((list) => list.map((x) => (x.id === c.id ? { ...x, isActive: !c.isActive } : x)))
      toast.success(c.isActive ? `${c.name} hidden from the storefront` : `${c.name} is visible again`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const remove = async (c) => {
    const note = c.count ? ` Its ${c.count} product${c.count === 1 ? '' : 's'} stay in the shop, just without a collection.` : ''
    if (!confirm(`Delete the "${c.name}" collection?${note}`)) return
    try {
      await deleteCollection(c.id)
      toast.success('Collection deleted')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Named product lines, each with its own page, in storefront order.{!canEditCatalog && ' View only for your role.'}
          </p>
        </div>
        {canEditCatalog && (
          <button onClick={() => setEditing(null)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Plus size={16} /> Add Collection
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-5 py-3">Collection</th>
                <th className="text-left px-5 py-3">Tagline</th>
                <th className="text-left px-5 py-3">Products</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!collections ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
                ))
              ) : collections.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No collections yet.</td></tr>
              ) : collections.map((c, i) => (
                <tr key={c.id} className={c.isActive ? '' : 'opacity-60'}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {(c.cardImage || c.image)
                        ? <img src={c.cardImage || c.image} alt="" className="w-11 h-11 rounded-xl object-cover bg-gray-50 shrink-0" />
                        : <div className="w-11 h-11 rounded-xl bg-gray-100 shrink-0" />}
                      <div>
                        <p className="font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400 font-mono">/collections/{c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-500 max-w-xs truncate">{c.tagline || '—'}</td>
                  <td className="px-5 py-4 text-gray-600">{c.count}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Visible' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-0.5">
                      <a href={`/collections/${c.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title="View on storefront"><ExternalLink size={14} /></a>
                      {canEditCatalog && (
                        <>
                          <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
                          <button onClick={() => move(i, 1)} disabled={i === collections.length - 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button>
                          <button onClick={() => toggleActive(c)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title={c.isActive ? 'Hide from storefront' : 'Show on storefront'}>
                            {c.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button onClick={() => setEditing(c)} className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-100" aria-label="Edit"><Edit2 size={14} /></button>
                          <button onClick={() => remove(c)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-100" aria-label="Delete"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        The navbar's Collections menu lists these automatically while its sub-links are empty (Storefront → Navbar menu).
        To feature one on the homepage, point Storefront → Featured collection at /collections/&lt;URL name&gt;.
      </p>

      {editing !== undefined && (
        <CollectionModal
          collection={editing}
          products={products}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load() }}
        />
      )}
    </div>
  )
}
