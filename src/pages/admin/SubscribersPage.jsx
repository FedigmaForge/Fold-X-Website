import { useState, useEffect } from 'react'
import { Download, Trash2, Search } from 'lucide-react'
import { getSubscribers, deleteSubscriber, exportSubscribersCsv } from '@/services/api'
import { usePermissions } from '@/utils/permissions'
import { formatDate } from '@/utils/formatDate'
import toast from 'react-hot-toast'

// Newsletter sign-ups from the storefront footer
export default function SubscribersPage() {
  const { canEditCatalog } = usePermissions()
  const [subs, setSubs] = useState(null)
  const [query, setQuery] = useState('')
  const [loadedAt, setLoadedAt] = useState(0) // "now" for the 30-day count, taken when the list loads

  useEffect(() => {
    getSubscribers()
      .then((list) => { setSubs(list); setLoadedAt(Date.now()) })
      .catch((e) => { toast.error(e.message); setSubs([]) })
  }, [])

  const q = query.trim().toLowerCase()
  const shown = (subs ?? []).filter((s) => !q || s.email.includes(q))
  const last30 = (subs ?? []).filter((s) => loadedAt - new Date(s.createdAt) < 30 * 24 * 60 * 60 * 1000).length

  const remove = async (s) => {
    if (!confirm(`Remove ${s.email} from the newsletter list?`)) return
    try {
      await deleteSubscriber(s.id)
      setSubs((list) => list.filter((x) => x.id !== s.id))
      toast.success('Subscriber removed')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const exportCsv = () => exportSubscribersCsv().catch((e) => toast.error(e.message))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
          <p className="text-sm text-gray-400 mt-0.5">People who signed up through the newsletter box in the storefront footer.</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!subs?.length}
          className="flex items-center gap-2 border border-gray-200 bg-white hover:border-violet-400 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400">Total subscribers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{subs ? subs.length : '—'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400">Joined in the last 30 days</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{subs ? last30 : '—'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email" className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-violet-400" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Signed up</th>
                <th className="text-right px-5 py-3">{canEditCatalog && 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!subs ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={3} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
                ))
              ) : shown.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-400">{subs.length ? 'No email matches.' : 'No sign-ups yet.'}</td></tr>
              ) : shown.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3.5 text-gray-800">{s.email}</td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(s.createdAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {canEditCatalog && (
                      <button onClick={() => remove(s)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-100" aria-label={`Remove ${s.email}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
