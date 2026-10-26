#Requires -Version 5.1
# Team KID — trình cài một-click cho Windows.
# Chạy bằng cách nhấp đúp Install-TeamKID.cmd (đặt cạnh file này). Chạy lại bao nhiêu lần cũng được:
# bước nào đã xong sẽ được bỏ qua.

$ErrorActionPreference = 'Continue'   # PowerShell 5.1 treats any stderr line as fatal under 'Stop'
$Here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$Distro = 'Ubuntu'
$env:WSL_UTF8 = '1'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$Host.UI.RawUI.WindowTitle = 'Cài đặt Team KID'

# The old "legacy console" gives WSL no real terminal: Claude login drops into --print mode and
# output stair-steps. Turn it off for this user and restart the installer in a fresh window.
$con = Get-ItemProperty HKCU:\Console -ErrorAction SilentlyContinue
if (-not $env:WT_SESSION -and $con -and $con.ForceV2 -eq 0) {
  Set-ItemProperty HKCU:\Console -Name ForceV2 -Value 1
  Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  exit
}
# Raster fonts print Vietnamese as '?': switch this window to Consolas (Windows Terminal needs nothing).
# The same helper saves/restores the console mode around wsl.exe, which leaves LF-without-CR on.
try {
    Add-Type -ErrorAction Stop -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class KidConsoleFont {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct FontInfo { public uint cbSize; public uint nFont; public short X; public short Y; public int Family; public int Weight;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string Face; }
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int n);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool SetCurrentConsoleFontEx(IntPtr h, bool max, ref FontInfo f);
  public static bool Use(string face, short size) {
    var f = new FontInfo(); f.cbSize = (uint)Marshal.SizeOf(f); f.Y = size; f.Family = 54; f.Weight = 400; f.Face = face;
    return SetCurrentConsoleFontEx(GetStdHandle(-11), false, ref f);
  }
  [DllImport("kernel32.dll")] static extern bool GetConsoleMode(IntPtr h, out uint m);
  [DllImport("kernel32.dll")] static extern bool SetConsoleMode(IntPtr h, uint m);
  public static uint Mode() { uint m; return GetConsoleMode(GetStdHandle(-11), out m) ? m : 0; }
  public static void Restore(uint m) { if (m != 0) SetConsoleMode(GetStdHandle(-11), m); }
}
'@
    if (-not $env:WT_SESSION) { [void][KidConsoleFont]::Use('Consolas', 16) }
} catch {}

function Say($m)  { Write-Host "`n▶ $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  ✓ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }
function Note($m) { Write-Host "    $m" -ForegroundColor Gray }
function Stop-Here($code) { Read-Host "`nNhấn Enter để đóng cửa sổ" | Out-Null; exit $code }

function Test-Admin {
  ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
}

# "D:\Code\Team KID" -> "/mnt/d/Code/Team KID"
function ConvertTo-WslPath([string]$p) {
  $full = (Resolve-Path $p).Path
  if ($full -notmatch '^([A-Za-z]):\\(.*)$') { throw "Thư mục phải nằm trên ổ đĩa có chữ cái (vd D:\Code): $full" }
  '/mnt/' + $Matches[1].ToLower() + '/' + ($Matches[2] -replace '\\', '/')
}

function Get-Distros {
  try { $o = & wsl.exe -l -q 2>$null } catch { return @() }
  @($o | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
}

# Windows command-line quoting for one argument (CommandLineToArgvW rules).
function ConvertTo-Arg([string]$s) {
  if ($s -eq '') { return '""' }
  if ($s -notmatch '[\s"]') { return $s }
  $r = '"'; $bs = 0
  foreach ($c in $s.ToCharArray()) {
    if ($c -eq [char]92) { $bs++; continue }
    if ($c -eq [char]34) { $r += ('\' * ($bs * 2 + 1)) + '"'; $bs = 0; continue }
    $r += ('\' * $bs) + $c; $bs = 0
  }
  $r + ('\' * ($bs * 2)) + '"'
}

function Invoke-Wsl {
  # Runs a program inside Ubuntu (--exec, no shell in between) in THIS console window, so
  # interactive programs (Claude login, gh login) get a real terminal. Returns the exit code.
  param([string[]]$Cmd, [switch]$Root, [string]$Cd = '~', [switch]$Window)
  $a = @('-d', $Distro, '--cd', $Cd)
  if ($Root) { $a += @('-u', 'root') }
  $a += '--exec'; $a += $Cmd
  $line = ($a | ForEach-Object { ConvertTo-Arg $_ }) -join ' '
  if ($Window) {
    # Claude's login and setup need a real terminal; some PowerShell consoles hand wsl.exe a pipe,
    # and Claude then fails with "--print". A window of its own always gets a terminal.
    $p = Start-Process wsl.exe -ArgumentList $line -Wait -PassThru
    return $p.ExitCode
  }
  $mode = 0; try { $mode = [KidConsoleFont]::Mode() } catch {}
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'wsl.exe'; $psi.Arguments = $line; $psi.UseShellExecute = $false
  $p = [System.Diagnostics.Process]::Start($psi)
  $p.WaitForExit()
  try { [KidConsoleFont]::Restore($mode) } catch {}
  return $p.ExitCode
}

function Get-Status {
  $s = & wsl.exe -d $Distro --cd ~ --exec bash -lc "bash '$LxKidwin/provision-user.sh' status" 2>$null
  @($s | ForEach-Object { "$_".Trim() })
}

function Set-ResumeAfterReboot {
  $cmd = Join-Path $Here 'Install-TeamKID.cmd'
  New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce' -Force | Out-Null
  Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce' -Name 'TeamKID' -Value "`"$cmd`""
}

try {
  Write-Host "=============================================" -ForegroundColor Cyan
  Write-Host "  TEAM KID — cài đặt một-click cho Windows" -ForegroundColor Cyan
  Write-Host "=============================================" -ForegroundColor Cyan
  Note "Thư mục cài đặt: $Here"

  if (-not (Test-Path (Join-Path $Here 'setup-team-kid.sh')) -or -not (Test-Path (Join-Path $Here 'kidwin'))) {
    Warn "Không thấy setup-team-kid.sh hoặc thư mục kidwin cạnh file này. Hãy giải nén đầy đủ file zip rồi chạy lại."
    Stop-Here 1
  }

  # ---------------------------------------------------------------- 1. WSL + Ubuntu
  Say "Bước 1/7 — WSL và Ubuntu"
  $haveUbuntu = (Get-Distros) -contains $Distro
  if (-not $haveUbuntu) {
    if (-not (Test-Admin)) {
      Note "Cần quyền Administrator để cài WSL. Windows sẽ hỏi xác nhận — chọn Yes."
      Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
      exit 0
    }
    Note "Đang cài WSL + Ubuntu (có thể mất 5–10 phút)…"
    & wsl.exe --install -d $Distro --no-launch
    $haveUbuntu = (Get-Distros) -contains $Distro
    if (-not $haveUbuntu) {
      $ubuntuExe = Get-Command ubuntu.exe -ErrorAction SilentlyContinue
      if ($ubuntuExe) { & $ubuntuExe.Source install --root | Out-Null; $haveUbuntu = (Get-Distros) -contains $Distro }
    }
    if (-not $haveUbuntu) {
      Set-ResumeAfterReboot
      Warn "Windows cần KHỞI ĐỘNG LẠI để bật WSL."
      Note "Sau khi khởi động lại và đăng nhập, trình cài này sẽ tự mở lại và chạy tiếp."
      if ((Read-Host "Khởi động lại ngay bây giờ? (y/n)") -match '^[yY]') { Restart-Computer -Force }
      Stop-Here 0
    }
  }
  if ((Invoke-Wsl -Root -Cmd @('true')) -ne 0) {
    Set-ResumeAfterReboot
    Warn "Ubuntu đã cài nhưng chưa chạy được — thường là do cần khởi động lại máy."
    if ((Read-Host "Khởi động lại ngay bây giờ? (y/n)") -match '^[yY]') { Restart-Computer -Force }
    Stop-Here 1
  }
  Ok "Ubuntu sẵn sàng"

  $script:LxHere   = ConvertTo-WslPath $Here
  $script:LxKidwin = "$LxHere/kidwin"

  # ---------------------------------------------------------------- 2. Linux user
  Say "Bước 2/7 — Tài khoản Linux"
  $user = (& wsl.exe -d $Distro -u root --exec bash -c "getent passwd 1000 | cut -d: -f1" 2>$null | Select-Object -First 1)
  if ($user) { $user = "$user".Trim() }
  if (-not $user) {
    $default = ($env:USERNAME.ToLower() -replace '[^a-z0-9_-]', '')
    if ($default -notmatch '^[a-z_]') { $default = 'kid' + $default }
    do {
      $user = Read-Host "Tên người dùng Linux (chữ thường, không dấu) [$default]"
      if (-not $user) { $user = $default }
    } until ($user -match '^[a-z_][a-z0-9_-]{0,31}$')
    do {
      $p1 = Read-Host "Đặt mật khẩu Linux (dùng khi cài phần mềm sau này)" -AsSecureString
      $p2 = Read-Host "Nhập lại mật khẩu" -AsSecureString
      $s1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1))
      $s2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2))
      if ($s1 -ne $s2 -or -not $s1) { Warn "Hai mật khẩu không khớp hoặc để trống, nhập lại." }
    } until ($s1 -eq $s2 -and $s1)
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${user}:$s1"))
    $s1 = $null; $s2 = $null
    $mk = "id -u $user >/dev/null 2>&1 || useradd -m -s /bin/bash -G sudo $user; " +
          "echo $b64 | base64 -d | chpasswd; " +
          "printf '[user]\ndefault=$user\n' > /etc/wsl.conf"
    if ((Invoke-Wsl -Root -Cmd @('bash', '-c', $mk)) -ne 0) { throw "Không tạo được tài khoản Linux." }
    & wsl.exe --terminate $Distro | Out-Null
    Ok "Đã tạo tài khoản '$user' và đặt làm mặc định"
  } else {
    Ok "Tài khoản Linux: $user"
  }

  # ---------------------------------------------------------------- 3. System packages
  Say "Bước 3/7 — Phần mềm hệ thống (Node.js, GitHub CLI, git, python)"
  $haveSys = (Invoke-Wsl -Cmd @('bash', '-c', 'command -v gh >/dev/null && command -v node >/dev/null && command -v lsof >/dev/null')) -eq 0
  if ($haveSys) { Ok "đã có" }
  else {
    if ((Invoke-Wsl -Root -Cmd @('bash', "$LxKidwin/provision-root.sh")) -ne 0) { throw "Cài phần mềm hệ thống thất bại (xem lỗi phía trên)." }
  }

  # ---------------------------------------------------------------- 4. Tools + projects
  Say "Bước 4/7 — Claude Code, herdr và dự án team-kid"
  $st = Get-Status
  if (($st -contains 'claude-installed') -and ($st -contains 'herdr') -and ($st -contains 'project')) { Ok "đã có" }
  else {
    if ((Invoke-Wsl -Cmd @('bash', '-lc', "bash '$LxKidwin/provision-user.sh' tools '$LxHere'")) -ne 0) {
      throw "Cài công cụ thất bại (xem lỗi phía trên)."
    }
  }
  # Always refresh the helper commands, so re-running a newer zip upgrades them.
  if ((Invoke-Wsl -Cmd @('bash', '-lc', "bash '$LxKidwin/provision-user.sh' helpers")) -ne 0) {
    Warn "Không cập nhật được lệnh kid / new-kid-project."
  }

  # ---------------------------------------------------------------- 5. Logins
  Say "Bước 5/7 — Đăng nhập Claude và GitHub"
  $st = Get-Status
  if ($st -contains 'claude-login') { Ok "Claude: đã đăng nhập" }
  else {
    Write-Host ""
    Write-Host "  ┌ ĐĂNG NHẬP CLAUDE ───────────────────────────────────────────" -ForegroundColor Yellow
    Write-Host "  │ Claude Code sẽ mở trong một cửa sổ mới:"                          -ForegroundColor Yellow
    Write-Host "  │  1. Chọn giao diện (Enter), chọn đăng nhập bằng tài khoản Claude" -ForegroundColor Yellow
    Write-Host "  │  2. Trình duyệt mở ra → đăng nhập → bấm Authorize"               -ForegroundColor Yellow
    Write-Host "  │     (nếu trình duyệt không tự mở: giữ Ctrl + bấm vào link)"        -ForegroundColor Yellow
    Write-Host "  │  3. Khi thấy ô chat của Claude, gõ  /exit  rồi Enter (cửa sổ đó tự đóng)" -ForegroundColor Yellow
    Write-Host "  └──────────────────────────────────────────────────────────────" -ForegroundColor Yellow
    Read-Host "  Nhấn Enter để bắt đầu" | Out-Null
    Invoke-Wsl -Window -Cmd @('bash', '-lc', 'claude') | Out-Null
    if (-not ((Get-Status) -contains 'claude-login')) {
      if ((Read-Host "  Bạn đã đăng nhập Claude thành công chưa? (y/n)") -match '^[yY]') {
        Invoke-Wsl -Cmd @('bash', '-c', 'mkdir -p ~/.teamkid && touch ~/.teamkid/claude-login-done') | Out-Null
      } else { Warn "Chạy lại trình cài để đăng nhập lại."; Stop-Here 1 }
    }
    Ok "Claude: đã đăng nhập"
  }

  if ($st -contains 'gh-login') { Ok "GitHub: đã đăng nhập" }
  else {
    Write-Host ""
    Write-Host "  ┌ ĐĂNG NHẬP GITHUB ───────────────────────────────────────────" -ForegroundColor Yellow
    Write-Host "  │ Sẽ hiện một MÃ 8 ký tự. Nhấn Enter để mở trình duyệt,"           -ForegroundColor Yellow
    Write-Host "  │ dán mã vào trang GitHub, rồi bấm Authorize."                     -ForegroundColor Yellow
    Write-Host "  └──────────────────────────────────────────────────────────────" -ForegroundColor Yellow
    Invoke-Wsl -Cmd @('gh', 'auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web') | Out-Null
    if (-not ((Get-Status) -contains 'gh-login')) { Warn "Chưa đăng nhập được GitHub. Chạy lại trình cài để thử lại."; Stop-Here 1 }
    Ok "GitHub: đã đăng nhập"
  }

  # ---------------------------------------------------------------- 6. GitHub repo + plugin + setup skill
  Say "Bước 6/7 — Repo GitHub, plugin và cấu hình dự án"
  $st = Get-Status
  if (($st -contains 'github-repo') -and ($st -contains 'plugin')) { Ok "repo và plugin: đã có" }
  else {
    if ((Invoke-Wsl -Cmd @('bash', '-lc', "bash '$LxKidwin/provision-user.sh' github")) -ne 0) {
      throw "Bước GitHub/plugin thất bại (xem lỗi phía trên)."
    }
  }

  $st = Get-Status
  if ($st -contains 'setup-skill') { Ok "cấu hình mattpocock-skills: đã có" }
  else {
    Write-Host ""
    Write-Host "  ┌ CẤU HÌNH DỰ ÁN (bước duy nhất agent không tự làm được) ────────" -ForegroundColor Yellow
    Write-Host "  │ Claude sẽ mở và tự chạy lệnh cấu hình. Nếu Claude hỏi:"            -ForegroundColor Yellow
    Write-Host "  │  • 'Do you trust this folder?'      → Yes"                           -ForegroundColor Yellow
    Write-Host "  │  • Issue tracker                     → GitHub"                       -ForegroundColor Yellow
    Write-Host "  │  • Ticket prefix                     → KID"                          -ForegroundColor Yellow
    Write-Host "  │  • Nhãn triage / domain / docs       → chấp nhận mặc định (Enter)"   -ForegroundColor Yellow
    Write-Host "  │ Khi Claude báo đã xong, gõ  /exit  rồi Enter."                       -ForegroundColor Yellow
    Write-Host "  └────────────────────────────────────────────────────────────────" -ForegroundColor Yellow
    Read-Host "  Nhấn Enter để bắt đầu" | Out-Null
    Invoke-Wsl -Window -Cd '~/team-kid' -Cmd @('bash', '-lc', 'claude /mattpocock-skills:setup-matt-pocock-skills') | Out-Null
    if (-not ((Get-Status) -contains 'setup-skill')) {
      Warn "Chưa thấy docs/agents/triage-labels.md và domain.md. Chạy lại trình cài để làm lại bước này."
      Stop-Here 1
    }
    Ok "cấu hình mattpocock-skills: xong"
  }

  $st = Get-Status
  if ($st -contains 'adapted') { Ok "kiểm tra cuối: tất cả đạt" }
  else {
    Invoke-Wsl -Cmd @('bash', '-lc', "bash '$LxKidwin/provision-user.sh' finish") | Out-Null
    if ((Get-Status) -contains 'adapted') { Ok "kiểm tra cuối: tất cả đạt" }
    else { Warn "Còn mục [MISS] ở trên — gửi ảnh chụp cho Claude để được hướng dẫn. KID vẫn khởi động được." }
  }

  # ---------------------------------------------------------------- 7. Desktop shortcut
  Say "Bước 7/7 — Shortcut 'Start KID' trên Desktop"
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shell   = New-Object -ComObject WScript.Shell
  $lnk     = $shell.CreateShortcut((Join-Path $desktop 'Start KID.lnk'))
  $wt      = Get-Command wt.exe -ErrorAction SilentlyContinue
  if ($wt) {
    $lnk.TargetPath = $wt.Source
    $lnk.Arguments  = "--title `"Team KID`" wsl.exe -d $Distro --cd ~ --exec bash -lic start-kid"
  } else {
    $lnk.TargetPath = "$env:WINDIR\System32\wsl.exe"
    $lnk.Arguments  = "-d $Distro --cd ~ --exec bash -lic start-kid"
  }
  $lnk.IconLocation = "$env:WINDIR\System32\wsl.exe,0"
  $lnk.Description  = 'Mở Team KID: herdr + KID'
  $lnk.Save()
  Ok "Đã tạo: $(Join-Path $desktop 'Start KID.lnk')"

  # KID Office: the pixel office in the browser. The window starts minimised and keeps the office
  # running; closing it stops the office (Start KID also runs one in the background).
  $lnk2 = $shell.CreateShortcut((Join-Path $desktop 'KID Office.lnk'))
  $lnk2.TargetPath  = "$env:WINDIR\System32\wsl.exe"
  $lnk2.Arguments   = "-d $Distro --cd ~ --exec bash -lic `"kid-office --fg`""
  $lnk2.WindowStyle = 7
  $lnk2.IconLocation = "$env:WINDIR\System32\shell32.dll,13"
  $lnk2.Description = 'Văn phòng ảo của Team KID: xem team làm việc, Scrum board, nói với KID'
  $lnk2.Save()
  Ok "Đã tạo: $(Join-Path $desktop 'KID Office.lnk')"

  # Update shortcut: pulls the latest kit from GitHub and re-runs this installer.
  $lnk3 = $shell.CreateShortcut((Join-Path $desktop 'Cập nhật Team KID.lnk'))
  $lnk3.TargetPath  = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
  $lnk3.Arguments   = '-NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/bankkeo1110/teamKid/main/install.ps1 | iex"'
  $lnk3.IconLocation = "$env:WINDIR\System32\shell32.dll,238"
  $lnk3.Description = 'Tải bản Team KID mới nhất từ GitHub và cài lại'
  $lnk3.Save()
  Ok "Đã tạo: $(Join-Path $desktop 'Cập nhật Team KID.lnk')"

  Write-Host ""
  Write-Host "=============================================" -ForegroundColor Green
  Write-Host "  XONG! Nhấp đúp 'Start KID' trên Desktop."     -ForegroundColor Green
  Write-Host "  Cửa sổ herdr mở ra, KID tự khởi động — cứ"    -ForegroundColor Green
  Write-Host "  gõ yêu cầu của bạn (tiếng Việt cũng được)."   -ForegroundColor Green
  Write-Host "  Nhấp đúp 'KID Office' để xem văn phòng ảo."   -ForegroundColor Green
  Write-Host "=============================================" -ForegroundColor Green
  Note "Code của bạn: \\wsl$\$Distro\home\$user\team-kid  (mở được bằng File Explorer / VS Code)"
  Note "Bảng công việc: repo 'team-kid' trên GitHub → tab Issues"
  Note "App mới: mở Start KID, mở tab mới trong herdr (dấu +) và gõ:  new-kid-project ten-app"
  if ((Read-Host "`nMở Team KID ngay bây giờ? (y/n)") -match '^[yY]') { Start-Process (Join-Path $desktop 'Start KID.lnk') }
  exit 0
}
catch {
  Write-Host ""
  Warn "Lỗi: $($_.Exception.Message)"
  Note "Chạy lại Install-TeamKID.cmd — các bước đã xong sẽ được bỏ qua."
  Note "Nếu vẫn lỗi, chụp màn hình cửa sổ này gửi cho Claude."
  Stop-Here 1
}
