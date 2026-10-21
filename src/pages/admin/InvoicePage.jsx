import { useState, useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { getOrderById, getAdminSettings } from '@/services/api'
import useAuthStore from '@/store/authStore'
import { formatVariant } from '@/utils/formatVariant'

// Two decimals on an invoice (unlike the rest of the admin, which rounds to whole rupees)
const money = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)

const formatInvoiceDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const round2 = (n) => Math.round(n * 100) / 100
const sameState = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

// Backs GST out of GST-inclusive prices. Each line uses the HSN/rate frozen
// into the order's product snapshot at purchase, falling back to the store
// defaults for orders placed before those fields existed. Shipping and gift
// wrap form a composite supply with the goods, so they take the principal
// (highest) item rate.
function computeTax(order, settings) {
  const defaultRate = settings.defaultGstRate ?? 18
  const defaultHsn = settings.defaultHsnCode || '—'
  const line = (fields, amount, rate) => {
    const taxable = round2((amount * 100) / (100 + rate))
    return { ...fields, amount, rate, taxable, gst: round2(amount - taxable) }
  }

  // GST is charged on what was actually paid, so each line's share of any
  // order discount (frozen on the order as lineDiscount) comes off first
  const lines = order.items.map((item) => {
    const rate = item.product.gstRate ?? defaultRate
    const lineDiscount = item.product.lineDiscount || 0
    return line({
      name: item.product.name,
      hsn: item.product.hsnCode || defaultHsn,
      quantity: item.quantity,
      details: [
        ...formatVariant(item.variant),
        ...(lineDiscount ? [`Discount −${money(lineDiscount)}`] : []),
      ],
    }, item.product.price * item.quantity - lineDiscount, rate)
  })

  const principalRate = Math.max(...lines.map((l) => l.rate))
  const principalHsn = lines.find((l) => l.rate === principalRate)?.hsn
  const charges = [
    order.shipping > 0 && line({ name: 'Shipping', hsn: principalHsn, details: [] }, order.shipping, principalRate),
    order.giftWrapFee > 0 && line({ name: 'Gift wrap', hsn: principalHsn, details: [] }, order.giftWrapFee, principalRate),
    order.codFee > 0 && line({ name: 'Cash-on-delivery fee', hsn: principalHsn, details: [] }, order.codFee, principalRate),
  ].filter(Boolean)
  const all = [...lines, ...charges]

  const rates = new Map()
  for (const l of all) rates.set(l.rate, round2((rates.get(l.rate) || 0) + l.gst))

  return {
    lines: all,
    hasCharges: charges.length > 0,
    taxable: round2(all.reduce((s, l) => s + l.taxable, 0)),
    // SGST takes the remainder so CGST + SGST always equals the GST exactly (no stray paisa)
    byRate: [...rates].sort(([a], [b]) => a - b).map(([rate, gst]) => {
      const cgst = round2(gst / 2)
      return { rate, gst, cgst, sgst: round2(gst - cgst) }
    }),
    intraState: sameState(settings.state, order.address?.state),
  }
}

// Rendered outside AdminLayout (no sidebar/top bar) so it prints as a clean A4
// page. Opened in a new tab from the order detail page.
export default function InvoicePage() {
  const { id } = useParams()
  const { isAdmin, isLoggedIn } = useAuthStore()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return
    Promise.all([getOrderById(id), getAdminSettings()])
      .then(([order, settings]) => setData({ order, settings }))
      .catch((e) => setError(e.message))
  }, [id, isLoggedIn, isAdmin])

  useEffect(() => {
    if (data) document.title = `Invoice ${data.order.id}`
  }, [data])

  if (!isLoggedIn || !isAdmin) return <Navigate to="/admin/login" replace />
  if (error) return <p className="p-10 text-center text-gray-500">{error}</p>
  if (!data) return <p className="p-10 text-center text-gray-400">Loading invoice…</p>

  const { order, settings } = data
  const addr = order.address || {}
  // The store trades publicly as its store name only (FoldX); registered
  // names in Settings are kept for records and not printed
  const sellerName = settings.storeName
  const tax = computeTax(order, settings)

  return (
    <div className="admin-theme min-h-screen bg-gray-100 print:bg-white py-8 print:py-0">
      <div className="max-w-3xl mx-auto mb-4 flex justify-end px-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
        >
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none p-10 print:p-0 text-gray-800 text-sm">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-gray-200 pb-6">
          <div>
            <p className="font-serif text-3xl tracking-[0.3em] font-light uppercase text-gray-900">{settings.storeName}</p>
            {settings.address && <p className="text-gray-500 whitespace-pre-line mt-1 max-w-xs">{settings.address}</p>}
            {settings.gstin && <p className="text-gray-700 mt-1"><span className="text-gray-400">GSTIN:</span> {settings.gstin}</p>}
            {(settings.supportEmail || settings.supportPhone) && (
              <p className="text-gray-500 mt-1">{[settings.supportEmail, settings.supportPhone].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl uppercase tracking-[0.2em] text-gray-900">Tax Invoice</p>
            <p className="mt-2"><span className="text-gray-400">Invoice no.</span> INV-{order.id}</p>
            <p><span className="text-gray-400">Order no.</span> {order.id}</p>
            <p><span className="text-gray-400">Date</span> {formatInvoiceDate(order.createdAt)}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 py-6 border-b border-gray-200">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1.5">Bill to / Ship to</p>
            <p className="font-medium text-gray-900">{addr.name || order.customerName}</p>
            {addr.line1 && <p>{addr.line1}</p>}
            {addr.line2 && <p>{addr.line2}</p>}
            <p>{[addr.city, addr.state].filter(Boolean).join(', ')}{addr.pincode && ` – ${addr.pincode}`}</p>
            {addr.phone && <p className="text-gray-500 mt-1">{addr.phone}</p>}
            <p className="text-gray-500">{order.customerEmail}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1.5">Payment</p>
            <p>{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'} · <span className="capitalize">{order.paymentStatus.replace('_', ' ')}</span></p>
            {order.paymentId && <p className="text-gray-500 font-mono text-xs mt-0.5">{order.paymentId}</p>}
            {addr.state && <p className="text-gray-500 mt-2">Place of supply: {addr.state}</p>}
          </div>
        </div>

        {/* Items — prices are GST-inclusive, so taxable value is backed out of each line */}
        <table className="w-full mt-6">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-gray-400 border-b border-gray-200">
              <th className="text-left font-medium pb-2 w-6">#</th>
              <th className="text-left font-medium pb-2">Item</th>
              <th className="text-left font-medium pb-2">HSN</th>
              <th className="text-right font-medium pb-2">Qty</th>
              <th className="text-right font-medium pb-2">Taxable value</th>
              <th className="text-right font-medium pb-2">GST</th>
              <th className="text-right font-medium pb-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {tax.lines.map((line, i) => (
              <tr key={i} className="border-b border-gray-100 align-top">
                <td className="py-3 text-gray-400">{i + 1}</td>
                <td className="py-3">
                  <p className="text-gray-900">{line.name}</p>
                  {line.details.map((d) => <p key={d} className="text-xs text-gray-400 capitalize">{d}</p>)}
                </td>
                <td className="py-3 text-gray-600">{line.hsn}</td>
                <td className="py-3 text-right">{line.quantity ?? '—'}</td>
                <td className="py-3 text-right">{money(line.taxable)}</td>
                <td className="py-3 text-right text-gray-500">{line.rate}%</td>
                <td className="py-3 text-right">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <dl className="w-72 space-y-1.5">
            {order.discount > 0 && (
              <>
                <div className="flex justify-between"><dt className="text-gray-500">Items</dt><dd>{money(order.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Discount{order.discountCode && !order.discountCode.startsWith('AUTO-') ? ` (${order.discountCode})` : ''}</dt><dd>−{money(order.discount)}</dd></div>
              </>
            )}
            <div className="flex justify-between"><dt className="text-gray-500">Taxable value</dt><dd>{money(tax.taxable)}</dd></div>
            {tax.intraState ? (
              tax.byRate.map(({ rate, cgst, sgst }) => (
                <div key={rate} className="contents">
                  <div className="flex justify-between"><dt className="text-gray-500">CGST @ {rate / 2}%</dt><dd>{money(cgst)}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">SGST @ {rate / 2}%</dt><dd>{money(sgst)}</dd></div>
                </div>
              ))
            ) : (
              tax.byRate.map(({ rate, gst }) => (
                <div key={rate} className="flex justify-between"><dt className="text-gray-500">IGST @ {rate}%</dt><dd>{money(gst)}</dd></div>
              ))
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2">
              <dt>Total</dt><dd>{money(order.total)}</dd>
            </div>
            {order.refundedAmount > 0 && (
              <div className="flex justify-between text-gray-500"><dt>Refunded</dt><dd>−{money(order.refundedAmount)}</dd></div>
            )}
          </dl>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400 space-y-1">
          <p>
            Prices are inclusive of GST. {tax.intraState ? 'Intra-state supply (CGST + SGST).' : 'Inter-state supply (IGST).'}
            {tax.hasCharges && ' Shipping, gift wrap and COD fees are taxed at the rate of the principal item.'}
          </p>
          <p>This is a computer-generated invoice and does not require a signature.</p>
          {(!settings.gstin || !settings.state) && (
            <p className="text-amber-600 print:hidden">
              Tip: add your {[!settings.gstin && 'GSTIN', !settings.state && 'state'].filter(Boolean).join(' and ')} in Admin → Settings.
              {!settings.state && ' Until then every order is treated as inter-state (IGST).'}
            </p>
          )}
        </div>
        <p className="text-center text-gray-500 mt-8">Thank you for shopping with {sellerName}.</p>
      </div>
    </div>
  )
}
