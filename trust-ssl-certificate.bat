@echo off
echo ========================================================
echo   Tiwlo StockPro - SSL Certificate Windows Trust Setup
echo ========================================================
echo.
echo Installing SSL certificate into Windows Current User Trusted Root store...
certutil -user -addstore "Root" "%~dp0server\certs\server.crt"
echo.
echo Done! Google Chrome, Edge, and Windows browsers will now trust
echo https://localhost:5173 and https://localhost:5000 securely with zero warnings.
echo ========================================================
pause
