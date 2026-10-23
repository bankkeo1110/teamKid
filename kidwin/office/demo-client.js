// Browser-only demo team for the public KID Office page (no herdr, no GitHub, no Claude).
const now = () => Date.now()
const crypto = globalThis.crypto
const ROLE_VI = { kid: 'Scrum Master', shaper: 'Product Owner', builder: 'Developer', qa: 'Tester' }
const STEP_VI = { implement: 'viết code', tdd: 'TDD (test trước)', 'code-review': 'tự review', 'mattpocock-skills:code-review': 'review theo chuẩn', simplify: 'dọn code', 'codex-arm': 'review chéo', 'grill-with-docs': 'hỏi rõ yêu cầu', 'to-spec': 'viết spec', 'to-tickets': 'cắt ticket', triage: 'phân loại việc', 'bmad-ux': 'kiểm tra UX', 'diagnosing-bugs': 'tìm nguyên nhân lỗi' }
const GATE_VI = { 'tdd-gate': 'commit khi chưa có test', 'wait-gate': 'vòng lặp chờ sai cách', 'arm-gate': 'review chéo trước khi tự review', 'merge-gate': 'merge thiếu bước' }
const COL_VI = { backlog: 'Backlog', ready: 'Sẵn sàng', doing: 'Đang làm', review: 'Review & QA', done: 'Xong' }

export class Demo {
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


export function startDemo(onData) {
  const d = new Demo()
  let last = 0
  const tick = () => {
    d.tick()
    const evs = d.events.filter(e => e.at > last)
    if (evs.length) last = evs[evs.length - 1].at
    onData({ state: d.state, events: evs })
  }
  tick(); setInterval(tick, 1000)
  return { say: text => { d.say(text); return { ok: true } } }
}
