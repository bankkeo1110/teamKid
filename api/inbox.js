// POST from the owner's machine (relay secret): take up to 20 waiting messages from the inbox.
import { send, redis, relayOk, fail } from './_lib.js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST' })
  try {
    if (!(await relayOk(req))) return send(res, 401, { error: 'relay' })
    const got = await redis('LPOP', 'kid:inbox', 20)
    const list = (Array.isArray(got) ? got : got ? [got] : []).map(x => { try { return JSON.parse(x) } catch { return null } }).filter(Boolean)
    const viewerAt = Number(await redis('GET', 'kid:viewer') || 0)
    send(res, 200, { messages: list, viewerAt })
  } catch (e) { return fail(res, e) }
}
