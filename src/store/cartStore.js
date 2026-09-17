import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (product, quantity = 1, variant = {}) => {
        const key = `${product.id}-${JSON.stringify(variant)}`
        set((state) => {
          const existing = state.items.find((i) => i.key === key)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, quantity: i.quantity + quantity } : i
              ),
            }
          }
          return { items: [...state.items, { key, product, quantity, variant }] }
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
