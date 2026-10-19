const crypto = require('crypto')

// Time-based one-time passwords (RFC 6238) — what Google Authenticator,
// Microsoft Authenticator, 1Password etc. generate. 30-second steps, 6 digits,
// HMAC-SHA1 (the default every authenticator app supports).

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf) {
  let bits = ''
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]
  return out
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const ch of clean) bits += B32.indexOf(ch).toString(2).padStart(5, '0')
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

const generateSecret = () => base32Encode(crypto.randomBytes(20))

function codeAt(secret, counter) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(bin).padStart(6, '0')
}

// Accepts the current code and one step either side, to allow for phone
// clocks a little out of sync. Constant-time compare.
function verifyCode(secret, code, { window = 1, now = Date.now() } = {}) {
  const given = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(given)) return false
  const counter = Math.floor(now / 1000 / 30)
  for (let w = -window; w <= window; w++) {
    const expected = codeAt(secret, counter + w)
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return true
  }
  return false
}

function otpauthUrl(secret, account, issuer = 'FoldX Admin') {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

// ─── Encryption at rest ───────────────────────────────────────────────────────
// TOTP secrets are stored AES-256-GCM encrypted with a key derived from
// JWT_SECRET, so a leaked database alone doesn't hand out login codes.

const key = () => crypto.createHash('sha256').update(`${process.env.JWT_SECRET}:two-factor`).digest()

function encrypt(plain) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}

function decrypt(blob) {
  const [iv, tag, enc] = String(blob).split('.').map((s) => Buffer.from(s, 'base64'))
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

// Backup codes: 10 random "xxxx-xxxx" codes, shown once
function generateBackupCodes(n = 10) {
  return Array.from({ length: n }, () => {
    const raw = crypto.randomBytes(5).toString('hex').slice(0, 8)
    return `${raw.slice(0, 4)}-${raw.slice(4)}`
  })
}

module.exports = { generateSecret, verifyCode, otpauthUrl, encrypt, decrypt, generateBackupCodes, codeAt }
