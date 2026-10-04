@echo off
:: Starts the local label-print server used by the admin pages' "print label set" button.
:: Leave this window open while you work; close it to stop.
::
:: The deployed admin (this shop's site) is allowed to call this server. For another address,
:: change the line below.
set LC_ALLOWED_ORIGINS=https://diy-figure-app.vercel.app
cd /d "%~dp0"
node server\print_server.mjs
pause
