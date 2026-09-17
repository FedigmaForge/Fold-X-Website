import { useState } from 'react'
import { Save, RotateCcw, Download, Upload } from 'lucide-react'
import useSettingsStore from '@/store/settingsStore'
import { exportData, importData, resetDemoData } from '@/services/api'
import toast from 'react-hot-toast'

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
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await settings.update(form)
      toast.success('Settings saved!')
    } catch (err) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Reset ALL demo data (products, banners, orders, reviews) to defaults?')) return
    await resetDemoData()
    toast.success('Store data reset to defaults')
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
        <p className="text-sm text-gray-400 mt-1">Configure your store settings. Changes save instantly to local storage.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
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
          <Field label="Announcement Bar Text" hint="Shown in the top bar on all pages. Separate items with ·">
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
          <Field label="Free Shipping Threshold (₹)" hint="Orders above this amount get free shipping.">
            <input
              type="number"
              min="0"
              value={form.freeShippingThreshold}
              onChange={(e) => set('freeShippingThreshold', Number(e.target.value))}
              className={inputCls}
            />
          </Field>
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

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <Save size={15} /> {saving ? 'Saving…' : 'Save Settings'}
        </button>
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

          <label className="flex items-center gap-2 border border-gray-200 hover:border-violet-400 text-gray-600 hover:text-violet-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer">
            <Upload size={15} /> Import Data (JSON)
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>

          <button
            onClick={handleReset}
            className="flex items-center gap-2 border border-red-200 hover:border-red-400 text-red-500 hover:text-red-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <RotateCcw size={15} /> Reset to Demo Data
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Export saves everything to a JSON file you can re-import later. Reset replaces all current data with the original demo data.
        </p>
      </Section>
    </div>
  )
}
