import { useState, useEffect } from 'react'
import { CheckCircle, Trash2, Clock } from 'lucide-react'
import StarRating from '@/components/ui/StarRating'
import { getAllReviews, approveReview, deleteReview } from '@/services/api'
import { formatDate } from '@/utils/formatDate'
import toast from 'react-hot-toast'

const TABS = ['all', 'pending', 'approved']

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')

  useEffect(() => {
    getAllReviews().then((r) => { setReviews(r); setLoading(false) })
  }, [])

  const filtered = reviews.filter((r) => {
    if (tab === 'pending') return !r.isApproved
    if (tab === 'approved') return r.isApproved
    return true
  })

  const handleApprove = async (id) => {
    await approveReview(id)
    setReviews((rs) => rs.map((r) => r.id === id ? { ...r, isApproved: true } : r))
    toast.success('Review approved')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this review?')) return
    await deleteReview(id)
    setReviews((rs) => rs.filter((r) => r.id !== id))
    toast.success('Review deleted')
  }

  const pending = reviews.filter((r) => !r.isApproved).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <p className="text-sm text-gray-400 mt-0.5">{reviews.length} total · {pending} pending moderation</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'all' ? 'All Reviews' : t}
            {t === 'pending' && pending > 0 && (
              <span className="ml-1 bg-orange-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* Reviews */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
          No reviews in this category
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className={`bg-white rounded-2xl border p-5 ${!r.isApproved ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                      {r.userName[0]}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{r.userName}</span>
                    <StarRating rating={r.rating} size={13} />
                    <span className="text-xs text-gray-400 ml-auto">{formatDate(r.date)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">{r.title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{r.body}</p>
                  <p className="text-xs text-gray-400 mt-2">Product ID: {r.productId}</p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {r.isApproved ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle size={13} /> Approved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                      <Clock size={13} /> Pending
                    </span>
                  )}
                  <div className="flex gap-1.5 mt-2">
                    {!r.isApproved && (
                      <button
                        onClick={() => handleApprove(r.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
