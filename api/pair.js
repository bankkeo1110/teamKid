// POST {password, secretHash} from `kid-online connect` on the owner's machine.
// Stores only the hash of the relay secret; the secret itself never leaves the machine.
import { send, body, samePassword, redis, ip, configured, fail } from './_lib.js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST' })
  const cfg = configured()
  if (!cfg.password) return send(res, 503, { error: 'Chưa đặt VIEW_PASSWORD (ít nhất 8 ký tự) trên Vercel.' })
  if (!cfg.redis) return send(res, 503, { error: 'Chưa nối Upstash Redis cho project trên Vercel.' })
  try {
    const key = `kid:loginfail:${ip(req)}`
    if (Number(await redis('GET', key) || 0) >= 10) return send(res, 429, { error: 'Sai mật khẩu quá nhiều lần. Thử lại sau 15 phút.' })
    const { password, secretHash } = await body(req)
    if (!samePassword(password)) { await redis('INCR', key); await redis('EXPIRE', key, 900); return send(res, 401, { error: 'Sai mật khẩu.' }) }
    if (!/^[a-f0-9]{64}$/.test(secretHash || '')) return send(res, 400, { error: 'Mã ghép nối không hợp lệ.' })
    await redis('SET', 'kid:relay', secretHash)
    send(res, 200, { ok: true })
  } catch (e) { return fail(res, e) }
}
