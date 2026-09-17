import { useState, useEffect } from 'react'
import { ShieldCheck, Plus, Ban, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { formatDate } from '@/utils/formatDate'
import { getStaff, createStaff, updateStaff } from '@/services/api'
import useAuthStore from '@/store/authStore'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'support',    label: 'Support',    desc: 'Orders & customers, moderate reviews' },
  { value: 'manager',    label: 'Manager',     desc: 'Everything except staff & activity log' },
  { value: 'superadmin', label: 'Super Admin', desc: 'Full access, including staff management' },
]

const ROLE_BADGE = {
  support: 'bg-blue-100 text-blue-700',
  manager: 'bg-violet-100 text-violet-700',
  superadmin: 'bg-amber-100 text-amber-700',
}

function InviteForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'support' })
  const [submitting, setSubmitting] = useState(false)

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const staff = await createStaff(form)
      toast.success(`${staff.name} added as ${ROLES.find((r) => r.value === staff.role)?.label}`)
      onCreated(staff)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to add staff member')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Full Name</label>
        <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
        <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Temporary Password</label>
        <input required type="password" minLength={6} value={form.password} onChange={(e) => set('password', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-2 block">Role</label>
        <div className="space-y-2">
          {ROLES.map((r) => (
            <label key={r.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.role === r.value ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => set('role', r.value)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-gray-800">{r.label}</span>
                <span className="block text-xs text-gray-400">{r.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-60"
      >
        {submitting ? 'Adding…' : 'Add Staff Member'}
      </button>
    </form>
  )
}

export default function StaffPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    if (currentUser?.role !== 'superadmin') return
    getStaff().then((s) => { setStaff(s); setLoading(false) }).catch(() => setLoading(false))
  }, [currentUser])

  if (currentUser?.role !== 'superadmin') {
    return (
      <div className="text-center py-20">
        <ShieldCheck size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">Only Super Admins can manage staff.</p>
      </div>
    )
  }

  const handleRoleChange = async (member, role) => {
    setUpdatingId(member.id)
    try {
      const updated = await updateStaff(member.id, { role })
      setStaff((s) => s.map((m) => (m.id === member.id ? updated : m)))
      toast.success(`${updated.name} is now ${ROLES.find((r) => r.value === role)?.label}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update role')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleToggleActive = async (member) => {
    setUpdatingId(member.id)
    try {
      const updated = await updateStaff(member.id, { isActive: !member.isActive })
      setStaff((s) => s.map((m) => (m.id === member.id ? updated : m)))
      toast.success(updated.isActive ? `${updated.name} reactivated` : `${updated.name} deactivated`)
    } catch (err) {
      toast.error(err.message || 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-400 mt-0.5">{staff.length} admin accounts</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Add Staff
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-400 tracking-wider">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Joined</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-4"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
                ))
              ) : staff.map((m) => {
                const isSelf = m.id === currentUser.id
                return (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800">{m.name} {isSelf && <span className="text-xs text-gray-400">(you)</span>}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={m.role}
                        disabled={isSelf || updatingId === m.id}
                        onChange={(e) => handleRoleChange(m, e.target.value)}
                        className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 outline-none disabled:opacity-60 ${ROLE_BADGE[m.role]}`}
                      >
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(m.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {m.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => handleToggleActive(m)}
                          disabled={updatingId === m.id}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${m.isActive ? 'hover:bg-red-100 text-red-500' : 'hover:bg-green-100 text-green-600'}`}
                          aria-label={m.isActive ? 'Deactivate' : 'Reactivate'}
                        >
                          {m.isActive ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title="Add Staff Member" size="sm">
        <InviteForm onClose={() => setInviteOpen(false)} onCreated={(s) => setStaff((prev) => [...prev, s])} />
      </Modal>
    </div>
  )
}
