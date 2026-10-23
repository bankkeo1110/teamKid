# Team KID — setup on your Windows laptop

Team KID is Astragentic with **Thomas renamed to KID**, Claude-only review, GitHub Issues as the
tracker, and three Linux fixes upstream doesn't have yet. Your PC is Windows, and the team needs
bash, `pgrep` and herdr, so **everything runs inside WSL2 (Ubuntu)**.

## ⚡ Cách nhanh nhất trên Windows (khuyên dùng)

1. Giải nén zip vào một thư mục, ví dụ `D:\Code` (ghi đè nếu đã có bản cũ).
2. Nhấp đúp **`Install-TeamKID.cmd`**. Nếu Windows cảnh báo, chọn **More info → Run anyway** / **Run**.
3. Làm theo cửa sổ hướng dẫn. Bạn chỉ phải tự làm 4 việc:
   - bấm **Yes** khi Windows xin quyền Administrator (lần đầu cài WSL), có thể phải khởi động lại máy — trình cài tự chạy tiếp sau khi đăng nhập lại;
   - đặt **tên + mật khẩu Linux**;
   - **đăng nhập Claude** và **GitHub** trên trình duyệt;
   - trả lời vài câu hỏi cấu hình: tracker **GitHub**, prefix **KID**, còn lại Enter.
4. Xong: nhấp đúp **Start KID** trên Desktop → herdr mở ra, KID tự khởi động, cứ gõ yêu cầu.

Chạy lại `Install-TeamKID.cmd` bao nhiêu lần cũng được — bước nào xong rồi sẽ bỏ qua.
`Start-KID.cmd` trong thư mục này làm đúng việc của shortcut, phòng khi shortcut bị xoá.

---

## 🆕 Tạo app mới (mỗi app một repo)

Mở **Start KID** → trong herdr bấm **+** để mở tab mới → gõ:

```bash
new-kid-project shop-app            # hoặc: new-kid-project shop-app --prefix SHOP
```

Lệnh này tự làm: tạo `~/shop-app`, cài Team KID vào, viết quy tắc dự án (prefix ticket riêng, vd `SHOP-1`),
cài git hooks, tạo repo GitHub riêng tư `shop-app` + nhãn, rồi mở Claude **một lần** để bạn trả lời
câu hỏi cấu hình (GitHub, prefix, còn lại Enter → `/exit`). Model/effort lấy theo `~/team-kid/.agents/orchestrator.md` của bạn.
Lỗi giữa chừng → chạy lại đúng lệnh đó, nó làm tiếp từ chỗ dừng.

Mở KID cho app nào:

| Cách | Kết quả |
|---|---|
| Nhấp **Start KID** | Có nhiều app → hiện menu chọn số |
| Gõ `kid shop-app` (trong tab herdr) | Mở KID cho shop-app |
| Gõ `kid` khi đang ở trong thư mục app | Mở KID cho app đó |
| `kid-projects` | Liệt kê các app Team KID |

---

## 🏢 KID Office — văn phòng ảo

Nhấp đúp **KID Office** trên Desktop (hoặc gõ `kid-office` trong herdr) → trình duyệt mở văn phòng pixel của team:

- **Văn phòng:** mỗi agent một bàn — KID (Scrum Master) ở giữa, Product Owner, Tester, các Developer. Agent được giao việc thì đi từ cửa vào bàn, đang làm thì gõ phím, bị kẹt thì hiện dấu **!** đỏ, đang chờ thì ngủ gật. Bong bóng chat là dòng mới nhất trên màn hình của agent đó. Máy bay giấy bay giữa các bàn = một tin nhắn (KID giao việc, agent báo cáo).
- **Bảng Scrum:** Backlog → Sẵn sàng → Đang làm → Review & QA → Xong, lấy thật từ GitHub Issues. Ticket có nhãn `needs-owner` hiện “Cần bạn quyết định”.
- **Hoạt động:** ai bắt đầu làm, chạy bước nào, bị cổng kiểm soát chặn, commit mới.
- **Nói với KID:** gõ yêu cầu ở đây, tin nhắn được gõ thẳng vào ô của KID.
- **Chi tiết:** bấm vào một người để xem ticket, các bước đã chạy và màn hình của họ.

**2D / 3D:** bấm nút **3D** trên thanh tiêu đề để xem văn phòng 3D: tường kính, phòng họp Sprint, khu Developer màn hình đôi, sofa, quầy cà phê, màn hình Scrum lớn trên tường, cửa sổ nhìn ra thành phố đổi sáng/chiều/tối theo giờ thật. Kéo chuột để xoay, cuộn để phóng to, bấm vào người để xem chi tiết, nhấp đúp để bay camera tới bàn họ. Nút nhanh: Toàn cảnh, Bàn KID, Khu Developer. Lựa chọn 2D/3D được nhớ cho lần sau. Bản 3D cần trình duyệt bật tăng tốc phần cứng (WebGL); nếu không có, tự quay về 2D.

Văn phòng chỉ mở trên máy bạn (localhost, có mã truy cập riêng). Muốn xem thử không cần team thật: `kid-office --demo`.

---

## Manual setup (if you prefer doing it by hand)

## What's in this zip

| File | What it is |
|---|---|
| `patches/` | The 6 Team KID commits on top of upstream Astragentic 4.1.1. The setup script clones upstream and applies them as branch `kid` in `~/astragentic-kid` (release 4.1.3). Edit roles/skills there, then re-run `./install.sh` per project. |
| `team-kid.bundle` | A new, empty project with the team already installed and committed. |
| `Install-TeamKID.cmd` / `.ps1` | One-click Windows installer (WSL, Ubuntu user, Node, gh, Claude Code, herdr, logins, GitHub repo, setup skill, desktop shortcut). |
| `Start-KID.cmd` | Opens herdr with KID, same as the desktop shortcut. |
| `KID-Office.cmd` | Opens KID Office in the browser, same as the desktop shortcut. |
| `kidwin/` | Linux helpers the installer runs: `provision-root.sh`, `provision-user.sh`, the `kid` / `start-kid` / `new-kid-project` / `kid-projects` / `kid-office` commands, `office/` (the KID Office web app), and `project-template/` for new apps. |
| `setup-team-kid.sh` | Builds/unpacks both into `~/astragentic-kid` and `~/team-kid` in WSL, installs git hooks, runs the machine check. |

## 1. Unpack (WSL Ubuntu terminal)

```bash
mkdir -p ~/kid-setup && cd ~/kid-setup
unzip /mnt/c/Users/<you>/Downloads/Team-KID_Setup_v1.zip
bash setup-team-kid.sh
```

It needs internet (clones upstream from GitHub). The last part prints a machine check; on a fresh machine expect five `[MISS]` lines — mattpocock-skills, herdr, herdr skill, `triage-labels.md`, `domain.md` — each fixed by the steps below.

## 2. Install the tools (once per machine)

```bash
# Claude Code CLI, GitHub CLI
curl -fsSL https://claude.ai/install.sh | bash
sudo apt install -y gh python3 && gh auth login

# Matt Pocock's skills — from his own marketplace (not the 1.2.3 copy in claude-plugins-official)
claude plugin marketplace add mattpocock/skills
claude plugin install mattpocock-skills@mattpocock
```

**herdr** (one pane per agent) and its skill: follow https://github.com/herdrdev/herdr (≥ 0.8.0),
and put the herdr skill at `~/.agents/skills/herdr`.

## 3. Create the GitHub repo the team tracks work in

```bash
cd ~/team-kid
gh repo create team-kid --private --source . --push
gh label create todo; gh label create needs-owner; gh label create needs-info
```

## 4. Run the setup skill (only you can — it refuses model invocation)

```bash
cd ~/team-kid && claude
```

Then type `/mattpocock-skills:setup-matt-pocock-skills`. Choose **GitHub**, ticket prefix **`KID`**.
It writes `docs/agents/triage-labels.md` and `domain.md` and rewrites `issue-tracker.md`.
Afterwards, in the same session, say:

> Read .astraler/releases/4.1.3/ADAPT-HARNESS.md §2.3–2.6 and finish the adaptation; the receipt is .astraler/state/ADAPTATION-REPORT.md.

Commit, then `./scripts/check-requirements.sh . --adapted` should report no `[MISS]`.

## 5. Start KID

```bash
cd ~/team-kid
herdr workspace create --label team-kid      # first time only
claude --dangerously-skip-permissions --agent kid --model claude-opus-5-5 --effort medium
```

Tell KID what you want built. KID calls the Shaper for a spec (you approve it), cuts tickets on
GitHub Issues, runs up to 4 Builders in parallel worktrees, gates each milestone with Rin, runs QA
before merges, and comes back to you only for real decisions (UI/UX, tech stack).

## What was customised

- **Thomas → KID everywhere**: `--agent kid`, `.claude/agents/kid.md`, `.agents/roles/kid*.md`,
  herdr tab `kid`, orchestrator row `kid`, messages from `@kid`.
- **Claude-only**: the Codex cross-review is off on all three scopes in `.agents/orchestrator.md`.
- **Models**: KID and Shaper on `claude-opus-5-5`, Builder and QA on `claude-sonnet-5-5`; edit the
  table to change. The Advisor column uses `fable` for Opus rows (one `/model fable` consent per
  machine, uses credits) — blank those cells if you don't want it.
- **Linux/WSL fixes** (upstream only works on macOS today): `install.sh` sed, the TDD gate's
  `mktemp` (it refused every Builder commit on Linux), and the reachability check on a repo with no
  README. Package selftest: 155 passed, 0 failed.
- **Project plugs** in `.astraler/project/`: GitHub tracker state/status, in-flight detection for
  vitest/jest/playwright/next/prisma/pytest, hook installer. Rules in `CLAUDE.md`: prefix `KID`,
  production off limits without your per-run permission, project ledger at `docs/ledger.md`.

## Safety

`--dangerously-skip-permissions` lets agents run commands unattended. Keep this in WSL with no
production credentials in the environment; the git-guard hook blocks unsafe git commands, but it
is not a sandbox.
