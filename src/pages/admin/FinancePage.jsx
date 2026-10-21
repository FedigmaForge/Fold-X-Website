import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Download, FileUp, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react'
import {
  getProfit, getPayments, downloadPaymentsCsv, getSettlements, importSettlementReport, syncSettlements, recordCodRemittance,
} from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import toast from 'react-hot-toast'

const DAY = 24 * 60 * 60 * 1000
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const PRESETS = [
  { key: '30d', label: '30 days', from: () => new Date(Date.now() - 29 * DAY) },
  { key: '90d', label: '90 days', from: () => new Date(Date.now() - 89 * DAY) },
  { key: 'ytd', label: 'This year', from: () => new Date(new Date().getFullYear(), 0, 1) },
  { key: 'all', label: 'All time', from: () => new Date(2020, 0, 1) },
]
const inr2 = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n ?? 0)
const inputCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400 bg-white'

function Tile({ label, value, sub, tone }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl mt-1 tabular-nums ${tone === 'neg' ? 'text-red-700' : tone === 'pos' ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function RangePicker({ from, to, onChange }) {
  const [preset, setPreset] = useState('30d')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => { setPreset(p.key); onChange(iso(p.from()), iso(new Date())) }} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === p.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{p.label}</button>
        ))}
      </div>
      <input type="date" value={from} max={to} onChange={(e) => { setPreset(''); e.target.value && onChange(e.target.value, to) }} aria-label="From date" className={inputCls} />
      <span className="text-sm text-gray-400">to</span>
      <input type="date" value={to} min={from} onChange={(e) => { setPreset(''); e.target.value && onChange(from, e.target.value) }} aria-label="To date" className={inputCls} />
    </div>
  )
}

// Fetches when `key` changes; returns { data, loading, reload }
function useLoad(fn, key) {
  const [state, setState] = useState({ key: null, data: null, tick: 0 })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let stale = false
    fn().then((d) => { if (!stale) setState({ key, data: d, tick }) }).catch((e) => { if (!stale) { toast.error(e.message); setState((s) => ({ ...s, key, tick })) } })
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])
  return { data: state.data, loading: state.key !== key || state.tick !== tick, reload: () => setTick((t) => t + 1) }
}

// ─── Profit ────────────────────────────────────────────────────────────────────

function ProfitTab({ from, to }) {
  const { data, loading } = useLoad(() => getProfit({ from, to }), `${from}|${to}`)
  if (!data) return <div className="h-48 bg-gray-200 animate-pulse rounded-2xl" />
  const t = data.totals
  return (
    <div className={`space-y-5 ${loading ? 'opacity-60' : ''}`}>
      {data.missingCost.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-gray-700">
            {data.missingCost.length} product{data.missingCost.length === 1 ? ' has' : 's have'} no cost price, so their cost is counted as ₹0 and profit is overstated:{' '}
            {data.missingCost.map((m, i) => (
              <span key={m.productId}>{i > 0 && ', '}{m.productId ? <Link to={`/admin/products/${m.productId}/edit`} className="text-violet-600 hover:underline">{m.name}</Link> : m.name}</span>
            ))}
            . Add it under Pricing & Stock on each product.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Tile label="Revenue (excl. GST)" value={formatCurrency(t.revenue)} sub={`${t.orders} paid order${t.orders === 1 ? '' : 's'}`} />
        <Tile label="Cost of goods" value={`−${formatCurrency(t.cogs)}`} />
        <Tile label="Payment fees" value={`−${formatCurrency(t.gatewayFees)}`} sub="Settled so far" />
        <Tile label="Shipping cost" value={`−${formatCurrency(t.shippingCost)}`} sub={data.shippingCostPerOrder ? `${formatCurrency(data.shippingCostPerOrder)} per order` : 'Not set'} />
        <Tile label="Gross profit" value={formatCurrency(t.grossProfit)} tone={t.grossProfit < 0 ? 'neg' : 'pos'} />
        <Tile label="Margin" value={`${t.margin}%`} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="mb-3">By product</h2>
        {data.byProduct.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No paid orders in this period</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-gray-400">
                  <th className="text-left pb-2 font-normal">Product</th>
                  <th className="text-right pb-2 font-normal">Units</th>
                  <th className="text-right pb-2 font-normal">Sales excl. GST</th>
                  <th className="text-right pb-2 font-normal">Cost of goods</th>
                  <th className="text-right pb-2 font-normal">Profit</th>
                  <th className="text-right pb-2 font-normal">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.byProduct.map((r) => (
                  <tr key={r.productId ?? r.name}>
                    <td className="py-2.5 text-gray-800">
                      {r.name}
                      {!r.costKnown && <span className="ml-2 text-xs text-amber-700">cost price missing</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{r.units}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatCurrency(r.sales)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatCurrency(r.cogs)}</td>
                    <td className={`py-2.5 text-right tabular-nums ${r.profit < 0 ? 'text-red-700' : 'text-gray-900'}`}>{formatCurrency(r.profit)}</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{r.costKnown ? `${r.margin}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        Estimate for paid orders placed in this period. Revenue = item sales after discounts plus shipping, gift-wrap and COD fees charged, all excluding GST, less refunds.
        Cost of goods uses each product's cost price at the time of sale; items returned and put back in stock aren't counted. Payment fees appear once
        settlements are matched. Set the shipping cost per order under <Link to="/admin/settings" className="text-violet-600 hover:underline">Settings</Link>.
      </p>
    </div>
  )
}

// ─── Payments ──────────────────────────────────────────────────────────────────

const SETTLE = {
  pending: ['Awaiting settlement', 'bg-amber-100 text-amber-700'],
  settled: ['Settled', 'bg-green-100 text-green-700'],
  na: ['—', 'bg-gray-100 text-gray-500'],
}

function PaymentsTab({ from, to }) {
  const [type, setType] = useState('all')
  const [method, setMethod] = useState('all')
  const [status, setStatus] = useState('all')
  const filters = { from, to, type, method, status }
  const { data, loading } = useLoad(() => getPayments(filters), JSON.stringify(filters))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" className={inputCls}>
          <option value="all">Payments & refunds</option><option value="capture">Payments</option><option value="refund">Refunds</option>
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method" className={inputCls}>
          <option value="all">All methods</option><option value="online">Online</option><option value="cod">Cash on delivery</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Settlement" className={inputCls}>
          <option value="all">Any settlement</option><option value="pending">Awaiting settlement</option><option value="settled">Settled</option><option value="na">Nothing to settle</option>
        </select>
        <button onClick={() => downloadPaymentsCsv(filters).catch((e) => toast.error(e.message))} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:border-violet-400"><Download size={14} /> CSV</button>
      </div>
      {!data ? <div className="h-48 bg-gray-200 animate-pulse rounded-2xl" /> : (
        <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Tile label="Received" value={formatCurrency(data.totals.received)} />
            <Tile label="Refunded" value={`−${formatCurrency(data.totals.refunded)}`} />
            <Tile label="Net" value={formatCurrency(data.totals.net)} />
            <Tile label="Fees (incl. GST)" value={inr2(data.totals.fees)} sub="From matched settlements" />
            <Tile label="Awaiting Razorpay" value={formatCurrency(data.totals.awaitingSettlement)} />
            <Tile label="Awaiting COD remittance" value={formatCurrency(data.totals.awaitingCodRemittance)} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Order</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-left px-4 py-3">Reference</th>
                    <th className="text-left px-4 py-3">Settlement</th>
                    <th className="text-right px-4 py-3">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.rows.map((r) => {
                    const [label, cls] = SETTLE[r.settlementStatus]
                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-3">{r.orderId ? <Link to={`/admin/orders/${encodeURIComponent(r.orderId)}`} className="font-mono text-xs text-violet-600 hover:underline">{r.orderId}</Link> : '—'}<span className="block text-xs text-gray-400">{r.order?.customerName}</span></td>
                        <td className="px-4 py-3 text-gray-700">{r.type === 'refund' ? 'Refund' : 'Payment'} <span className="text-xs text-gray-400">· {r.method === 'cod' ? 'COD' : 'Online'}</span></td>
                        <td className={`px-4 py-3 text-right tabular-nums ${r.type === 'refund' ? 'text-red-700' : 'text-gray-900'}`}>{r.type === 'refund' ? '−' : ''}{inr2(r.amount)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.gatewayRef ?? '—'}{r.notes && <span className="block font-sans text-gray-400">{r.notes}</span>}</td>
                        <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>{r.settledAt && <span className="block text-xs text-gray-400 mt-0.5">{formatDate(r.settledAt)}{r.settlementId && ` · ${r.settlementId}`}</span>}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">{r.fee != null ? inr2((r.fee ?? 0) + (r.tax ?? 0)) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {data.rows.length === 0 && <p className="text-center py-10 text-gray-400">Nothing in this period</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Settlements ───────────────────────────────────────────────────────────────

function ImportResult({ record }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 text-sm">
      <p className="flex items-center gap-2 text-gray-800">
        <CheckCircle2 size={15} className="text-green-600" /> {record.label}: {record.matched} of {record.rows} line{record.rows === 1 ? '' : 's'} matched
        <span className="ml-auto text-xs text-gray-400">{formatDate(record.createdAt)}{record.actorName && ` · ${record.actorName}`}</span>
      </p>
      {record.unmatched.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-800">
          {record.unmatched.slice(0, 50).map((u, i) => <li key={i}><span className="font-mono">{u.ref || '—'}</span>{u.amount != null && ` · ₹${u.amount}`} — {u.reason}</li>)}
        </ul>
      )}
    </div>
  )
}

function SettlementsTab() {
  const { data, reload } = useLoad(() => getSettlements(), 'settlements')
  const cod = useLoad(() => getPayments({ method: 'cod', type: 'capture', status: 'pending', from: '2020-01-01', to: iso(new Date()) }), 'cod-pending')
  const [paise, setPaise] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncDate, setSyncDate] = useState(() => iso(new Date(Date.now() - DAY)))
  const [selected, setSelected] = useState([])
  const [reference, setReference] = useState('')
  const [fee, setFee] = useState('')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    onDrop: async ([file]) => {
      if (!file) return
      setBusy(true)
      try {
        const rec = await importSettlementReport({ csv: await file.text(), fileName: file.name, paise })
        toast.success(`${rec.matched} of ${rec.rows} lines matched`)
        reload(); cod.reload()
      } catch (e) {
        toast.error(e.message)
      } finally {
        setBusy(false)
      }
    },
  })

  const sync = async () => {
    setBusy(true)
    try {
      const rec = await syncSettlements(syncDate)
      toast.success(`${rec.matched} of ${rec.rows} lines matched`)
      reload()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await recordCodRemittance({ ids: selected, reference, fee: fee === '' ? undefined : Number(fee) })
      toast.success(`Recorded ${formatCurrency(res.amount)} remitted for ${res.updated} order${res.updated === 1 ? '' : 's'}`)
      setSelected([]); setReference(''); setFee('')
      cod.reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const codRows = cod.data?.rows ?? []
  const selectedTotal = codRows.filter((r) => selected.includes(r.id)).reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <h2>Match a Razorpay settlement report</h2>
          <p className="text-sm text-gray-500">In the Razorpay dashboard, go to Reports → Settlements and download the <b>settlement recon</b> report (CSV) for the days you want, then drop it here. Each payment and refund is matched and its fee recorded. Importing the same report twice is safe.</p>
          <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer ${isDragActive ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-400'} ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            <input {...getInputProps()} />
            <FileUp size={24} className="mx-auto text-gray-300 mb-1" />
            <p className="text-sm text-gray-600">{busy ? 'Matching…' : 'Drop the CSV here, or click to choose'}</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={paise} onChange={(e) => setPaise(e.target.checked)} /> Amounts in this file are in paise</label>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <h2>Sync from Razorpay</h2>
          {data?.live ? (
            <>
              <p className="text-sm text-gray-500">Fetch the settlement report for a day straight from Razorpay.</p>
              <div className="flex gap-2">
                <input type="date" value={syncDate} max={iso(new Date())} onChange={(e) => setSyncDate(e.target.value)} className={inputCls} />
                <button onClick={sync} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50"><RefreshCw size={14} /> Sync</button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Available once your live Razorpay keys are added to the backend. Until then, upload the report CSV.</p>
          )}
          {data?.overdue?.length > 0 && (
            <div className="border-t border-gray-50 pt-3">
              <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5"><AlertTriangle size={14} /> {data.overdue.length} online payment{data.overdue.length === 1 ? '' : 's'} not settled after 4 days</p>
              <ul className="mt-1 text-xs text-gray-600 space-y-0.5 max-h-32 overflow-y-auto">
                {data.overdue.map((o) => <li key={o.id}><span className="font-mono">{o.gatewayRef}</span> · {formatCurrency(o.amount)} · {formatDate(o.createdAt)}{o.order && ` · ${o.order.customerName}`}</li>)}
              </ul>
              <p className="text-xs text-gray-400 mt-1">Razorpay usually settles in 2 working days. Import a recent report, or check these in the Razorpay dashboard.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="mb-1">Cash on delivery — courier remittances</h2>
        <p className="text-sm text-gray-500 mb-3">Tick the orders included in a courier's COD payout, then record the payout reference.</p>
        {codRows.length === 0 ? <p className="text-sm text-gray-400">No COD cash waiting to be remitted.</p> : (
          <form onSubmit={remit} className="space-y-3">
            <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {codRows.map((r) => (
                <li key={r.id}>
                  <label className="flex items-center gap-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} />
                    <span className="font-mono text-xs text-violet-600">{r.orderId}</span>
                    <span className="text-gray-500 flex-1">{r.order?.customerName}</span>
                    <span className="text-xs text-gray-400">collected {formatDate(r.createdAt)}</span>
                    <span className="tabular-nums w-24 text-right">{formatCurrency(r.amount)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-50 pt-3">
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / courier statement no." className={`${inputCls} w-56`} />
              <input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Courier COD charges (₹)" className={`${inputCls} w-48`} />
              <button type="submit" disabled={busy || !selected.length || !reference.trim()} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-40">
                Record {selected.length ? `${formatCurrency(selectedTotal)} remitted` : 'remittance'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="space-y-3">
        <h2>Import history</h2>
        {!data ? <div className="h-16 bg-gray-200 animate-pulse rounded-xl" /> : data.imports.length === 0
          ? <p className="text-sm text-gray-400">No reports matched yet.</p>
          : data.imports.map((r) => <ImportResult key={r.id} record={r} />)}
      </div>
    </div>
  )
}

export default function FinancePage() {
  const [tab, setTab] = useState('profit')
  const [[from, to], setRange] = useState(() => [iso(new Date(Date.now() - 29 * DAY)), iso(new Date())])
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <p className="text-sm text-gray-400 mt-0.5">Profit, every payment and refund, and matching them to what actually reached your bank.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[['profit', 'Profit'], ['payments', 'Payments'], ['settlements', 'Settlements']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === k ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>
          ))}
        </div>
        {tab !== 'settlements' && <RangePicker from={from} to={to} onChange={(f, t) => setRange([f, t])} />}
      </div>
      {tab === 'profit' && <ProfitTab from={from} to={to} />}
      {tab === 'payments' && <PaymentsTab from={from} to={to} />}
      {tab === 'settlements' && <SettlementsTab />}
    </div>
  )
}
