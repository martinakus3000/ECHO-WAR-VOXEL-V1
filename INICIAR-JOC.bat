@echo off
title ECHO WAR
cd /d "%~dp0"
start "" http://localhost:3000
call npm.cmd run dev
pause
