import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getSettings, updateSettings } from '@/services/api'

// Admin-only settings (same list as the backend's public /settings filter)
const PRIVATE_KEYS = ['razorpayKeyId', 'legalName', 'tradeName', 'businessType', 'shippingCostPerOrder']

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
  gstin: '',
  state: '',
  defaultHsnCode: '4202',
  defaultGstRate: 18,
  flatShippingFee: 99,
  giftWrapFee: 149,
  returnWindowDays: 10,
  codEnabled: true,
  codFee: 49,
  codMaxOrder: 15000,
  customisationEnabled: true,
  customLeathers: 'Full Grain Leather, Pebbled Leather, Croco Embossed Leather, Saffiano Leather, Vegetable Tanned Leather, Nubuck Leather',
  customisationNote: 'Made to order in your chosen leather — ships in 7–10 days.',
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
        // Keep only what the storefront may see in this (persisted) store
        set(Object.fromEntries(Object.entries(saved).filter(([k]) => !PRIVATE_KEYS.includes(k))))
        return saved
      },
    }),
    {
      name: 'foldx-settings',
      // v3: drop cached admin-only values (registered names etc.); hydrate() refills the rest
      version: 3,
      migrate: () => ({ ...DEFAULTS, hydrated: false }),
    }
  )
)

export default useSettingsStore
