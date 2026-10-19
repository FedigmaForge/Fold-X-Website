import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Power, Search, Copy } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { getCoupons, saveCoupon, deleteCoupon, getAdminCategories, getAllProducts } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import { usePermissions } from '@/utils/permissions'
import toast from 'react-hot-toast'

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 bg-white'
const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'

const STATUS = {
  active: ['Active', 'bg-green-100 text-green-700'],
  scheduled: ['Scheduled', 'bg-blue-100 text-blue-700'],
  expired: ['Expired', 'bg-gray-100 text-gray-500'],
  used_up: ['Used up', 'bg-orange-100 text-orange-700'],
  disabled: ['Disabled', 'bg-gray-100 text-gray-500'],
}

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm"
const toLocalInput = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function describe(c) {
  const what = c.type === 'percent' ? `${c.value}% off` : c.type === 'fixed' ? `${formatCurrency(c.value)} off` : 'Free shipping'
  const extra = [
    c.type === 'percent' && c.maxDiscount ? `up to ${formatCurrency(c.maxDiscount)}` : null,
    c.minSubtotal > 0 ? `orders over ${formatCurrency(c.minSubtotal)}` : null,
    c.firstOrderOnly ? 'first order only' : null,
  ].filter(Boolean)
  return [what, ...extra].join(' · ')
}

const EMPTY = {
  isAutomatic: false, code: '', description: '', type: 'percent', value: '', maxDiscount: '', minSubtotal: '',
  appliesTo: 'all', targetIds: [], startsAt: '', endsAt: '', usageLimit: '', perCustomerLimit: '', firstOrderOnly: false, isActive: true,
}

function TargetPicker({ appliesTo, value, onChange, categories, products }) {
  const [q, setQ] = useState('')
  const options = appliesTo === 'categories'
    ? categories.map((c) => ({ id: c.id, label: c.name }))
    : products.map((p) => ({ id: p.id, label: p.name })).filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2">
      {appliesTo === 'products' && (
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400" />
        </div>
      )}
      <div className="max-h-44 overflow-y-auto space-y-1">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer py-0.5">
            <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} /> {o.label}
          </label>
        ))}
        {options.length === 0 && <p className="text-xs text-gray-400">Nothing found</p>}
      </div>
      <p className="text-xs text-gray-400">{value.length} selected</p>
    </div>
  )
}

function CouponModal({ coupon, isAutomatic, onClose, onSaved, categories, products }) {
  const isNew = !coupon
  const [f, setF] = useState(() => coupon
    ? {
        ...EMPTY, ...coupon,
        value: coupon.type === 'free_shipping' ? '' : String(coupon.value),
        maxDiscount: coupon.maxDiscount ?? '', minSubtotal: coupon.minSubtotal || '',
        usageLimit: coupon.usageLimit ?? '', perCustomerLimit: coupon.perCustomerLimit ?? '',
        startsAt: toLocalInput(coupon.startsAt), endsAt: toLocalInput(coupon.endsAt),
        targetIds: coupon.targetIds ?? [],
      }
    : { ...EMPTY, isAutomatic })
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const used = coupon?.usedCount > 0

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        ...(coupon && { id: coupon.id }),
        isAutomatic: f.isAutomatic,
        description: f.description,
        ...(!f.isAutomatic && { code: f.code }),
        ...(isNew && f.isAutomatic && { code: '' }),
        type: f.type,
        value: f.type === 'free_shipping' ? 0 : Number(f.value),
        maxDiscount: f.type === 'percent' && f.maxDiscount !== '' ? Number(f.maxDiscount) : null,
        minSubtotal: Number(f.minSubtotal || 0),
        appliesTo: f.appliesTo,
        targetIds: f.appliesTo === 'all' ? [] : f.targetIds,
        startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
        endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
        usageLimit: f.usageLimit === '' ? null : Number(f.usageLimit),
        perCustomerLimit: f.isAutomatic || f.perCustomerLimit === '' ? null : Number(f.perCustomerLimit),
        firstOrderOnly: f.firstOrderOnly,
        isActive: f.isActive,
      }
      await saveCoupon(payload)
      toast.success(isNew ? 'Discount created' : 'Discount saved')
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={isNew ? (f.isAutomatic ? 'New automatic discount' : 'New coupon code') : `Edit ${f.isAutomatic ? f.description : f.code}`} size="lg">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {f.isAutomatic ? (
            <div className="col-span-2">
              <label className={labelCls}>Name (shown to shoppers at checkout)</label>
              <input value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Festive sale — 15% off wallets" maxLength={80} className={inputCls} />
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Code</label>
                <input
                  value={f.code}
                  onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                  disabled={used}
                  placeholder="e.g. DIWALI15"
                  maxLength={30}
                  className={`${inputCls} font-mono uppercase disabled:bg-gray-50`}
                />
                {used && <p className="text-xs text-gray-400 mt-1">Can't be renamed once used</p>}
              </div>
              <div>
                <label className={labelCls}>Label at checkout (optional)</label>
                <input value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. 15% off for Diwali" maxLength={80} className={inputCls} />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Discount type</label>
            <select value={f.type} onChange={(e) => set({ type: e.target.value })} className={inputCls}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Amount off (₹)</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </div>
          {f.type !== 'free_shipping' && (
            <div>
              <label className={labelCls}>{f.type === 'percent' ? 'Percent off' : 'Amount off (₹)'}</label>
              <input type="number" min="1" max={f.type === 'percent' ? 100 : undefined} step="1" required value={f.value} onChange={(e) => set({ value: e.target.value })} className={inputCls} />
            </div>
          )}
          {f.type === 'percent' && (
            <div>
              <label className={labelCls}>Maximum discount (₹)</label>
              <input type="number" min="1" step="1" value={f.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} placeholder="No cap" className={inputCls} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Minimum order (₹)</label>
            <input type="number" min="0" step="1" value={f.minSubtotal} onChange={(e) => set({ minSubtotal: e.target.value })} placeholder="None" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Starts</label>
            <input type="datetime-local" value={f.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Ends</label>
            <input type="datetime-local" value={f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Applies to</label>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-2">
            {[['all', 'Whole order'], ['categories', 'Categories'], ['products', 'Products']].map(([k, label]) => (
              <button type="button" key={k} onClick={() => set({ appliesTo: k, targetIds: [] })} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${f.appliesTo === k ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'}`}>{label}</button>
            ))}
          </div>
          {f.appliesTo !== 'all' && (
            <TargetPicker appliesTo={f.appliesTo} value={f.targetIds} onChange={(ids) => set({ targetIds: ids })} categories={categories} products={products} />
          )}
          {f.appliesTo !== 'all' && f.type !== 'free_shipping' && (
            <p className="text-xs text-gray-400 mt-1">The discount is worked out on the matching items only; the minimum order still uses the whole bag.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Total uses</label>
            <input type="number" min="1" step="1" value={f.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} placeholder="Unlimited" className={inputCls} />
          </div>
          {!f.isAutomatic && (
            <div>
              <label className={labelCls}>Uses per customer</label>
              <input type="number" min="1" step="1" value={f.perCustomerLimit} onChange={(e) => set({ perCustomerLimit: e.target.value })} placeholder="Unlimited" className={inputCls} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={f.firstOrderOnly} onChange={(e) => set({ firstOrderOnly: e.target.checked })} /> First order only (by email)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Enabled
          </label>
        </div>

        <p className="text-xs text-gray-400">One discount applies per order — the shopper's code or the best automatic discount, whichever saves them more.</p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={busy} className="px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
            {busy ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function CouponsPage() {
  const { canEditCatalog } = usePermissions()
  const [tab, setTab] = useState('codes')
  const [coupons, setCoupons] = useState(null)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(undefined) // undefined closed · null new · object edit

  const load = () => getCoupons().then(setCoupons).catch((e) => toast.error(e.message))
  useEffect(() => {
    load()
    getAdminCategories().then(setCategories).catch(() => {})
    getAllProducts().then(setProducts).catch(() => {})
  }, [])

  const automatic = tab === 'automatic'
  const rows = (coupons ?? []).filter((c) => c.isAutomatic === automatic)
  const nameOf = (c) => (c.isAutomatic ? c.description : c.code)

  const toggle = async (c) => {
    try {
      await saveCoupon({ id: c.id, isActive: !c.isActive })
      toast.success(c.isActive ? `${nameOf(c)} disabled` : `${nameOf(c)} enabled`)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const remove = async (c) => {
    if (!confirm(`Delete ${nameOf(c)}?`)) return
    try {
      await deleteCoupon(c.id)
      toast.success('Deleted')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const scope = (c) => {
    if (c.appliesTo === 'all') return 'Whole order'
    const names = c.appliesTo === 'categories'
      ? c.targetIds.map((id) => categories.find((x) => x.id === id)?.name ?? id)
      : c.targetIds.map((id) => products.find((x) => x.id === id)?.name ?? 'Deleted product')
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discounts</h1>
          <p className="text-sm text-gray-400 mt-0.5">Coupon codes shoppers type at checkout, and automatic discounts that apply on their own.</p>
        </div>
        {canEditCatalog && (
          <button onClick={() => setEditing(null)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Plus size={16} /> {automatic ? 'New automatic discount' : 'New coupon code'}
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['codes', 'Coupon codes'], ['automatic', 'Automatic discounts']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === k ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-5 py-3">{automatic ? 'Discount' : 'Code'}</th>
                <th className="text-left px-5 py-3">Applies to</th>
                <th className="text-left px-5 py-3">Valid</th>
                <th className="text-right px-5 py-3">Uses</th>
                <th className="text-right px-5 py-3">Given</th>
                <th className="text-right px-5 py-3">Sales</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!coupons ? (
                <tr><td colSpan={8} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
              ) : rows.map((c) => {
                const [label, cls] = STATUS[c.status] ?? STATUS.active
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      {c.isAutomatic ? (
                        <p className="font-medium text-gray-800">{c.description}</p>
                      ) : (
                        <button onClick={() => navigator.clipboard?.writeText(c.code).then(() => toast.success(`${c.code} copied`))} className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-900 hover:text-violet-600" title="Copy code">
                          {c.code} <Copy size={12} className="text-gray-300" />
                        </button>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">{describe(c)}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{scope(c)}</td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {c.startsAt || c.endsAt
                        ? <>{c.startsAt ? shortDate(c.startsAt) : 'Now'} – {c.endsAt ? shortDate(c.endsAt) : 'no end'}</>
                        : 'Always'}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                      {c.usedCount}{c.usageLimit != null && <span className="text-gray-400"> / {c.usageLimit}</span>}
                      {c.perCustomerLimit != null && <span className="block text-xs text-gray-400">{c.perCustomerLimit} per customer</span>}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-gray-700">{formatCurrency(c.discountGiven)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-gray-700">{formatCurrency(c.sales)}</td>
                    <td className="px-5 py-4"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span></td>
                    <td className="px-5 py-4">
                      {canEditCatalog && (
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => toggle(c)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title={c.isActive ? 'Disable' : 'Enable'}><Power size={14} /></button>
                          <button onClick={() => setEditing(c)} className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-100" aria-label="Edit"><Edit2 size={14} /></button>
                          <button onClick={() => remove(c)} disabled={c.usedCount > 0} title={c.usedCount > 0 ? 'Used on orders — disable it instead' : 'Delete'} className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 disabled:opacity-30 disabled:hover:bg-transparent"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {coupons && rows.length === 0 && (
          <p className="text-center py-12 text-gray-400">
            {automatic ? 'No automatic discounts yet — use one for a sale that applies without a code.' : 'No coupon codes yet'}
          </p>
        )}
      </div>
      <p className="text-xs text-gray-400">"Given" is the total discount handed out; "Sales" is what those orders paid (cancelled orders excluded).</p>

      {editing !== undefined && (
        <CouponModal
          coupon={editing}
          isAutomatic={automatic}
          categories={categories}
          products={products}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load() }}
        />
      )}
    </div>
  )
}
