import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronRight, ShieldCheck, Gift, Smartphone, CreditCard, Landmark, Wallet } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'
import { initiatePayment } from '@/utils/razorpay'
import { placeOrder, createRazorpayOrder, verifyPayment } from '@/services/api'
import useCartStore from '@/store/cartStore'
import useSettingsStore from '@/store/settingsStore'
import toast from 'react-hot-toast'

const STEPS = ['Address', 'Review Order', 'Payment']
const GIFT_WRAP_FEE = 149

export default function CheckoutPage() {
  const [step, setStep] = useState(0)
  const [address, setAddress] = useState({ name: '', phone: '', email: '', line1: '', city: '', state: '', pincode: '' })
  const [processing, setProcessing] = useState(false)
  const [giftWrap, setGiftWrap] = useState(false)
  const [giftNote, setGiftNote] = useState('')

  const { items, clearCart } = useCartStore()
  const freeShippingThreshold = useSettingsStore((s) => s.freeShippingThreshold)
  const navigate = useNavigate()
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)

  const shipping = subtotal >= freeShippingThreshold ? 0 : 99
  const giftWrapFee = giftWrap ? GIFT_WRAP_FEE : 0
  const total = subtotal + shipping + giftWrapFee

  const handleAddressSubmit = (e) => {
    e.preventDefault()
    setStep(1)
  }

  const finishOrder = async (paymentId, razorpayOrderId) => {
    const order = await placeOrder({
      items, address, subtotal, shipping, total, paymentId, razorpayOrderId,
      giftWrap, giftNote: giftWrap ? giftNote : undefined, giftWrapFee,
    })
    clearCart()
    navigate(`/order-confirmation/${order.id}`, { state: { order, address } })
  }

  const handlePayment = async () => {
    setProcessing(true)
    try {
      // Backend creates the Razorpay order first (or a mock order id if the
      // backend has no Razorpay keys configured — see backend/.env.example).
      const { razorpayOrderId, mock } = await createRazorpayOrder(total)

      if (mock) {
        // No Razorpay keys on the backend — skip the real checkout widget
        // entirely (it would try to validate a fake order id against
        // Razorpay's servers and fail) and complete the order directly.
        await new Promise((r) => setTimeout(r, 1200))
        await verifyPayment({ razorpay_order_id: razorpayOrderId })
        await finishOrder(`pay_mock_${Date.now()}`, razorpayOrderId)
        return
      }

      await initiatePayment({
        amount: total,
        razorpayOrderId,
        customerName: address.name,
        customerEmail: address.email,
        customerPhone: address.phone,
        onSuccess: async (response) => {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id ?? razorpayOrderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            await finishOrder(response.razorpay_payment_id, razorpayOrderId)
          } catch (err) {
            toast.error(err.message || 'Payment verification failed. Please contact support.')
            setProcessing(false)
          }
        },
        onFailure: (msg) => {
          toast.error(msg || 'Payment failed. Please try again.')
          setProcessing(false)
        },
      })
    } catch (err) {
      toast.error(err.message || 'Something went wrong. Please try again.')
      setProcessing(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-brown-mid font-sans font-light mb-6">Your cart is empty</p>
        <Link to="/products" className="btn-brand-primary inline-block">
          Continue Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl text-brown font-light mb-8">Checkout</h1>

      {/* Stepper */}
      <div className="flex items-center mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-2 ${i <= step ? 'text-brown' : 'text-brown-mid/50'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-sans border ${i < step ? 'border-brown bg-brown text-cream' : i === step ? 'border-brown text-brown' : 'border-border text-brown-mid/50'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-[11px] tracking-luxury font-sans uppercase hidden sm:block">{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 mx-3 h-px w-12 sm:w-24 ${i < step ? 'bg-brown' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: steps */}
        <div className="lg:col-span-2">
          {step === 0 && (
            <form onSubmit={handleAddressSubmit} className="panel-brand p-6 space-y-4">
              <h2 className="font-serif text-xl text-brown mb-2">Shipping Address</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label-brand">Full Name *</label>
                  <input required value={address.name} onChange={(e) => setAddress((a) => ({ ...a, name: e.target.value }))} className="input-brand" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label-brand">Phone *</label>
                  <input required type="tel" value={address.phone} onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))} className="input-brand" />
                </div>
                <div className="col-span-2">
                  <label className="label-brand">Email *</label>
                  <input required type="email" value={address.email} onChange={(e) => setAddress((a) => ({ ...a, email: e.target.value }))} className="input-brand" />
                </div>
                <div className="col-span-2">
                  <label className="label-brand">Address Line 1 *</label>
                  <input required value={address.line1} onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))} className="input-brand" />
                </div>
                <div>
                  <label className="label-brand">City *</label>
                  <input required value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} className="input-brand" />
                </div>
                <div>
                  <label className="label-brand">State *</label>
                  <input required value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} className="input-brand" />
                </div>
                <div>
                  <label className="label-brand">Pincode *</label>
                  <input required value={address.pincode} onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))} className="input-brand" />
                </div>
              </div>
              <button type="submit" className="w-full btn-brand-primary flex items-center justify-center gap-2 mt-2">
                Continue to Review <ChevronRight size={16} />
              </button>
            </form>
          )}

          {step === 1 && (
            <div className="panel-brand p-6 space-y-4">
              <h2 className="font-serif text-xl text-brown mb-2">Review Your Order</h2>
              <div className="space-y-3 divide-y divide-border">
                {items.map((item) => (
                  <div key={item.key} className="flex gap-3 pt-3 first:pt-0">
                    <img src={item.product.images[0]} alt={item.product.name} className="w-14 h-14 object-cover bg-cream-dark border border-border shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-sans text-brown">{item.product.name}</p>
                      {Object.keys(item.variant).length > 0 && (
                        <p className="text-xs font-sans text-brown-mid">{Object.entries(item.variant).map(([k,v]) => `${k}: ${v}`).join(' · ')}</p>
                      )}
                      <p className="text-sm font-sans text-brown-mid mt-0.5">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-sans text-brown">{formatCurrency(item.product.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-cream-dark p-3 text-sm space-y-1 border border-border">
                <p className="label-brand mb-2">Delivery to</p>
                <p className="font-sans text-brown">{address.name} · {address.phone}</p>
                <p className="font-sans text-brown-mid">{address.line1}, {address.city}, {address.state} - {address.pincode}</p>
              </div>

              <div className="border border-border p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giftWrap}
                    onChange={(e) => setGiftWrap(e.target.checked)}
                    className="mt-0.5 accent-brown"
                  />
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-sans text-brown">
                      <Gift size={14} /> This is a gift — add premium wrapping
                    </span>
                    <span className="block text-xs font-sans text-brown-mid mt-0.5">
                      Wrapped in FoldX signature paper with a handwritten note · {formatCurrency(GIFT_WRAP_FEE)}
                    </span>
                  </span>
                </label>
                {giftWrap && (
                  <textarea
                    value={giftNote}
                    onChange={(e) => setGiftNote(e.target.value)}
                    rows={2}
                    maxLength={200}
                    placeholder="Add a note for the recipient (optional)"
                    className="input-brand resize-none mt-3"
                  />
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="flex-1 btn-brand-ghost">
                  Edit Address
                </button>
                <button onClick={() => setStep(2)} className="flex-1 btn-brand-primary flex items-center justify-center gap-2">
                  Proceed to Pay <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="panel-brand p-6 space-y-4">
              <h2 className="font-serif text-xl text-brown">Payment</h2>
              <div className="border border-border bg-cream-dark p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img src="https://razorpay.com/favicon.png" alt="Razorpay" className="w-6 h-6" onError={(e)=>{e.currentTarget.style.display='none'}} />
                  <span className="font-sans text-brown">Razorpay Secure Payment</span>
                </div>
                <p className="text-sm font-sans font-light text-brown-mid mb-3">Pay using UPI, credit/debit card, net banking, wallets and more.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'UPI', icon: Smartphone },
                    { label: 'Cards', icon: CreditCard },
                    { label: 'Net Banking', icon: Landmark },
                    { label: 'Wallets', icon: Wallet },
                  ].map(({ label, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-2 text-xs font-sans bg-cream border border-border px-3 py-2.5 text-brown-mid">
                      <Icon size={15} className="text-brown shrink-0" /> {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-sans text-brown-mid">
                <ShieldCheck size={14} className="text-brown" />
                Your payment is 100% secure. We never store card details.
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 btn-brand-ghost">
                  Back
                </button>
                <button
                  onClick={handlePayment}
                  disabled={processing}
                  className="flex-1 btn-brand-primary"
                >
                  {processing ? 'Processing…' : `Pay ${formatCurrency(total)}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: order summary */}
        <div>
          <div className="panel-brand p-5 sticky top-28">
            <h3 className="font-serif text-lg text-brown mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm divide-y divide-border">
              {items.map((item) => (
                <div key={item.key} className="flex justify-between pt-2 first:pt-0">
                  <span className="font-sans text-brown-mid line-clamp-1 pr-2 flex-1">{item.product.name} × {item.quantity}</span>
                  <span className="font-sans text-brown shrink-0">{formatCurrency(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-4 pt-4 space-y-2 text-sm font-sans">
              <div className="flex justify-between text-brown-mid">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-brown-mid">
                <span>Shipping</span>
                <span>{shipping === 0 ? 'FREE' : formatCurrency(shipping)}</span>
              </div>
              {giftWrap && (
                <div className="flex justify-between text-brown-mid">
                  <span>Gift Wrapping</span>
                  <span>{formatCurrency(giftWrapFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-brown text-base border-t border-border pt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
