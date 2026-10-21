import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, Ban } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { getCustomers } from '@/services/api'
import toast from 'react-hot-toast'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'repeat', label: 'Repeat' },
  { key: 'registered', label: 'With account' },
  { key: 'guests', label: 'Guests' },
  { key: 'blocked', label: 'Blocked' },
]

// Everyone who has an account or has ordered — guests included, one row per email
export default function CustomersPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [result, setResult] = useState({ key: null, rows: [] })
  const key = `${filter}|${debounced}`
  const loading = result.key !== key
  const rows = result.rows

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let stale = false
    getCustomers({ filter, q: debounced })
      .then((r) => { if (!stale) setResult({ key, rows: r }) })
      .catch((e) => { if (!stale) { toast.error(e.message); setResult({ key, rows: [] }) } })
    return () => { stale = true }
  }, [filter, debounced, key])

  const totalSpent = rows.reduce((s, c) => s + c.totalSpent, 0)
  const repeat = rows.filter((c) => c.orderCount > 1).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-400 mt-0.5">Everyone who has an account or has ordered, including guest checkouts.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Customers', rows.length],
          ['Repeat customers', rows.length ? `${repeat} (${Math.round((repeat / rows.length) * 100)}%)` : '—'],
          ['Total spent', formatCurrency(totalSpent)],
          ['Avg. spend per customer', rows.length ? formatCurrency(totalSpent / rows.length) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl text-gray-900 mt-1 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{f.label}</button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or phone…" className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-5 py-3">Customer</th>
                <th className="text-left px-5 py-3">City</th>
                <th className="text-right px-5 py-3">Orders</th>
                <th className="text-right px-5 py-3">Spent</th>
                <th className="text-left px-5 py-3">Last order</th>
                <th className="text-left px-5 py-3">Tags</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>)
              ) : rows.map((c) => (
                <tr key={c.email} onClick={() => navigate(`/admin/customers/${encodeURIComponent(c.email)}`)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800 flex items-center gap-1.5">
                      {c.name}
                      {c.isBlocked && <Ban size={13} className="text-red-500" aria-label="Blocked" />}
                    </p>
                    <p className="text-xs text-gray-400">{c.email}{!c.registered && ' · guest'}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{c.city ?? '—'}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                    {c.orderCount}
                    {c.codRefusals > 0 && <span className="block text-xs text-red-600">{c.codRefusals} COD refused</span>}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-gray-900">{formatCurrency(c.totalSpent)}</td>
                  <td className="px-5 py-4 text-xs text-gray-400">{c.lastOrderAt ? formatDate(c.lastOrderAt) : 'No orders yet'}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs">{t}</span>)}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-300"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length === 0 && <p className="text-center py-12 text-gray-400">No customers match</p>}
      </div>
    </div>
  )
}
