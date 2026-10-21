import { useState, useEffect } from 'react'
import { ArrowUp, ArrowDown, Plus, Trash2, RotateCcw, Save, ExternalLink } from 'lucide-react'
import ImageUploader from '@/components/admin/ImageUploader'
import { getCategories, getCollections, saveSiteContent, resetSiteContent } from '@/services/api'
import useSiteContentStore from '@/store/siteContentStore'
import { SITE_CONTENT_DEFAULTS } from '@/data/siteContentDefaults'
import { usePermissions } from '@/utils/permissions'
import { toSlug } from '@/utils/categoryBanner'
import toast from 'react-hot-toast'

// In the order they appear on the site
const TABS = [
  { key: 'announcements', label: 'Announcement bar', desc: 'Short messages that rotate in the brown bar at the very top. Add a link to make one clickable. If you remove them all, the announcement from Settings is shown instead.' },
  { key: 'navMenu', label: '☰ Menu', desc: 'The slide-out menu behind the ☰ button. Menus with sub-links open their own panel; the featured image shows at the bottom of it. A menu linking to /collections with no sub-links lists your collections automatically.' },
  { key: 'homeTiles', label: 'Shop by category', desc: 'The "Shop by Category" tiles under the slideshow — 3 per row on computers, 2 on phones. Square images work best. (Slideshow images are under Banners.)' },
  { key: 'homeGifting', label: 'Gift store · Her · Him', desc: 'Banner 1 is the full-width "Gift Store" strip; banners 2 and 3 are the large "For Her" / "For Him" pictures side by side.' },
  { key: 'homeMoments', label: 'Every moment', desc: 'The "Made for every moment" section: a title and up to six square image tiles.' },
  { key: 'homeEditorial', label: 'Featured collection', desc: 'The image with a "Shop Now" button; the product carousel beside it shows products from the button link, e.g. /collections/heritage or /products?badge=new.' },
  { key: 'homeTrending', label: 'Trending now', desc: 'The "Trending Now" category tiles — 4 per row on computers.' },
  { key: 'homeClosing', label: 'Your next stop', desc: 'The wide image near the end of the homepage (title above it, text and button on it) — e.g. your studio or store.' },
  { key: 'homeCommunity', label: 'Community', desc: 'The "Join Our Community" section at the end of the homepage: title, intro, a card for each social account (taken from Footer → Social links) and a photo strip that opens your Instagram.' },
  { key: 'categoryBanners', label: 'Category banners', desc: 'The banner at the top of each product listing page — photo on the left, title on the right. Each banner belongs to a page link; a page shows the banner that matches most of its filters, and a bag type beats a category (e.g. /products?gender=women&type=tote-bags shows "Tote Bags"). /products on its own is the fallback.' },
  { key: 'giftStore', label: 'Gift store page', desc: 'The hero at the top of the /gifts page. The gifts themselves are filtered from your products automatically.' },
  { key: 'footer', label: 'Footer', desc: 'The text under the logo, the Shop column and the social links. Customer Service links come from published pages (admin → Pages).' },
]
const MAX_ITEMS = 8
const MAX_MENUS = 10

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 bg-white'
const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'

// ─── Small building blocks ────────────────────────────────────────────────────

function TextField({ label, value, onChange, placeholder, multiline, rows = 3, list }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {multiline ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} resize-none`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} list={list} className={inputCls} />
      )}
    </div>
  )
}

// Links get suggestions (categories, gender pages, badges) via a shared <datalist>
function LinkField({ label = 'Link', value, onChange }) {
  return <TextField label={label} value={value} onChange={onChange} placeholder="/products?category=…" list="storefront-link-suggestions" />
}

function ImageField({ label, value, onChange }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <ImageUploader images={value ? [value] : []} onChange={(imgs) => onChange(imgs[0] || '')} maxFiles={1} />
    </div>
  )
}

// Up / down / remove controls shared by menu items, sub-links and tiles
function RowControls({ index, count, onMove, onRemove, removeLabel }) {
  const btn = 'p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} className={btn} aria-label="Move up"><ArrowUp size={14} /></button>
      <button type="button" onClick={() => onMove(index, 1)} disabled={index === count - 1} className={btn} aria-label="Move down"><ArrowDown size={14} /></button>
      <button type="button" onClick={() => onRemove(index)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label={removeLabel}><Trash2 size={14} /></button>
    </div>
  )
}

const move = (arr, i, dir) => {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
const patchAt = (arr, i, patch) => arr.map((x, k) => (k === i ? { ...x, ...patch } : x))

// ─── Section editors ──────────────────────────────────────────────────────────

function NavMenuEditor({ value, onChange }) {
  const update = (i, patch) => onChange(patchAt(value, i, patch))
  const updateFeatured = (i, patch) => update(i, { featured: { image: '', label: '', href: '', ...value[i].featured, ...patch } })
  const updateSub = (i, j, patch) => update(i, { sub: patchAt(value[i].sub, j, patch) })

  return (
    <div className="space-y-4">
      {value.map((item, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3>{item.label || `Menu ${i + 1}`}</h3>
            <RowControls index={i} count={value.length} onMove={(k, d) => onChange(move(value, k, d))} onRemove={(k) => onChange(value.filter((_, x) => x !== k))} removeLabel="Remove menu" />
          </div>

          <div className="grid md:grid-cols-[1fr_220px] gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Menu label" value={item.label} onChange={(v) => update(i, { label: v })} placeholder="e.g. Women" />
                <LinkField label="Menu link" value={item.href} onChange={(v) => update(i, { href: v })} />
              </div>

              <div>
                <p className={labelCls}>Sub-links</p>
                <div className="space-y-2">
                  {item.sub.map((s, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <input value={s.label} onChange={(e) => updateSub(i, j, { label: e.target.value })} placeholder="Label" className={`${inputCls} flex-[2]`} />
                      <input value={s.href} onChange={(e) => updateSub(i, j, { href: e.target.value })} placeholder="/products?…" list="storefront-link-suggestions" className={`${inputCls} flex-[3]`} />
                      <RowControls index={j} count={item.sub.length} onMove={(k, d) => update(i, { sub: move(item.sub, k, d) })} onRemove={(k) => update(i, { sub: item.sub.filter((_, x) => x !== k) })} removeLabel="Remove sub-link" />
                    </div>
                  ))}
                </div>
                {item.sub.length < 10 && (
                  <button type="button" onClick={() => update(i, { sub: [...item.sub, { label: '', href: '' }] })} className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                    <Plus size={12} /> Add sub-link
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <ImageField label="Featured image (optional)" value={item.featured?.image ?? ''} onChange={(v) => updateFeatured(i, { image: v })} />
              {item.featured?.image ? (
                <>
                  <TextField label="Image caption" value={item.featured.label} onChange={(v) => updateFeatured(i, { label: v })} placeholder="e.g. New Arrivals" />
                  <LinkField label="Image link" value={item.featured.href} onChange={(v) => updateFeatured(i, { href: v })} />
                </>
              ) : (
                <p className="text-xs text-gray-400">
                  No image: the drop-down shows links only{item.sub.length ? '' : ', and with no sub-links it does not drop down at all'}.
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {value.length < MAX_MENUS && (
        <button
          type="button"
          onClick={() => onChange([...value, { label: '', href: '', sub: [], featured: { image: '', label: '', href: '' } }])}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-violet-400 hover:text-violet-600"
        >
          <Plus size={14} className="inline -mt-0.5" /> Add menu
        </button>
      )}
    </div>
  )
}

// Image + title + link cards: category tiles, gifting banners, "moments" cards
function TilesEditor({ value, onChange, max = MAX_ITEMS, imageHint, noun = 'Tile', titlePlaceholder = 'e.g. Wallets', subPlaceholder = 'Optional' }) {
  const update = (i, patch) => onChange(patchAt(value, i, patch))
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {value.map((tile, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{noun} {i + 1}</p>
            <RowControls index={i} count={value.length} onMove={(k, d) => onChange(move(value, k, d))} onRemove={(k) => onChange(value.filter((_, x) => x !== k))} removeLabel={`Remove ${noun.toLowerCase()}`} />
          </div>
          <ImageField label={`Image (${imageHint})`} value={tile.image} onChange={(v) => update(i, { image: v })} />
          <TextField label="Title" value={tile.label} onChange={(v) => update(i, { label: v })} placeholder={titlePlaceholder} />
          <TextField label="Subtitle" value={tile.sub} onChange={(v) => update(i, { sub: v })} placeholder={subPlaceholder} />
          <LinkField value={tile.href} onChange={(v) => update(i, { href: v })} />
        </div>
      ))}
      {value.length < max && (
        <button
          type="button"
          onClick={() => onChange([...value, { label: '', sub: '', href: '', image: '' }])}
          className="min-h-48 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-violet-400 hover:text-violet-600"
        >
          <Plus size={14} className="inline -mt-0.5" /> Add {noun.toLowerCase()}
        </button>
      )}
    </div>
  )
}

const HomeTilesEditor = (props) => <TilesEditor {...props} imageHint="square, 1:1" noun="Tile" />
const HomeTrendingEditor = (props) => <TilesEditor {...props} imageHint="square, 1:1" noun="Tile" titlePlaceholder="e.g. Work Essentials" />
const HomeGiftingEditor = (props) => (
  <TilesEditor {...props} max={3} imageHint="1st very wide; 2nd and 3rd portrait" noun="Banner" titlePlaceholder="e.g. For Her" subPlaceholder="Optional (1st banner only)" />
)

function HomeCommunityEditor({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <TextField label="Section title" value={value.title} onChange={(v) => set({ title: v })} placeholder="e.g. Join the Community" />
        <TextField label="Handle" value={value.handle} onChange={(v) => set({ handle: v })} placeholder="@foldx01" />
        <TextField label="Profile link (optional)" value={value.href} onChange={(v) => set({ href: v })} placeholder="https://www.instagram.com/foldx01" />
      </div>
      <TextField label="Intro text (optional)" value={value.intro ?? ''} onChange={(v) => set({ intro: v })} multiline rows={2} />
      <p className="text-xs text-gray-400">The Instagram / Facebook / YouTube cards come from Footer → Social links — add or change them there.</p>
      <div>
        <label className={labelCls}>Photos (square, up to 12)</label>
        <ImageUploader images={value.images} onChange={(images) => set({ images })} maxFiles={12} />
      </div>
    </div>
  )
}

function HomeMomentsEditor({ value, onChange }) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 max-w-md">
        <TextField label="Section title" value={value.title} onChange={(v) => onChange({ ...value, title: v })} placeholder="e.g. Made for Every Moment" />
      </div>
      <TilesEditor
        value={value.items}
        onChange={(items) => onChange({ ...value, items })}
        max={6}
        imageHint="portrait, 4:5"
        noun="Card"
        titlePlaceholder="e.g. The Daily Commute"
        subPlaceholder="e.g. Laptop bags & briefcases"
      />
    </div>
  )
}

function AnnouncementsEditor({ value, onChange }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="space-y-2">
        {value.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={a.text} onChange={(e) => onChange(patchAt(value, i, { text: e.target.value }))} placeholder="Message" maxLength={120} className={`${inputCls} flex-[3]`} />
            <input value={a.href} onChange={(e) => onChange(patchAt(value, i, { href: e.target.value }))} placeholder="Link (optional)" list="storefront-link-suggestions" className={`${inputCls} flex-[2]`} />
            <RowControls index={i} count={value.length} onMove={(k, d) => onChange(move(value, k, d))} onRemove={(k) => onChange(value.filter((_, x) => x !== k))} removeLabel="Remove message" />
          </div>
        ))}
      </div>
      {value.length < 6 && (
        <button type="button" onClick={() => onChange([...value, { text: '', href: '' }])} className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
          <Plus size={12} /> Add message
        </button>
      )}
    </div>
  )
}

function GiftStoreEditor({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 grid md:grid-cols-[260px_1fr] gap-6">
      <ImageField label="Hero image (wide, 16:9)" value={value.image} onChange={(v) => set({ image: v })} />
      <div className="space-y-4">
        <TextField label="Small heading" value={value.eyebrow} onChange={(v) => set({ eyebrow: v })} placeholder="e.g. The Gift Store" />
        <TextField label="Title (press Enter for a line break)" value={value.title} onChange={(v) => set({ title: v })} multiline rows={2} />
        <TextField label="Intro text" value={value.body} onChange={(v) => set({ body: v })} multiline rows={3} />
      </div>
    </div>
  )
}

function CategoryBannersEditor({ value, onChange }) {
  const update = (i, patch) => onChange(patchAt(value, i, patch))
  return (
    <div className="space-y-3">
      {value.map((b, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 grid md:grid-cols-[200px_1fr_auto] gap-4 items-start">
          <ImageField label="Photo (wide, about 16:9)" value={b.image} onChange={(v) => update(i, { image: v })} />
          <div className="grid sm:grid-cols-2 gap-3">
            <LinkField label="Page link" value={b.link} onChange={(v) => update(i, { link: v })} />
            <TextField label="Title" value={b.title} onChange={(v) => update(i, { title: v })} placeholder="e.g. Tote Bags" />
            <div className="sm:col-span-2">
              <TextField label="Subtitle (optional)" value={b.sub} onChange={(v) => update(i, { sub: v })} placeholder="e.g. Room for the whole day" />
            </div>
          </div>
          <RowControls index={i} count={value.length} onMove={(k, d) => onChange(move(value, k, d))} onRemove={(k) => onChange(value.filter((_, x) => x !== k))} removeLabel="Remove banner" />
        </div>
      ))}
      {value.length < 40 && (
        <button
          type="button"
          onClick={() => onChange([...value, { link: '/products?type=', title: '', sub: '', image: '' }])}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-violet-400 hover:text-violet-600"
        >
          <Plus size={14} className="inline -mt-0.5" /> Add banner
        </button>
      )}
    </div>
  )
}

// Image + copy + button: featured collection and closing banner
function BannerBlockEditor({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 grid md:grid-cols-[260px_1fr] gap-6">
      <ImageField label="Image (wide, 16:9)" value={value.image} onChange={(v) => set({ image: v })} />
      <div className="space-y-4">
        <TextField label="Small heading" value={value.eyebrow} onChange={(v) => set({ eyebrow: v })} placeholder="e.g. New Collection · 2026" />
        <TextField label="Title (press Enter for a line break)" value={value.title} onChange={(v) => set({ title: v })} multiline rows={2} />
        <TextField label="Body text" value={value.body} onChange={(v) => set({ body: v })} multiline rows={4} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Button text" value={value.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
          <LinkField label="Button link" value={value.ctaHref} onChange={(v) => set({ ctaHref: v })} />
        </div>
      </div>
    </div>
  )
}

function FooterEditor({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  const updateAt = (key, i, patch) => set({ [key]: patchAt(value[key], i, patch) })
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <TextField label="About text (under the logo)" value={value.blurb} onChange={(v) => set({ blurb: v })} multiline rows={3} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="mb-3">Shop links</h3>
        <div className="space-y-2">
          {value.shopLinks.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={l.label} onChange={(e) => updateAt('shopLinks', i, { label: e.target.value })} placeholder="Label" className={`${inputCls} flex-[2]`} />
              <input value={l.href} onChange={(e) => updateAt('shopLinks', i, { href: e.target.value })} placeholder="/products?…" list="storefront-link-suggestions" className={`${inputCls} flex-[3]`} />
              <RowControls index={i} count={value.shopLinks.length} onMove={(k, d) => set({ shopLinks: move(value.shopLinks, k, d) })} onRemove={(k) => set({ shopLinks: value.shopLinks.filter((_, x) => x !== k) })} removeLabel="Remove link" />
            </div>
          ))}
        </div>
        {value.shopLinks.length < 12 && (
          <button type="button" onClick={() => set({ shopLinks: [...value.shopLinks, { label: '', href: '' }] })} className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
            <Plus size={12} /> Add link
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="mb-3">Social links</h3>
        <div className="space-y-2">
          {value.social.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={l.label} onChange={(e) => updateAt('social', i, { label: e.target.value })} placeholder="e.g. Instagram" className={`${inputCls} flex-[2]`} />
              <input value={l.handle} onChange={(e) => updateAt('social', i, { handle: e.target.value })} placeholder="@handle" className={`${inputCls} flex-[2]`} />
              <input value={l.href} onChange={(e) => updateAt('social', i, { href: e.target.value })} placeholder="https://instagram.com/…" className={`${inputCls} flex-[3]`} />
              <RowControls index={i} count={value.social.length} onMove={(k, d) => set({ social: move(value.social, k, d) })} onRemove={(k) => set({ social: value.social.filter((_, x) => x !== k) })} removeLabel="Remove social link" />
            </div>
          ))}
        </div>
        {value.social.length < 6 && (
          <button type="button" onClick={() => set({ social: [...value.social, { label: '', handle: '', href: '' }] })} className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
            <Plus size={12} /> Add social link
          </button>
        )}
        <p className="text-xs text-gray-400 mt-2">Leave the URL blank to show the handle as plain text.</p>
      </div>
    </div>
  )
}

const EDITORS = {
  announcements: AnnouncementsEditor,
  navMenu: NavMenuEditor,
  homeTiles: HomeTilesEditor,
  homeGifting: HomeGiftingEditor,
  homeMoments: HomeMomentsEditor,
  homeEditorial: BannerBlockEditor,
  homeTrending: HomeTrendingEditor,
  homeClosing: BannerBlockEditor,
  homeCommunity: HomeCommunityEditor,
  categoryBanners: CategoryBannersEditor,
  giftStore: GiftStoreEditor,
  footer: FooterEditor,
}
const SECTION_KEYS = TABS.map((t) => t.key)
const pick = (src) => Object.fromEntries(SECTION_KEYS.map((k) => [k, src[k]]))

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StorefrontPage() {
  const { canEditCatalog } = usePermissions()
  const live = useSiteContentStore()
  const [tab, setTab] = useState('announcements')
  // One draft per section, so switching tabs doesn't lose unsaved edits
  const [drafts, setDrafts] = useState(() => pick(live))
  const [busy, setBusy] = useState(false)
  const [suggestions, setSuggestions] = useState([])

  // Pull the latest saved content once (another admin may have changed it since this browser cached it)
  useEffect(() => {
    useSiteContentStore.getState().hydrate()
      .then(() => {
        setDrafts(pick(useSiteContentStore.getState()))
      })
      .catch(() => {})
    Promise.all([getCategories().catch(() => []), getCollections().catch(() => [])]).then(([cats, cols]) => setSuggestions([
      '/products', '/products?gender=women', '/products?gender=men',
      ...cats.map((c) => `/products?category=${c.id}`),
      ...[...new Set(cats.flatMap((c) => (c.sub ?? []).map((n) => `/products?type=${toSlug(n)}`)))],
      '/products?badge=new', '/products?badge=best-seller', '/products?badge=limited-edition', '/products?badge=online-exclusive',
      '/products?sale=1',
      '/collections', ...cols.map((c) => `/collections/${c.id}`),
      '/gifts', '/gifts?for=her', '/gifts?for=him', '/gifts?for=sets', '/gifts?under=2999', '/gifts?under=4999',
      '/contact', '/journal',
    ]))
  }, [])

  const draft = drafts[tab]
  const dirty = JSON.stringify(draft) !== JSON.stringify(live[tab])
  const isDefault = JSON.stringify(live[tab]) === JSON.stringify(SITE_CONTENT_DEFAULTS[tab])
  const current = TABS.find((t) => t.key === tab)
  const Editor = EDITORS[tab]

  const handleSave = async () => {
    setBusy(true)
    try {
      const saved = await saveSiteContent(tab, draft)
      live.setSection(tab, saved)
      setDrafts((d) => ({ ...d, [tab]: saved }))
      toast.success(`${current.label} saved — live on the storefront`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    if (!confirm(`Reset the ${current.label.toLowerCase()} to the original design? Your changes to it will be lost.`)) return
    setBusy(true)
    try {
      await resetSiteContent(tab)
      live.setSection(tab, undefined)
      setDrafts((d) => ({ ...d, [tab]: SITE_CONTENT_DEFAULTS[tab] }))
      toast.success(`${current.label} reset to default`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Storefront</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Menu and homepage images, titles and links.{!canEditCatalog && ' View only for your role.'}
          </p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline">
          <ExternalLink size={14} /> View store
        </a>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
            {JSON.stringify(drafts[t.key]) !== JSON.stringify(live[t.key]) && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-violet-500 align-middle" aria-label="unsaved changes" />}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500 -mt-2">{current.desc}</p>

      <fieldset disabled={!canEditCatalog || busy} className="min-w-0">
        <Editor value={draft} onChange={(v) => setDrafts((d) => ({ ...d, [tab]: v }))} />
      </fieldset>

      <datalist id="storefront-link-suggestions">
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>

      {canEditCatalog && (
        <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3 z-30">
          <p className="mr-auto text-xs text-gray-400">
            {dirty ? 'You have unsaved changes' : isDefault ? 'Showing the original design' : 'All changes saved'}
          </p>
          {dirty && (
            <button onClick={() => setDrafts((d) => ({ ...d, [tab]: live[tab] }))} disabled={busy} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">
              Discard
            </button>
          )}
          {!isDefault && (
            <button onClick={handleReset} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50">
              <RotateCcw size={14} /> Reset to default
            </button>
          )}
          <button onClick={handleSave} disabled={busy || !dirty} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40">
            <Save size={14} /> {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
