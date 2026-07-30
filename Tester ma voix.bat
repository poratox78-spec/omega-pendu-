@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Lancement du test voix OMEGA... (la 1re fois, le modele se telecharge, patiente)
python dictee\asr_voix_test.py
echo.
echo Fenetre fermee. Tu peux fermer ceci.
pause
