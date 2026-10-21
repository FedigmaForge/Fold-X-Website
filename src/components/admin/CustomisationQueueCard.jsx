import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Scissors } from 'lucide-react'
import { getOrders } from '@/services/api'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDate } from '@/utils/formatDate'

// Dashboard workshop queue: open orders where the customer chose the free
// leather customisation, one row per bag to make. Renders nothing when empty.
export default function CustomisationQueueCard() {
  const [orders, setOrders] = useState([])

  useEffect(() => {
    getOrders({ customised: 'open' }).then(setOrders).catch(() => {})
  }, [])

  const lines = orders.flatMap((o) =>
    o.items.filter((i) => i.variant?.leather).map((i) => ({ order: o, item: i }))
  )
  if (lines.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 bg-amber-50 border-b border-amber-200">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Scissors size={18} className="text-amber-600" />
          Custom leather to make
          <span className="text-sm font-normal text-gray-500">· {lines.length} bag{lines.length === 1 ? '' : 's'}</span>
        </h2>
        <Link to="/admin/orders?customised=1" className="text-sm text-violet-600 hover:underline shrink-0">All customised orders →</Link>
      </div>
      <ul className="divide-y divide-gray-50">
        {lines.slice(0, 6).map(({ order, item }) => (
          <li key={`${order.id}-${item.id}`}>
            <Link to={`/admin/orders/${encodeURIComponent(order.id)}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
              {item.product?.images?.[0]
                ? <img src={item.product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-50 shrink-0" />
                : <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">
                  {item.product?.name}{item.quantity > 1 && <span className="text-gray-400"> × {item.quantity}</span>}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  Make in <span className="font-medium text-amber-700">{item.variant.leather}</span>
                  {item.variant.color && <> · {item.variant.color}</>}
                  {' · '}{order.id} · {formatDate(order.createdAt)}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </Link>
          </li>
        ))}
      </ul>
      {lines.length > 6 && (
        <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-50">and {lines.length - 6} more — see all customised orders.</p>
      )}
    </div>
  )
}
