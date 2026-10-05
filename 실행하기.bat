@echo off
chcp 65001 > nul
title 학급경제 & Classimal World 3D 서버
echo ========================================================
echo   🪙 학급경제 & Classimal World 3D 서버를 시작합니다
echo ========================================================
echo.
echo 교실 PC 서버가 켜지면 기본 브라우저가 자동으로 열립니다.
echo 학생들은 같은 학교 와이파이에서 표시되는 IP 주소로 접속할 수 있습니다.
echo.
echo 서버를 종료하려면 이 창을 닫아 주세요.
echo --------------------------------------------------------

start http://localhost:8000
python server.py
if errorlevel 1 (
    py server.py
)
pause
