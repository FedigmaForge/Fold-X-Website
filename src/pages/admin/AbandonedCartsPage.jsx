import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Mail, Link2, Trash2, ShoppingBag } from 'lucide-react'
import { getAbandonedCarts, markCartReminded, dismissCart, getCoupons } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import useSettingsStore from '@/store/settingsStore'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'abandoned', label: 'Abandoned' },
  { key: 'recovered', label: 'Recovered' },
  { key: 'all', label: 'All' },
]

const ago = (d) => {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  return `${Math.round(hrs / 24)} days ago`
}

// Indian mobile numbers → wa.me format (country code, digits only)
const waNumber = (phone) => {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return null
}

export default function AbandonedCartsPage() {
  const storeName = useSettingsStore((s) => s.storeName)
  const [tab, setTab] = useState('abandoned')
  const [result, setResult] = useState({ tab: null, data: null })
  const [codes, setCodes] = useState([])
  const [offerCode, setOfferCode] = useState('')
  const loading = result.tab !== tab
  const data = result.data

  const load = (t) => getAbandonedCarts(t).then((d) => setResult({ tab: t, data: d })).catch((e) => toast.error(e.message))
  useEffect(() => { load(tab) }, [tab])
  useEffect(() => {
    // Codes worth offering in a reminder: active, non-automatic coupons
    getCoupons().then((c) => setCodes(c.filter((x) => !x.isAutomatic && x.status === 'active'))).catch(() => {})
  }, [])

  const linkFor = (cart) => `${window.location.origin}/cart/recover/${cart.token}${offerCode ? `?code=${encodeURIComponent(offerCode)}` : ''}`

  const message = (cart) => {
    const first = cart.name?.split(' ')[0] || 'there'
    const items = cart.items.map((i) => i.name).join(', ')
    return [
      `Hi ${first}, you left ${items} in your ${storeName} bag.`,
      offerCode ? `Use code ${offerCode} at checkout for a little extra off.` : null,
      `Pick up where you left off: ${linkFor(cart)}`,
    ].filter(Boolean).join('\n\n')
  }

  const reminded = async (cart, channel) => {
    try {
      const updated = await markCartReminded(cart.id, channel)
      setResult((r) => ({ ...r, data: { ...r.data, carts: r.data.carts.map((c) => (c.id === cart.id ? updated : c)) } }))
    } catch {
      // the reminder itself already went out — not worth an error
    }
  }

  const copyLink = (cart) => {
    navigator.clipboard?.writeText(linkFor(cart)).then(() => toast.success('Recovery link copied'))
    reminded(cart, 'link')
  }

  const dismiss = async (cart) => {
    if (!confirm('Remove this cart from the list?')) return
    try {
      await dismissCart(cart.id)
      setResult((r) => ({ ...r, data: { ...r.data, carts: r.data.carts.filter((c) => c.id !== cart.id) } }))
    } catch (e) {
      toast.error(e.message)
    }
  }

  const s = data?.stats

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abandoned carts</h1>
        <p className="text-sm text-gray-400 mt-0.5">Shoppers who entered their email at checkout and left. Send them their bag back — the link refills it in one click.</p>
      </div>

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Abandoned', `${s.abandoned}`, formatCurrency(s.abandonedValue) + ' left behind'],
            ['Recovered', `${s.recovered}`, formatCurrency(s.recoveredValue) + ' won back'],
            ['Recovery rate', `${s.recoveryRate}%`, null],
            ['After a reminder', `${s.recoveredAfterReminder}`, 'recovered carts'],
          ].map(([label, value, sub]) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl text-gray-900 mt-1 tabular-nums">{value}</p>
              {sub && <p className="text-xs text-gray-400">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t.label}</button>
          ))}
        </div>
        {tab === 'abandoned' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto">
            Include a discount code
            <select value={offerCode} onChange={(e) => setOfferCode(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400 bg-white">
              <option value="">None</option>
              {codes.map((c) => <option key={c.id} value={c.code}>{c.code}{c.description ? ` — ${c.description}` : ''}</option>)}
            </select>
          </label>
        )}
      </div>

      {loading ? <div className="h-40 bg-gray-200 animate-pulse rounded-2xl" /> : data.carts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
          <ShoppingBag size={28} className="mx-auto mb-2 text-gray-300" />
          {tab === 'abandoned' ? 'No abandoned carts right now' : 'Nothing here yet'}
        </div>
      ) : (
        <div className="space-y-3">
          {data.carts.map((cart) => {
            const wa = waNumber(cart.phone)
            return (
              <div key={cart.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-[14rem]">
                    <p className="font-medium text-gray-800">{cart.name || cart.email}</p>
                    <p className="text-xs text-gray-400">
                      <Link to={`/admin/customers/${encodeURIComponent(cart.email)}`} className="hover:text-violet-600">{cart.email}</Link>
                      {cart.phone && ` · ${cart.phone}`} · {ago(cart.lastActivityAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg text-gray-900 tabular-nums">{formatCurrency(cart.subtotal)}</p>
                    {cart.recoveredAt
                      ? <p className="text-xs text-green-700">Recovered{cart.orderId && <> · <Link to={`/admin/orders/${encodeURIComponent(cart.orderId)}`} className="hover:underline">order</Link></>}</p>
                      : cart.reminderCount > 0 && <p className="text-xs text-gray-400">Reminded {cart.reminderCount}× · last {ago(cart.remindedAt)}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-3">
                  {cart.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {it.image ? <img src={it.image} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-gray-100" />}
                      <span className="text-gray-700">{it.name}{it.variant && <span className="text-gray-400"> · {it.variant}</span>} <span className="text-gray-400">× {it.quantity}</span></span>
                    </div>
                  ))}
                </div>

                {!cart.recoveredAt && (
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                    {wa && (
                      <a href={`https://wa.me/${wa}?text=${encodeURIComponent(message(cart))}`} target="_blank" rel="noopener noreferrer" onClick={() => reminded(cart, 'whatsapp')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700">
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    )}
                    <a href={`mailto:${cart.email}?subject=${encodeURIComponent(`You left something in your ${storeName} bag`)}&body=${encodeURIComponent(message(cart))}`} onClick={() => reminded(cart, 'email')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-violet-400">
                      <Mail size={14} /> Email
                    </a>
                    <button onClick={() => copyLink(cart)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-violet-400">
                      <Link2 size={14} /> Copy link
                    </button>
                    <button onClick={() => dismiss(cart)} className="ml-auto p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="Remove"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="text-xs text-gray-400">A checkout counts as abandoned 30 minutes after the shopper's last activity. Carts are marked recovered automatically when that customer completes an order.</p>
    </div>
  )
}
