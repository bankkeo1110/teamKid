// Who is looking, and is the site set up? The page uses this to decide what to show.
import { send, hasSession, configured, redis, fail } from './_lib.js'
export default async function handler(req, res) {
  const cfg = configured()
  const loggedIn = hasSession(req)
  let projects = [], paired = false
  try {
    if (loggedIn && cfg.redis) {
      const [p, relay] = await Promise.all([redis('GET', 'kid:projects'), redis('EXISTS', 'kid:relay')])
      projects = p ? JSON.parse(p) : []; paired = relay === 1
    }
  } catch (e) { return fail(res, e) }
  if (loggedIn && cfg.redis) await redis('SET', 'kid:viewer', String(Date.now()), 'EX', 600).catch(() => {})
  send(res, 200, { loggedIn, configured: cfg, paired, projects, chatUnlocked: loggedIn && hasSession(req, 'chat') })
}
