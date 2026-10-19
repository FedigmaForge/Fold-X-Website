import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { recoverCart } from '@/services/api'
import useCartStore from '@/store/cartStore'
import { setCartToken, setOfferCode, setRecoveredContact } from '@/utils/cartToken'

// Landing page for abandoned-cart reminder links: refills the bag with what
// the shopper left behind (current prices, available items only) and sends
// them to checkout, with any discount code from the link ready to apply.
export default function CartRecoverPage() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    recoverCart(token)
      .then(({ items, name, email }) => {
        if (cancelled) return
        if (items.length === 0) { setError('The items from your bag are no longer available.'); return }
        const { clearCart, addItem } = useCartStore.getState()
        clearCart()
        for (const it of items) addItem(it.product, it.quantity, it.variant, it.variantId)
        setCartToken(token)
        setRecoveredContact({ name, email })
        const code = params.get('code')
        if (code) setOfferCode(code)
        navigate('/checkout', { replace: true })
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [token, params, navigate])

  return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center">
      {error ? (
        <>
          <p className="font-serif text-3xl text-brown font-light mb-3">We couldn't restore your bag</p>
          <p className="text-sm font-sans text-brown-mid mb-8">{error}</p>
          <Link to="/products" className="btn-brand-primary inline-block">Continue shopping</Link>
        </>
      ) : (
        <p className="font-sans text-brown-mid">Restoring your bag…</p>
      )}
    </div>
  )
}
