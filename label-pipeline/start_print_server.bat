@echo off
:: Starts the local label-print server used by the admin pages' "print label set" button.
:: Leave this window open while you work; close it to stop.
::
:: To also allow the deployed admin site, set its address first, e.g.:
::     set LC_ALLOWED_ORIGINS=https://your-shop-domain.example
cd /d "%~dp0"
node server\print_server.mjs
pause
