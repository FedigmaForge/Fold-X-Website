import { useState, useEffect } from 'react'
import { Plus, ArrowLeft, ArrowUp, ArrowDown, ExternalLink, Trash2, FileText } from 'lucide-react'
import MarkdownLite from '@/components/ui/MarkdownLite'
import { getAdminPages, savePage, deletePage, reorderPages } from '@/services/api'
import { usePermissions } from '@/utils/permissions'
import { formatDate } from '@/utils/formatDate'
import toast from 'react-hot-toast'

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 bg-white'
const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'
const toSlug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const HELP = [
  ['# Heading', 'large heading'],
  ['## Heading', 'section heading'],
  ['- item', 'bullet list'],
  ['1. item', 'numbered list'],
  ['**bold**', 'bold'],
  ['[text](/contact)', 'link'],
  ['> note', 'callout box'],
]

function Editor({ page, canEdit, onBack, onSaved, onDeleted }) {
  const isNew = !page.id
  const [form, setForm] = useState({
    title: page.title ?? '', slug: page.slug ?? '', body: page.body ?? '', metaDescription: page.metaDescription ?? '',
    isPublished: page.isPublished ?? false, showInFooter: page.showInFooter ?? true,
  })
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const dirty = JSON.stringify(form) !== JSON.stringify({
    title: page.title ?? '', slug: page.slug ?? '', body: page.body ?? '', metaDescription: page.metaDescription ?? '',
    isPublished: page.isPublished ?? false, showInFooter: page.showInFooter ?? true,
  })

  const save = async (overrides = {}) => {
    setBusy(true)
    try {
      const saved = await savePage({ ...(page.id && { id: page.id }), ...form, ...overrides })
      toast.success(overrides.isPublished === true ? 'Page published' : 'Page saved')
      onSaved(saved)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm(`Delete "${page.title}"? Links to /pages/${page.slug} will stop working.`)) return
    try {
      await deletePage(page.id)
      toast.success('Page deleted')
      onDeleted()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const draftNotice = /\[[^\]]+\]/.test(form.body) || /Draft — replace/.test(form.body)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 mb-2">
            <ArrowLeft size={13} /> All pages
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New page' : form.title || 'Untitled'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && page.isPublished && (
            <a href={`/pages/${page.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline mr-2">
              <ExternalLink size={14} /> View on store
            </a>
          )}
          {canEdit && !isNew && (
            <button onClick={remove} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600" aria-label="Delete page"><Trash2 size={15} /></button>
          )}
          {canEdit && (
            <>
              <button onClick={() => save()} disabled={busy || (!dirty && !isNew)} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:border-violet-400 disabled:opacity-40">
                {busy ? 'Saving…' : form.isPublished ? 'Save' : 'Save draft'}
              </button>
              {!form.isPublished && (
                <button onClick={() => save({ isPublished: true })} disabled={busy} className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40">
                  Publish
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {draftNotice && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          This text still has placeholders in [square brackets] or a draft note. Fill them in, and have policy pages reviewed, before publishing.
        </p>
      )}

      <fieldset disabled={!canEdit || busy} className="grid xl:grid-cols-2 gap-5 min-w-0">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Title</label>
                <input value={form.title} onChange={(e) => set({ title: e.target.value, ...(!slugTouched && { slug: toSlug(e.target.value) }) })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <div className="flex items-center border border-gray-200 rounded-xl bg-white focus-within:border-violet-400">
                  <span className="pl-3 text-sm text-gray-400">/pages/</span>
                  <input value={form.slug} onChange={(e) => { set({ slug: toSlug(e.target.value) }); setSlugTouched(true) }} className="flex-1 py-2.5 pr-3 text-sm outline-none bg-transparent font-mono" />
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>Page text</label>
              <textarea value={form.body} onChange={(e) => set({ body: e.target.value })} rows={20} className={`${inputCls} font-mono text-[13px] leading-relaxed resize-y`} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                {HELP.map(([syntax, what]) => <span key={syntax}><code className="text-gray-600">{syntax}</code> {what}</span>)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />
              Published (visible on the store)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.showInFooter} onChange={(e) => set({ showInFooter: e.target.checked })} />
              Link it in the footer's Help column
            </label>
            <div>
              <label className={labelCls}>Search description <span className="text-gray-400">({form.metaDescription.length}/170)</span></label>
              <textarea value={form.metaDescription} maxLength={170} rows={2} onChange={(e) => set({ metaDescription: e.target.value })} className={`${inputCls} resize-none`} />
            </div>
          </div>
        </div>

        <div className="xl:sticky xl:top-0 self-start">
          <p className="text-xs text-gray-400 mb-2">Preview</p>
          <div className="bg-cream border border-border rounded-2xl p-8 max-h-[80vh] overflow-y-auto">
            <h1 className="font-serif text-4xl text-brown font-light mb-8">{form.title || 'Untitled'}</h1>
            <MarkdownLite source={form.body} />
          </div>
        </div>
      </fieldset>
    </div>
  )
}

export default function PagesPage() {
  const { canEditCatalog } = usePermissions()
  const [pages, setPages] = useState(null)
  const [editing, setEditing] = useState(null) // page object (or {} for new)

  const load = () => getAdminPages().then(setPages).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])

  const move = async (i, dir) => {
    const next = [...pages]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    setPages(next)
    try { await reorderPages(next.map((p) => p.id)) } catch (e) { toast.error(e.message); load() }
  }

  if (editing) {
    return (
      <Editor
        key={editing.id ?? 'new'}
        page={editing}
        canEdit={canEditCatalog}
        onBack={() => setEditing(null)}
        onSaved={(saved) => { setEditing(saved); load() }}
        onDeleted={() => { setEditing(null); load() }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pages</h1>
          <p className="text-sm text-gray-400 mt-0.5">About, FAQ and policy pages. Published pages appear in the footer's Help column, in this order.</p>
        </div>
        {canEditCatalog && (
          <button onClick={() => setEditing({})} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Plus size={16} /> New Page
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
              <th className="text-left px-5 py-3">Page</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">In footer</th>
              <th className="text-left px-5 py-3">Updated</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!pages ? (
              <tr><td colSpan={5} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
            ) : pages.map((p, i) => (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setEditing(p)}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-gray-300 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-800">{p.title}</p>
                      <p className="text-xs text-gray-400 font-mono">/pages/{p.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.isPublished ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="px-5 py-4 text-gray-500">{p.showInFooter ? 'Yes' : 'No'}</td>
                <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(p.updatedAt)}</td>
                <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                  {canEditCatalog && (
                    <div className="flex justify-end gap-0.5">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
                      <button onClick={() => move(i, 1)} disabled={i === pages.length - 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages?.length === 0 && <p className="text-center py-12 text-gray-400">No pages yet</p>}
      </div>
    </div>
  )
}
