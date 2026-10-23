# Team KID

Một đội phát triển phần mềm gồm toàn AI agent, làm việc theo Scrum ngay trên máy Windows của bạn.
Bạn chỉ nói chuyện với **KID** (Scrum Master). KID giao việc cho **Product Owner**, các **Developer**
và **Tester**, mọi ticket nằm trên GitHub Issues, và **KID Office** cho bạn xem cả team làm việc
trong một văn phòng ảo 2D / 3D.

## Cài đặt (Windows 10/11)

Mở PowerShell và dán:

```powershell
irm https://raw.githubusercontent.com/bankkeo1110/teamKid/main/install.ps1 | iex
```

Trình cài tự làm: WSL + Ubuntu, Node.js, GitHub CLI, Claude Code, herdr, plugin mattpocock-skills,
repo GitHub cho dự án đầu tiên, và ba shortcut trên Desktop: **Start KID**, **KID Office**,
**Cập nhật Team KID**. Bạn chỉ cần bấm Yes, đặt mật khẩu Linux, đăng nhập Claude và GitHub, rồi trả
lời vài câu cấu hình. Chi tiết: [SETUP.md](SETUP.md).

## Cập nhật

- Nhấp đúp **Cập nhật Team KID** trên Desktop, hoặc
- trong herdr gõ `kid-update` (`kid-update --check` để chỉ xem có bản mới không).

## Lệnh hằng ngày (trong herdr)

| Lệnh | Việc |
|---|---|
| `kid [app]` | Mở KID cho một app |
| `new-kid-project ten-app` | Tạo app mới: repo riêng, team cài sẵn |
| `kid-projects` | Liệt kê các app |
| `kid-office` | Mở văn phòng ảo trên trình duyệt (`--demo` để xem thử) |
| `kid-update` | Cập nhật Team KID từ GitHub |

## Cấu trúc repo

| Đường dẫn | Nội dung |
|---|---|
| `install.ps1` | Trình cài một dòng: tải repo này và chạy `Install-TeamKID.ps1` |
| `Install-TeamKID.ps1` / `.cmd` | Trình cài Windows (chạy lại được, bước xong sẽ bỏ qua) |
| `kidwin/` | Lệnh Linux (`kid`, `start-kid`, `new-kid-project`, `kid-office`, `kid-update`), KID Office, mẫu dự án |
| `patches/` | Các thay đổi Team KID trên Astragentic 4.1.1: Thomas → KID, sửa lỗi Linux/WSL |
| `team-kid.bundle` | Dự án khởi đầu đã cài sẵn team |
| `site/`, `scripts/build-site.sh`, `vercel.json` | Trang giới thiệu trên Vercel, có văn phòng mô phỏng chạy ngay trên trình duyệt |

## Ghi công

Team KID xây trên [Astragentic](https://github.com/thientranhung/astragentic) của Astraler
(Apache License 2.0). Các thay đổi nằm trong `patches/`. Three.js (MIT) được kèm trong
`kidwin/office/vendor/`.
