import { useState, useEffect } from 'react'
import { Search, Eye, Gift } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { getOrders, updateOrderStatus } from '@/services/api'
import toast from 'react-hot-toast'

const STATUS_TABS = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled']

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    getOrders({ status: activeTab }).then((o) => { setOrders(o); setLoading(false) })
  }, [activeTab])

  const filtered = orders.filter((o) =>
    o.id.toLowerCase().includes(search.toLowerCase()) ||
    o.customerName.toLowerCase().includes(search.toLowerCase())
  )

  const handleStatusUpdate = async (orderId, status) => {
    setUpdating(true)
    await updateOrderStatus(orderId, status)
    setOrders((os) => os.map((o) => o.id === orderId ? { ...o, status } : o))
    if (selected?.id === orderId) setSelected((s) => ({ ...s, status }))
    toast.success('Order status updated')
    setUpdating(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-400 mt-0.5">{orders.length} orders</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => { setActiveTab(s); setLoading(true) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${activeTab === s ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {s === 'all' ? 'All Orders' : s}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order ID or customer…" className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-5 py-3">Order ID</th>
                <th className="text-left px-5 py-3">Customer</th>
                <th className="text-left px-5 py-3">Items</th>
                <th className="text-left px-5 py-3">Total</th>
                <th className="text-left px-5 py-3">Payment</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
                ))
              ) : filtered.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-violet-600 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      {o.id}
                      {o.giftWrap && <Gift size={13} className="text-pink-500" aria-label="Gift wrapped" />}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800">{o.customerName}</p>
                    <p className="text-xs text-gray-400">{o.customerEmail}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{o.items.reduce((s, i) => s + i.quantity, 0)} items</td>
                  <td className="px-5 py-4 font-semibold text-gray-900">{formatCurrency(o.total)}</td>
                  <td className="px-5 py-4"><StatusBadge status={o.paymentStatus} /></td>
                  <td className="px-5 py-4"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(o.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => setSelected(o)} className="p-1.5 rounded-lg hover:bg-violet-100 text-violet-600 transition-colors">
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No orders found</div>
          )}
        </div>
      </div>

      {/* Order detail modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Order ${selected?.id}`} size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Customer</p>
                <p className="font-medium text-gray-800">{selected.customerName}</p>
                <p className="text-gray-500">{selected.customerEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Deliver to</p>
                <p className="text-gray-700">{selected.address?.line1}</p>
                <p className="text-gray-500">{selected.address?.city}, {selected.address?.state} - {selected.address?.pincode}</p>
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {selected.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border-b border-gray-50 last:border-0">
                  <img src={item.product.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-50 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                    <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm border-t border-gray-100 pt-3 font-bold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(selected.total)}</span>
            </div>

            {selected.giftWrap && (
              <div className="flex items-start gap-2 bg-pink-50 border border-pink-100 rounded-xl p-3 text-sm">
                <Gift size={16} className="text-pink-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Gift wrap requested</p>
                  {selected.giftNote && <p className="text-gray-500 text-xs mt-0.5">"{selected.giftNote}"</p>}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusUpdate(selected.id, s)}
                    disabled={updating || selected.status === s}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${selected.status === s ? 'bg-violet-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-violet-400 hover:text-violet-600 disabled:opacity-50'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
