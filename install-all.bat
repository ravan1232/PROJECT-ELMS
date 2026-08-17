@echo off
echo ========================================================
echo   Installing all dependencies for Root, Backend, Frontend
echo ========================================================
echo.

call npm.cmd run install-all

echo.
echo ========================================================
echo   Installation completed! You can now run start-dev.bat
echo ========================================================
pause
