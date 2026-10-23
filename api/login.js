// POST {password} → session cookie. Ten wrong tries from one IP lock it out for 15 minutes.
import { send, body, samePassword, setSession, redis, ip, configured, fail } from './_lib.js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST' })
  if (!configured().password) return send(res, 503, { error: 'Chưa đặt VIEW_PASSWORD (ít nhất 8 ký tự) trên Vercel.' })
  try {
    const key = `kid:loginfail:${ip(req)}`
    const fails = configured().redis ? Number(await redis('GET', key) || 0) : 0
    if (fails >= 10) return send(res, 429, { error: 'Sai mật khẩu quá nhiều lần. Thử lại sau 15 phút.' })
    const { password } = await body(req)
    if (!samePassword(password)) {
      if (configured().redis) { await redis('INCR', key); await redis('EXPIRE', key, 900) }
      return send(res, 401, { error: 'Sai mật khẩu.' })
    }
    setSession(res)
    return send(res, 200, { ok: true })
  } catch (e) { return fail(res, e) }
}
