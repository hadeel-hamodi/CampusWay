@echo off
title CampusWay local server
rem Serves the CampusWay folder (one level up from this file) and opens it in your browser.
cd /d "%~dp0.."
set PORT=8765
echo.
echo   CampusWay is running at  http://localhost:%PORT%/index.html
echo   Keep this window open while you use the app. Close it to stop the server.
echo.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/index.html'"
where py >nul 2>nul && (py -3 -m http.server %PORT% --bind 127.0.0.1 & goto :eof)
where python >nul 2>nul && (python -m http.server %PORT% --bind 127.0.0.1 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p %PORT% -a 127.0.0.1 -c-1 & goto :eof)
echo Could not find Python or Node.js to run a local web server.
pause
