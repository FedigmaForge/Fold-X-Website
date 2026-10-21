import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PhoneCall } from 'lucide-react'
import { getOrders } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'

// Dashboard prompt: cash-on-delivery orders nobody has confirmed with the
// customer yet. Renders nothing when there are none.
export default function CodToConfirmCard() {
  const [orders, setOrders] = useState([])

  useEffect(() => {
    getOrders({ paymentMethod: 'cod_unconfirmed' }).then(setOrders).catch(() => {})
  }, [])

  if (orders.length === 0) return null
  const value = orders.reduce((s, o) => s + o.total, 0)

  return (
    <Link to="/admin/orders?method=cod_unconfirmed" className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:border-amber-300">
      <PhoneCall size={20} className="text-amber-600 shrink-0" />
      <p className="flex-1 text-sm text-gray-800">
        <span className="font-medium">{orders.length} cash-on-delivery order{orders.length === 1 ? '' : 's'} to confirm</span>
        <span className="text-gray-500"> · {formatCurrency(value)} to collect. Call each customer before packing.</span>
      </p>
      <span className="text-sm text-violet-600 shrink-0">Review →</span>
    </Link>
  )
}
