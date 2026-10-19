import { useState } from 'react'
import { X } from 'lucide-react'
import { requestReturn } from '@/services/api'
import { formatDate } from '@/utils/formatDate'
import toast from 'react-hot-toast'

const REASONS = ['Damaged or defective', 'Wrong item received', 'Not as described', 'Changed my mind', 'Other']

// Customer picks which items (and how many) to send back, and why. The server
// checks the order is theirs, delivered, and still inside the return window.
export default function ReturnRequestModal({ order, onClose, onRequested }) {
  const [qty, setQty] = useState(() => Object.fromEntries(order.items.map((i) => [i.id, 0])))
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const chosen = order.items.filter((i) => qty[i.id] > 0)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const created = await requestReturn(order.id, {
        items: chosen.map((i) => ({ itemId: i.id, quantity: qty[i.id] })),
        reason,
        details,
      })
      toast.success("Return requested — we'll be in touch by email")
      onRequested(created)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brown/50" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-cream w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-serif text-2xl text-brown font-light">Request a return</p>
            {order.returnUntil && <p className="text-xs font-sans text-brown-mid mt-1">Available until {formatDate(order.returnUntil)}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-brown-mid hover:text-brown"><X size={20} /></button>
        </div>

        <div>
          <p className="label-brand">Which items?</p>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 border border-border bg-white px-3 py-2">
                <img src={item.product.images?.[0]} alt="" className="w-11 h-11 object-cover bg-cream-dark shrink-0" />
                <div className="flex-1 min-w-0 text-sm font-sans">
                  <p className="text-brown truncate">{item.product.name}</p>
                  <p className="text-xs text-brown-mid">{Object.values(item.variant ?? {}).filter(Boolean).join(' / ') || `Bought ${item.quantity}`}</p>
                </div>
                <select
                  value={qty[item.id]}
                  onChange={(e) => setQty((q) => ({ ...q, [item.id]: Number(e.target.value) }))}
                  aria-label={`How many ${item.product.name} to return`}
                  className="border border-border bg-cream px-2 py-1.5 text-sm font-sans text-brown outline-none focus:border-brown"
                >
                  {Array.from({ length: item.quantity + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label-brand">Reason</label>
          <select required value={reason} onChange={(e) => setReason(e.target.value)} className="input-brand">
            <option value="" disabled>Choose a reason</option>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="label-brand">Anything we should know?{reason === 'Other' ? ' *' : ''}</label>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} required={reason === 'Other'} className="input-brand resize-none" placeholder={reason === 'Damaged or defective' ? 'Please describe the damage — we may ask for photos by email' : ''} />
        </div>

        <p className="text-xs font-sans text-brown-mid">
          Items should be unused with their tags and packaging. Once we approve the request we'll email you how to send it back; refunds go to your original payment method after we receive it.
        </p>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 btn-brand-ghost">Cancel</button>
          <button type="submit" disabled={busy || chosen.length === 0 || !reason} className="flex-1 btn-brand-primary">
            {busy ? 'Sending…' : 'Request return'}
          </button>
        </div>
      </form>
    </div>
  )
}
