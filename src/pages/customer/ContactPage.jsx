import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, CheckCircle } from 'lucide-react'
import { sendContactMessage } from '@/services/api'
import useSettingsStore from '@/store/settingsStore'
import useAuthStore from '@/store/authStore'
import useDocumentMeta from '@/utils/useDocumentMeta'
import toast from 'react-hot-toast'

const SUBJECTS = ['Order question', 'Returns & refunds', 'Product question', 'Feedback', 'Other']

export default function ContactPage() {
  const { storeName, supportEmail, supportPhone, address, gstin } = useSettingsStore()
  const user = useAuthStore((s) => s.user)
  const [form, setForm] = useState({
    name: user?.name ?? '', email: user?.email ?? '', phone: '', orderId: '', subject: SUBJECTS[0], message: '', website: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useDocumentMeta(`Contact Us | ${storeName}`, `Questions about an order, a product or a return? Get in touch with ${storeName}.`)

  const submit = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      await sendContactMessage(form)
      setSent(true)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-14">
      <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">We're here to help</p>
      <h1 className="font-serif text-4xl lg:text-5xl text-brown font-light mb-10">Contact Us</h1>

      <div className="grid lg:grid-cols-[1fr_300px] gap-12">
        {sent ? (
          <div className="panel-brand p-10 text-center">
            <CheckCircle size={32} strokeWidth={1.2} className="mx-auto text-brown mb-4" />
            <p className="font-serif text-2xl text-brown font-light mb-2">Thank you, {form.name.split(' ')[0]}</p>
            <p className="text-sm font-sans font-light text-brown-mid">We've received your message and will reply to {form.email} within one working day.</p>
            <Link to="/products" className="btn-brand-secondary inline-block mt-8">Continue shopping</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-brand">Name *</label>
                <input required value={form.name} onChange={set('name')} className="input-brand" autoComplete="name" />
              </div>
              <div>
                <label className="label-brand">Email *</label>
                <input required type="email" value={form.email} onChange={set('email')} className="input-brand" autoComplete="email" />
              </div>
              <div>
                <label className="label-brand">Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')} className="input-brand" autoComplete="tel" />
              </div>
              <div>
                <label className="label-brand">Order number</label>
                <input value={form.orderId} onChange={set('orderId')} placeholder="If it's about an order" className="input-brand" />
              </div>
            </div>
            <div>
              <label className="label-brand">Subject</label>
              <select value={form.subject} onChange={set('subject')} className="input-brand">
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label-brand">Message *</label>
              <textarea required minLength={10} rows={6} value={form.message} onChange={set('message')} className="input-brand resize-none" />
            </div>
            {/* Honeypot — hidden from people, often filled in by spam bots */}
            <div className="hidden" aria-hidden="true">
              <label>Website <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
            </div>
            <button type="submit" disabled={sending} className="btn-brand-primary w-full sm:w-auto">
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}

        <aside className="space-y-6 text-sm font-sans font-light text-brown-mid">
          <p>For returns, you can also request one directly from <Link to="/account" className="text-brown underline underline-offset-2">My Orders</Link> once your order has been delivered.</p>
          {supportEmail && (
            <a href={`mailto:${supportEmail}`} className="flex items-start gap-3 hover:text-brown"><Mail size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" /> {supportEmail}</a>
          )}
          {supportPhone && (
            <a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`} className="flex items-start gap-3 hover:text-brown"><Phone size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" /> {supportPhone}</a>
          )}
          {address && <p className="flex items-start gap-3"><MapPin size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" /> {address}</p>}
          {gstin && <p className="pl-7 text-xs tracking-wide">GSTIN: {gstin}</p>}
        </aside>
      </div>
    </div>
  )
}
