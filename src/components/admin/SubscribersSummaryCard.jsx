import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MailPlus } from 'lucide-react'
import { getSubscribers } from '@/services/api'

// Dashboard line: newsletter sign-ups from the storefront footer
export default function SubscribersSummaryCard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getSubscribers()
      .then((list) => {
        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
        setStats({ total: list.length, recent: list.filter((s) => new Date(s.createdAt) >= monthAgo).length })
      })
      .catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <Link to="/admin/subscribers" className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 hover:border-violet-300">
      <MailPlus size={20} className="text-violet-600 shrink-0" />
      <p className="flex-1 text-sm text-gray-800">
        <span className="font-medium">{stats.total} newsletter subscriber{stats.total === 1 ? '' : 's'}</span>
        <span className="text-gray-500"> · {stats.recent} joined in the last 30 days</span>
      </p>
      <span className="text-sm text-violet-600 shrink-0">View →</span>
    </Link>
  )
}
