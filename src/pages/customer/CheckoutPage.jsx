import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronRight, ShieldCheck, Gift, Smartphone, CreditCard, Landmark, Wallet, Tag, X, Banknote } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'
import { initiatePayment } from '@/utils/razorpay'
import { placeOrder, createRazorpayOrder, verifyPayment, getOrderQuote, saveCheckoutCart } from '@/services/api'
import useCartStore from '@/store/cartStore'
import useSettingsStore from '@/store/settingsStore'
import { INDIAN_STATES } from '@/data/indianStates'
import toast from 'react-hot-toast'
import { getCartToken, resetCartToken, peekOfferCode, clearOfferCode, peekRecoveredContact, clearRecoveredContact } from '@/utils/cartToken'

const STEPS = ['Address', 'Review Order', 'Payment']

// What the server needs to price the order — ids and quantities only. Prices
// are always looked up server-side.
const toOrderItems = (items) => items.map((i) => ({
  product: { id: i.product.id },
  variantId: i.variantId,
  variant: i.variant,
  quantity: i.quantity,
}))

export default function CheckoutPage() {
  const [step, setStep] = useState(0)
  // Arriving from a cart-recovery link, name and email are already known
  const [address, setAddress] = useState(() => {
    const known = peekRecoveredContact()
    return { name: known?.name ?? '', phone: '', email: known?.email ?? '', line1: '', city: '', state: '', pincode: '' }
  })
  const [processing, setProcessing] = useState(false)
  const [giftWrap, setGiftWrap] = useState(false)
  const [giftNote, setGiftNote] = useState('')
  const [quote, setQuote] = useState(null)
  // Promo code: what's typed, the code we're asking the server to apply, and
  // any message about it (invalid, or beaten by an automatic discount)
  // A code from an abandoned-cart reminder link arrives pre-applied
  const [codeInput, setCodeInput] = useState(() => peekOfferCode() ?? '')
  const [appliedCode, setAppliedCode] = useState(() => peekOfferCode())
  const [codeMessage, setCodeMessage] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('online') // 'online' | 'cod'
  // One key per checkout visit: a double-clicked "Place order" for cash on
  // delivery returns the same order instead of creating two
  const [checkoutKey] = useState(() => `cod_${crypto.randomUUID()}`)

  const { items, clearCart } = useCartStore()
  const { freeShippingThreshold, flatShippingFee, giftWrapFee: GIFT_WRAP_FEE } = useSettingsStore()
  const navigate = useNavigate()

  // Local estimate for instant feedback; replaced by the server's quote (the
  // amount that will actually be charged) as soon as it arrives.
  const estSubtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  const estShipping = estSubtotal >= freeShippingThreshold ? 0 : flatShippingFee
  const estimate = { subtotal: estSubtotal, discount: 0, shipping: estShipping, giftWrapFee: giftWrap ? GIFT_WRAP_FEE : 0 }
  estimate.total = estimate.subtotal + estimate.shipping + estimate.giftWrapFee
  const { subtotal, discount, shipping, giftWrapFee, total } = quote ?? estimate

  useEffect(() => {
    if (items.length === 0) return
    let stale = false
    getOrderQuote({ items: toOrderItems(items), giftWrap, couponCode: appliedCode, email: address.email || undefined, paymentMethod })
      .then((q) => {
        if (stale) return
        setQuote(q)
        // e.g. the order grew past the COD limit — fall back to paying online
        if (paymentMethod === 'cod' && !q.codAvailable) setPaymentMethod('online')
        if (q.couponError) {
          // Don't keep a code that doesn't work — paying would be refused
          setCodeMessage({ tone: 'error', text: q.couponError })
          setAppliedCode(null)
        } else if (q.couponNotice) {
          setCodeMessage({ tone: 'info', text: q.couponNotice })
        } else if (appliedCode && q.discountCode === appliedCode) {
          setCodeMessage(null)
        }
      })
      .catch((err) => { if (!stale) { setQuote(null); toast.error(err.message) } })
    return () => { stale = true }
    // address.email matters for per-customer and first-order rules, but only
    // once it's final — the quote re-runs when the review step mounts anyway
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, giftWrap, appliedCode, step, paymentMethod])

  const applyCode = (e) => {
    e.preventDefault()
    const code = codeInput.trim().toUpperCase()
    if (!code) return
    setCodeMessage(null)
    setAppliedCode(code)
  }

  const removeCode = () => {
    setAppliedCode(null)
    setCodeInput('')
    setCodeMessage(null)
  }

  const paymentDetails = () => ({ items: toOrderItems(items), giftWrap, couponCode: appliedCode, email: address.email })

  useEffect(() => { clearOfferCode(); clearRecoveredContact() }, [])

  const handleAddressSubmit = (e) => {
    e.preventDefault()
    setStep(1)
    // Save the bag with the email so it can be recovered if they don't finish.
    // Best effort — checkout carries on regardless.
    saveCheckoutCart({ token: getCartToken(), email: address.email, name: address.name, phone: address.phone, items: toOrderItems(items) }).catch(() => {})
  }

  const finishOrder = async (payment) => {
    const order = await placeOrder({
      items: toOrderItems(items),
      address,
      giftWrap,
      giftNote: giftWrap ? giftNote : undefined,
      couponCode: appliedCode,
      cartToken: getCartToken(),
      ...payment,
    })
    clearCart()
    resetCartToken()
    navigate(`/order-confirmation/${order.id}`, { state: { order, address } })
  }

  const handlePayment = async () => {
    setProcessing(true)
    if (paymentMethod === 'cod') {
      try {
        await finishOrder({ paymentMethod: 'cod', checkoutKey })
      } catch (err) {
        toast.error(err.message || 'Could not place your order. Please try again.')
        setProcessing(false)
      }
      return
    }
    try {
      // The backend prices the bag itself and creates the Razorpay order for
      // that amount (or a mock order id when it has no Razorpay keys — see
      // backend/.env.example).
      const { razorpayOrderId, amount, mock } = await createRazorpayOrder(paymentDetails())

      if (mock) {
        // No Razorpay keys on the backend — skip the real checkout widget
        // entirely (it would try to validate a fake order id against
        // Razorpay's servers and fail) and complete the order directly.
        await new Promise((r) => setTimeout(r, 1200))
        await finishOrder({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: `pay_mock_${Date.now()}` })
        return
      }

      await initiatePayment({
        amount,
        razorpayOrderId,
        customerName: address.name,
        customerEmail: address.email,
        customerPhone: address.phone,
        onSuccess: async (response) => {
          const payment = {
            razorpay_order_id: response.razorpay_order_id ?? razorpayOrderId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }
          try {
            await verifyPayment(payment)
            await finishOrder(payment)
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
                  <select required value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} className="input-brand">
                    <option value="" disabled>Select state</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
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
              <label className={`block border p-4 cursor-pointer transition-colors ${paymentMethod === 'online' ? 'border-brown bg-cream-dark' : 'border-border hover:border-brown-mid'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <input type="radio" name="paymentMethod" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} className="accent-brown" />
                  <img src="https://razorpay.com/favicon.png" alt="Razorpay" className="w-6 h-6" onError={(e)=>{e.currentTarget.style.display='none'}} />
                  <span className="font-sans text-brown">Pay online — Razorpay Secure</span>
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
              </label>

              {quote?.codFeeSetting !== undefined && (quote.codAvailable || quote.codReason) && (
                <label className={`block border p-4 transition-colors ${!quote.codAvailable ? 'opacity-60 cursor-not-allowed border-border' : paymentMethod === 'cod' ? 'border-brown bg-cream-dark cursor-pointer' : 'border-border hover:border-brown-mid cursor-pointer'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="paymentMethod" checked={paymentMethod === 'cod'} disabled={!quote.codAvailable} onChange={() => setPaymentMethod('cod')} className="accent-brown" />
                    <Banknote size={20} strokeWidth={1.5} className="text-brown" />
                    <span className="font-sans text-brown">Cash on delivery</span>
                    {quote.codAvailable && quote.codFeeSetting > 0 && <span className="ml-auto text-xs font-sans text-brown-mid">+{formatCurrency(quote.codFeeSetting)} fee</span>}
                  </div>
                  <p className="text-xs font-sans text-brown-mid mt-2 ml-7">
                    {quote.codAvailable
                      ? 'Pay in cash or UPI when your order arrives. We\'ll call to confirm your order before it ships.'
                      : quote.codReason}
                  </p>
                </label>
              )}

              <div className="flex items-center gap-2 text-xs font-sans text-brown-mid">
                <ShieldCheck size={14} className="text-brown" />
                {paymentMethod === 'cod'
                  ? 'Please keep the exact amount ready — our courier partners may not carry change.'
                  : 'Your payment is 100% secure. We never store card details.'}
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
                  {processing ? 'Processing…' : paymentMethod === 'cod' ? `Place order · pay ${formatCurrency(total)} on delivery` : `Pay ${formatCurrency(total)}`}
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
              {discount > 0 && (
                <div className="flex justify-between text-brown">
                  <span className="flex items-center gap-1.5"><Tag size={12} strokeWidth={1.5} /> {quote?.discountLabel || 'Discount'}</span>
                  <span>−{formatCurrency(discount)}</span>
                </div>
              )}
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
              {quote?.codFee > 0 && (
                <div className="flex justify-between text-brown-mid">
                  <span>Cash-on-delivery fee</span>
                  <span>{formatCurrency(quote.codFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-brown text-base border-t border-border pt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Promo code */}
            <div className="border-t border-border mt-4 pt-4">
              {appliedCode && quote?.discountCode === appliedCode ? (
                <div className="flex items-center justify-between text-sm font-sans">
                  <span className="flex items-center gap-1.5 text-brown"><Tag size={13} strokeWidth={1.5} /> {appliedCode} applied</span>
                  <button type="button" onClick={removeCode} aria-label="Remove code" className="text-brown-mid hover:text-brown"><X size={14} /></button>
                </div>
              ) : (
                <form onSubmit={applyCode} className="flex gap-2">
                  <input
                    value={codeInput}
                    onChange={(e) => { setCodeInput(e.target.value); if (codeMessage?.tone === 'error') setCodeMessage(null) }}
                    placeholder="Promo code"
                    aria-label="Promo code"
                    className="input-brand flex-1 uppercase placeholder:normal-case"
                  />
                  <button type="submit" disabled={!codeInput.trim()} className="btn-brand-secondary px-4">Apply</button>
                </form>
              )}
              {codeMessage && (
                <p className={`text-xs font-sans mt-2 ${codeMessage.tone === 'error' ? 'text-red-700' : 'text-brown-mid'}`}>{codeMessage.text}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
