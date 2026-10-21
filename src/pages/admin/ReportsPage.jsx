import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Download, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { getReports } from '@/services/api'
import { formatCurrency, formatNumber } from '@/utils/formatCurrency'
import toast from 'react-hot-toast'

// Single-series colour (cognac): validated with the dataviz palette checks
// against the white card surface — passes lightness, chroma and 3:1 contrast.
const SERIES = '#A86B32'
const GRID = '#EFE8E1'
const AXIS_TEXT = '#9E8878'

const DAY = 24 * 60 * 60 * 1000
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const PRESETS = [
  { key: '7d', label: '7 days', range: () => [new Date(Date.now() - 6 * DAY), new Date()] },
  { key: '30d', label: '30 days', range: () => [new Date(Date.now() - 29 * DAY), new Date()] },
  { key: '90d', label: '90 days', range: () => [new Date(Date.now() - 89 * DAY), new Date()] },
  { key: 'ytd', label: 'This year', range: () => [new Date(new Date().getFullYear(), 0, 1), new Date()] },
  { key: '12m', label: '12 months', range: () => [new Date(Date.now() - 364 * DAY), new Date()] },
]

function bucketLabel(date, unit, long = false) {
  const d = new Date(`${date}T00:00:00`)
  if (unit === 'month') return d.toLocaleDateString('en-IN', { month: 'short', year: long ? 'numeric' : '2-digit' })
  const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(long && { year: 'numeric' }) })
  return unit === 'week' && long ? `Week of ${label}` : label
}

const compactINR = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${n}`)

// ─── Pieces ───────────────────────────────────────────────────────────────────

// Change vs the previous period of equal length — arrow + words, never colour alone
function Change({ current, previous }) {
  if (!previous) return <span className="text-xs text-gray-400">No earlier data</span>
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus
  const tone = pct > 0 ? 'text-green-700' : pct < 0 ? 'text-red-600' : 'text-gray-500'
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${tone}`}>
      <Icon size={13} /> {pct > 0 ? '+' : ''}{pct}% <span className="text-gray-400 ml-1">vs previous</span>
    </span>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl text-gray-900 mt-1 tabular-nums">{value}</p>
      <div className="mt-1 min-h-4">{sub}</div>
    </div>
  )
}

function ChartTooltip({ active, payload, unit, metric }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <p className="text-xs text-gray-500">{bucketLabel(p.date, unit, true)}</p>
      <p className="text-gray-900 tabular-nums">{metric === 'net' ? formatCurrency(p.net) : `${p.orders} order${p.orders === 1 ? '' : 's'}`}</p>
    </div>
  )
}

function downloadCsv(filename, header, rows) {
  const cell = (v) => {
    let s = v === null || v === undefined ? '' : String(v)
    if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Ranked table with a thin inline bar showing each row's share of the top value
function Breakdown({ title, rows, nameHeader, filename, limit = 10 }) {
  const [showAll, setShowAll] = useState(false)
  const max = Math.max(...rows.map((r) => r.revenue), 1)
  const total = rows.reduce((s, r) => s + r.revenue, 0)
  const shown = showAll ? rows : rows.slice(0, limit)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2>{title}</h2>
        {rows.length > 0 && (
          <button
            onClick={() => downloadCsv(filename, [nameHeader, 'Orders', 'Units', 'Item sales (INR)', 'Share %'], rows.map((r) => [r.label, r.orders, r.units, r.revenue, total ? Math.round((r.revenue / total) * 1000) / 10 : 0]))}
            className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
          >
            <Download size={12} /> CSV
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No sales in this period</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-gray-400">
              <th className="text-left pb-2 font-normal">{nameHeader}</th>
              <th className="text-right pb-2 font-normal w-14">Units</th>
              <th className="text-right pb-2 font-normal w-28">Sales</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key} className="border-t border-gray-50">
                <td className="py-2 pr-3">
                  <p className="text-gray-800 truncate max-w-[16rem]" title={r.label}>{r.label}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full" style={{ width: `${(r.revenue / max) * 100}%`, background: SERIES }} />
                  </div>
                </td>
                <td className="py-2 text-right text-gray-600 tabular-nums align-top">{r.units}</td>
                <td className="py-2 text-right text-gray-900 tabular-nums align-top">
                  {formatCurrency(r.revenue)}
                  <span className="block text-xs text-gray-400">{total ? `${Math.round((r.revenue / total) * 100)}%` : ''}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > limit && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-violet-600 hover:underline">
          {showAll ? 'Show top 10' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [preset, setPreset] = useState('30d')
  const [[from, to], setRange] = useState(() => PRESETS[1].range().map(iso))
  const [metric, setMetric] = useState('net')
  const [result, setResult] = useState({ key: null, data: null })
  const key = `${from}|${to}`
  const data = result.data
  const loading = result.key !== key

  useEffect(() => {
    let stale = false
    getReports({ from, to })
      .then((d) => { if (!stale) setResult({ key, data: d }) })
      .catch((e) => { if (!stale) { toast.error(e.message); setResult((r) => ({ ...r, key })) } })
    return () => { stale = true }
  }, [from, to, key])

  const choosePreset = (p) => { setPreset(p.key); setRange(p.range().map(iso)) }
  const setCustom = (f, t) => { setPreset('custom'); setRange([f, t]) }

  const s = data?.summary
  const prev = data?.previous

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-400 mt-0.5">Paid orders only. Net revenue is order totals minus refunds.</p>
      </div>

      {/* Filters — one row above everything */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => choosePreset(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${preset === p.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-400">
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setCustom(e.target.value, to)} aria-label="From date" className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-violet-400 bg-white" />
          <span>to</span>
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setCustom(from, e.target.value)} aria-label="To date" className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-violet-400 bg-white" />
        </div>
        {loading && <span className="text-xs text-gray-400">Updating…</span>}
      </div>

      {!data ? (
        <div className="h-64 bg-gray-200 animate-pulse rounded-2xl" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <Tile label="Net revenue" value={formatCurrency(s.net)} sub={<Change current={s.net} previous={prev.net} />} />
            <Tile label="Orders" value={formatNumber(s.orders)} sub={<Change current={s.orders} previous={prev.orders} />} />
            <Tile label="Average order" value={formatCurrency(s.avgOrderValue)} sub={<Change current={s.avgOrderValue} previous={prev.avgOrderValue} />} />
            <Tile label="Units sold" value={formatNumber(s.units)} sub={<Change current={s.units} previous={prev.units} />} />
            <Tile label="Discounts given" value={formatCurrency(s.discounts ?? 0)} sub={<Change current={s.discounts ?? 0} previous={prev.discounts ?? 0} />} />
            <Tile label="Refunded" value={formatCurrency(s.refunds)} sub={<span className="text-xs text-gray-400">{s.cancelled} cancelled order{s.cancelled === 1 ? '' : 's'}</span>} />
            <Tile label="Repeat customers" value={`${s.repeatRate}%`} sub={<span className="text-xs text-gray-400">{s.customers} customers · {s.newCustomers} new</span>} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2>{metric === 'net' ? 'Net revenue' : 'Orders'} by {data.range.unit}</h2>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {[['net', 'Revenue'], ['orders', 'Orders']].map(([k, label]) => (
                  <button key={k} onClick={() => setMetric(k)} className={`px-3 py-1 rounded-md text-xs ${metric === k ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'}`}>{label}</button>
                ))}
              </div>
            </div>
            {/* Height includes the x-axis band so labels never get cropped */}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => bucketLabel(d, data.range.unit)}
                    tick={{ fontSize: 11, fill: AXIS_TEXT }}
                    axisLine={{ stroke: GRID }}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={metric === 'net' ? compactINR : (n) => n}
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: AXIS_TEXT }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip content={<ChartTooltip unit={data.range.unit} metric={metric} />} cursor={{ stroke: AXIS_TEXT, strokeWidth: 1 }} />
                  <Area
                    type="linear" // smoothing would invent values between buckets
                    dataKey={metric}
                    stroke={SERIES}
                    strokeWidth={2}
                    fill={SERIES}
                    fillOpacity={0.1}
                    dot={false}
                    activeDot={{ r: 5, fill: SERIES, stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-end mt-2">
              <button
                onClick={() => downloadCsv(`foldx-sales-${from}-to-${to}.csv`, ['Period start', 'Net revenue (INR)', 'Orders'], data.series.map((r) => [r.date, r.net, r.orders]))}
                className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
              >
                <Download size={12} /> Download as CSV
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Breakdown title="Top products" nameHeader="Product" rows={data.byProduct} filename={`foldx-products-${from}-to-${to}.csv`} />
            <Breakdown title="By category" nameHeader="Category" rows={data.byCategory} filename={`foldx-categories-${from}-to-${to}.csv`} />
            <Breakdown title="By state" nameHeader="State" rows={data.byState} filename={`foldx-states-${from}-to-${to}.csv`} />
            <Breakdown title="By city" nameHeader="City" rows={data.byCity} filename={`foldx-cities-${from}-to-${to}.csv`} />
          </div>
          <p className="text-xs text-gray-400">Breakdowns use item sales (price × quantity, before shipping and gift wrap) and leave out cancelled orders.</p>
        </div>
      )}
    </div>
  )
}
