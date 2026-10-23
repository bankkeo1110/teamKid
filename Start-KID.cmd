@echo off
rem Team KID - open herdr with KID (same as the desktop shortcut).
where wt.exe >/dev/null 2>/dev/null && (start "" wt.exe --title "Team KID" wsl.exe -d Ubuntu --cd ~ --exec bash -lic start-kid) || (wsl.exe -d Ubuntu --cd ~ --exec bash -lic start-kid)
