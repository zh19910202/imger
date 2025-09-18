@echo off
setlocal enabledelayedexpansion

REM Content.js 版本切换脚本 (Windows版本)
REM 用于在原始版本和重构版本之间切换

set "RED=[91m"
set "GREEN=[92m"
set "BLUE=[94m"
set "YELLOW=[93m"
set "NC=[0m"

REM 显示当前状态
:show_current_status
echo %BLUE%=== 当前版本状态 ===%NC%

if not exist "manifest.json" (
    echo %RED%❌ manifest.json 文件不存在%NC%
    exit /b 1
)

findstr /C:"\"js\": [\"resource-extractor.js\", \"content.js\"]" manifest.json >nul
if !errorlevel! equ 0 (
    echo 📜 当前使用: %YELLOW%原始版本 ^(v1.0.0^)%NC%
    echo    文件: content.js ^(8373行, 300KB+^)
    goto :eof
)

findstr /C:"\"js\": [\"resource-extractor.js\", \"src/content.js\"]" manifest.json >nul
if !errorlevel! equ 0 (
    echo 🚀 当前使用: %GREEN%重构版本 ^(v2.0.0^)%NC%
    echo    文件: src/content.js ^(模块化架构^)
    goto :eof
)

echo ❓ 未知版本配置
echo.
goto :eof

REM 切换到原始版本
:switch_to_original
echo %YELLOW%切换到原始版本...%NC%

REM 备份当前manifest
copy manifest.json manifest.json.backup >nul

REM 创建原始版本的manifest配置
(
echo {
echo   "manifest_version": 3,
echo   "name": "Auxis",
echo   "version": "2.5.0",
echo   "description": "Annotation platform assistant: Fast image download with D key, skip with Space, submit with S key, upload with A key, history with F key, mark invalid with X key ^(auto-confirm^), batch invalid with F1, AI image processing with R key ^(RunningHub integration^)",
echo   "permissions": [
echo     "downloads",
echo     "contextMenus",
echo     "activeTab",
echo     "storage",
echo     "notifications",
echo     "tabs",
echo     "nativeMessaging",
echo     "webRequest"
echo   ],
echo   "host_permissions": [
echo     "^<all_urls^>",
echo     "*://aidata-1258344706.cos.ap-guangzhou.myqcloud.com/*"
echo   ],
echo   "background": {
echo     "service_worker": "background.js"
echo   },
echo   "action": {
echo     "default_popup": "popup.html",
echo     "default_title": "Auxis",
echo     "default_icon": {
echo       "16": "icon.png",
echo       "32": "icon.png",
echo       "48": "icon.png",
echo       "128": "icon.png"
echo     }
echo   },
echo   "icons": {
echo     "16": "icon.png",
echo     "32": "icon.png",
echo     "48": "icon.png",
echo     "128": "icon.png"
echo   },
echo   "content_scripts": [
echo     {
echo       "matches": ["https://qlabel.tencent.com/*", "http://localhost:*/*", "file://*/*"],
echo       "js": ["resource-extractor.js", "content.js"]
echo     }
echo   ],
echo   "web_accessible_resources": [
echo     {
echo       "resources": ["notification.mp3", "runninghub-config.json"],
echo       "matches": ["https://qlabel.tencent.com/*", "http://localhost:*/*", "file://*/*"]
echo     }
echo   ]
echo }
) > manifest.json

echo %GREEN%✅ 已切换到原始版本%NC%
echo    请重新加载浏览器扩展以生效
goto :eof

REM 切换到重构版本
:switch_to_refactored
echo %BLUE%切换到重构版本...%NC%

REM 检查重构文件是否存在
if not exist "src\content.js" (
    echo %RED%❌ 重构版本文件不存在: src\content.js%NC%
    echo    请确保重构代码已正确部署
    exit /b 1
)

REM 备份当前manifest
copy manifest.json manifest.json.backup >nul

REM 使用重构版本的manifest配置
copy manifest-refactored.json manifest.json >nul

echo %GREEN%✅ 已切换到重构版本%NC%
echo    请重新加载浏览器扩展以生效
goto :eof

REM 恢复备份
:restore_backup
if exist "manifest.json.backup" (
    echo %YELLOW%恢复备份...%NC%
    copy manifest.json.backup manifest.json >nul
    echo %GREEN%✅ 已恢复备份%NC%
) else (
    echo %RED%❌ 没有找到备份文件%NC%
)
goto :eof

REM 显示帮助信息
:show_help
echo %BLUE%Content.js 版本切换工具%NC%
echo.
echo 用法: %0 [选项]
echo.
echo 选项:
echo   original    切换到原始版本 ^(📜 v1.0.0^)
echo   refactored  切换到重构版本 ^(🚀 v2.0.0^)
echo   status      显示当前版本状态
echo   restore     恢复备份
echo   help        显示此帮助信息
echo.
echo 示例:
echo   %0 status              # 查看当前版本
echo   %0 refactored          # 切换到重构版本
echo   %0 original            # 切换到原始版本
echo.
echo %YELLOW%注意: 切换版本后需要重新加载浏览器扩展%NC%
goto :eof

REM 主逻辑
if "%1"=="" set "1=status"

if "%1"=="original" (
    call :show_current_status
    call :switch_to_original
    echo.
    call :show_current_status
) else if "%1"=="refactored" (
    call :show_current_status
    call :switch_to_refactored
    echo.
    call :show_current_status
) else if "%1"=="status" (
    call :show_current_status
) else if "%1"=="restore" (
    call :restore_backup
) else if "%1"=="help" (
    call :show_help
) else if "%1"=="-h" (
    call :show_help
) else if "%1"=="--help" (
    call :show_help
) else (
    echo %RED%❌ 未知选项: %1%NC%
    echo.
    call :show_help
    exit /b 1
)

echo.
echo %BLUE%💡 提示:%NC%
echo 1. 切换版本后，请在浏览器中重新加载扩展
echo 2. 可以通过控制台检查版本: console.log^(window.ANNOTATEFLOW_VERSION^)
echo 3. 使用 generateVersionReport^(^) 获取详细版本信息