import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getSiteContent } from '@/services/api'
import { SITE_CONTENT_DEFAULTS } from '@/data/siteContentDefaults'

// Navbar menu + homepage tiles/editorial. Starts from the built-in defaults,
// then App.jsx hydrates it from the backend on boot. Persisted so returning
// visitors see the admin's last-saved content immediately instead of a flash
// of the defaults while the request is in flight.
const useSiteContentStore = create(
  persist(
    (set) => ({
      ...SITE_CONTENT_DEFAULTS,

      hydrate: async () => {
        const saved = await getSiteContent()
        // A section missing from the response was never customised (or was
        // reset) — fall back to its default rather than keeping a stale cache.
        set({ ...SITE_CONTENT_DEFAULTS, ...saved })
      },

      // Used by the admin Storefront page after a save/reset, so the
      // storefront in the same browser updates without a reload.
      setSection: (key, value) => set({ [key]: value ?? SITE_CONTENT_DEFAULTS[key] }),
    }),
    {
      name: 'foldx-site-content',
      // Bumped whenever the default sections change (v6: community section)
      // — drops older caches; hydrate() re-applies saved content.
      version: 6,
      migrate: () => ({ ...SITE_CONTENT_DEFAULTS }),
    }
  )
)

export default useSiteContentStore
