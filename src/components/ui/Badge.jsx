const variants = {
  green: 'bg-green-100 text-green-700 border border-green-200',
  red: 'bg-red-100 text-red-700 border border-red-200',
  yellow: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  blue: 'bg-blue-100 text-blue-700 border border-blue-200',
  purple: 'bg-violet-100 text-violet-700 border border-violet-200',
  gray: 'bg-gray-100 text-gray-600 border border-gray-200',
  orange: 'bg-orange-100 text-orange-700 border border-orange-200',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-sans text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function DiscountBadge({ discount }) {
  if (!discount) return null
  return (
    <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded">
      -{discount}%
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    pending: { label: 'Pending', variant: 'yellow' },
    processing: { label: 'Processing', variant: 'blue' },
    shipped: { label: 'Shipped', variant: 'purple' },
    delivered: { label: 'Delivered', variant: 'green' },
    cancelled: { label: 'Cancelled', variant: 'red' },
    paid: { label: 'Paid', variant: 'green' },
    refunded: { label: 'Refunded', variant: 'orange' },
    partially_refunded: { label: 'Part refunded', variant: 'orange' },
    active: { label: 'Active', variant: 'green' },
    inactive: { label: 'Inactive', variant: 'gray' },
  }
  const cfg = map[status] || { label: status, variant: 'gray' }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
