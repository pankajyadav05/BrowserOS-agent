@echo off
echo ========================================
echo Mitria Extension Testing Guide
echo ========================================
echo.
echo Extension Location:
echo   Unpacked: %cd%\dist
echo   Packed:   %cd%\dist.crx
echo.
echo ----------------------------------------
echo Verification Checklist:
echo ----------------------------------------
echo.
echo [ ] 1. Open chrome://extensions in your browser
echo [ ] 2. Enable "Developer mode" (top-right toggle)
echo [ ] 3. Click "Load unpacked" and select: %cd%\dist
echo [ ] 4. Verify Extension ID: djhdjhlnljbjgejbndockeedocneiaei
echo [ ] 5. Extension name shows: "Mitria"
echo [ ] 6. Extension is ENABLED (toggle is on)
echo.
echo ----------------------------------------
echo Test Cases:
echo ----------------------------------------
echo.
echo TEST 1: New Tab Override
echo [ ] Open new tab (Ctrl+T)
echo [ ] Should display your custom new tab page
echo [ ] NOT the default Chrome new tab
echo.
echo TEST 2: Sidepanel
echo [ ] Press Ctrl+E (or click extension icon)
echo [ ] Sidepanel opens from right side
echo [ ] Shows your AI agent interface
echo.
echo TEST 3: Extension ID
echo [ ] In chrome://extensions, check ID
echo [ ] Should be: djhdjhlnljbjgejbndockeedocneiaei
echo [ ] Copy actual ID: __________________________
echo.
echo ----------------------------------------
echo Common Issues:
echo ----------------------------------------
echo.
echo ISSUE: Extension won't load
echo FIX: Check console for errors (F12 on extensions page)
echo.
echo ISSUE: New tab not showing custom page
echo FIX: 1. Check manifest.json has "chrome_url_overrides"
echo      2. Reload extension (click reload icon)
echo      3. Hard refresh new tab (Ctrl+Shift+R)
echo.
echo ISSUE: Different Extension ID
echo FIX: You packed with different private key
echo      Delete dist.pem and dist.crx, rebuild
echo.
echo ========================================
echo Press any key to open extensions folder...
pause >nul
explorer "%cd%\dist"
