@echo off
echo.
echo ==========================================
echo   HOSTAWAY WEBHOOK TESTING SETUP
echo ==========================================
echo.

REM Check if ngrok is installed
ngrok version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ngrok not found. Installing...
    winget install ngrok.ngrok
    echo ✅ ngrok installed. Please restart your terminal and run this script again.
    pause
    exit /b 1
)

echo 🚀 Starting Smithers server...
start /b node server.js

echo ⏳ Waiting for server to start...
timeout /t 5 /nobreak >nul

echo 🌐 Creating ngrok tunnel...
echo.
echo 📋 Instructions:
echo 1. Copy the ngrok URL that appears below
echo 2. Add '/webhooks/hostaway' to the end
echo 3. Use this full URL in your Hostaway webhook configuration
echo.
echo ⚠️  Press Ctrl+C in this window to stop everything
echo.

ngrok http 3000
