@echo off
echo 正在测试 Native Host 功能...
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误：未找到Python，请先安装Python 3.6+
    pause
    exit /b 1
)

REM 检查测试脚本是否存在
if not exist "test_native_host.py" (
    echo 错误：test_native_host.py 文件不存在
    pause
    exit /b 1
)

echo 开始测试...
echo.

REM 运行Python测试脚本
python test_native_host.py

echo.
echo 测试完成！
pause
