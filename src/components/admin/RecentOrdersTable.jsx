import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/utils/formatCurrency'

export default function RecentOrdersTable({ orders = [] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-800">Recent Orders</h3>
        <Link to="/admin/orders" className="text-sm text-violet-600 hover:underline font-medium">
          View all →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
              <th className="text-left px-6 py-3">Order ID</th>
              <th className="text-left px-6 py-3">Customer</th>
              <th className="text-left px-6 py-3">Amount</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3.5">
                  <Link to={`/admin/orders`} className="font-mono text-violet-600 hover:underline text-xs">
                    {order.id}
                  </Link>
                </td>
                <td className="px-6 py-3.5">
                  <div>
                    <p className="font-medium text-gray-800">{order.customerName}</p>
                    <p className="text-xs text-gray-400">{order.customerEmail}</p>
                  </div>
                </td>
                <td className="px-6 py-3.5 font-semibold text-gray-900">
                  {formatCurrency(order.total)}
                </td>
                <td className="px-6 py-3.5">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-6 py-3.5 text-gray-400 text-xs">{order.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
