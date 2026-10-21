import { useState } from 'react'
import { Plus, Trash2, Wand2 } from 'lucide-react'

const inputCls = 'w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm outline-none focus:border-violet-400 bg-white'
const splitList = (s) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))]

// Edits a product's variants: each colour/size combination with its own SKU
// and stock. `value` is [{ id?, color, size, sku, stock, isActive }].
export default function VariantsEditor({ value, onChange, lowStockThreshold }) {
  const [colors, setColors] = useState('')
  const [sizes, setSizes] = useState('')

  const update = (i, patch) => onChange(value.map((v, k) => (k === i ? { ...v, ...patch } : v)))
  const remove = (i) => onChange(value.filter((_, k) => k !== i))
  const add = () => onChange([...value, { color: '', size: '', sku: '', stock: 0, isActive: true }])

  // Adds every colour × size combination that isn't listed yet (stock 0)
  const generate = () => {
    const cs = splitList(colors)
    const ss = splitList(sizes)
    if (!cs.length && !ss.length) return
    const combos = (cs.length ? cs : ['']).flatMap((c) => (ss.length ? ss : ['']).map((s) => ({ color: c, size: s })))
    const has = (c) => value.some((v) => v.color === c.color && v.size === c.size)
    const added = combos.filter((c) => !has(c)).map((c) => ({ ...c, sku: '', stock: 0, isActive: true }))
    onChange([...value, ...added])
    setColors('')
    setSizes('')
  }

  const total = value.filter((v) => v.isActive).reduce((s, v) => s + (Number(v.stock) || 0), 0)
  const hasSizes = value.some((v) => v.size)

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Colours</label>
          <input value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Black, Tan, Cognac" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Sizes (optional)</label>
          <input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S, M, L" className={inputCls} />
        </div>
        <button type="button" onClick={generate} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-100 text-violet-600 text-sm hover:bg-violet-200">
          <Wand2 size={14} /> Add combinations
        </button>
      </div>

      {value.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-1 pb-2">Colour</th>
                {hasSizes && <th className="text-left px-1 pb-2">Size</th>}
                <th className="text-left px-1 pb-2">SKU</th>
                <th className="text-left px-1 pb-2 w-24">Stock</th>
                <th className="text-center px-1 pb-2 w-16">On sale</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {value.map((v, i) => {
                const low = v.isActive && Number(v.stock) <= lowStockThreshold
                return (
                  <tr key={v.id ?? `new-${i}`} className={v.isActive ? '' : 'opacity-50'}>
                    <td className="px-1 py-1"><input value={v.color} onChange={(e) => update(i, { color: e.target.value })} className={inputCls} /></td>
                    {hasSizes && <td className="px-1 py-1"><input value={v.size} onChange={(e) => update(i, { size: e.target.value })} className={inputCls} /></td>}
                    <td className="px-1 py-1"><input value={v.sku ?? ''} onChange={(e) => update(i, { sku: e.target.value })} placeholder="Optional" className={`${inputCls} font-mono`} /></td>
                    <td className="px-1 py-1">
                      <input
                        type="number" min="0" step="1"
                        value={v.stock}
                        onChange={(e) => update(i, { stock: e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))) })}
                        className={`${inputCls} ${low ? 'border-orange-300 bg-orange-50/30' : ''}`}
                        title={low ? 'At or below the low-stock threshold' : undefined}
                      />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <input type="checkbox" checked={v.isActive} onChange={(e) => update(i, { isActive: e.target.checked })} aria-label="On sale" />
                    </td>
                    <td className="px-1 py-1">
                      <button type="button" onClick={() => remove(i)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="Remove variant">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
          <Plus size={12} /> Add a single variant
        </button>
        {value.length > 0 && <p className="text-xs text-gray-500">Total stock on sale: <span className="font-medium text-gray-800">{total}</span></p>}
      </div>
      <p className="text-xs text-gray-400">
        {value.length
          ? 'Shoppers pick a colour/size; each has its own stock. Removing a variant that was ordered before keeps it hidden for order history.'
          : 'No variants — the product is sold as one item using the stock quantity above.'}
      </p>
    </div>
  )
}
