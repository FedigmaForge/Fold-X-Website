import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, MapPin, X, Ban, Banknote, Undo2, Inbox } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { getCustomer, updateCustomer } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { usePermissions } from '@/utils/permissions'
import toast from 'react-hot-toast'

const SUGGESTED_TAGS = ['VIP', 'Wholesale', 'Influencer', 'Gifting', 'Repeat']

function Card({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 ${className}`}>
      {title && <h2 className="flex items-center gap-2 mb-4">{Icon && <Icon size={16} className="text-gray-400" />}{title}</h2>}
      {children}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl text-gray-900 mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function CustomerDetailPage() {
  const { email } = useParams()
  const { canEditCatalog: canManage } = usePermissions()
  const [c, setC] = useState(null)
  const [error, setError] = useState(null)
  const [notes, setNotes] = useState('')
  const [newTag, setNewTag] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getCustomer(email)
      .then((data) => { setC(data); setNotes(data.profile.notes); setBlockReason(data.profile.blockReason) })
      .catch((e) => setError(e.message))
  }, [email])

  const save = async (data, msg) => {
    setBusy(true)
    try {
      const profile = await updateCustomer(c.email, data)
      setC((x) => ({ ...x, profile }))
      if (msg) toast.success(msg)
      return true
    } catch (e) {
      toast.error(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="text-center py-20"><p className="text-gray-500 mb-4">{error}</p><Link to="/admin/customers" className="text-sm text-violet-600 hover:underline">Back to customers</Link></div>
  if (!c) return <div className="space-y-4"><div className="h-8 w-64 bg-gray-200 animate-pulse rounded-lg" /><div className="h-48 bg-gray-200 animate-pulse rounded-2xl" /></div>

  const { profile, stats } = c
  const tags = profile.tags ?? []
  const addTag = (t) => {
    const tag = t.trim()
    if (!tag || tags.includes(tag)) return
    save({ tags: [...tags, tag] })
    setNewTag('')
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/customers" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 mb-2"><ArrowLeft size={13} /> All customers</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.registered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.registered ? 'Has account' : 'Guest'}</span>
          {profile.isBlocked && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><Ban size={11} /> Blocked</span>}
          {tags.map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs">{t}</span>)}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm">
          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-violet-600 hover:underline"><Mail size={13} /> {c.email}</a>
          {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-gray-600 hover:text-violet-600"><Phone size={13} /> {c.phone}</a>}
          {c.joinedAt && <span className="text-gray-400">Joined {formatDate(c.joinedAt)}</span>}
        </div>
      </div>

      {profile.isBlocked && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          Blocked{profile.blockReason ? ` — ${profile.blockReason}` : ''}. They can't place orders{c.registered ? ' or sign in' : ''}.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Orders" value={stats.orderCount} sub={stats.cancelledCount ? `${stats.cancelledCount} cancelled` : null} />
        <Stat label="Total spent" value={formatCurrency(stats.totalSpent)} sub={stats.refunded ? `${formatCurrency(stats.refunded)} refunded` : null} />
        <Stat label="Average order" value={stats.avgOrderValue ? formatCurrency(stats.avgOrderValue) : '—'} />
        <Stat label="Customer since" value={stats.firstOrderAt ? formatDate(stats.firstOrderAt) : '—'} sub={stats.lastOrderAt ? `Last order ${formatDate(stats.lastOrderAt)}` : null} />
        <Stat label="Cash on delivery" value={stats.codOrders} sub={stats.codRefusals ? `${stats.codRefusals} refused` : 'orders'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <Card title={`Orders (${c.orders.length})`}>
            {c.orders.length === 0 ? <p className="text-sm text-gray-400">No orders yet</p> : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-gray-400">
                      <th className="text-left px-1 pb-2 font-normal">Order</th>
                      <th className="text-left px-1 pb-2 font-normal">Date</th>
                      <th className="text-right px-1 pb-2 font-normal">Total</th>
                      <th className="text-left px-3 pb-2 font-normal">Payment</th>
                      <th className="text-left px-1 pb-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {c.orders.map((o) => (
                      <tr key={o.id}>
                        <td className="px-1 py-2.5"><Link to={`/admin/orders/${encodeURIComponent(o.id)}`} className="font-mono text-xs text-violet-600 hover:underline">{o.id}</Link></td>
                        <td className="px-1 py-2.5 text-xs text-gray-500">{formatDate(o.createdAt)}</td>
                        <td className="px-1 py-2.5 text-right tabular-nums">{formatCurrency(o.total)}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-gray-500 mr-1.5">{o.paymentMethod === 'cod' ? 'COD' : 'Online'}</span>
                          <StatusBadge status={o.paymentStatus} />
                          {o.codRefused && <span className="block text-xs text-red-600 mt-0.5">Refused at delivery</span>}
                        </td>
                        <td className="px-1 py-2.5"><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Notes (staff only)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="e.g. Prefers WhatsApp; asked about a matching card holder" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 resize-y" />
            {notes !== profile.notes && (
              <button onClick={() => save({ notes }, 'Notes saved')} disabled={busy} className="mt-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50">Save notes</button>
            )}
          </Card>

          {(c.returns.length > 0 || c.messages.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-5">
              <Card title={`Returns (${c.returns.length})`} icon={Undo2}>
                {c.returns.length === 0 ? <p className="text-sm text-gray-400">None</p> : (
                  <ul className="space-y-2 text-sm">
                    {c.returns.map((r) => (
                      <li key={r.id}><Link to="/admin/returns" className="text-gray-800 hover:text-violet-600 capitalize">{r.status}</Link> <span className="text-xs text-gray-400">· {r.reason} · {formatDate(r.createdAt)}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title={`Messages (${c.messages.length})`} icon={Inbox}>
                {c.messages.length === 0 ? <p className="text-sm text-gray-400">None</p> : (
                  <ul className="space-y-2 text-sm">
                    {c.messages.map((m) => (
                      <li key={m.id}><Link to="/admin/inbox" className="text-gray-800 hover:text-violet-600">{m.subject}</Link> <span className="text-xs text-gray-400">· {m.status} · {formatDate(m.createdAt)}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Tags">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs">
                  {t}
                  <button onClick={() => save({ tags: tags.filter((x) => x !== t) })} aria-label={`Remove ${t}`} className="hover:text-red-600"><X size={11} /></button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-xs text-gray-400">No tags</span>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addTag(newTag) }} className="flex gap-2">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} maxLength={30} placeholder="Add a tag…" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400" />
              <button type="submit" disabled={!newTag.trim() || busy} className="px-3 rounded-xl bg-violet-100 text-violet-600 text-sm disabled:opacity-50">Add</button>
            </form>
            <div className="flex flex-wrap gap-1 mt-2">
              {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                <button key={t} onClick={() => addTag(t)} className="px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-xs text-gray-500 hover:border-violet-400 hover:text-violet-600">+ {t}</button>
              ))}
            </div>
          </Card>

          <Card title="Addresses" icon={MapPin}>
            {c.addresses.length === 0 ? <p className="text-sm text-gray-400">None yet</p> : (
              <ul className="space-y-3 text-sm text-gray-600">
                {c.addresses.map((a, i) => (
                  <li key={i}>
                    <p className="text-gray-800">{a.name}</p>
                    <p>{a.line1}</p>
                    <p>{[a.city, a.state].filter(Boolean).join(', ')}{a.pincode && ` – ${a.pincode}`}</p>
                    <p className="text-xs text-gray-400">Last used {formatDate(a.lastUsed)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Account controls">
            {!canManage && <p className="text-xs text-gray-400 mb-3">Only a Manager or Super Admin can change these.</p>}
            <fieldset disabled={!canManage || busy} className="space-y-4">
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!profile.codDisabled} onChange={(e) => save({ codDisabled: !e.target.checked }, e.target.checked ? 'Cash on delivery turned on' : 'Cash on delivery turned off')} className="mt-0.5" />
                <span>
                  <span className="flex items-center gap-1.5"><Banknote size={14} className="text-gray-400" /> Allow cash on delivery</span>
                  <span className="block text-xs text-gray-400">Turn off for customers who refuse parcels. COD also stops automatically after repeated refusals.</span>
                </span>
              </label>

              <div className="border-t border-gray-50 pt-4">
                {profile.isBlocked ? (
                  <button onClick={() => save({ isBlocked: false }, 'Customer unblocked')} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-violet-400">Unblock customer</button>
                ) : (
                  <>
                    <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} maxLength={300} placeholder="Reason (e.g. repeated fake orders)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400 mb-2" />
                    <button
                      onClick={() => { if (confirm(`Block ${c.name}? They won't be able to place orders${c.registered ? ' or sign in' : ''}.`)) save({ isBlocked: true, blockReason }, 'Customer blocked') }}
                      disabled={!blockReason.trim()}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Ban size={14} /> Block customer
                    </button>
                  </>
                )}
              </div>
            </fieldset>
          </Card>
        </div>
      </div>
    </div>
  )
}
