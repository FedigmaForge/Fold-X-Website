import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, X } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import ImageUploader from '@/components/admin/ImageUploader'
import { getAdminCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from '@/services/api'
import { usePermissions } from '@/utils/permissions'
import toast from 'react-hot-toast'

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 bg-white'
const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'
const toSlug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// Subcategories are edited as rows that remember their original name, so a
// rename can be sent to the server as { old: new } and products follow it.
function CategoryModal({ category, onClose, onSaved }) {
  const isNew = !category
  const [name, setName] = useState(category?.name ?? '')
  const [id, setId] = useState(category?.id ?? '')
  const [idTouched, setIdTouched] = useState(false)
  const [image, setImage] = useState(category?.image ?? '')
  const [isActive, setIsActive] = useState(category?.isActive ?? true)
  const [subs, setSubs] = useState(() => (category?.sub ?? []).map((n) => ({ original: n, name: n })))
  const [newSub, setNewSub] = useState('')
  const [saving, setSaving] = useState(false)
  const usage = category?.subUsage ?? {}

  const addSub = () => {
    const n = newSub.trim()
    if (!n) return
    if (subs.some((s) => s.name.toLowerCase() === n.toLowerCase())) { toast.error(`"${n}" is already listed`); return }
    setSubs((s) => [...s, { original: null, name: n }])
    setNewSub('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const sub = subs.map((s) => s.name.trim()).filter(Boolean)
      const subRenames = Object.fromEntries(
        subs.filter((s) => s.original && s.name.trim() && s.name.trim() !== s.original).map((s) => [s.original, s.name.trim()])
      )
      const saved = isNew
        ? await createCategory({ id: id || toSlug(name), name, image, sub, isActive })
        : await updateCategory(category.id, { name, image, sub, subRenames, isActive })
      toast.success(isNew ? 'Category created' : 'Category saved')
      onSaved(saved)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'New category' : `Edit ${category.name}`} size="lg">
      <div className="space-y-5">
        <div className="grid sm:grid-cols-[200px_1fr] gap-5">
          <div>
            <label className={labelCls}>Image</label>
            <ImageUploader images={image ? [image] : []} onChange={(imgs) => setImage(imgs[0] || '')} maxFiles={1} />
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Name</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); if (isNew && !idTouched) setId(toSlug(e.target.value)) }}
                placeholder="e.g. Home Decor"
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
                {isNew ? 'Used in links: ' : "Can't be changed — links and products use it: "}
                /products?category={id || '…'}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Show in storefront filters
            </label>
          </div>
        </div>

        <div>
          <label className={labelCls}>Subcategories</label>
          <div className="space-y-2">
            {subs.map((s, i) => {
              const used = s.original ? usage[s.original] ?? 0 : 0
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={s.name}
                    onChange={(e) => setSubs((list) => list.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                    className={`${inputCls} flex-1`}
                  />
                  <span className="text-xs text-gray-400 w-24 shrink-0">{used ? `${used} product${used === 1 ? '' : 's'}` : 'unused'}</span>
                  <button
                    type="button"
                    onClick={() => setSubs((list) => list.filter((_, k) => k !== i))}
                    disabled={used > 0}
                    title={used ? 'Move its products to another subcategory first (or rename it instead)' : 'Remove'}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub() } }}
              placeholder="Add a subcategory…"
              className={`${inputCls} flex-1`}
            />
            <button type="button" onClick={addSub} className="px-4 rounded-xl bg-violet-100 text-violet-600 text-sm hover:bg-violet-200">Add</button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Renaming a subcategory moves its products to the new name.</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || (isNew && !id)}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isNew ? 'Create category' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function CategoriesPage() {
  const { canEditCatalog } = usePermissions()
  const [categories, setCategories] = useState(null)
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, object = edit

  const load = () => getAdminCategories().then(setCategories).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])

  const move = async (i, dir) => {
    const next = [...categories]
    const j = i + dir
    ;[next[i], next[j]] = [next[j], next[i]]
    setCategories(next)
    try {
      await reorderCategories(next.map((c) => c.id))
    } catch (e) {
      toast.error(e.message)
      load()
    }
  }

  const toggleActive = async (c) => {
    try {
      await updateCategory(c.id, { isActive: !c.isActive })
      setCategories((list) => list.map((x) => (x.id === c.id ? { ...x, isActive: !c.isActive } : x)))
      toast.success(c.isActive ? `${c.name} hidden from the storefront` : `${c.name} is visible again`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const remove = async (c) => {
    if (!confirm(`Delete the "${c.name}" category?`)) return
    try {
      await deleteCategory(c.id)
      setCategories((list) => list.filter((x) => x.id !== c.id))
      toast.success('Category deleted')
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            The categories products are filed under, in storefront order.{!canEditCatalog && ' View only for your role.'}
          </p>
        </div>
        {canEditCatalog && (
          <button onClick={() => setEditing(null)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Plus size={16} /> Add Category
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Subcategories</th>
                <th className="text-left px-5 py-3">Products</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">{canEditCatalog && 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!categories ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
                ))
              ) : categories.map((c, i) => (
                <tr key={c.id} className={c.isActive ? '' : 'opacity-60'}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {c.image
                        ? <img src={c.image} alt="" className="w-11 h-11 rounded-xl object-cover bg-gray-50 shrink-0" />
                        : <div className="w-11 h-11 rounded-xl bg-gray-100 shrink-0" />}
                      <div>
                        <p className="font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {(c.sub ?? []).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-lg bg-gray-100 text-xs text-gray-600">
                          {s}{c.subUsage?.[s] ? <span className="text-gray-400"> · {c.subUsage[s]}</span> : null}
                        </span>
                      ))}
                      {(c.sub ?? []).length === 0 && <span className="text-xs text-gray-400">None</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600">{c.count}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Visible' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {canEditCatalog && (
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
                        <button onClick={() => move(i, 1)} disabled={i === categories.length - 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button>
                        <button onClick={() => toggleActive(c)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title={c.isActive ? 'Hide from storefront' : 'Show on storefront'}>
                          {c.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={() => setEditing(c)} className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-100" aria-label="Edit"><Edit2 size={14} /></button>
                        <button
                          onClick={() => remove(c)}
                          disabled={c.count > 0}
                          title={c.count > 0 ? 'Move or delete its products first' : 'Delete'}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Hiding a category removes it from storefront filters; its products stay reachable through search and direct links.
        Navbar menus and homepage tiles are edited separately under Storefront.
      </p>

      {editing !== undefined && (
        <CategoryModal
          category={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load() }}
        />
      )}
    </div>
  )
}
