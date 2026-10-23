// Shared helpers for the KID Office online API (Vercel functions, no npm dependencies).
// Storage: Upstash Redis over REST. Env (set by the Vercel ↔ Upstash integration):
//   KV_REST_API_URL + KV_REST_API_TOKEN   or   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// Owner password (set by you in Vercel → Settings → Environment Variables): VIEW_PASSWORD
import crypto from 'node:crypto'

const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const PASSWORD = process.env.VIEW_PASSWORD || ''

export const configured = () => ({ redis: Boolean(RURL && RTOK), password: PASSWORD.length >= 8 })

export async function redis(...cmd) {
  if (!RURL || !RTOK) throw Object.assign(new Error('redis-missing'), { code: 503 })
  const r = await fetch(RURL, { method: 'POST', headers: { authorization: `Bearer ${RTOK}`, 'content-type': 'application/json' }, body: JSON.stringify(cmd) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw Object.assign(new Error(j.error || `redis ${r.status}`), { code: 502 })
  return j.result
}

const sha = s => crypto.createHash('sha256').update(String(s)).digest()
export const sha256hex = s => sha(s).toString('hex')
export function samePassword(given) {
  if (!PASSWORD) return false
  return crypto.timingSafeEqual(sha(given || ''), sha(PASSWORD))
}

// session cookie: "<expiry>.<hmac>", key derived from the password + Redis token, so changing
// the password logs every browser out.
const KEY = () => sha(`kid-office:${PASSWORD}:${RTOK || ''}`)
const sign = v => crypto.createHmac('sha256', KEY()).update(v).digest('base64url')
const COOKIE = 'kid_session'
export function setSession(res, days = 30) {
  const exp = String(Date.now() + days * 864e5)
  res.setHeader('set-cookie', `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${days * 86400}`)
}
export function clearSession(res) { res.setHeader('set-cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`) }
export function hasSession(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))
  if (!raw || !PASSWORD) return false
  const [exp, mac] = raw.slice(COOKIE.length + 1).split('.')
  if (!exp || !mac || Number(exp) < Date.now()) return false
  const want = sign(exp)
  return mac.length === want.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))
}

export function send(res, code, body) {
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}
export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  let s = ''; for await (const c of req) { s += c; if (s.length > 3e6) break }
  try { return JSON.parse(s) } catch { return {} }
}
export const ip = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
export const safeProject = p => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(p || '') ? p : null
export function fail(res, e) {
  if (e?.code === 503) return send(res, 503, { error: 'Chưa nối Redis. Thêm Upstash Redis cho project trên Vercel.' })
  return send(res, e?.code || 500, { error: 'Lỗi máy chủ.' })
}
