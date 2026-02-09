@echo off
title DataInsight Server
echo Iniciando DataInsight...
start "" "http://localhost:8000"
cd /d "%~dp0"
echo Instalando dependencias...
pip install -r requirements.txt
python -m backend.main
pause
