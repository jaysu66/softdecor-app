@echo off
chcp 65001 >nul
title SoftDecor App
cd /d "%~dp0"

echo ============================================
echo   SoftDecor App - 一键启动
echo ============================================
echo.

:: 1. 检查 / 启动 API Gateway (端口 3000)
echo [1/2] 检查 API Gateway (端口 3000)...
curl -s -o nul -w "" http://localhost:3000/health >nul 2>&1
if %errorlevel%==0 (
    echo       √ Gateway 已在运行
) else (
    echo       Gateway 未运行，正在启动...
    pushd "C:\Users\su200\Desktop\api中转站"
    start "AI-Gateway" /min cmd /c "node server.js > gateway.log 2>&1"
    popd
    set /a retry=0
    :wait_gw
    set /a retry+=1
    if %retry% gtr 15 (
        echo       ! Gateway 未能在15秒内就绪，继续启动应用...
        goto start_app
    )
    timeout /t 1 /nobreak >nul
    curl -s -o nul -w "" http://localhost:3000/health >nul 2>&1
    if errorlevel 1 goto wait_gw
    echo       √ Gateway 已就绪
)

:start_app
echo.
echo [2/2] 启动 SoftDecor (server + client)...
echo       Server: http://localhost:3001
echo       Client: http://localhost:8080
echo.

:: 延迟打开浏览器
start "" /b cmd /c "timeout /t 4 /nobreak >nul && start \"\" http://localhost:8080"

call npm run dev
pause
