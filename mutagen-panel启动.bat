@echo off
chcp 65001 >nul
title Mutagen 同步面板
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装 Node.js 18 或更高版本：https://nodejs.org/
  pause
  exit /b 1
)
node server.js
echo.
echo 面板已退出。已创建的同步会话仍由 mutagen 守护进程在后台运行。
pause
