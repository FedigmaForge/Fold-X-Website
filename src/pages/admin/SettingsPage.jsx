import { useState, useEffect } from 'react'
import { Save, RotateCcw, Download, Upload } from 'lucide-react'
import useSettingsStore from '@/store/settingsStore'
import { exportData, importData, resetDemoData, getAdminSettings } from '@/services/api'
import { INDIAN_STATES } from '@/data/indianStates'
import toast from 'react-hot-toast'
import { usePermissions } from '@/utils/permissions'

function Section({ title, desc, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 bg-white'

export default function SettingsPage() {
  const settings = useSettingsStore()
  const [form, setForm] = useState({ ...settings })
  // The form is filled from the admin endpoint: the public settings leave out
  // the Razorpay key and registered names, so saving before this loads would blank them
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAdminSettings()
      .then((full) => { setForm((f) => ({ ...f, ...full })); setLoaded(true) })
      .catch((err) => toast.error(err.message || 'Could not load settings'))
  }, [])
  const { canEditCatalog, isSuperAdmin } = usePermissions()

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!loaded) return
    setSaving(true)
    try {
      const saved = await settings.update(form)
      setForm((f) => ({ ...f, ...saved }))
      toast.success('Settings saved!')
    } catch (err) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Reset ALL demo data (products, banners, orders, reviews) to defaults?')) return
    try {
      await resetDemoData()
      toast.success('Store data reset to defaults')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleExport = async () => {
    const data = await exportData()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `foldx-data-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported!')
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        const result = await importData(data)
        toast.success(
          `Imported: ${Object.entries(result.imported).filter(([, v]) => v).map(([k]) => k).join(', ') || 'nothing'}. ` +
          `Orders/customers are never reimported (see development.md).`
        )
      } catch (err) {
        toast.error(err.message || 'Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Configure your store settings. Changes go live on the storefront when you save.</p>
      </div>

      {!canEditCatalog && (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-4 py-3">
          You can view these settings, but only a Manager or Super Admin can change them.
        </p>
      )}

      <form onSubmit={handleSave}>
        {/* A disabled fieldset makes every field inside read-only in one go */}
        <fieldset disabled={!canEditCatalog} className="space-y-5 min-w-0">
        {/* Store Info */}
        <Section title="Store Information" desc="These values appear on the customer-facing site.">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Store Name">
              <input value={form.storeName} onChange={(e) => set('storeName', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Tagline">
              <input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Announcement Bar Text" hint="Fallback only: the top bar shows the rotating messages from Storefront → Announcement bar, and this text only when that list is empty.">
            <input value={form.announcementBar} onChange={(e) => set('announcementBar', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Instagram Handle">
            <input value={form.instagramHandle} onChange={(e) => set('instagramHandle', e.target.value)} className={inputCls} placeholder="@yourbrand" />
          </Field>
        </Section>

        {/* Contact & Shipping */}
        <Section title="Contact & Shipping">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Support Email">
              <input type="email" value={form.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Support Phone">
              <input value={form.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Store Address">
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Legal Name" hint="For your records only — the website and invoices show just the store name (FoldX).">
              <input value={form.legalName ?? ''} onChange={(e) => set('legalName', e.target.value)} className={inputCls} placeholder="e.g. NITIN KAPOOR" />
            </Field>
            <Field label="GSTIN" hint="15-character GST number, printed on invoices.">
              <input
                value={form.gstin ?? ''}
                onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                maxLength={15}
                placeholder="22AAAAA0000A1Z5"
                className={`${inputCls} font-mono`}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Trade Name" hint="For your records only — not shown on the website or invoices.">
              <input value={form.tradeName ?? ''} onChange={(e) => set('tradeName', e.target.value)} className={inputCls} placeholder="e.g. M/s KAPSONS ENTERPRISES" />
            </Field>
            <Field label="Constitution of Business" hint="For your records only.">
              <select value={form.businessType ?? ''} onChange={(e) => set('businessType', e.target.value)} className={inputCls}>
                <option value="">Not set</option>
                {['Proprietorship', 'Partnership', 'Limited Liability Partnership', 'Private Limited Company', 'Public Limited Company', 'Hindu Undivided Family'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Store State" hint="Same state as customer → CGST + SGST, else IGST.">
              <select value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} className={inputCls}>
                <option value="">Not set</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Default HSN Code" hint="Used when a product has none.">
              <input
                value={form.defaultHsnCode ?? ''}
                onChange={(e) => set('defaultHsnCode', e.target.value.replace(/\D/g, '').slice(0, 8))}
                inputMode="numeric"
                className={`${inputCls} font-mono`}
              />
            </Field>
            <Field label="Default GST Rate (%)" hint="Used when a product has none.">
              <select value={form.defaultGstRate ?? 18} onChange={(e) => set('defaultGstRate', Number(e.target.value))} className={inputCls}>
                {[0, 3, 5, 12, 18, 28, 40].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </Field>
          </div>
          <Field label="Free Shipping Threshold (₹)" hint="Orders above this amount get free shipping.">
            <input
              type="number"
              min="0"
              value={form.freeShippingThreshold}
              onChange={(e) => set('freeShippingThreshold', Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Shipping Fee (₹)" hint="Charged below the free-shipping threshold.">
              <input type="number" min="0" value={form.flatShippingFee ?? 99} onChange={(e) => set('flatShippingFee', Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Gift Wrap Fee (₹)">
              <input type="number" min="0" value={form.giftWrapFee ?? 149} onChange={(e) => set('giftWrapFee', Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Shipping Cost Per Order (₹)" hint="What a courier charges you, on average — for Finance → Profit.">
              <input type="number" min="0" step="1" value={form.shippingCostPerOrder ?? 0} onChange={(e) => set('shippingCostPerOrder', Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Return Window (days)" hint="After delivery, for return requests.">
              <input type="number" min="0" step="1" value={form.returnWindowDays ?? 10} onChange={(e) => set('returnWindowDays', Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Free customisation */}
        <Section title="Free Customisation" desc="Shoppers can ask for any bag in a different leather at no extra charge. Their choice shows on the order, the invoice and in My Orders. Turn it off per product in the product form.">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.customisationEnabled ?? true} onChange={(e) => set('customisationEnabled', e.target.checked)} />
            Offer free leather customisation on product pages
          </label>
          <Field label="Leathers offered" hint="Separate with commas, up to 12. The bag's own material is hidden from its list.">
            <textarea rows={2} value={form.customLeathers ?? ''} onChange={(e) => set('customLeathers', e.target.value)} className={`${inputCls} resize-none`} />
          </Field>
          <Field label="Note shown when a leather is chosen" hint="E.g. the extra making time. Also shown on the order confirmation.">
            <input value={form.customisationNote ?? ''} maxLength={200} onChange={(e) => set('customisationNote', e.target.value)} className={inputCls} />
          </Field>
        </Section>

        {/* Cash on delivery */}
        <Section title="Cash on Delivery" desc="Every COD order waits for staff to confirm it with the customer before it's packed.">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.codEnabled ?? true} onChange={(e) => set('codEnabled', e.target.checked)} />
            Offer cash on delivery at checkout
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Field label="COD Fee (₹)" hint="Added to COD orders. 0 for none.">
              <input type="number" min="0" step="1" value={form.codFee ?? 49} onChange={(e) => set('codFee', Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Maximum COD Order (₹)" hint="COD is hidden for bigger orders.">
              <input type="number" min="0" step="1" value={form.codMaxOrder ?? 15000} onChange={(e) => set('codMaxOrder', Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Refusals Before COD Stops" hint="Parcels a customer can refuse before they must pay online.">
              <input type="number" min="1" step="1" value={form.codMaxRefusals ?? 2} onChange={(e) => set('codMaxRefusals', Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Open COD Orders Per Customer" hint="Unconfirmed or undelivered COD orders allowed at once.">
              <input type="number" min="1" step="1" value={form.codMaxOpen ?? 2} onChange={(e) => set('codMaxOpen', Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Payments */}
        <Section title="Razorpay" desc="Enter your Razorpay Key ID to enable live payments.">
          <Field label="Razorpay Key ID" hint="Starts with rzp_live_ or rzp_test_. Set this in your .env as VITE_RAZORPAY_KEY_ID for production.">
            <input
              value={form.razorpayKeyId}
              onChange={(e) => set('razorpayKeyId', e.target.value)}
              placeholder="rzp_test_xxxxxxxxxxxx"
              className={`${inputCls} font-mono text-xs`}
            />
          </Field>
        </Section>

        {canEditCatalog && <button
          type="submit"
          disabled={saving || !loaded}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <Save size={15} /> {saving ? 'Saving…' : 'Save Settings'}
        </button>}
        </fieldset>
      </form>

      {/* Data Management */}
      <Section title="Data Management" desc="Import or export all store data as JSON, or reset to demo defaults.">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 border border-gray-200 hover:border-violet-400 text-gray-600 hover:text-violet-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Download size={15} /> Export Data (JSON)
          </button>

          {canEditCatalog && <label className="flex items-center gap-2 border border-gray-200 hover:border-violet-400 text-gray-600 hover:text-violet-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer">
            <Upload size={15} /> Import Data (JSON)
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>}

          {isSuperAdmin && <button
            onClick={handleReset}
            className="flex items-center gap-2 border border-red-200 hover:border-red-400 text-red-500 hover:text-red-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <RotateCcw size={15} /> Reset to Demo Data
          </button>}
        </div>
        <p className="text-xs text-gray-400">
          Export saves everything to a JSON file you can re-import later. Reset replaces all current data with the original demo data.
        </p>
      </Section>
    </div>
  )
}
