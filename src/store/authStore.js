import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { loginAdmin, loginCustomer, registerCustomer } from '@/services/api'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAdmin: false,
      isLoggedIn: false,

      logout: () =>
        set({ user: null, token: null, isAdmin: false, isLoggedIn: false }),

      // Throws on invalid credentials — callers should try/catch and show the error.
      adminLogin: async (email, password) => {
        const { user, token } = await loginAdmin(email, password)
        set({ user, token, isAdmin: true, isLoggedIn: true })
      },

      customerLogin: async (email, password) => {
        const { user, token } = await loginCustomer(email, password)
        set({ user, token, isAdmin: false, isLoggedIn: true })
      },

      customerRegister: async ({ name, email, password, phone }) => {
        const { user, token } = await registerCustomer({ name, email, password, phone })
        set({ user, token, isAdmin: false, isLoggedIn: true })
      },
    }),
    { name: 'foldx-auth' }
  )
)

export default useAuthStore
