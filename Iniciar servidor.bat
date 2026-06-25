@echo off
title Servidor Baby Shower Eros
echo Iniciando servidor local en http://localhost:8000
echo Deja esta ventana abierta mientras usas la invitacion.
echo Cierra esta ventana para detener el servidor.
echo.
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0serve.ps1"
echo.
echo El servidor se detuvo. Pulsa una tecla para cerrar.
pause >nul
