import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, Reply, Package } from 'lucide-react'
import { getMessages, updateMessage } from '@/services/api'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'new', label: 'New' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]
const STATUS_STYLE = { new: 'bg-violet-100 text-violet-700', open: 'bg-yellow-100 text-yellow-700', closed: 'bg-gray-100 text-gray-500' }
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// Messages from the storefront contact form. Replies go out from the staff
// member's own email client (there's no outgoing email service yet).
export default function InboxPage() {
  const [tab, setTab] = useState('new')
  const [result, setResult] = useState({ tab: null, messages: [] })
  const [selectedId, setSelectedId] = useState(null)
  const [note, setNote] = useState('')
  const loading = result.tab !== tab
  const messages = result.messages
  const selected = messages.find((m) => m.id === selectedId) ?? null

  const load = (t) => getMessages(t).then((m) => setResult({ tab: t, messages: m })).catch((e) => toast.error(e.message))
  useEffect(() => { load(tab) }, [tab])

  const open = (m) => {
    setSelectedId(m.id)
    setNote(m.internalNote)
    // Opening a new message moves it to "open" so colleagues see someone's on it
    if (m.status === 'new') change(m, { status: 'open' }, false)
  }

  const change = async (m, data, notify = true) => {
    try {
      const updated = await updateMessage(m.id, data)
      setResult((r) => ({ ...r, messages: r.messages.map((x) => (x.id === m.id ? { ...x, ...updated } : x)) }))
      if (notify) toast.success(data.status ? `Marked as ${data.status}` : 'Note saved')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const replyHref = (m) => `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}${m.orderId ? ` (order ${m.orderId})` : ''}`)}&body=${encodeURIComponent(`Hi ${m.name.split(' ')[0]},\n\n\n\n— \n> ${m.message.split('\n').join('\n> ')}`)}`

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
        <p className="text-sm text-gray-400 mt-0.5">Messages from the storefront contact form.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedId(null) }} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5 items-start">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {loading ? (
            <div className="p-5"><div className="h-4 bg-gray-200 animate-pulse rounded" /></div>
          ) : messages.length === 0 ? (
            <p className="p-10 text-center text-gray-400 text-sm">No {tab === 'all' ? '' : tab} messages</p>
          ) : messages.map((m) => (
            <button key={m.id} onClick={() => open(m)} className={`w-full text-left px-5 py-4 hover:bg-gray-50 ${selectedId === m.id ? 'bg-violet-50' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm truncate ${m.status === 'new' ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>{m.name}</p>
                <span className="text-xs text-gray-400 shrink-0">{when(m.createdAt)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{m.subject}{m.orderId && ` · ${m.orderId}`}</p>
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">{m.message}</p>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 lg:sticky lg:top-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2>{selected.subject}</h2>
                <p className="text-xs text-gray-400 mt-1">{when(selected.createdAt)}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="text-gray-800">{selected.name}</span>
              <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1 text-violet-600 hover:underline"><Mail size={13} /> {selected.email}</a>
              {selected.phone && <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1 text-gray-600 hover:text-violet-600"><Phone size={13} /> {selected.phone}</a>}
              {selected.orderId && (
                selected.orderExists
                  ? <Link to={`/admin/orders/${encodeURIComponent(selected.orderId)}`} className="inline-flex items-center gap-1 text-violet-600 hover:underline"><Package size={13} /> Order {selected.orderId}</Link>
                  : <span className="inline-flex items-center gap-1 text-gray-400"><Package size={13} /> {selected.orderId} (no matching order)</span>
              )}
            </div>

            <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-4">{selected.message}</p>

            <div className="flex flex-wrap gap-2">
              <a href={replyHref(selected)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700">
                <Reply size={14} /> Reply by email
              </a>
              {selected.status !== 'closed' ? (
                <button onClick={() => change(selected, { status: 'closed' })} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-violet-400">Mark as resolved</button>
              ) : (
                <button onClick={() => change(selected, { status: 'open' })} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-violet-400">Reopen</button>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Internal note (staff only)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 resize-none" />
              {note !== selected.internalNote && (
                <button onClick={() => change(selected, { internalNote: note })} className="mt-2 text-xs text-violet-600 hover:underline">Save note</button>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex items-center justify-center h-64 rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400">
            Select a message to read it
          </div>
        )}
      </div>
    </div>
  )
}
