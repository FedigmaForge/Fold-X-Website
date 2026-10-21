import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import toast from 'react-hot-toast'
import { loginAdmin, loginCustomer, registerCustomer, SESSION_EXPIRED_EVENT } from '@/services/api'

// Reads the JWT's own expiry (no signature check — the server does that).
// Unreadable tokens count as expired.
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return !payload.exp || payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

const SIGNED_OUT = { user: null, token: null, isAdmin: false, isLoggedIn: false }

const useAuthStore = create(
  persist(
    (set) => ({
      ...SIGNED_OUT,

      logout: () => set(SIGNED_OUT),

      // Throws on invalid credentials — callers should try/catch and show the error.
      // Returns null when signed in, or the next step when two-step login is
      // needed: { step: 'code' | 'setup', challenge }
      adminLogin: async (email, password) => {
        const res = await loginAdmin(email, password)
        if (res.twoFactorRequired) return { step: 'code', challenge: res.challenge }
        if (res.twoFactorSetupRequired) return { step: 'setup', challenge: res.challenge }
        set({ user: res.user, token: res.token, isAdmin: true, isLoggedIn: true })
        return null
      },

      // Finishes a staff sign-in after the two-step login step
      setAdminSession: ({ user, token }) => set({ user, token, isAdmin: true, isLoggedIn: true }),

      customerLogin: async (email, password) => {
        const { user, token } = await loginCustomer(email, password)
        set({ user, token, isAdmin: false, isLoggedIn: true })
      },

      customerRegister: async ({ name, email, password, phone }) => {
        const { user, token } = await registerCustomer({ name, email, password, phone })
        set({ user, token, isAdmin: false, isLoggedIn: true })
      },
    }),
    {
      name: 'foldx-auth',
      // A login saved in localStorage can outlive its token (tokens last 7
      // days). Drop it on load instead of letting every request fail with
      // "Invalid or expired token".
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.logout()
          // Deferred so a <Toaster> has mounted to show it
          setTimeout(() => toast.error('Your session has expired — please sign in again', { id: 'session-expired' }), 0)
        }
      },
    }
  )
)

// The API layer reports a rejected token (expired mid-session, or the user was
// deactivated) via this event — it can't import this store directly without a
// circular dependency. Signing out sends admin pages back to the login screen.
if (typeof window !== 'undefined') {
  window.addEventListener(SESSION_EXPIRED_EVENT, () => {
    if (!useAuthStore.getState().isLoggedIn) return
    useAuthStore.getState().logout()
    toast.error('Your session has expired — please sign in again', { id: 'session-expired' })
  })
}

export default useAuthStore
