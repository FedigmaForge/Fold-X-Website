import { useState, useEffect } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { CheckCircle, Package, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'
import { getOrderPublic } from '@/services/api'
import OrderTimeline from '@/components/customer/OrderTimeline'

export default function OrderConfirmationPage() {
  const { orderId } = useParams()
  const { state } = useLocation()
  const [order, setOrder] = useState(state?.order ?? null)
  const [address, setAddress] = useState(state?.address ?? null)

  useEffect(() => {
    // Refreshing this page (or opening the link directly) loses router state —
    // fall back to fetching the order by id so the page never renders blank.
    if (order) return
    getOrderPublic(orderId).then((o) => {
      if (!o) return
      setOrder(o)
      setAddress(o.address)
    })
  }, [orderId, order])

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <div className="panel-brand p-8 space-y-6">
        <div className="w-16 h-16 border border-brown rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={32} strokeWidth={1.5} className="text-brown" />
        </div>

        <div>
          <h1 className="font-serif text-2xl text-brown font-light mb-2">Order Placed Successfully</h1>
          <p className="font-sans font-light text-brown-mid">Thank you for shopping with FoldX. Your order is confirmed.</p>
        </div>

        {order?.status && (
          <div className="text-left pt-2">
            <OrderTimeline status={order.status} />
          </div>
        )}

        <div className="bg-cream-dark p-4 text-left space-y-3 border border-border">
          <div className="flex justify-between text-sm font-sans">
            <span className="text-brown-mid">Order ID</span>
            <span className="font-mono text-brown">{orderId}</span>
          </div>
          {order?.total && (
            <div className="flex justify-between text-sm font-sans">
              <span className="text-brown-mid">{order.paymentMethod === 'cod' ? 'To pay on delivery' : 'Amount Paid'}</span>
              <span className="text-brown">{formatCurrency(order.total)}</span>
            </div>
          )}
          {order?.paymentMethod === 'cod' && (
            <p className="text-xs font-sans text-brown-mid border-l-2 border-gold pl-3">
              Cash on delivery: we'll call you shortly to confirm your order before it ships. Please keep the exact amount ready when it arrives — you can pay by cash or UPI.
            </p>
          )}
          {order?.discount > 0 && (
            <div className="flex justify-between text-sm font-sans">
              <span className="text-brown-mid">You saved</span>
              <span className="text-brown">{formatCurrency(order.discount)}</span>
            </div>
          )}
          {address && (
            <div className="flex justify-between text-sm font-sans">
              <span className="text-brown-mid">Deliver to</span>
              <span className="text-brown text-right">{address.city}, {address.state}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-sans">
            <span className="text-brown-mid">Estimated Delivery</span>
            <span className="text-brown">3–5 business days</span>
          </div>
        </div>

        {order?.giftWrap && (
          <div className="text-left text-xs font-sans text-brown-mid bg-cream-dark p-3 border border-border">
            <span className="text-brown">Gift wrapped</span> — {order.giftNote ? `"${order.giftNote}"` : 'no note added'}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-xs font-sans text-brown-mid bg-cream-dark p-3 border border-border">
          <Package size={15} className="text-brown" />
          A confirmation email will be sent to your registered email address.
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            to="/account"
            className="flex-1 btn-brand-secondary"
          >
            Track Order
          </Link>
          <Link
            to="/products"
            className="flex-1 btn-brand-primary flex items-center justify-center gap-2"
          >
            Continue Shopping <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
