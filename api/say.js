// POST {project, text} from the owner's browser → the shared inbox in Redis. The owner's machine
// collects it (api/inbox) and types it into KID's pane. 30 messages per hour, 2000 characters each.
import crypto from 'node:crypto'
import { send, body, hasSession, redis, safeProject, configured, fail } from './_lib.js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST' })
  if (!hasSession(req)) return send(res, 401, { error: 'login' })
  if (!configured().chat || !hasSession(req, 'chat')) return send(res, 403, { error: 'Mở khoá nhắn tin trước.' })
  try {
    const b = await body(req)
    const project = safeProject(b.project)
    const text = String(b.text || '').trim().slice(0, 2000)
    if (!project || !text) return send(res, 400, { error: 'Tin nhắn trống.' })
    const hour = `kid:saycount:${Math.floor(Date.now() / 3600e3)}`
    if (Number(await redis('INCR', hour)) > 30) return send(res, 429, { error: 'Đã gửi 30 tin trong giờ này. Đợi một lát.' })
    await redis('EXPIRE', hour, 3700)
    const msg = { id: crypto.randomUUID(), project, text, at: Date.now() }
    await redis('RPUSH', 'kid:inbox', JSON.stringify(msg))
    await redis('LTRIM', 'kid:inbox', -50, -1)
    await redis('SET', 'kid:viewer', String(Date.now()), 'EX', 600)
    send(res, 200, { ok: true, id: msg.id })
  } catch (e) { return fail(res, e) }
}
