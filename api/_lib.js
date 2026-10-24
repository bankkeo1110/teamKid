// Shared helpers for the KID Office online API (Vercel functions, no npm dependencies).
// Storage: Redis (Upstash REST or any Redis over TCP — see redis() below).
// Owner password (set by you in Vercel → Settings → Environment Variables): VIEW_PASSWORD
import crypto from 'node:crypto'

import net from 'node:net'
import tls from 'node:tls'

// Two ways to reach Redis, whichever the Vercel integration provided:
//   REST: KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//   TCP:  REDIS_URL / KV_URL (redis:// or rediss://), spoken with a tiny RESP client below
const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const TCPURL = process.env.REDIS_URL || process.env.KV_URL
const PASSWORD = process.env.VIEW_PASSWORD || ''
const CHAT_PASSWORD = process.env.CHAT_PASSWORD || ''

// Messaging KID from the web: on whenever the view password is set. Until CHAT_PASSWORD (12+ chars,
// different from VIEW_PASSWORD) is added, the view login also unlocks messaging.
const chatSeparate = () => CHAT_PASSWORD.length >= 12 && CHAT_PASSWORD !== PASSWORD
export const configured = () => ({ redis: Boolean((RURL && RTOK) || TCPURL), password: PASSWORD.length >= 8, chat: PASSWORD.length >= 8, chatSeparate: chatSeparate() })

export async function redis(...cmd) {
  if (RURL && RTOK) {
    const r = await fetch(RURL, { method: 'POST', headers: { authorization: `Bearer ${RTOK}`, 'content-type': 'application/json' }, body: JSON.stringify(cmd) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw Object.assign(new Error(j.error || `redis ${r.status}`), { code: 502 })
    return j.result
  }
  if (TCPURL) return tcpCommand(cmd)
  throw Object.assign(new Error('redis-missing'), { code: 503 })
}

// ---- minimal RESP client: one connection per call, AUTH (+SELECT) then the command
const enc = arr => `*${arr.length}\r\n` + arr.map(a => { const b = Buffer.from(String(a)); return `$${b.length}\r\n${b}\r\n` }).join('')
function parseOne(buf, i = 0) {
  const nl = buf.indexOf('\r\n', i); if (nl < 0) return null
  const t = String.fromCharCode(buf[i]), line = buf.toString('utf8', i + 1, nl)
  if (t === '+') return [line, nl + 2]
  if (t === '-') return [Object.assign(new Error(line), { code: 502, redis: true }), nl + 2]
  if (t === ':') return [Number(line), nl + 2]
  if (t === '$') { const n = Number(line); if (n < 0) return [null, nl + 2]; if (buf.length < nl + 2 + n + 2) return null; return [buf.toString('utf8', nl + 2, nl + 2 + n), nl + 2 + n + 2] }
  if (t === '*') { const n = Number(line); if (n < 0) return [null, nl + 2]; const out = []; let j = nl + 2; for (let k = 0; k < n; k++) { const r = parseOne(buf, j); if (!r) return null; out.push(r[0]); j = r[1] } return [out, j] }
  return [Object.assign(new Error('bad reply'), { code: 502 }), buf.length]
}
function tcpCommand(cmd) {
  const u = new URL(TCPURL)
  const pre = []
  if (u.password) pre.push(u.username && u.username !== 'default' ? ['AUTH', decodeURIComponent(u.username), decodeURIComponent(u.password)] : ['AUTH', decodeURIComponent(u.password)])
  const db = u.pathname.replace('/', ''); if (db) pre.push(['SELECT', db])
  const all = [...pre, cmd]
  return new Promise((resolve, reject) => {
    const opts = { host: u.hostname, port: Number(u.port || 6379), servername: u.hostname }
    const sock = u.protocol === 'rediss:' ? tls.connect(opts) : net.connect(opts)
    let buf = Buffer.alloc(0); const replies = []
    const done = (err, val) => { sock.destroy(); err ? reject(Object.assign(err, { code: err.code || 502 })) : resolve(val) }
    sock.setTimeout(8000, () => done(new Error('redis timeout')))
    sock.on('error', e => done(e))
    sock.on(u.protocol === 'rediss:' ? 'secureConnect' : 'connect', () => sock.write(all.map(enc).join('')))
    sock.on('data', d => {
      buf = Buffer.concat([buf, d])
      let r; while (replies.length < all.length && (r = parseOne(buf))) { replies.push(r[0]); buf = buf.subarray(r[1]) }
      if (replies.length === all.length) { const bad = replies.find(x => x instanceof Error); bad ? done(bad) : done(null, replies[replies.length - 1]) }
    })
  })
}

const sha = s => crypto.createHash('sha256').update(String(s)).digest()
export const sha256hex = s => sha(s).toString('hex')
export function samePassword(given, which = 'view') {
  const want = which === 'chat' && chatSeparate() ? CHAT_PASSWORD : PASSWORD
  if (!want) return false
  return crypto.timingSafeEqual(sha(given || ''), sha(want))
}

// session cookie: "<expiry>.<hmac>", key derived from the password + Redis token, so changing
// the password logs every browser out.
const KEY = scope => sha(`kid-office:${scope}:${PASSWORD}:${scope === 'chat' && chatSeparate() ? CHAT_PASSWORD : ''}:${RTOK || TCPURL || ''}`)
const sign = (v, scope) => crypto.createHmac('sha256', KEY(scope)).update(v).digest('base64url')
const COOKIES = { view: 'kid_session', chat: 'kid_chat' }
export function setSession(res, days = 30, scope = 'view') {
  const exp = String(Date.now() + days * 864e5)
  const prev = res.getHeader('set-cookie'); const list = prev ? [].concat(prev) : []
  list.push(`${COOKIES[scope]}=${exp}.${sign(exp, scope)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${days * 86400}`)
  res.setHeader('set-cookie', list)
}
export function clearSession(res) { res.setHeader('set-cookie', Object.values(COOKIES).map(c => `${c}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)) }
export function hasSession(req, scope = 'view') {
  if (scope === 'chat' && !chatSeparate()) return hasSession(req, 'view')
  const name = COOKIES[scope]
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='))
  if (!raw || !PASSWORD) return false
  const [exp, mac] = raw.slice(name.length + 1).split('.')
  if (!exp || !mac || Number(exp) < Date.now()) return false
  const want = sign(exp, scope)
  return mac.length === want.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))
}
export async function relayOk(req) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const want = await redis('GET', 'kid:relay')
  return Boolean(tok && want && sha256hex(tok) === want)
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
