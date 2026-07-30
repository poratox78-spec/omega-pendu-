@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Lancement de la dictee vocale (Whisper local)... (1re fois : telechargement ~460 Mo, patiente)
python dictee\asr_voix_gui.py
echo.
echo Fenetre fermee. Tu peux fermer ceci.
pause
