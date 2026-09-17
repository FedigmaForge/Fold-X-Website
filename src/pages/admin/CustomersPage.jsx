import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { getCustomers } from '@/services/api'

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCustomers().then((c) => { setCustomers(c); setLoading(false) })
  }, [])

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-400 mt-0.5">{customers.length} registered customers</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Customers', value: customers.length },
          { label: 'Active', value: customers.filter((c) => c.isActive).length },
          { label: 'Avg. Order Value', value: customers.length ? formatCurrency(customers.reduce((s, c) => s + (c.totalSpent / (c.orderCount || 1)), 0) / customers.length) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-5 py-3">Customer</th>
                <th className="text-left px-5 py-3">Location</th>
                <th className="text-left px-5 py-3">Orders</th>
                <th className="text-left px-5 py-3">Total Spent</th>
                <th className="text-left px-5 py-3">Joined</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({length:4}).map((_,i) => (
                  <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded"/></td></tr>
                ))
              ) : filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-semibold shrink-0">
                        {c.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{c.city}</td>
                  <td className="px-5 py-4 text-gray-700 font-medium">{c.orderCount}</td>
                  <td className="px-5 py-4 font-semibold text-gray-900">{formatCurrency(c.totalSpent)}</td>
                  <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(c.joinedAt)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400">No customers found</div>
          )}
        </div>
      </div>
    </div>
  )
}
