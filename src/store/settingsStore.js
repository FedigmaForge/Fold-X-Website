import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getSettings, updateSettings } from '@/services/api'

const DEFAULTS = {
  storeName: 'FoldX',
  tagline: 'Handcrafted Leather Goods',
  announcementBar: '',
  freeShippingThreshold: 999,
  supportEmail: '',
  supportPhone: '',
  address: '',
  instagramHandle: '',
  currency: 'INR',
  razorpayKeyId: '',
}

const useSettingsStore = create(
  persist(
    (set) => ({
      ...DEFAULTS,
      hydrated: false,

      // Called once on app boot (see App.jsx) to pull the latest values saved
      // by the admin, so Navbar/Footer/checkout reflect real settings instead
      // of the localStorage cache from a previous session.
      hydrate: async () => {
        const data = await getSettings()
        set({ ...data, hydrated: true })
      },

      update: async (data) => {
        const saved = await updateSettings(data)
        set(saved)
      },
    }),
    { name: 'foldx-settings', version: 2 }
  )
)

export default useSettingsStore
