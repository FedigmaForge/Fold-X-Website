import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { getLowStock } from '@/services/api'

// Dashboard alert listing products/variants at or below their low-stock
// threshold. Renders nothing when everything is well stocked.
export default function LowStockCard() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    getLowStock().then(setRows).catch(() => {})
  }, [])

  if (rows.length === 0) return null
  const shown = rows.slice(0, 6)

  return (
    <div className="bg-white rounded-2xl border border-orange-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" /> Running low
        </h2>
        <Link to="/admin/products" className="text-xs text-violet-600 hover:underline">
          {rows.length > shown.length ? `View all ${rows.length}` : 'Manage stock'}
        </Link>
      </div>
      <ul className="divide-y divide-gray-50">
        {shown.map((r) => (
          <li key={`${r.productId}-${r.variantId}`}>
            <Link to={`/admin/products/${r.productId}/edit`} className="flex items-center gap-3 py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg">
              {r.image ? <img src={r.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" /> : <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{r.productName}</p>
                <p className="text-xs text-gray-400 truncate">{[r.variant, r.sku].filter(Boolean).join(' · ') || 'No variants'}</p>
              </div>
              <span className={`text-sm font-medium shrink-0 ${r.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                {r.stock === 0 ? 'Sold out' : `${r.stock} left`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
