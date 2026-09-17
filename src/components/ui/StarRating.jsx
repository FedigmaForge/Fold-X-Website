import { Star } from 'lucide-react'

export default function StarRating({ rating, max = 5, size = 16, showValue = false, interactive = false, onChange }) {
  const stars = Array.from({ length: max }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((star) => (
        <Star
          key={star}
          size={size}
          className={`${interactive ? 'cursor-pointer' : ''} transition-colors`}
          fill={star <= rating ? '#f59e0b' : 'none'}
          stroke={star <= rating ? '#f59e0b' : '#d1d5db'}
          onClick={() => interactive && onChange?.(star)}
        />
      ))}
      {showValue && (
        <span className="ml-1 text-sm text-gray-600 font-medium">{rating.toFixed(1)}</span>
      )}
    </div>
  )
}
