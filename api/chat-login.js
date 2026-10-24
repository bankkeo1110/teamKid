// POST {password} → unlocks messaging KID from the web. Needs the view login first, and its own
// password (CHAT_PASSWORD, 12+ characters, different from VIEW_PASSWORD). Without CHAT_PASSWORD the
// view login already unlocks messaging, and this endpoint just says so.
import { send, body, samePassword, setSession, hasSession, redis, ip, configured, fail } from './_lib.js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST' })
  if (!hasSession(req)) return send(res, 401, { error: 'login' })
  if (!configured().chatSeparate) return send(res, 200, { ok: true, shared: true })
  try {
    const key = `kid:chatfail:${ip(req)}`
    if (Number(await redis('GET', key) || 0) >= 5) return send(res, 429, { error: 'Sai mật khẩu nhắn tin quá nhiều lần. Thử lại sau 30 phút.' })
    const { password } = await body(req)
    if (!samePassword(password, 'chat')) { await redis('INCR', key); await redis('EXPIRE', key, 1800); return send(res, 401, { error: 'Sai mật khẩu nhắn tin.' }) }
    setSession(res, 7, 'chat')
    send(res, 200, { ok: true })
  } catch (e) { return fail(res, e) }
}
