import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Gift, Download, ChevronRight, X, Truck, Scissors } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { getOrders, downloadOrdersCsv } from '@/services/api'
import toast from 'react-hot-toast'

const STATUS_TABS = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled']
// Payment method, incl. COD orders nobody has confirmed with the customer yet
const METHOD_FILTERS = [
  { value: 'all', label: 'All methods' },
  { value: 'online', label: 'Paid online' },
  { value: 'cod', label: 'Cash on delivery' },
  { value: 'cod_unconfirmed', label: 'COD — to confirm' },
]

const PAYMENT_FILTERS = [
  { value: 'all', label: 'All payments' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Payment pending' },
  { value: 'partially_refunded', label: 'Partly refunded' },
  { value: 'refunded', label: 'Refunded' },
]

export default function OrdersPage() {
  const navigate = useNavigate()
  // Results are tagged with the filter key they were fetched for, so "loading"
  // is derived (key mismatch) rather than toggled inside the effect.
  const [result, setResult] = useState({ key: null, orders: [] })
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  // ?method=cod_unconfirmed deep-links straight to COD orders awaiting confirmation
  const [paymentMethod, setPaymentMethod] = useState(() => new URLSearchParams(window.location.search).get('method') || 'all')
  // ?customised=1 deep-links to orders with a free leather change
  const [customised, setCustomised] = useState(() => new URLSearchParams(window.location.search).get('customised') === '1')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filters = { status: activeTab, paymentStatus, paymentMethod, q: debouncedSearch, from, to, customised: customised ? '1' : '' }
  const filterKey = JSON.stringify(filters)
  const loading = result.key !== filterKey
  const orders = result.orders

  useEffect(() => {
    let stale = false
    getOrders(JSON.parse(filterKey))
      .then((o) => { if (!stale) setResult({ key: filterKey, orders: o }) })
      .catch((e) => { if (!stale) { toast.error(e.message); setResult({ key: filterKey, orders: [] }) } })
    return () => { stale = true }
  }, [filterKey])

  const hasExtraFilters = paymentStatus !== 'all' || paymentMethod !== 'all' || customised || search || from || to
  const clearFilters = () => { setPaymentStatus('all'); setPaymentMethod('all'); setCustomised(false); setSearch(''); setFrom(''); setTo('') }

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadOrdersCsv(filters)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setExporting(false)
    }
  }

  const totalRevenue = orders.reduce((s, o) => s + o.total - (o.refundedAmount || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {orders.length} orders{orders.length > 0 && ` · ${formatCurrency(totalRevenue)} net`}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || orders.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-violet-400 hover:text-violet-600 disabled:opacity-50 transition-colors"
        >
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setActiveTab(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${activeTab === s ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {s === 'all' ? 'All Orders' : s}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order ID, name or email…" className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400" />
        </div>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          aria-label="Payment method"
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400 bg-white"
        >
          {METHOD_FILTERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400 bg-white"
        >
          {PAYMENT_FILTERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setCustomised((c) => !c)}
          aria-pressed={customised}
          className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm border transition-colors ${customised ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-600 hover:border-violet-400'}`}
        >
          <Scissors size={14} /> Custom leather
        </button>
        <div className="flex items-center gap-1.5 text-sm text-gray-400">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-violet-400" />
          <span>to</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-violet-400" />
        </div>
        {hasExtraFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 px-2 py-2 text-xs text-gray-500 hover:text-violet-600">
            <X size={13} /> Clear filters
          </button>
        )}
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
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
                ))
              ) : orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/admin/orders/${encodeURIComponent(o.id)}`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4 font-mono text-xs text-violet-600 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      {o.id}
                      {o.giftWrap && <Gift size={13} className="text-pink-500" aria-label="Gift wrapped" />}
                      {o.trackingNumber && <Truck size={13} className="text-gray-400" aria-label="Has tracking number" />}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800">{o.customerName}</p>
                    <p className="text-xs text-gray-400">{o.customerEmail}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {o.items.reduce((s, i) => s + i.quantity, 0)} items
                    {o.items.some((i) => i.variant?.leather) && (
                      <span className="block mt-0.5 text-xs text-amber-700" title={o.items.filter((i) => i.variant?.leather).map((i) => `${i.product?.name} → ${i.variant.leather}`).join(', ')}>
                        Custom leather
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-semibold text-gray-900">{formatCurrency(o.total)}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={o.paymentStatus} />
                    {o.paymentMethod === 'cod' && (
                      <span className={`block text-xs mt-0.5 ${!o.codConfirmedAt && o.status !== 'cancelled' ? 'text-amber-700' : 'text-gray-400'}`}>
                        COD{!o.codConfirmedAt && o.status !== 'cancelled' ? ' · to confirm' : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(o.createdAt)}</td>
                  <td className="px-5 py-4 text-right text-gray-300"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && orders.length === 0 && (
            <div className="text-center py-12 text-gray-400">No orders match these filters</div>
          )}
        </div>
      </div>
    </div>
  )
}
