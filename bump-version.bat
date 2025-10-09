@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Mitria Version Bump Tool
echo ========================================
echo.

REM Get current version from manifest.json
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" manifest.json') do (
    set CURRENT_VERSION=%%a
    set CURRENT_VERSION=!CURRENT_VERSION:"=!
)

echo Current version: %CURRENT_VERSION%
echo.
echo What type of update?
echo   1. Patch (bug fixes)     - Example: 1.0.0 → 1.0.1
echo   2. Minor (new features)  - Example: 1.0.0 → 1.1.0
echo   3. Major (big changes)   - Example: 1.0.0 → 2.0.0
echo   4. Custom version
echo.

set /p CHOICE="Enter choice (1-4): "

if "%CHOICE%"=="4" (
    set /p NEW_VERSION="Enter new version (e.g., 1.2.3): "
) else (
    REM Parse current version
    for /f "tokens=1,2,3 delims=." %%a in ("%CURRENT_VERSION%") do (
        set MAJOR=%%a
        set MINOR=%%b
        set PATCH=%%c
    )

    if "%CHOICE%"=="1" (
        set /a PATCH+=1
        set NEW_VERSION=!MAJOR!.!MINOR!.!PATCH!
    )
    if "%CHOICE%"=="2" (
        set /a MINOR+=1
        set PATCH=0
        set NEW_VERSION=!MAJOR!.!MINOR!.!PATCH!
    )
    if "%CHOICE%"=="3" (
        set /a MAJOR+=1
        set MINOR=0
        set PATCH=0
        set NEW_VERSION=!MAJOR!.!MINOR!.!PATCH!
    )
)

echo.
echo ========================================
echo Version Update Summary
echo ========================================
echo Old version: %CURRENT_VERSION%
echo New version: %NEW_VERSION%
echo.
echo Files that will be updated:
echo   - manifest.json
echo   - package.json
echo   - update-manifest.xml
echo.

set /p CONFIRM="Proceed with update? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Cancelled.
    exit /b
)

echo.
echo Updating files...

REM Update manifest.json
powershell -Command "(Get-Content manifest.json) -replace '\"version\": \"%CURRENT_VERSION%\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content manifest.json"
echo   [OK] manifest.json

REM Update package.json
powershell -Command "(Get-Content package.json) -replace '\"version\": \"%CURRENT_VERSION%\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.json"
echo   [OK] package.json

REM Update update-manifest.xml
powershell -Command "(Get-Content update-manifest.xml) -replace 'version=\"%CURRENT_VERSION%\"', 'version=\"%NEW_VERSION%\"' | Set-Content update-manifest.xml"
echo   [OK] update-manifest.xml

echo.
echo ========================================
echo Version updated to %NEW_VERSION%
echo ========================================
echo.
echo Next steps:
echo   1. npm run build
echo   2. Package as CRX (chrome://extensions → Pack extension)
echo   3. Upload dist.crx to Vercel
echo   4. Upload update-manifest.xml to Vercel
echo.
pause
