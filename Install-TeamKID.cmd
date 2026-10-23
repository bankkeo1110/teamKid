@echo off
rem Team KID - one-click installer. Double-click this file.
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-TeamKID.ps1"
