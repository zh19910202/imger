@echo off
echo 正在安装 AnnotateFlow Assistant Native Host...

REM 获取当前目录
set "CURRENT_DIR=%~dp0"

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误：未找到Python，请先安装Python 3.6+
    pause
    exit /b 1
)

REM 检查文件是否存在
if not exist "%CURRENT_DIR%native_host.py" (
    echo 错误：native_host.py 文件不存在
    pause
    exit /b 1
)

if not exist "%CURRENT_DIR%com.annotateflow.assistant.json" (
    echo 错误：com.annotateflow.assistant.json 文件不存在
    pause
    exit /b 1
)

REM 创建NativeMessagingHosts目录
set "NATIVE_DIR=%USERPROFILE%\AppData\Local\Google\Chrome\User Data\NativeMessagingHosts"
if not exist "%NATIVE_DIR%" mkdir "%NATIVE_DIR%"

REM 复制文件到Chrome目录
copy "%CURRENT_DIR%com.annotateflow.assistant.json" "%NATIVE_DIR%\" >nul
copy "%CURRENT_DIR%native_host.py" "%NATIVE_DIR%\" >nul

REM 更新JSON文件中的路径
powershell -Command "(Get-Content '%NATIVE_DIR%\com.annotateflow.assistant.json') -replace 'native_host.py', '%NATIVE_DIR%\native_host.py' | Set-Content '%NATIVE_DIR%\com.annotateflow.assistant.json'"

echo Native Host 安装完成！
echo 文件已复制到：%NATIVE_DIR%
echo 请重启Chrome浏览器以使更改生效。
pause
