@echo off
REM Supabase Edge Function 배포 스크립트
REM 사용법: supabase-deploy.bat

echo ========================================
echo Supabase Edge Function 배포
echo ========================================
echo.

REM 1. 로그인 확인
echo [1/3] Supabase 로그인 확인...
npx supabase login
if %ERRORLEVEL% NEQ 0 (
    echo 로그인 실패. 브라우저가 열리면 인증을 완료해주세요.
    pause
    exit /b 1
)
echo 로그인 성공!
echo.

REM 2. 프로젝트 연결 (PROJECT_REF는 수동 입력 필요)
set /p PROJECT_REF="Supabase Project Reference ID를 입력하세요: "
echo [2/3] 프로젝트 연결 중... (%PROJECT_REF%)
npx supabase link --project-ref %PROJECT_REF%
if %ERRORLEVEL% NEQ 0 (
    echo 프로젝트 연결 실패.
    pause
    exit /b 1
)
echo 프로젝트 연결 성공!
echo.

REM 3. Edge Function 배포
echo [3/3] login-with-device-check 함수 배포 중...
npx supabase functions deploy login-with-device-check
if %ERRORLEVEL% NEQ 0 (
    echo Edge Function 배포 실패.
    pause
    exit /b 1
)
echo.

echo ========================================
echo 배포 완료! 🎉
echo ========================================
echo.
echo 함수 URL:
echo https://%PROJECT_REF%.supabase.co/functions/v1/login-with-device-check
echo.
echo 로그 확인:
echo npx supabase functions logs login-with-device-check --follow
echo.
pause
