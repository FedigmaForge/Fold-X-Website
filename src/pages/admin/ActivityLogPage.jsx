import { useState, useEffect } from 'react'
import { ScrollText, Package, ShoppingBag, Image, Star, Settings, ShieldCheck } from 'lucide-react'
import { formatDate } from '@/utils/formatDate'
import { getAuditLog } from '@/services/api'
import useAuthStore from '@/store/authStore'

const ENTITY_ICON = {
  Product: Package,
  Order: ShoppingBag,
  Banner: Image,
  Review: Star,
  Settings: Settings,
  Staff: ShieldCheck,
}

const ROLE_BADGE = {
  support: 'bg-blue-100 text-blue-700',
  manager: 'bg-violet-100 text-violet-700',
  superadmin: 'bg-amber-100 text-amber-700',
}

export default function ActivityLogPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentUser?.role !== 'superadmin') return
    getAuditLog().then((e) => { setEntries(e); setLoading(false) }).catch(() => setLoading(false))
  }, [currentUser])

  if (currentUser?.role !== 'superadmin') {
    return (
      <div className="text-center py-20">
        <ScrollText size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">Only Super Admins can view the activity log.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-sm text-gray-400 mt-0.5">Recent staff actions, most recent first</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></div>
          ))
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No activity recorded yet</div>
        ) : entries.map((e) => {
          const Icon = ENTITY_ICON[e.entityType] || ScrollText
          return (
            <div key={e.id} className="flex items-start gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{e.summary}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">{e.actorName}</span>
                  <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${ROLE_BADGE[e.actorRole] || 'bg-gray-100 text-gray-500'}`}>
                    {e.actorRole}
                  </span>
                </div>
              </div>
              <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{formatDate(e.createdAt)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
