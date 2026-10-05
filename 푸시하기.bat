@echo off
chcp 65001 > nul
title GitHub 저장소로 배포 푸시하기
echo ========================================================
echo   🚀 GitHub 저장소(seongho0674-glitch/-)로 배포 푸시를 시작합니다
echo ========================================================
echo.
echo 잠시 후 GitHub 로그인 브라우저 창이 뜨면 로그인을 진행해 주세요.
echo (이미 로그인이 되어 있다면 바로 전송됩니다)
echo.

git push -u origin main

if errorlevel 1 (
    echo.
    echo ❌ 푸시 중 오류가 발생했습니다.
    echo 인터넷 연결 또는 GitHub 권한을 확인해 주세요.
) else (
    echo.
    echo ========================================================
    echo   🎉 푸시 성공! GitHub로 웹앱 파일이 모두 전송되었습니다!
    echo ========================================================
    echo.
    echo 이제 브라우저에서 아래 주소로 접속하거나 설정을 확인하세요:
    echo 1. 배포 주소: https://seongho0674-glitch.github.io/-/
    echo 2. 저장소: https://github.com/seongho0674-glitch/-
)

echo.
pause
