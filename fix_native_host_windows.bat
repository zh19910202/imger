@echo off
echo 正在修复 AnnotateFlow Assistant Native Host 配置 (Windows)...

REM 获取当前目录
set "CURRENT_DIR=%~dp0"

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 警告：未找到Python，请确保已安装Python 3.6+
)

REM 检查必要文件是否存在
if not exist "%CURRENT_DIR%native_host.py" (
    echo 错误：native_host.py 文件不存在
    pause
    exit /b 1
)

if not exist "%CURRENT_DIR%native_host_launcher.bat" (
    echo 错误：native_host_launcher.bat 文件不存在
    pause
    exit /b 1
)

if not exist "%CURRENT_DIR%com.annotateflow.assistant.json" (
    echo 错误：com.annotateflow.assistant.json 文件不存在
    pause
    exit /b 1
)

REM 创建NativeMessagingHosts目录（如果不存在）
set "NATIVE_DIR=%USERPROFILE%\AppData\Local\Google\Chrome\User Data\NativeMessagingHosts"
if not exist "%NATIVE_DIR%" (
    echo 创建NativeMessagingHosts目录...
    mkdir "%NATIVE_DIR%"
)

REM 复制文件到Chrome目录
echo 复制文件到Chrome NativeMessaging目录...
copy "%CURRENT_DIR%com.annotateflow.assistant.json" "%NATIVE_DIR%\" >nul
copy "%CURRENT_DIR%native_host.py" "%NATIVE_DIR%\" >nul
copy "%CURRENT_DIR%native_host_launcher.bat" "%NATIVE_DIR%\" >nul

REM 更新JSON文件中的路径为相对路径（Chrome会自动处理）
echo 更新Native Host配置...

REM 注册Native Host到Windows注册表
echo 正在注册Native Host到注册表...
reg add "HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.annotateflow.assistant" /ve /t REG_SZ /d "%NATIVE_DIR%\com.annotateflow.assistant.json" /f >nul 2>&1
if errorlevel 1 (
    echo 警告：注册表注册失败，可能需要管理员权限
    echo 请以管理员身份运行此脚本，或手动注册注册表项
) else (
    echo 注册表注册成功
)

echo.
echo Native Host 修复完成！
echo 请重启Chrome浏览器以使更改生效。
echo 文件已复制到：%NATIVE_DIR%
pause