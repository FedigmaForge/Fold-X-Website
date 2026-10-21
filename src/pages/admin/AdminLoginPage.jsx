import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Copy, Download } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import { verifyAdmin2fa, startForced2faSetup, finishForced2faSetup } from '@/services/api'
import toast, { Toaster } from 'react-hot-toast'

// Demo credentials are only filled in on a dev build — never on the live site
const DEV = import.meta.env.DEV
const label = 'text-[10px] uppercase tracking-[0.2em] text-brown-mid mb-1.5 block'

export function BackupCodesList({ codes }) {
  const text = codes.join('\n')
  const download = () => {
    const url = URL.createObjectURL(new Blob([`FoldX Admin — backup codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'foldx-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-sm text-brown bg-white border border-border p-4">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="flex gap-3 mt-2 text-xs">
        <button type="button" onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'))} className="inline-flex items-center gap-1 text-brown-mid hover:text-brown"><Copy size={12} /> Copy</button>
        <button type="button" onClick={download} className="inline-flex items-center gap-1 text-brown-mid hover:text-brown"><Download size={12} /> Download</button>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState(DEV ? 'admin@foldx.com' : '')
  const [password, setPassword] = useState(DEV ? 'admin123' : '')
  const [loading, setLoading] = useState(false)
  // password → code (has two-step login) | setup (must set it up) → backup (show codes once)
  const [step, setStep] = useState('password')
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [setup, setSetup] = useState(null)
  const [pendingSession, setPendingSession] = useState(null)
  const { adminLogin, setAdminSession, isAdmin } = useAuthStore()
  const navigate = useNavigate()

  if (isAdmin && step !== 'backup') return <Navigate to="/admin/dashboard" replace />

  const done = () => {
    toast.success('Welcome back!')
    navigate('/admin/dashboard')
  }

  const run = async (fn) => {
    setLoading(true)
    try {
      await fn()
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
      // An expired or over-used challenge means starting again
      if (/sign in again|enter your password again|Invalid sign-in/.test(err.message ?? '')) {
        setStep('password'); setCode(''); setChallenge(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const submitPassword = (e) => {
    e.preventDefault()
    run(async () => {
      const next = await adminLogin(email, password)
      if (!next) return done()
      setChallenge(next.challenge)
      setStep(next.step)
      if (next.step === 'setup') setSetup(await startForced2faSetup(next.challenge))
    })
  }

  const submitCode = (e) => {
    e.preventDefault()
    run(async () => {
      setAdminSession(await verifyAdmin2fa(challenge, code))
      done()
    })
  }

  const submitSetup = (e) => {
    e.preventDefault()
    run(async () => {
      const res = await finishForced2faSetup(challenge, code)
      setPendingSession(res)
      setStep('backup')
    })
  }

  return (
    <div className="admin-theme min-h-screen bg-brown flex items-center justify-center p-4">
      {/* Outside AdminLayout, so it needs its own — shows login errors and "session expired" */}
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: '2px', fontSize: '14px', color: '#2C1810' } }} />
      <div className={`w-full ${step === 'setup' || step === 'backup' ? 'max-w-md' : 'max-w-sm'} bg-cream p-10 shadow-2xl`}>
        <div className="text-center mb-8">
          <p className="font-serif text-3xl tracking-[0.3em] text-brown font-light">FOLDX</p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="h-px w-8 bg-gold" />
            <span className="text-[10px] uppercase tracking-[0.35em] text-brown-mid">Atelier Admin</span>
            <span className="h-px w-8 bg-gold" />
          </div>
        </div>

        {step === 'password' && (
          <form onSubmit={submitPassword} className="space-y-5">
            <div>
              <label className={label}>Email</label>
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="input-brand bg-white" />
            </div>
            <div>
              <label className={label}>Password</label>
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-brand bg-white" />
            </div>
            <button type="submit" disabled={loading} className="btn-brand-primary w-full mt-2">{loading ? 'Signing in…' : 'Sign In'}</button>
            {DEV && <p className="text-[11px] text-brown-mid text-center">Dev only — default: admin@foldx.com / admin123</p>}
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={submitCode} className="space-y-5">
            <p className="text-sm text-brown-mid text-center">
              {useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
            </p>
            <input
              autoFocus
              required
              inputMode={useBackup ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(useBackup ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={useBackup ? 'xxxx-xxxx' : '123456'}
              className="input-brand bg-white text-center text-xl tracking-[0.4em] font-mono"
            />
            <button type="submit" disabled={loading || (!useBackup && code.length !== 6)} className="btn-brand-primary w-full">{loading ? 'Checking…' : 'Verify'}</button>
            <div className="flex justify-between text-[11px] text-brown-mid">
              <button type="button" onClick={() => { setUseBackup((v) => !v); setCode('') }} className="hover:text-brown underline underline-offset-2">
                {useBackup ? 'Use authenticator code' : 'Lost your phone? Use a backup code'}
              </button>
              <button type="button" onClick={() => { setStep('password'); setCode('') }} className="hover:text-brown">Back</button>
            </div>
          </form>
        )}

        {step === 'setup' && (
          <form onSubmit={submitSetup} className="space-y-5">
            <div className="text-sm text-brown-mid space-y-2">
              <p className="text-brown">Two-step login is required for FoldX staff.</p>
              <p>1. Install an authenticator app (Google Authenticator, Microsoft Authenticator or 1Password).</p>
              <p>2. Scan this QR code in the app.</p>
            </div>
            {setup ? (
              <div className="text-center">
                <img src={setup.qr} alt="QR code for your authenticator app" className="mx-auto w-44 h-44 bg-white p-2 border border-border" />
                <p className="text-[11px] text-brown-mid mt-2">Can't scan? Enter this key: <span className="font-mono text-brown break-all">{setup.secret.match(/.{1,4}/g).join(' ')}</span></p>
              </div>
            ) : <div className="h-44 bg-cream-dark animate-pulse" />}
            <div>
              <label className={label}>3. Enter the 6-digit code it shows</label>
              <input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" className="input-brand bg-white text-center text-xl tracking-[0.4em] font-mono" />
            </div>
            <button type="submit" disabled={loading || code.length !== 6} className="btn-brand-primary w-full">{loading ? 'Checking…' : 'Turn on two-step login'}</button>
          </form>
        )}

        {step === 'backup' && pendingSession && (
          <div className="space-y-5">
            <p className="text-sm text-brown">Two-step login is on. Save these backup codes somewhere safe.</p>
            <p className="text-xs text-brown-mid">If you lose your phone, each code lets you sign in once. They won't be shown again.</p>
            <BackupCodesList codes={pendingSession.backupCodes} />
            <button
              type="button"
              onClick={() => { setAdminSession(pendingSession); done() }}
              className="btn-brand-primary w-full"
            >
              I've saved them — continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
