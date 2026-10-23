@echo off
rem Team KID - open KID Office (pixel office) in the browser.
wsl.exe -d Ubuntu --cd ~ --exec bash -lic "kid-office --fg"
