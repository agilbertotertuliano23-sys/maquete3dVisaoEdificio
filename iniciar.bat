@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ====================================================================
echo          ILUSÃO DIGITAL STUDIO 3D — MAQUETE INTERATIVA
echo   Vista Aérea 3D • Fachada Frontal • Planta Baixa Geral (Setores 1-7)
echo   Desmonte Interativo em H • Paisagismo • Ficha Técnica & Unidades 3D
echo ====================================================================
echo.
echo Links disponíveis:
echo  - Maquete 3D Interativa:    http://localhost:18910/index.html
echo  - Referencia enviada:      reference\reel-Dd2FExNoS6Q.mp4
echo  - Biblioteca 360:          http://localhost:18910/panoramas.html
echo.
echo Abrindo o navegador e iniciando servidor local HTTP na porta 18910...
start "" http://localhost:18910/index.html
python -m http.server 18910
