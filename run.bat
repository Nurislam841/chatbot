@echo off
title KTZ Telegram Bot
cls
:start
echo [%TIME%] Checking and installing dependencies...
call npm install
echo [%TIME%] Starting Bot...
call npm start
echo [%TIME%] Bot crashed or stopped! Restarting in 5 seconds...
timeout /t 5
goto start
