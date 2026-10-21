import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      // variantId identifies the exact colour/size bought (its own stock);
      // `variant` is the human-readable { color, size } shown in the bag, plus
      // `leather` when the shopper chose the free leather customisation — the
      // same bag in two leathers is two separate lines.
      addItem: (product, quantity = 1, variant = {}, variantId = null) => {
        const leather = variant.leather ? `~${variant.leather}` : ''
        const key = variantId ? `${product.id}-${variantId}${leather}` : `${product.id}-${JSON.stringify(variant)}`
        set((state) => {
          const existing = state.items.find((i) => i.key === key)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, quantity: i.quantity + quantity } : i
              ),
            }
          }
          return { items: [...state.items, { key, product, quantity, variant, variantId }] }
        })
      },

      removeItem: (key) =>
        set((state) => ({ items: state.items.filter((i) => i.key !== key) })),

      updateQuantity: (key, quantity) => {
        if (quantity < 1) {
          get().removeItem(key)
          return
        }
        set((state) => ({
          items: state.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
        }))
      },

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'foldx-cart',
      // isOpen is transient UI state, not data — persisting it meant a reload
      // could resurrect an open drawer whose backdrop blocks the page underneath.
      partialize: (state) => ({ items: state.items }),
    }
  )
)

export default useCartStore
