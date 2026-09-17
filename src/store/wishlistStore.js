import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useWishlistStore = create(
  persist(
    (set, get) => ({
      items: [],

      isInWishlist: (productId) => get().items.some((p) => p.id === productId),

      toggleItem: (product) => {
        const inList = get().items.some((p) => p.id === product.id)
        set((state) => ({
          items: inList
            ? state.items.filter((p) => p.id !== product.id)
            : [...state.items, product],
        }))
        return !inList
      },

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((p) => p.id !== productId) })),
    }),
    { name: 'foldx-wishlist' }
  )
)

export default useWishlistStore
