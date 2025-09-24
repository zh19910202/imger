@echo off
REM AnnotateFlow-Assistant Windows 安装脚本
REM 版本: {{VERSION}}

echo 正在安装 AnnotateFlow-Assistant...

REM 检查PowerShell版本
powershell -Command "Get-Host" >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：需要PowerShell来下载Python
    pause
    exit /b 1
)

REM 检查Python环境
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 未检测到Python环境，正在自动安装...

    REM 下载Python安装程序
    set PYTHON_INSTALLER_URL=https://www.python.org/ftp/python/3.9.13/python-3.9.13-amd64.exe
    set PYTHON_INSTALLER_NAME=python-installer.exe

    echo 正在下载Python安装程序...
    powershell -Command "Invoke-WebRequest -Uri '%PYTHON_INSTALLER_URL%' -OutFile '%PYTHON_INSTALLER_NAME%'"
    if %errorlevel% neq 0 (
        echo 错误：下载Python安装程序失败
        pause
        exit /b 1
    )

    echo 正在安装Python，请稍候...
    echo 这可能需要几分钟时间...
    %PYTHON_INSTALLER_NAME% /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
    if %errorlevel% neq 0 (
        echo 错误：Python安装失败
        pause
        exit /b 1
    )

    echo Python安装完成
    del %PYTHON_INSTALLER_NAME%

    REM 刷新环境变量
    echo 刷新环境变量...
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python39;%LOCALAPPDATA%\Programs\Python\Python39\Scripts"
)

REM 验证Python安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：Python安装验证失败
    pause
    exit /b 1
)

echo Python环境已准备就绪

REM 安装Python依赖（如果需要）
echo 正在安装Python依赖...
pip install -r requirements.txt >nul 2>&1
if %errorlevel% neq 0 (
    echo 警告：无法安装Python依赖，可能需要手动安装
)

REM 配置Chrome Native Messaging Host
echo 正在配置Chrome Native Messaging Host...

REM 复制native_host.py到适当位置
set NATIVE_HOST_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\com.annotateflow.assistant
if not exist "%NATIVE_HOST_DIR%" mkdir "%NATIVE_HOST_DIR%"
copy "native_host.py" "%NATIVE_HOST_DIR%\native_host.py"

REM 创建manifest.json
(
echo {^
echo   "name": "com.annotateflow.assistant",^
echo   "description": "Chrome extension for Tencent QLabel annotation platform with PS integration",^
echo   "path": "%NATIVE_HOST_DIR%\native_host.py",^
echo   "type": "stdio",^
echo   "allowed_origins": [^
echo     "chrome-extension://__MSG_@@extension_id__/"^
echo   ]^
echo }
) > "%NATIVE_HOST_DIR%\com.annotateflow.assistant.json"

echo 安装完成！
echo.
echo 请在Chrome中加载扩展：
echo 1. 打开Chrome浏览器
echo 2. 进入 chrome://extensions/
echo 3. 启用"开发者模式"
echo 4. 点击"加载已解压的扩展程序"
echo 5. 选择extension文件夹
echo.
pause