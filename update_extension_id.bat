@echo off
echo 正在更新扩展ID...

REM 获取扩展ID
for /f "tokens=2 delims= " %%i in ('reg query "HKEY_CURRENT_USER\Software\Google\Chrome\Extensions" /s /f "AnnotateFlow Assistant" ^| findstr "AnnotateFlow Assistant"') do (
    set "EXTENSION_ID=%%i"
    goto :found
)

:found
if "%EXTENSION_ID%"=="" (
    echo 未找到扩展ID，请先安装扩展
    pause
    exit /b 1
)

echo 找到扩展ID: %EXTENSION_ID%

REM 更新JSON文件
set "NATIVE_DIR=%USERPROFILE%\AppData\Local\Google\Chrome\User Data\NativeMessagingHosts"
set "JSON_FILE=%NATIVE_DIR%\com.annotateflow.assistant.json"

if exist "%JSON_FILE%" (
    powershell -Command "(Get-Content '%JSON_FILE%') -replace '__MSG_@@extension_id__', '%EXTENSION_ID%' | Set-Content '%JSON_FILE%'"
    echo 扩展ID已更新
) else (
    echo 错误：JSON文件不存在，请先运行 install_native_host.bat
)

pause
