import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getStockHistory } from '@/services/api'

const REASONS = { sale: 'Sold', cancel: 'Order cancelled', return: 'Returned', adjustment: 'Manual change', import: 'CSV import' }

const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// Latest stock movements for one product (newest first). `refreshKey` lets
// the parent reload it after a save.
export default function StockHistory({ productId, refreshKey }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let stale = false
    getStockHistory(productId).then((r) => { if (!stale) setRows(r) }).catch(() => { if (!stale) setRows([]) })
    return () => { stale = true }
  }, [productId, refreshKey])

  if (!rows) return <div className="h-16 bg-gray-100 animate-pulse rounded-xl" />
  if (rows.length === 0) return <p className="text-sm text-gray-400">No stock changes recorded yet.</p>

  return (
    <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto -mx-1">
      {rows.map((m) => (
        <li key={m.id} className="flex items-start gap-3 py-2.5 px-1 text-sm">
          <span className={`w-12 shrink-0 text-right font-medium tabular-nums ${m.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {m.change > 0 ? `+${m.change}` : m.change}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-gray-700">
              {REASONS[m.reason] ?? m.reason}
              {m.variant && <span className="text-gray-400"> · {m.variant}</span>}
              {m.orderId && (
                <> · <Link to={`/admin/orders/${encodeURIComponent(m.orderId)}`} className="text-violet-600 hover:underline font-mono text-xs">{m.orderId.slice(-8)}</Link></>
              )}
            </p>
            {m.note && <p className="text-xs text-gray-400 truncate">{m.note}</p>}
          </div>
          <span className="text-xs text-gray-400 shrink-0 text-right">
            {when(m.createdAt)}{m.actorName && <><br />{m.actorName}</>}
          </span>
        </li>
      ))}
    </ul>
  )
}
