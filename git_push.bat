@echo off
echo Iniciando subida a GitHub...
git init
git config user.email "deploy@datainsight.com"
git config user.name "DataInsight Deployer"
git add .
git commit -m "Initial commit"
git branch -M main
git remote remove origin
git remote add origin https://github.com/Rodrigoem01/datainsight-app.git
echo.
echo ----------------------------------------------------------------
echo Ahora se intentara subir el codigo.
echo Si aparece una ventana de inicio de sesion, usala.
echo ----------------------------------------------------------------
git push -u origin main
echo.
echo Si todo salio bien, veras un mensaje de exito arriba.
pause
