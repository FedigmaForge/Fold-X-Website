import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatCard({ title, value, growth, icon: Icon, color = 'violet', prefix = '', suffix = '' }) {
  const colors = {
    violet: 'bg-violet-100 text-violet-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
  }
  const isPositive = growth >= 0

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={22} />
        </div>
        {growth !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
            isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
          }`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(growth)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">
        {prefix}{value}{suffix}
      </p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  )
}
