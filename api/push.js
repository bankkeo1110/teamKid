// POST from the owner's KID Office (relay): {project, projects, state, events}.
// One Redis write per push, so the Upstash free tier lasts.
import { send, body, redis, sha256hex, safeProject, fail } from './_lib.js'
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST' })
  try {
    const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const want = await redis('GET', 'kid:relay')
    if (!tok || !want || sha256hex(tok) !== want) return send(res, 401, { error: 'relay' })
    const b = await body(req)
    const p = safeProject(b.project)
    if (!p || !b.state) return send(res, 400, { error: 'project/state' })
    const snap = JSON.stringify({ state: b.state, events: (b.events || []).slice(-150), at: Date.now() })
    if (snap.length > 900000) return send(res, 413, { error: 'too big' })
    const cmds = [['SET', `kid:snap:${p}`, snap, 'EX', 7 * 86400]]
    if (Array.isArray(b.projects)) cmds.push(['SET', 'kid:projects', JSON.stringify(b.projects.map(safeProject).filter(Boolean).slice(0, 50))])
    for (const c of cmds) await redis(...c)
    send(res, 200, { ok: true })
  } catch (e) { return fail(res, e) }
}
