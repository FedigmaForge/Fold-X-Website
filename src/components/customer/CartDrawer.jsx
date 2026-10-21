import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X, Trash2, Plus, Minus, ShoppingBag, Gift } from 'lucide-react'
import useCartStore from '@/store/cartStore'
import useSettingsStore from '@/store/settingsStore'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatVariant } from '@/utils/formatVariant'

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity } = useCartStore()
  const freeShippingThreshold = useSettingsStore((s) => s.freeShippingThreshold)
  const flatShippingFee = useSettingsStore((s) => s.flatShippingFee)
  const navigate = useNavigate()
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  const shipping = subtotal >= freeShippingThreshold ? 0 : flatShippingFee

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') closeCart() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, closeCart])

  const handleCheckout = () => {
    closeCart()
    navigate('/checkout')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-cream z-[61] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} strokeWidth={1.5} className="text-brown" />
            <h2 className="text-[11px] tracking-luxury font-sans uppercase text-brown">Cart ({items.reduce((s, i) => s + i.quantity, 0)})</h2>
          </div>
          <button onClick={closeCart} className="p-1.5 hover:bg-cream-dark transition-colors" aria-label="Close bag">
            <X size={18} className="text-brown-mid" />
          </button>
        </div>

        {/* Free shipping progress */}
        {items.length > 0 && (
          <div className="px-5 pt-4">
            {subtotal >= freeShippingThreshold ? (
              <p className="text-[11px] font-sans text-brown-mid">✓ You've unlocked free shipping</p>
            ) : (
              <p className="text-[11px] font-sans text-brown-mid">
                Add {formatCurrency(freeShippingThreshold - subtotal)} more for free shipping
              </p>
            )}
            <div className="h-[2px] bg-cream-dark mt-2">
              <div
                className="h-full bg-gold transition-all duration-500"
                style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto py-4 px-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <ShoppingBag size={40} strokeWidth={1} className="text-brown-mid mb-4" />
              <p className="text-brown font-sans">Your cart is empty</p>
              <p className="text-xs font-sans text-brown-mid mt-1">Add items to get started</p>
              <button
                onClick={closeCart}
                className="mt-6 btn-brand-secondary"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.key} className="flex gap-3">
                <Link to={`/products/${item.product.slug}`} onClick={closeCart}>
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-[72px] h-[72px] object-cover bg-cream-dark border border-border shrink-0"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/products/${item.product.slug}`}
                    onClick={closeCart}
                    className="text-sm font-sans text-brown line-clamp-2 hover:text-brown-mid transition-colors"
                  >
                    {item.product.name}
                  </Link>
                  {formatVariant(item.variant).length > 0 && (
                    <p className="text-xs font-sans text-brown-mid mt-0.5">{formatVariant(item.variant).join(' · ')}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-sans text-brown">{formatCurrency(item.product.price)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        className="w-6 h-6 border border-border hover:border-brown flex items-center justify-center transition-colors"
                      >
                        <Minus size={12} className="text-brown" />
                      </button>
                      <span className="w-6 text-center text-sm font-sans text-brown">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="w-6 h-6 border border-border hover:border-brown flex items-center justify-center transition-colors"
                      >
                        <Plus size={12} className="text-brown" />
                      </button>
                      <button
                        onClick={() => removeItem(item.key)}
                        className="w-6 h-6 hover:bg-cream-dark flex items-center justify-center transition-colors ml-1"
                      >
                        <Trash2 size={12} className="text-brown-mid" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border px-5 py-4 space-y-3">
            <div className="flex justify-between text-sm font-sans text-brown-mid">
              <span>Subtotal</span>
              <span className="text-brown">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-sans text-brown-mid">
              <span>Shipping</span>
              <span className="text-brown">{shipping ? formatCurrency(shipping) : 'FREE'}</span>
            </div>
            <div className="flex justify-between font-sans text-brown text-base border-t border-border pt-3">
              <span>Estimated total</span>
              <span>{formatCurrency(subtotal + shipping)}</span>
            </div>
            <p className="flex items-center gap-2 text-[11px] font-sans text-brown-mid">
              <Gift size={13} strokeWidth={1.5} className="shrink-0" />
              Gift wrap and a personal note can be added at checkout.
            </p>
            <button
              onClick={handleCheckout}
              className="w-full btn-brand-primary"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  )
}
