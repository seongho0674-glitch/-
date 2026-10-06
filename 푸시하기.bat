@echo off
chcp 65001 > nul
cd /d "%~dp0"
title 서초롱 민주시민 경제교육 업데이트
echo ========================================================
echo   수정 내용 저장 및 GitHub 전송을 시작합니다
echo ========================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0푸시하기.ps1"
set "PUSH_RESULT=%ERRORLEVEL%"
echo.
if not "%PUSH_RESULT%"=="0" echo 업데이트 전송에 실패했습니다. 위 오류를 확인해 주세요.
pause
exit /b %PUSH_RESULT%
