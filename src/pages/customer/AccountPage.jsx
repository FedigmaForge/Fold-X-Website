import { useState, useEffect } from 'react'
import { Package, User, MapPin, LogIn, Truck, Copy, RotateCcw } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { getMyOrders } from '@/services/api'
import useAuthStore from '@/store/authStore'
import OrderTimeline from '@/components/customer/OrderTimeline'
import ReturnRequestModal from '@/components/customer/ReturnRequestModal'
import toast from 'react-hot-toast'

// Shown instead of the account dashboard when the customer isn't signed in —
// previously there was no way to reach this at all (Navbar's "Sign In" link
// pointed here, but this page redirected straight back home when logged out).
function AuthGate() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const { customerLogin, customerRegister } = useAuthStore()

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await customerLogin(form.email, form.password)
        toast.success('Welcome back!')
      } else {
        await customerRegister(form)
        toast.success('Account created!')
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <div className="panel-brand p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 border border-border flex items-center justify-center mx-auto mb-4">
            <LogIn size={20} strokeWidth={1.5} className="text-brown" />
          </div>
          <h1 className="font-serif text-2xl text-brown font-light">{mode === 'login' ? 'Sign In' : 'Create Account'}</h1>
          <p className="text-xs font-sans font-light text-brown-mid mt-2">
            {mode === 'login' ? 'Sign in to view your orders' : 'Join FoldX for faster checkout'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="label-brand">Full Name</label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input-brand" />
            </div>
          )}
          <div>
            <label className="label-brand">Email</label>
            <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input-brand" />
          </div>
          <div>
            <label className="label-brand">Password</label>
            <input required type="password" minLength={6} value={form.password} onChange={(e) => set('password', e.target.value)} className="input-brand" />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full btn-brand-primary"
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
          className="w-full text-center text-xs font-sans font-light text-brown-mid hover:text-brown mt-5 transition-colors"
        >
          {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

const RETURN_STATUS_TEXT = {
  requested: 'requested — we\'ll review it shortly',
  approved: 'approved — check your email for how to send it back',
  received: 'received — your refund is being processed',
  closed: 'completed',
  rejected: 'not approved — see our email for details',
}

export default function AccountPage() {
  const { isLoggedIn, user } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders')
  const [returning, setReturning] = useState(null) // order being returned

  useEffect(() => {
    if (!isLoggedIn) return
    getMyOrders().then((mine) => {
      setOrders(mine)
      setLoading(false)
    })
  }, [isLoggedIn])

  if (!isLoggedIn) return <AuthGate />

  const handleReturned = (created) => {
    setOrders((list) => list.map((o) => (o.id === returning.id ? { ...o, canReturn: false, returns: [created, ...(o.returns ?? [])] } : o)))
    setReturning(null)
  }

  return (
    <div className="max-w-screen-md mx-auto px-6 py-10 space-y-8">
      <h1 className="font-serif text-3xl text-brown font-light">My Account</h1>

      {/* Profile card */}
      <div className="panel-brand p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full border border-border flex items-center justify-center text-brown font-serif text-xl">
          {user?.name?.[0]}
        </div>
        <div>
          <p className="font-sans text-brown">{user?.name}</p>
          <p className="text-sm font-sans text-brown-mid">{user?.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { key: 'orders', label: 'My Orders', icon: Package },
          { key: 'profile', label: 'Profile', icon: User },
          { key: 'addresses', label: 'Addresses', icon: MapPin },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-[11px] tracking-luxury font-sans uppercase border-b-2 -mb-px transition-colors ${tab === key ? 'border-brown text-brown' : 'border-transparent text-brown-mid hover:text-brown'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="space-y-4">
          {loading ? (
            Array.from({length:3}).map((_,i) => <div key={i} className="h-24 bg-cream-dark animate-pulse" />)
          ) : orders.length === 0 ? (
            <p className="text-brown-mid font-sans font-light text-center py-10">No orders yet</p>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="panel-brand p-5 hover:border-brown transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sm text-brown">{order.id}</p>
                    <p className="text-xs font-sans text-brown-mid mt-0.5">Placed on {formatDate(order.createdAt)}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex gap-2 mb-3">
                  {order.items.slice(0, 3).map((item, i) => (
                    <img key={i} src={item.product.images[0]} alt="" className="w-12 h-12 object-cover bg-cream-dark border border-border" />
                  ))}
                  {order.items.length > 3 && (
                    <div className="w-12 h-12 bg-cream-dark flex items-center justify-center text-xs font-sans text-brown-mid">+{order.items.length - 3}</div>
                  )}
                </div>
                <div className="mb-3 max-w-[220px]">
                  <OrderTimeline status={order.status} compact />
                </div>
                {(order.courier || order.trackingNumber) && order.status !== 'cancelled' && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 px-3 py-2 bg-cream-dark/60 border border-border text-xs font-sans text-brown">
                    <Truck size={14} strokeWidth={1.5} className="text-brown-mid shrink-0" />
                    <span>{order.courier ? `Shipped via ${order.courier}` : 'Tracking number'}</span>
                    {order.trackingNumber && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(order.trackingNumber).then(() => toast.success('Tracking number copied'))}
                        className="inline-flex items-center gap-1 tracking-wider text-brown hover:text-brown-mid"
                        title="Copy tracking number"
                      >
                        · {order.trackingNumber} <Copy size={11} />
                      </button>
                    )}
                  </div>
                )}
                {order.returns?.[0] && (
                  <p className="flex items-center gap-1.5 mb-3 text-xs font-sans text-brown">
                    <RotateCcw size={12} strokeWidth={1.5} className="text-brown-mid" />
                    Return {RETURN_STATUS_TEXT[order.returns[0].status] ?? order.returns[0].status}
                    <span className="text-brown-mid">· {formatDate(order.returns[0].createdAt)}</span>
                  </p>
                )}
                {order.refundedAmount > 0 && (
                  <p className="flex items-center gap-1.5 mb-3 text-xs font-sans text-brown-mid">
                    <RotateCcw size={12} strokeWidth={1.5} />
                    {formatCurrency(order.refundedAmount)} refunded to your original payment method
                  </p>
                )}
                <div className="flex justify-between items-center text-sm font-sans">
                  <span className="text-brown-mid">{order.items.reduce((s, i) => s + i.quantity, 0)} items</span>
                  <span className="flex items-center gap-4">
                    {order.canReturn && (
                      <button onClick={() => setReturning(order)} className="text-[10px] tracking-luxury uppercase text-brown border-b border-brown pb-0.5 hover:text-brown-mid hover:border-brown-mid">
                        Request a return
                      </button>
                    )}
                    <span className="text-brown text-right">
                      {formatCurrency(order.total)}
                      {order.paymentMethod === 'cod' && (
                        <span className="block text-[10px] tracking-wide uppercase text-brown-mid">
                          {order.paymentStatus === 'pending' && order.status !== 'cancelled' ? 'Cash on delivery · pay on arrival' : 'Cash on delivery'}
                        </span>
                      )}
                    </span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'profile' && (
        <div className="panel-brand p-6 max-w-md space-y-4">
          <div>
            <label className="label-brand">Full Name</label>
            <input defaultValue={user?.name} className="input-brand" />
          </div>
          <div>
            <label className="label-brand">Email</label>
            <input defaultValue={user?.email} type="email" className="input-brand" />
          </div>
          <button className="btn-brand-primary">
            Save Changes
          </button>
        </div>
      )}

      {tab === 'addresses' && (
        <div className="panel-brand p-6 max-w-md">
          <p className="text-brown-mid font-sans font-light text-center py-6">No saved addresses yet.</p>
          <button className="w-full border border-dashed border-border py-3 text-[11px] tracking-luxury font-sans uppercase text-brown-mid hover:border-brown hover:text-brown transition-colors">
            + Add New Address
          </button>
        </div>
      )}
      {returning && <ReturnRequestModal order={returning} onClose={() => setReturning(null)} onRequested={handleReturned} />}
    </div>
  )
}
