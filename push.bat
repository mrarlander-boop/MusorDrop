@echo off
chcp 65001 >nul
set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"

echo ====================================================
echo   Загрузка проекта на GitHub (MusorDrop)
echo ====================================================
echo.
echo Вставьте ваш GitHub Personal Access Token и нажмите Enter:
set /p TOKEN="Токен: "

if "%TOKEN%"=="" (
    echo Попытка отправки через стандартную авторизацию...
    git push -u origin main
) else (
    echo Отправка на GitHub...
    git push https://%TOKEN%@github.com/mrarlander-boop/MusorDrop.git main
)

echo.
echo ====================================================
pause
