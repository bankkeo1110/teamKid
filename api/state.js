// GET ?p=<project>&since=<ms> for a logged-in owner: the latest snapshot the relay pushed.
import { send, hasSession, redis, safeProject, fail } from './_lib.js'
export default async function handler(req, res) {
  if (!hasSession(req)) return send(res, 401, { error: 'login' })
  try {
    const url = new URL(req.url, 'http://x')
    const p = safeProject(url.searchParams.get('p'))
    if (!p) return send(res, 400, { error: 'project' })
    const since = Number(url.searchParams.get('since') || 0)
    if (url.searchParams.get('touch')) await redis('SET', 'kid:viewer', String(Date.now()), 'EX', 600)
    const raw = await redis('GET', `kid:snap:${p}`)
    if (!raw) return send(res, 200, { empty: true })
    const s = JSON.parse(raw)
    send(res, 200, { state: s.state, events: (s.events || []).filter(e => e.at > since), pushedAt: s.at })
  } catch (e) { return fail(res, e) }
}
