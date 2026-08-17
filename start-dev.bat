@echo off
echo ========================================================
echo   Starting Employee Leave Management System (ELMS)
echo ========================================================
echo.
echo   Backend will run on:  http://localhost:5000
echo   Frontend will run on: http://localhost:5173
echo.
echo   Demo Manager:  manager@gcu.in   / ManagerPass123!
echo   Demo Employee: employee1@gcu.in / EmployeePass123!
echo.
echo ========================================================
echo.

call npm.cmd run dev
pause
