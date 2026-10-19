import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Banknote, PhoneCall,
  ArrowLeft, Printer, Gift, Truck, CreditCard, User, MapPin, MessageSquare,
  RotateCcw, CircleDot, StickyNote, PackageCheck, ShoppingBag,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { getOrderById, updateOrderStatus, updateOrderShipping, addOrderNote, refundOrder, confirmCodOrder } from '@/services/api'
import { usePermissions } from '@/utils/permissions'
import toast from 'react-hot-toast'

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
const COURIERS = ['Delhivery', 'Blue Dart', 'DTDC', 'Ekart', 'Xpressbees', 'Shiprocket', 'India Post', 'Other']

const EVENT_ICONS = {
  created: ShoppingBag,
  status: CircleDot,
  note: StickyNote,
  refund: RotateCcw,
  shipping: Truck,
}

const formatDateTime = (date) =>
  new Date(date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

function Card({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          {Icon && <Icon size={16} className="text-gray-400" />} {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function CancelModal({ isOpen, onClose, onConfirm, busy, isCod }) {
  const [reason, setReason] = useState('')
  const [refused, setRefused] = useState(false)
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel order" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          {isCod
            ? 'Items go back into stock. Nothing was paid online, so there\u2019s nothing to refund unless cash was already collected.'
            : 'Cancelling doesn\u2019t refund the customer automatically. Issue a refund from the Payment card if they\u2019ve paid.'}
        </p>
        {isCod && (
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={refused} onChange={(e) => setRefused(e.target.checked)} className="mt-0.5" />
            <span>
              Customer refused the parcel at delivery (RTO)
              <span className="block text-xs text-gray-400">Counts towards their COD refusals — repeated refusals stop COD for them.</span>
            </span>
          </label>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer requested, out of stock…"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Keep order</button>
          <button
            onClick={() => onConfirm(reason, refused)}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Cancel order
          </button>
        </div>
      </div>
    </Modal>
  )
}

function RefundModal({ isOpen, onClose, onConfirm, busy, refundable }) {
  const [amount, setAmount] = useState(refundable)
  const [reason, setReason] = useState('')

  const value = Number(amount)
  const invalid = !(value > 0) || value > refundable

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Issue refund" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Amount (up to {formatCurrency(refundable)})
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
            <input
              type="number"
              min="0"
              step="0.01"
              max={refundable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Reason</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Damaged in transit, returned item…"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400"
          />
        </div>
        <p className="text-xs text-gray-400">
          With Razorpay keys configured this sends a real refund to the customer's original payment method. Without them, it's recorded as a mock refund.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          <button
            onClick={() => onConfirm({ amount: value, reason })}
            disabled={busy || invalid}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Refund {value > 0 && !invalid ? formatCurrency(value) : ''}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const { canRefund: roleCanRefund } = usePermissions()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [shipping, setShipping] = useState({ courier: '', trackingNumber: '' })
  const [note, setNote] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [codNote, setCodNote] = useState('')
  const [refundOpen, setRefundOpen] = useState(false)

  const applyOrder = (o) => {
    setOrder(o)
    setShipping({ courier: o.courier || '', trackingNumber: o.trackingNumber || '' })
  }

  useEffect(() => {
    getOrderById(id).then(applyOrder).catch((e) => setError(e.message))
  }, [id])

  // Every mutation returns the full updated order (incl. timeline), so one
  // wrapper handles busy state, errors and refreshing for all of them.
  const run = async (fn, successMsg) => {
    setBusy(true)
    try {
      applyOrder(await fn())
      toast.success(successMsg)
      return true
    } catch (e) {
      toast.error(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleStatus = (status) => {
    if (status === 'cancelled') return setCancelOpen(true)
    run(() => updateOrderStatus(order.id, status), `Order marked as ${status}`)
  }

  const handleCodConfirm = async () => {
    if (await run(() => confirmCodOrder(order.id, codNote), 'Order confirmed — ready to pack')) setCodNote('')
  }

  const handleCancel = async (reason, codRefused) => {
    if (await run(() => updateOrderStatus(order.id, 'cancelled', reason, { codRefused }), 'Order cancelled')) setCancelOpen(false)
  }

  const handleRefund = async (payload) => {
    if (await run(() => refundOrder(order.id, payload), 'Refund issued')) setRefundOpen(false)
  }

  const handleShippingSave = (e) => {
    e.preventDefault()
    run(() => updateOrderShipping(order.id, shipping), 'Shipping details saved')
  }

  const handleNote = async (e) => {
    e.preventDefault()
    if (await run(() => addOrderNote(order.id, note), 'Note added')) setNote('')
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/admin/orders" className="text-sm text-violet-600 hover:underline">Back to orders</Link>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-gray-200 animate-pulse rounded-lg" />
        <div className="h-64 bg-gray-200 animate-pulse rounded-2xl" />
      </div>
    )
  }

  const refundable = Math.round((order.total - (order.refundedAmount || 0)) * 100) / 100
  const canRefund = roleCanRefund && ['paid', 'partially_refunded'].includes(order.paymentStatus) && refundable > 0
  const shippingDirty = shipping.courier !== (order.courier || '') || shipping.trackingNumber !== (order.trackingNumber || '')
  const events = order.events?.length
    ? order.events
    : [{ id: 'placed', type: 'created', message: 'Order placed', createdAt: order.createdAt }]
  const addr = order.address || {}

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/orders" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 mb-2">
            <ArrowLeft size={13} /> All orders
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex flex-wrap items-center gap-3">
            <span className="font-mono text-xl">{order.id}</span>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
          </h1>
          <p className="text-sm text-gray-400 mt-1">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <a
          href={`/admin/orders/${encodeURIComponent(order.id)}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-violet-400 hover:text-violet-600 transition-colors"
        >
          <Printer size={15} /> Invoice
        </a>
      </div>

      {order.paymentMethod === 'cod' && !order.codConfirmedAt && order.status !== 'cancelled' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-wrap items-center gap-4">
          <PhoneCall size={20} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-[16rem]">
            <p className="text-sm font-medium text-gray-900">Cash on delivery — confirm before packing</p>
            <p className="text-sm text-gray-600">
              Call or WhatsApp {order.customerName}{addr.phone && <> on <a href={`tel:${addr.phone}`} className="text-violet-600 hover:underline">{addr.phone}</a></>} to confirm the order and the {formatCurrency(order.total)} to pay at the door.
            </p>
          </div>
          <input value={codNote} onChange={(e) => setCodNote(e.target.value)} placeholder="Note (optional)" className="px-3 py-2 border border-amber-200 rounded-xl text-sm bg-white outline-none focus:border-violet-400 w-48" />
          <button onClick={handleCodConfirm} disabled={busy} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50">Confirm order</button>
          <button onClick={() => setCancelOpen(true)} disabled={busy} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:border-red-300 hover:text-red-600">Couldn't confirm — cancel</button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {/* Left: items, totals, timeline */}
        <div className="lg:col-span-2 space-y-5">
          <Card title={`Items (${order.items.reduce((s, i) => s + i.quantity, 0)})`} icon={PackageCheck}>
            <div className="divide-y divide-gray-50 -my-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <img src={item.product.images?.[0]} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.product.name}</p>
                    {item.product.sku && <p className="text-xs text-gray-400 font-mono">SKU {item.product.sku}</p>}
                    <p className="text-xs text-gray-400">
                      {formatCurrency(item.product.price)} × {item.quantity}
                      {Object.entries(item.variant || {}).filter(([, v]) => v).map(([k, v]) => (
                        <span key={k} className="capitalize"> · {k}: {typeof v === 'object' ? v.name ?? JSON.stringify(v) : v}</span>
                      ))}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 mt-3 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-700"><span>Discount{order.discountCode && !order.discountCode.startsWith('AUTO-') ? ` (${order.discountCode})` : ''}</span><span>−{formatCurrency(order.discount)}</span></div>
              )}
              <div className="flex justify-between text-gray-500"><span>Shipping</span><span>{order.shipping ? formatCurrency(order.shipping) : 'Free'}</span></div>
              {order.giftWrapFee > 0 && (
                <div className="flex justify-between text-gray-500"><span>Gift wrap</span><span>{formatCurrency(order.giftWrapFee)}</span></div>
              )}
              {order.codFee > 0 && (
                <div className="flex justify-between text-gray-500"><span>Cash-on-delivery fee</span><span>{formatCurrency(order.codFee)}</span></div>
              )}
              <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-50"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
              {order.refundedAmount > 0 && (
                <>
                  <div className="flex justify-between text-orange-600"><span>Refunded</span><span>−{formatCurrency(order.refundedAmount)}</span></div>
                  <div className="flex justify-between font-semibold text-gray-900"><span>Net</span><span>{formatCurrency(refundable)}</span></div>
                </>
              )}
            </div>

            {order.giftWrap && (
              <div className="flex items-start gap-2 bg-pink-50 border border-pink-100 rounded-xl p-3 text-sm mt-4">
                <Gift size={16} className="text-pink-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Gift wrap requested</p>
                  {order.giftNote && <p className="text-gray-500 text-xs mt-0.5">"{order.giftNote}"</p>}
                </div>
              </div>
            )}
          </Card>

          <Card title="Timeline" icon={MessageSquare}>
            <form onSubmit={handleNote} className="flex gap-2 mb-5">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an internal note (customers never see these)…"
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400"
              />
              <button
                type="submit"
                disabled={busy || !note.trim()}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Add
              </button>
            </form>

            <ol className="relative border-l border-gray-100 ml-3 space-y-5">
              {events.map((ev) => {
                const Icon = EVENT_ICONS[ev.type] || CircleDot
                return (
                  <li key={ev.id} className="ml-5">
                    <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white ${ev.type === 'note' ? 'bg-amber-100 text-amber-600' : ev.type === 'refund' ? 'bg-orange-100 text-orange-600' : 'bg-violet-100 text-violet-600'}`}>
                      <Icon size={12} />
                    </span>
                    <p className={`text-sm ${ev.type === 'note' ? 'text-gray-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 whitespace-pre-wrap' : 'text-gray-700'}`}>
                      {ev.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDateTime(ev.createdAt)}{ev.actorName && ` · ${ev.actorName}`}
                    </p>
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>

        {/* Right: actions + customer */}
        <div className="space-y-5">
          <Card title="Status" icon={CircleDot}>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatus(s)}
                  disabled={busy || order.status === s}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${order.status === s ? 'bg-violet-600 text-white' : s === 'cancelled' ? 'border border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-600 disabled:opacity-50' : 'border border-gray-200 text-gray-600 hover:border-violet-400 hover:text-violet-600 disabled:opacity-50'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {order.status === 'cancelled' && order.cancelReason && (
              <p className="text-xs text-gray-500 mt-3">Reason: {order.cancelReason}</p>
            )}
          </Card>

          <Card title="Shipping" icon={Truck}>
            <form onSubmit={handleShippingSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Courier</label>
                <select
                  value={shipping.courier}
                  onChange={(e) => setShipping((s) => ({ ...s, courier: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-violet-400 bg-white"
                >
                  <option value="">Not assigned</option>
                  {/* Keep a previously-saved value selectable even if it's not in the preset list */}
                  {[...new Set([...COURIERS, ...(order.courier ? [order.courier] : [])])].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Tracking number / AWB</label>
                <input
                  value={shipping.trackingNumber}
                  onChange={(e) => setShipping((s) => ({ ...s, trackingNumber: e.target.value }))}
                  placeholder="e.g. 1234567890"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-violet-400"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !shippingDirty}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
              >
                Save shipping details
              </button>
            </form>
          </Card>

          <Card
            title="Payment"
            icon={CreditCard}
            action={canRefund && (
              <button onClick={() => setRefundOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline">
                <RotateCcw size={12} /> Refund
              </button>
            )}
          >
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-400">Method</dt><dd className="flex items-center gap-1.5">{order.paymentMethod === 'cod' ? <><Banknote size={14} className="text-gray-400" /> Cash on delivery</> : 'Online (Razorpay)'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Status</dt><dd><StatusBadge status={order.paymentStatus} /></dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">{order.paymentMethod === 'cod' && order.paymentStatus === 'pending' ? 'To collect' : 'Paid'}</dt><dd className="font-medium">{formatCurrency(order.total)}</dd></div>
              {order.paymentMethod === 'cod' && (
                <div className="flex justify-between"><dt className="text-gray-400">Confirmed</dt><dd className="text-xs">{order.codConfirmedAt ? formatDate(order.codConfirmedAt) : 'Not yet'}</dd></div>
              )}
              {order.codRefused && <p className="text-xs text-red-600">Customer refused this parcel at delivery.</p>}
              {order.refundedAmount > 0 && (
                <div className="flex justify-between"><dt className="text-gray-400">Refunded</dt><dd className="font-medium text-orange-600">{formatCurrency(order.refundedAmount)}</dd></div>
              )}
              {order.paymentId && (
                <div className="flex justify-between gap-3"><dt className="text-gray-400 shrink-0">Payment ID</dt><dd className="font-mono text-xs truncate">{order.paymentId}</dd></div>
              )}
            </dl>
            {!roleCanRefund && ['paid', 'partially_refunded'].includes(order.paymentStatus) && (
              <p className="text-xs text-gray-400 mt-3">Refunds need a Manager or Super Admin.</p>
            )}
            {order.paymentMethod === 'cod' && canRefund && (
              <p className="text-xs text-gray-400 mt-3">COD refunds are recorded here, then paid back to the customer by UPI or bank transfer.</p>
            )}
          </Card>

          {order.returns?.length > 0 && (
            <Card title="Returns" icon={RotateCcw} action={<Link to="/admin/returns" className="text-xs text-violet-600 hover:underline">Manage</Link>}>
              <ul className="space-y-3 text-sm">
                {order.returns.map((r) => (
                  <li key={r.id}>
                    <div className="flex justify-between gap-2">
                      <span className="capitalize text-gray-800">{r.status}</span>
                      <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-500">{r.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')} — {r.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Customer" icon={User}>
            <Link to={`/admin/customers/${encodeURIComponent(order.customerEmail.toLowerCase())}`} className="text-sm font-medium text-gray-800 hover:text-violet-600">{order.customerName} →</Link>
            <a href={`mailto:${order.customerEmail}`} className="text-sm text-violet-600 hover:underline break-all">{order.customerEmail}</a>
            {addr.phone && <p className="text-sm text-gray-500"><a href={`tel:${addr.phone}`} className="hover:text-violet-600">{addr.phone}</a></p>}
            <div className="flex items-start gap-2 mt-4 pt-4 border-t border-gray-50 text-sm text-gray-600">
              <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p>{addr.name}</p>
                <p>{addr.line1}</p>
                {addr.line2 && <p>{addr.line2}</p>}
                <p>{[addr.city, addr.state].filter(Boolean).join(', ')}{addr.pincode && ` – ${addr.pincode}`}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Last updated {formatDate(order.updatedAt)}</p>
          </Card>
        </div>
      </div>

      {/* Mounted only while open so each opening starts with fresh form state */}
      {cancelOpen && <CancelModal isOpen onClose={() => setCancelOpen(false)} onConfirm={handleCancel} busy={busy} isCod={order.paymentMethod === 'cod'} />}
      {refundOpen && <RefundModal isOpen onClose={() => setRefundOpen(false)} onConfirm={handleRefund} busy={busy} refundable={refundable} />}
    </div>
  )
}
