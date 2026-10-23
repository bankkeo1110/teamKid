#!/usr/bin/env node
// KID Office — a local web view of a Team KID project: who is working, on what, and the board.
//
//   node server.mjs [--port 4747] [--demo] [--open]
//
// Reads, never writes, the team's real state:
//   herdr workspace list / agent list / pane read     who is at which desk, what they are doing
//   <project>/.astraler/state/dispatch-record.json     ticket, steps run, refusals, turn ends
//   gh issue list / gh pr list                         the Scrum board
//   git log                                            commits
// The one write is "Nói với KID": it types your message into KID's pane (herdr agent prompt).
// Bound to 127.0.0.1 with a per-machine token, because that pane runs with permissions bypassed.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOME = os.homedir()
const args = process.argv.slice(2)
const flag = n => args.includes(n)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', process.env.KID_OFFICE_PORT || 4747))
const DEMO = flag('--demo')

// ---------------------------------------------------------------- token
const TOKEN_FILE = path.join(HOME, '.teamkid', 'office-token')
let TOKEN
try { TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim() } catch {}
if (!TOKEN) {
  TOKEN = crypto.randomBytes(18).toString('base64url')
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
  fs.writeFileSync(TOKEN_FILE, TOKEN + '\n', { mode: 0o600 })
}

// ---------------------------------------------------------------- helpers
const run = (cmd, argv, { cwd, timeout = 8000 } = {}) => new Promise(resolve => {
  execFile(cmd, argv, { cwd, timeout, maxBuffer: 8 << 20, env: process.env }, (err, stdout) => {
    resolve(err && !stdout ? null : String(stdout))
  })
})
const json = s => { try { return JSON.parse(s) } catch { return null } }
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
const now = () => Date.now()
const ROLE_OF = name => {
  const n = (name || '').toLowerCase()
  if (n.startsWith('builder-')) return 'builder'
  if (n.startsWith('shaper-')) return 'shaper'
  if (n.startsWith('qa-')) return 'qa'
  if (n === 'kid' || n.endsWith('kid')) return 'kid'
  return null
}
const ticketOf = name => {
  const m = (name || '').match(/^(?:builder|shaper|qa)-(.+)$/i)
  return m ? m[1].toUpperCase() : null
}
const TICKET_RE = /^([A-Z][A-Z0-9]{1,9}-\d+)\s*[—:–-]?\s*(.*)$/

// ---------------------------------------------------------------- projects
function listProjects() {
  let out = []
  try {
    for (const d of fs.readdirSync(HOME, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith('.')) continue
      const p = path.join(HOME, d.name)
      if (fs.existsSync(path.join(p, '.claude/agents/kid.md')) && fs.existsSync(path.join(p, '.agents/orchestrator.md'))) out.push(d.name)
    }
  } catch {}
  return out.sort()
}
function projectConfig(name) {
  const root = path.join(HOME, name)
  let orch = ''
  try { orch = fs.readFileSync(path.join(root, '.agents/orchestrator.md'), 'utf8') } catch {}
  const label = (orch.match(/\|\s*workspace-label\s*\|\s*`([^`]*)`/) || [])[1] || name
  const target = Number((orch.match(/\|\s*builder-target\s*\|\s*`(\d+)`/) || [])[1] || 4)
  let claude = ''
  try { claude = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8') } catch {}
  const prefix = (claude.match(/Ticket prefix:\s*`([A-Z]+)`/) || [])[1] || null
  return { name, root, label, builderTarget: target, prefix }
}

// ---------------------------------------------------------------- pane text → one line
const UI_NOISE = /^(❯|>|\?|─|━|│|╭|╰|⏵|⏸|▶▶|⏩|esc to|shift\+tab|bypass permissions|auto mode|accept edits|\[.*\]$)/i
function lastThought(text) {
  if (!text) return null
  const lines = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').split('\n').map(l => l.replace(/\s+$/, ''))
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim()
    if (l.startsWith('●') || l.startsWith('⏺')) {
      const t = l.replace(/^[●⏺]\s*/, '').trim()
      if (t.length > 2) return t.slice(0, 160)
    }
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim()
    if (l.length > 3 && !UI_NOISE.test(l) && /[a-zA-ZÀ-ỹ]/.test(l)) return l.slice(0, 160)
  }
  return null
}
function tailLines(text, n = 18) {
  if (!text) return []
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').split('\n').map(l => l.replace(/\s+$/, '')).filter(Boolean).slice(-n)
}

// ---------------------------------------------------------------- live collector
class Collector {
  constructor(project) {
    this.cfg = projectConfig(project)
    this.state = { project: this.cfg.name, prefix: this.cfg.prefix, builderTarget: this.cfg.builderTarget, agents: [], board: [], commits: [], prs: [], herdr: 'unknown', github: 'unknown', updatedAt: 0 }
    this.events = []
    this.prev = { agents: new Map(), issues: new Map(), commits: new Set(), skills: new Map(), refusals: new Map(), turnEnds: new Map(), briefs: new Map() }
    this.paneCache = new Map()
    this.ticks = 0
    this.firstRun = true
  }
  push(ev) {
    ev.at = ev.at || now(); ev.id = crypto.randomUUID()
    if (this.firstRun && !ev.always) return
    this.events.push(ev); if (this.events.length > 300) this.events.shift()
  }

  async herdrAgents() {
    const wsRaw = json(await run('herdr', ['workspace', 'list']))
    if (!wsRaw) { this.state.herdr = 'offline'; return [] }
    const ws = (wsRaw.result?.workspaces || []).find(w => w.label === this.cfg.label)
    if (!ws) { this.state.herdr = 'no-workspace'; return [] }
    const al = json(await run('herdr', ['agent', 'list']))
    if (!al) { this.state.herdr = 'offline'; return [] }
    this.state.herdr = 'ok'
    return (al.result?.agents || []).filter(a => String(a.pane_id || '').startsWith(ws.workspace_id + ':'))
  }

  async tick() {
    this.ticks++
    const rec = readJson(path.join(this.cfg.root, '.astraler/state/dispatch-record.json')) || {}
    const raw = await this.herdrAgents()

    // who is in the office
    const agents = []
    for (const a of raw) {
      const name = a.name || ''
      const title = a.terminal_title_stripped || ''
      let role = ROLE_OF(name) || (title.endsWith('kid') ? 'kid' : null)
      if (!role) {
        const t = title.toLowerCase()
        if (t.startsWith('ticket:') || t.startsWith('builder:')) role = 'builder'
        else if (t.startsWith('spec:')) role = 'shaper'
        else if (t.startsWith('qa:')) role = 'qa'
      }
      if (!role) continue
      let ticket = ticketOf(name) || (title.match(/:([A-Za-z]+-\d+)/) || [])[1]?.toUpperCase() || null
      const key = Object.keys(rec).find(k => rec[k]?.pane_id === a.pane_id) || (ticket && (rec[ticket] ? ticket : rec['qa:' + ticket] ? 'qa:' + ticket : null))
      const entry = key ? rec[key] : null
      if (!ticket && key) ticket = key.replace(/^(qa|spec):/, '')
      agents.push({
        id: name || a.pane_id, name, role, ticket, pane: a.pane_id,
        status: String(a.agent_status || 'unknown').toLowerCase(),
        steps: entry?.skills_run ? Object.keys(entry.skills_run) : [],
        refusals: Array.isArray(entry?.refusals) ? entry.refusals.length : 0,
        lastRefusal: Array.isArray(entry?.refusals) && entry.refusals.length ? entry.refusals[entry.refusals.length - 1] : null,
        waitingOn: entry?.waiting_on || null,
        briefAt: entry?.last_brief_received_at || null,
        turnEndAt: entry?.last_turn_end_at || null,
        branch: entry?.branch || null,
      })
    }

    // what they are saying (pane text), staggered: working panes every tick, others every 4th
    await Promise.all(agents.map(async ag => {
      const c = this.paneCache.get(ag.pane)
      if (c && !(ag.status === 'working' || this.ticks % 4 === 0)) { ag.thought = c.thought; ag.tail = c.tail; return }
      const txt = await run('herdr', ['pane', 'read', ag.pane, '--source', 'recent-unwrapped', '--lines', '60'], { timeout: 4000 })
      const v = { thought: lastThought(txt), tail: tailLines(txt) }
      this.paneCache.set(ag.pane, v); ag.thought = v.thought; ag.tail = v.tail
    }))

    // events from agents
    const seen = new Set()
    for (const ag of agents) {
      seen.add(ag.id)
      const p = this.prev.agents.get(ag.id)
      const who = ag.role === 'kid' ? 'KID' : `${ROLE_VI[ag.role]} ${ag.ticket || ''}`.trim()
      if (!p) this.push({ kind: 'join', role: ag.role, agent: ag.id, ticket: ag.ticket, text: `${who} vào văn phòng` })
      else if (p.status !== ag.status) {
        const t = { working: 'bắt đầu làm việc', blocked: 'đang bị kẹt, cần xem lại', idle: 'đang chờ', done: 'xong lượt làm việc' }[ag.status]
        if (t) this.push({ kind: 'status', role: ag.role, agent: ag.id, ticket: ag.ticket, status: ag.status, text: `${who} ${t}` })
      }
      const prevSteps = this.prev.skills.get(ag.id) || []
      for (const s of ag.steps) if (!prevSteps.includes(s)) this.push({ kind: 'step', role: ag.role, agent: ag.id, ticket: ag.ticket, step: s, text: `${who} chạy bước ${STEP_VI[s] || s}` })
      this.prev.skills.set(ag.id, ag.steps)
      if (ag.refusals > (this.prev.refusals.get(ag.id) || 0)) this.push({ kind: 'refusal', role: ag.role, agent: ag.id, ticket: ag.ticket, text: `Cổng kiểm soát chặn ${who}: ${GATE_VI[ag.lastRefusal?.gate] || ag.lastRefusal?.gate || 'một lệnh'}` })
      this.prev.refusals.set(ag.id, ag.refusals)
      if (ag.briefAt && ag.briefAt !== this.prev.briefs.get(ag.id)) this.push({ kind: 'message', from: 'kid', to: ag.id, role: ag.role, ticket: ag.ticket, text: `KID giao việc cho ${who}` })
      this.prev.briefs.set(ag.id, ag.briefAt)
      if (ag.turnEndAt && ag.turnEndAt !== this.prev.turnEnds.get(ag.id)) this.push({ kind: 'message', from: ag.id, to: 'kid', role: ag.role, ticket: ag.ticket, text: `${who} báo cáo lại cho KID` })
      this.prev.turnEnds.set(ag.id, ag.turnEndAt)
      if (ag.role === 'kid' && ag.thought && p && p.thought !== ag.thought) this.push({ kind: 'say', role: 'kid', agent: ag.id, text: `KID: ${ag.thought}` })
      this.prev.agents.set(ag.id, { status: ag.status, thought: ag.thought })
    }
    for (const [id] of this.prev.agents) if (!seen.has(id)) { this.push({ kind: 'leave', agent: id, text: `${id} rời văn phòng` }); this.prev.agents.delete(id) }
    this.state.agents = agents

    // board, every 5th tick
    if (this.firstRun || this.ticks % 5 === 0) await this.board(rec)
    if (this.firstRun || this.ticks % 5 === 2) await this.commits()
    this.state.updatedAt = now()
    this.firstRun = false
  }

  async board(rec) {
    const cwd = this.cfg.root
    const issues = json(await run('gh', ['issue', 'list', '--state', 'all', '--limit', '150', '--json', 'number,title,state,labels,assignees,milestone,closedAt,createdAt,updatedAt,url'], { cwd, timeout: 15000 }))
    if (!issues) { this.state.github = 'offline'; return }
    this.state.github = 'ok'
    const prs = json(await run('gh', ['pr', 'list', '--state', 'open', '--limit', '50', '--json', 'number,title,headRefName,url'], { cwd, timeout: 15000 })) || []
    const prTicket = new Set(prs.map(p => ((p.title + ' ' + p.headRefName).match(/[A-Za-z]+-\d+/) || [''])[0].toUpperCase()).filter(Boolean))
    const workingTickets = new Set(this.state.agents.filter(a => a.role === 'builder').map(a => a.ticket))
    const qaTickets = new Set(this.state.agents.filter(a => a.role === 'qa').map(a => a.ticket))
    const board = []
    for (const i of issues) {
      const m = i.title.match(TICKET_RE)
      const ticket = m ? m[1] : `#${i.number}`
      const title = m ? (m[2] || i.title) : i.title
      const labels = (i.labels || []).map(l => l.name)
      const assignee = (i.assignees || [])[0]?.login || null
      let col
      if (i.state === 'CLOSED') {
        if (labels.includes('wontfix')) continue
        if (i.closedAt && now() - Date.parse(i.closedAt) > 21 * 864e5) continue
        col = 'done'
      } else if (qaTickets.has(ticket) || prTicket.has(ticket)) col = 'review'
      else if (assignee || workingTickets.has(ticket)) col = 'doing'
      else if (labels.some(l => ['todo', 'ready-for-agent'].includes(l))) col = 'ready'
      else col = 'backlog'
      const owner = labels.includes('needs-owner') || labels.includes('needs-info') || labels.includes('ready-for-human')
      board.push({ ticket, number: i.number, title, col, labels, assignee, owner, url: i.url, milestone: i.milestone?.title || null, closedAt: i.closedAt, createdAt: i.createdAt })
      const prevCol = this.prev.issues.get(ticket)
      if (prevCol && prevCol !== col) this.push({ kind: 'board', ticket, col, text: `${ticket} chuyển sang “${COL_VI[col]}”` })
      if (!prevCol && !this.firstRun) this.push({ kind: 'board', ticket, col, text: `Ticket mới ${ticket}: ${title.slice(0, 60)}` })
      this.prev.issues.set(ticket, col)
    }
    this.state.board = board
    this.state.prs = prs
  }

  async commits() {
    const out = await run('git', ['-C', this.cfg.root, 'log', '--all', '-n', '25', '--since=7.days', '--pretty=%h\x1f%an\x1f%at\x1f%s'])
    const commits = (out || '').split('\n').filter(Boolean).map(l => { const [h, a, t, s] = l.split('\x1f'); return { hash: h, author: a, at: Number(t) * 1000, subject: s } })
    for (const c of commits.slice().reverse()) {
      if (!this.prev.commits.has(c.hash)) {
        if (!this.firstRun) this.push({ kind: 'commit', ticket: (c.subject.match(/[A-Z]+-\d+/) || [])[0], text: `Commit ${c.hash}: ${c.subject.slice(0, 70)}` })
        this.prev.commits.add(c.hash)
      }
    }
    this.state.commits = commits.slice(0, 12)
  }

  async say(text) {
    const kid = this.state.agents.find(a => a.role === 'kid')
    if (!kid) return { ok: false, error: 'KID chưa chạy trong herdr. Mở Start KID trước.' }
    const out = await run('herdr', ['agent', 'prompt', kid.pane, text], { timeout: 8000 })
    if (out === null) return { ok: false, error: 'herdr không gửi được tin nhắn vào ô của KID.' }
    this.push({ kind: 'owner', from: 'owner', to: 'kid', text: `Bạn: ${text.slice(0, 120)}`, always: true })
    return { ok: true }
  }
}

const ROLE_VI = { kid: 'Scrum Master', shaper: 'Product Owner', builder: 'Developer', qa: 'Tester' }
const STEP_VI = { implement: 'viết code', tdd: 'TDD (test trước)', 'code-review': 'tự review', 'mattpocock-skills:code-review': 'review theo chuẩn', simplify: 'dọn code', 'codex-arm': 'review chéo', 'grill-with-docs': 'hỏi rõ yêu cầu', 'to-spec': 'viết spec', 'to-tickets': 'cắt ticket', triage: 'phân loại việc', 'bmad-ux': 'kiểm tra UX', 'diagnosing-bugs': 'tìm nguyên nhân lỗi' }
const GATE_VI = { 'tdd-gate': 'commit khi chưa có test', 'wait-gate': 'vòng lặp chờ sai cách', 'arm-gate': 'review chéo trước khi tự review', 'merge-gate': 'merge thiếu bước' }
const COL_VI = { backlog: 'Backlog', ready: 'Sẵn sàng', doing: 'Đang làm', review: 'Review & QA', done: 'Xong' }

// ---------------------------------------------------------------- demo team (for preview / screenshots)
class Demo {
  constructor() {
    this.t0 = now()
    this.state = { project: 'demo-shop', prefix: 'SHOP', builderTarget: 3, demo: true, herdr: 'ok', github: 'ok', agents: [], board: [], commits: [], prs: [], updatedAt: 0 }
    this.events = []
    const T = (n, title, col) => ({ ticket: `SHOP-${n}`, number: n, title, col, labels: col === 'ready' ? ['todo'] : [], assignee: null, owner: false, url: '#', milestone: 'Sprint 1 — Đặt sân', closedAt: col === 'done' ? new Date(now() - (8 - n) * 864e5 / 2).toISOString() : null, createdAt: new Date(now() - 6 * 864e5).toISOString() })
    this.board = [
      T(1, 'Khởi tạo Next.js + Prisma + SQLite', 'done'), T(2, 'Trang danh sách sân cầu lông', 'done'),
      T(3, 'Chọn ngày và khung giờ', 'doing'), T(4, 'Đăng nhập bằng Google', 'doing'), T(5, 'Xác nhận đặt sân và gửi email', 'review'),
      T(6, 'Trang quản trị: thêm, sửa sân', 'ready'), T(7, 'Huỷ đặt sân trước 2 giờ', 'ready'), T(8, 'Thanh toán MoMo', 'backlog'),
      T(9, 'Báo cáo doanh thu theo tuần', 'backlog'),
    ]
    this.board[5].owner = false; this.board[7].owner = true; this.board[7].labels = ['needs-owner']
    this.script = [
      ['kid', null, 'working', 'Đọc bảng việc: 2 ticket sẵn sàng, 2 Developer đang làm'],
      ['shaper', 'SHOP-10', 'working', 'Đang viết spec cho tính năng khuyến mãi giờ vàng'],
      ['builder', 'SHOP-3', 'working', 'Viết test cho bộ chọn khung giờ: không cho chọn giờ đã qua'],
      ['builder', 'SHOP-4', 'working', 'Cấu hình NextAuth với Google provider'],
      ['qa', 'SHOP-5', 'working', 'Đặt thử sân 3 lúc 19:00 → email xác nhận đã tới'],
    ]
    this.lines = {
      'SHOP-3': ['Viết test cho bộ chọn khung giờ: không cho chọn giờ đã qua', 'Test đỏ như mong đợi. Giờ viết TimeSlotPicker', 'Chạy npm test: 14 passed', 'Tự review theo chuẩn: tách hook useAvailableSlots', 'Dọn code xong, commit và báo cáo KID'],
      'SHOP-4': ['Cấu hình NextAuth với Google provider', 'Thêm callback lưu user vào bảng User (Prisma)', 'Test đăng nhập giả lập: passed', 'Cần GOOGLE_CLIENT_ID — hỏi KID có biến môi trường chưa'],
      kid: ['Đọc bảng việc: 2 ticket sẵn sàng, 2 Developer đang làm', 'Trả lời Developer SHOP-4: dùng .env.local, không commit secret', 'Giao SHOP-6 cho Developer mới', 'Gom kết quả QA SHOP-5 để báo cho bạn'],
      'SHOP-10': ['Đang viết spec cho tính năng khuyến mãi giờ vàng', 'Hỏi lại: giảm theo % hay theo số tiền?', 'Spec xong, chờ bạn duyệt'],
      'SHOP-5': ['Đặt thử sân 3 lúc 19:00 → email xác nhận đã tới', 'Thử đặt trùng giờ → báo lỗi đúng', 'Màn hình điện thoại 375px: nút Xác nhận bị che, mở ticket mới'],
      'SHOP-6': ['Đọc ticket SHOP-6 và acceptance criteria', 'Viết test cho form thêm sân'],
    }
    this.tick()
  }
  push(ev) { ev.at = now(); ev.id = crypto.randomUUID(); this.events.push(ev); if (this.events.length > 300) this.events.shift() }
  tick() {
    const s = Math.floor((now() - this.t0) / 1000)
    const phase = Math.floor(s / 6)
    const agents = []
    for (const [role, ticket, , first] of this.script) {
      const key = ticket || 'kid'
      const ls = this.lines[key] || [first]
      const idx = Math.min(ls.length - 1, Math.floor(phase / (role === 'kid' ? 1 : 2)) % (ls.length + 1))
      let status = 'working'
      if (ticket === 'SHOP-4' && idx === ls.length - 1) status = 'blocked'
      if (ticket === 'SHOP-10' && idx === ls.length - 1) status = 'idle'
      agents.push({ id: role === 'kid' ? 'kid' : `${role}-${ticket.toLowerCase()}`, name: role === 'kid' ? 'kid' : `${role}-${ticket.toLowerCase()}`, role, ticket, pane: 'demo', status, steps: role === 'builder' ? ['implement', 'tdd', 'code-review'].slice(0, 1 + (idx % 3)) : [], refusals: 0, thought: ls[Math.max(0, idx)], tail: ls.slice(0, idx + 1) })
    }
    if (phase >= 4) agents.push({ id: 'builder-shop-6', name: 'builder-shop-6', role: 'builder', ticket: 'SHOP-6', pane: 'demo', status: 'working', steps: ['implement'], refusals: 0, thought: this.lines['SHOP-6'][phase % 2], tail: this.lines['SHOP-6'] })
    const prev = new Map(this.state.agents.map(a => [a.id, a]))
    for (const a of agents) {
      const p = prev.get(a.id)
      const who = a.role === 'kid' ? 'KID' : `${ROLE_VI[a.role]} ${a.ticket}`
      if (!p) { this.push({ kind: 'join', role: a.role, agent: a.id, ticket: a.ticket, text: `${who} vào văn phòng` }); if (a.role !== 'kid') this.push({ kind: 'message', from: 'kid', to: a.id, role: a.role, ticket: a.ticket, text: `KID giao việc cho ${who}` }) }
      else if (p.thought !== a.thought) {
        this.push({ kind: 'say', role: a.role, agent: a.id, ticket: a.ticket, text: `${who}: ${a.thought}` })
        if (a.role === 'builder' && /báo cáo|hỏi KID/.test(a.thought)) this.push({ kind: 'message', from: a.id, to: 'kid', role: a.role, ticket: a.ticket, text: `${who} nhắn KID` })
        if (a.role === 'kid' && /Trả lời Developer SHOP-4/.test(a.thought)) this.push({ kind: 'message', from: 'kid', to: 'builder-shop-4', role: 'builder', ticket: 'SHOP-4', text: 'KID trả lời Developer SHOP-4' })
      }
      if (p && p.status !== a.status && a.status === 'blocked') this.push({ kind: 'status', status: 'blocked', role: a.role, agent: a.id, ticket: a.ticket, text: `${who} đang bị kẹt, cần xem lại` })
    }
    if (phase >= 4 && this.board[5].col === 'ready') { this.board[5].col = 'doing'; this.push({ kind: 'board', ticket: 'SHOP-6', col: 'doing', text: 'SHOP-6 chuyển sang “Đang làm”' }) }
    this.state.agents = agents
    this.state.board = this.board
    this.state.commits = [
      { hash: 'a1c9e02', author: 'builder-shop-3', at: now() - 4 * 60e3, subject: 'SHOP-3: test(TimeSlotPicker) rejects past slots' },
      { hash: '7be4410', author: 'builder-shop-5', at: now() - 26 * 60e3, subject: 'SHOP-5: send booking confirmation email' },
      { hash: '19d0f3c', author: 'kid', at: now() - 3 * 3600e3, subject: 'Merge SHOP-2: court list page' },
    ]
    this.state.updatedAt = now()
  }
  async say(text) {
    this.push({ kind: 'owner', from: 'owner', to: 'kid', text: `Bạn: ${text.slice(0, 120)}` })
    setTimeout(() => this.push({ kind: 'say', role: 'kid', agent: 'kid', text: 'KID: Đã nhận. Tôi sẽ đưa vào backlog và báo lại khi Shaper có spec.' }), 2500)
    return { ok: true }
  }
}

// ---------------------------------------------------------------- server
const collectors = new Map()
function getCollector(project) {
  if (DEMO) { if (!collectors.has('demo')) collectors.set('demo', new Demo()); return collectors.get('demo') }
  const projects = listProjects()
  const p = projects.includes(project) ? project : projects.includes('team-kid') ? 'team-kid' : projects[0]
  if (!p) return null
  if (!collectors.has(p)) collectors.set(p, new Collector(p))
  return collectors.get(p)
}
let busy = false
setInterval(async () => {
  if (busy) return; busy = true
  try { for (const c of collectors.values()) { if (now() - (c.lastSeen || 0) < 60000 || c.state.updatedAt === 0) await c.tick() } } catch (e) { console.error(e) }
  busy = false
}, 2000)

const INDEX = path.join(HERE, 'index.html')
const okHost = h => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h || '')
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (!okHost(req.headers.host)) { res.writeHead(403).end('forbidden host'); return }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    fs.createReadStream(INDEX).pipe(res); return
  }
  const STATIC = { '/office3d.js': 'office3d.js', '/vendor/three.module.min.js': 'vendor/three.module.min.js', '/vendor/OrbitControls.js': 'vendor/OrbitControls.js', '/vendor/RoomEnvironment.js': 'vendor/RoomEnvironment.js' }
  if (STATIC[url.pathname]) {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'max-age=300' })
    fs.createReadStream(path.join(HERE, STATIC[url.pathname])).pipe(res); return
  }
  const tok = url.searchParams.get('t') || req.headers['x-kid-token']
  if (!url.pathname.startsWith('/api/')) { res.writeHead(404).end(); return }
  if (tok !== TOKEN) { res.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"token"}'); return }

  if (url.pathname === '/api/projects') {
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ projects: DEMO ? ['demo-shop'] : listProjects(), demo: DEMO }))
    return
  }
  const c = getCollector(url.searchParams.get('p'))
  if (!c) { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ empty: true })); return }
  c.lastSeen = now()
  if (c.state.updatedAt === 0) await c.tick()

  if (url.pathname === '/api/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
    let lastEv = Number(url.searchParams.get('since') || 0)
    let lastUpd = 0
    const send = () => {
      c.lastSeen = now()
      if (DEMO) c.tick()
      const evs = c.events.filter(e => e.at > lastEv)
      if (c.state.updatedAt !== lastUpd || evs.length) {
        res.write(`data: ${JSON.stringify({ state: c.state, events: evs })}\n\n`)
        lastUpd = c.state.updatedAt
        if (evs.length) lastEv = evs[evs.length - 1].at
      }
    }
    send()
    const iv = setInterval(send, 1000)
    const hb = setInterval(() => res.write(': ping\n\n'), 15000)
    req.on('close', () => { clearInterval(iv); clearInterval(hb) })
    return
  }
  if (url.pathname === '/api/say' && req.method === 'POST') {
    let body = ''
    req.on('data', d => { body += d; if (body.length > 8000) req.destroy() })
    req.on('end', async () => {
      const text = String(json(body)?.text || '').trim()
      if (!text) { res.writeHead(400, { 'content-type': 'application/json' }).end('{"ok":false,"error":"Tin nhắn trống."}'); return }
      const r = await c.say(text)
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(r))
    })
    return
  }
  res.writeHead(404).end()
})

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.log(`KID Office đã chạy ở cổng ${PORT}.`); maybeOpen(); setTimeout(() => process.exit(0), 300) }
  else { console.error(e); process.exit(1) }
})
server.listen(PORT, '127.0.0.1', () => {
  console.log(`KID Office: http://localhost:${PORT}/?t=${TOKEN}${DEMO ? '  (demo)' : ''}`)
  maybeOpen()
})

const which = cmd => (process.env.PATH || '').split(':').some(d => { try { fs.accessSync(path.join(d, cmd), fs.constants.X_OK); return true } catch { return false } })
function maybeOpen() {
  if (!flag('--open')) return
  const u = `http://localhost:${PORT}/?t=${TOKEN}`
  // explorer.exe returns 1 even on success; cmd.exe needs the & escaped, so prefer wslview, then explorer
  const pick = [['wslview', [u]], ['explorer.exe', [u]], ['xdg-open', [u]]].find(([c]) => which(c))
  if (!pick) { console.log('Mở trình duyệt và vào: ' + u); return }
  const p = spawn(pick[0], pick[1], { detached: true, stdio: 'ignore' }); p.on('error', () => {}); p.unref()
}
