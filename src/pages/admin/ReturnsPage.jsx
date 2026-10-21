import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { getReturns, updateReturn } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'open', label: 'To handle' },
  { key: 'received', label: 'Received' },
  { key: 'closed', label: 'Closed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]
const STATUS = {
  requested: ['Requested', 'bg-violet-100 text-violet-700'],
  approved: ['Approved — awaiting parcel', 'bg-blue-100 text-blue-700'],
  received: ['Received — refund due', 'bg-yellow-100 text-yellow-700'],
  closed: ['Closed', 'bg-green-100 text-green-700'],
  rejected: ['Rejected', 'bg-gray-100 text-gray-500'],
}
const when = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function ReturnCard({ r, onChanged }) {
  const [note, setNote] = useState(r.adminNote)
  const [restock, setRestock] = useState(!/damaged|defective/i.test(r.reason))
  const [busy, setBusy] = useState(false)

  const act = async (status) => {
    if (status === 'rejected' && !note.trim()) { toast.error('Add a note explaining why it was rejected'); return }
    setBusy(true)
    try {
      const updated = await updateReturn(r.id, { status, adminNote: note, ...(status === 'received' && { restock }) })
      toast.success(`Return ${status}`)
      onChanged({ ...r, ...updated })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const [label, cls] = STATUS[r.status]
  const units = r.items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/admin/orders/${encodeURIComponent(r.orderId)}`} className="inline-flex items-center gap-1 font-mono text-sm text-violet-600 hover:underline">
            {r.orderId} <ExternalLink size={12} />
          </Link>
          <p className="text-sm text-gray-800 mt-0.5">{r.order.customerName} <span className="text-gray-400">· {r.order.customerEmail}</span></p>
          <p className="text-xs text-gray-400">Requested {when(r.createdAt)}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-1">Items ({units})</p>
          <ul className="space-y-0.5 text-gray-700">
            {r.items.map((i) => (
              <li key={i.itemId}>
                {i.name} × {i.quantity}
                {Object.values(i.variant ?? {}).filter(Boolean).length > 0 && <span className="text-gray-400"> · {Object.values(i.variant).filter(Boolean).join(' / ')}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Reason</p>
          <p className="text-gray-700">{r.reason}</p>
          {r.details && <p className="text-gray-500 text-xs mt-1 whitespace-pre-wrap">"{r.details}"</p>}
        </div>
      </div>

      {r.status === 'received' && (
        <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2">
          Parcel is back{r.restocked ? ' and restocked' : ''}. Issue the refund from the{' '}
          <Link to={`/admin/orders/${encodeURIComponent(r.orderId)}`} className="underline">order page</Link>
          {' '}(paid {formatCurrency(r.order.total)}{r.order.refundedAmount > 0 && `, ${formatCurrency(r.order.refundedAmount)} refunded so far`}), then close this return.
        </p>
      )}

      {!['closed', 'rejected'].includes(r.status) && (
        <div className="space-y-3 border-t border-gray-50 pt-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note (recorded on the order timeline — required when rejecting)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400 resize-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            {r.status === 'requested' && (
              <button onClick={() => act('approved')} disabled={busy} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50">Approve</button>
            )}
            {r.status === 'approved' && (
              <>
                <button onClick={() => act('received')} disabled={busy} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50">Mark parcel received</button>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put items back in stock
                </label>
              </>
            )}
            {r.status === 'received' && (
              <button onClick={() => act('closed')} disabled={busy} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50">Close return</button>
            )}
            {['requested', 'approved'].includes(r.status) && (
              <button onClick={() => act('rejected')} disabled={busy} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50">Reject</button>
            )}
          </div>
        </div>
      )}
      {['closed', 'rejected'].includes(r.status) && r.adminNote && <p className="text-xs text-gray-500">Note: {r.adminNote}</p>}
    </div>
  )
}

export default function ReturnsPage() {
  const [tab, setTab] = useState('open')
  const [result, setResult] = useState({ tab: null, rows: [] })
  const loading = result.tab !== tab

  useEffect(() => {
    let stale = false
    getReturns(tab).then((rows) => { if (!stale) setResult({ tab, rows }) }).catch((e) => toast.error(e.message))
    return () => { stale = true }
  }, [tab])

  const replace = (updated) => setResult((r) => ({ ...r, rows: r.rows.map((x) => (x.id === updated.id ? updated : x)) }))

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
        <p className="text-sm text-gray-400 mt-0.5">Requests customers make from My Orders. Approve → mark received → refund on the order → close.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-32 bg-gray-200 animate-pulse rounded-2xl" />
      ) : result.rows.length === 0 ? (
        <p className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">Nothing here</p>
      ) : (
        <div className="space-y-4">
          {result.rows.map((r) => <ReturnCard key={`${r.id}-${r.status}`} r={r} onChanged={replace} />)}
        </div>
      )}
    </div>
  )
}
