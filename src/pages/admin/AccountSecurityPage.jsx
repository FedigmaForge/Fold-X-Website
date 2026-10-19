import { useState, useEffect } from 'react'
import { ShieldCheck, ShieldAlert, Smartphone, KeyRound, CheckCircle2, XCircle } from 'lucide-react'
import { getMyAccount, start2faSetup, enable2fa, disable2fa, regenerateBackupCodes } from '@/services/api'
import { BackupCodesList } from '@/pages/admin/AdminLoginPage'
import toast from 'react-hot-toast'

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 bg-white'
const codeInput = (value, set) => (
  <input value={value} onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={`${inputCls} font-mono tracking-[0.3em] text-center`} />
)
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// Short device description from a user-agent string
function device(ua) {
  if (!ua) return 'Unknown device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return [browser, os].filter(Boolean).join(' on ')
}

export default function AccountSecurityPage() {
  const [account, setAccount] = useState(null)
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [backupCodes, setBackupCodes] = useState(null)
  const [mode, setMode] = useState(null) // null | 'disable' | 'regenerate'
  const [busy, setBusy] = useState(false)

  const load = () => getMyAccount().then(setAccount).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (!account) return <div className="h-48 bg-gray-200 animate-pulse rounded-2xl" />

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My account</h1>
        <p className="text-sm text-gray-400 mt-0.5">{account.user.name} · {account.user.email}</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-start gap-3">
          {account.twoFactorEnabled ? <ShieldCheck size={22} className="text-green-600 shrink-0" /> : <ShieldAlert size={22} className="text-amber-600 shrink-0" />}
          <div className="flex-1">
            <h2>Two-step login</h2>
            <p className="text-sm text-gray-500 mt-1">
              {account.twoFactorEnabled
                ? `On. Signing in needs your password and a code from your authenticator app. ${account.backupCodesRemaining} backup code${account.backupCodesRemaining === 1 ? '' : 's'} left.`
                : 'Off. Anyone with your password can sign in. Turn it on so a stolen password isn’t enough.'}
              {account.require2FA && ' Required for all FoldX staff.'}
            </p>
          </div>
        </div>

        {backupCodes && (
          <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
            <p className="text-sm text-gray-800 font-medium">Save these backup codes — they won't be shown again.</p>
            <p className="text-xs text-gray-500">Each one signs you in once if you lose your phone.</p>
            <BackupCodesList codes={backupCodes} />
            <button onClick={() => setBackupCodes(null)} className="text-sm text-violet-600 hover:underline">I've saved them</button>
          </div>
        )}

        {!account.twoFactorEnabled && !setup && (
          <button onClick={() => run(async () => setSetup(await start2faSetup()))} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            <Smartphone size={15} /> Turn on two-step login
          </button>
        )}

        {setup && !account.twoFactorEnabled && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                const res = await enable2fa(code)
                setBackupCodes(res.backupCodes); setSetup(null); setCode('')
                toast.success('Two-step login is on')
                load()
              })
            }}
            className="grid sm:grid-cols-[200px_1fr] gap-5 border-t border-gray-50 pt-4"
          >
            <div className="text-center">
              <img src={setup.qr} alt="QR code for your authenticator app" className="w-44 h-44 mx-auto border border-gray-200 rounded-xl p-2 bg-white" />
              <p className="text-[11px] text-gray-400 mt-2">Can't scan? Key: <span className="font-mono text-gray-700 break-all">{setup.secret.match(/.{1,4}/g).join(' ')}</span></p>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p>1. Open Google Authenticator, Microsoft Authenticator or 1Password on your phone.</p>
              <p>2. Add an account and scan the QR code.</p>
              <p>3. Enter the 6-digit code it shows:</p>
              {codeInput(code, setCode)}
              <div className="flex gap-2">
                <button type="submit" disabled={busy || code.length !== 6} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50">Confirm</button>
                <button type="button" onClick={() => { setSetup(null); setCode('') }} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancel</button>
              </div>
            </div>
          </form>
        )}

        {account.twoFactorEnabled && !mode && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMode('regenerate')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-violet-400"><KeyRound size={14} /> New backup codes</button>
            {!account.require2FA && (
              <button onClick={() => setMode('disable')} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-red-300 hover:text-red-600">Turn off</button>
            )}
          </div>
        )}

        {mode && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                if (mode === 'regenerate') {
                  setBackupCodes((await regenerateBackupCodes(code)).backupCodes)
                  toast.success('New backup codes created — the old ones no longer work')
                } else {
                  await disable2fa(password, code)
                  toast.success('Two-step login is off')
                }
                setMode(null); setCode(''); setPassword('')
                load()
              })
            }}
            className="space-y-3 border-t border-gray-50 pt-4 max-w-sm"
          >
            <p className="text-sm text-gray-600">{mode === 'disable' ? 'Confirm with your password and a current code.' : 'Enter a current code from your app. Your old backup codes will stop working.'}</p>
            {mode === 'disable' && <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" className={inputCls} />}
            {codeInput(code, setCode)}
            <div className="flex gap-2">
              <button type="submit" disabled={busy || code.length !== 6} className={`px-4 py-2 rounded-xl text-white text-sm disabled:opacity-50 ${mode === 'disable' ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'}`}>
                {mode === 'disable' ? 'Turn off two-step login' : 'Create new codes'}
              </button>
              <button type="button" onClick={() => { setMode(null); setCode(''); setPassword('') }} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="mb-1">Recent sign-ins</h2>
        <p className="text-xs text-gray-400 mb-4">If you see a sign-in you don't recognise, change your password and tell the Super Admin.</p>
        {account.logins.length === 0 ? <p className="text-sm text-gray-400">No sign-ins recorded yet.</p> : (
          <ul className="divide-y divide-gray-50">
            {account.logins.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                {l.success ? <CheckCircle2 size={15} className="text-green-600 shrink-0" /> : <XCircle size={15} className="text-red-500 shrink-0" />}
                <span className="flex-1 text-gray-700">{device(l.userAgent)} <span className="text-gray-400">· {l.ip || 'unknown IP'}</span></span>
                <span className={`text-xs ${l.success ? 'text-gray-500' : 'text-red-600'}`}>{l.reason}</span>
                <span className="text-xs text-gray-400 w-28 text-right">{when(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
