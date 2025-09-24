# AnnotateFlow Assistant 分发包说明

## 当前分发包结构
```
AnnotateFlow-Assistant-v2.0.0/
├── extension/                 # Chrome扩展文件
├── native-host/               # Native Host相关文件
│   ├── native_host.py         # Python Native Host程序
│   ├── install.sh             # macOS安装脚本
│   └── install.bat            # Windows安装脚本
├── README.txt                 # 使用说明
└── requirements.txt           # Python依赖列表
```

## 一键安装功能

### macOS 平台
当前的 `install.sh` 脚本已经实现了自动安装功能：
1. 自动检测和安装 Homebrew（如果未安装）
2. 自动检测和安装 Python 3.9+（通过 Homebrew）
3. 自动安装 Python 依赖
4. 自动配置 Chrome Native Messaging Host

### Windows 平台
当前的 `install.bat` 脚本也实现了自动安装功能：
1. 自动检测 Python 环境
2. 如果未安装 Python，自动下载并安装 Python 3.9+
3. 自动安装 Python 依赖
4. 自动配置 Chrome Native Messaging Host

## 自动安装 Python 的实现

### macOS (install.sh)
```bash
# 检查Homebrew
if ! command -v brew &> /dev/null
then
    echo "未检测到Homebrew，正在安装..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# 检查Python环境
if ! command -v python3 &> /dev/null
then
    echo "未检测到Python环境，正在通过Homebrew安装..."
    brew install python
fi
```

### Windows (install.bat)
```batch
REM 检查Python环境
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 未检测到Python环境，正在自动安装...

    REM 下载Python安装程序
    set PYTHON_INSTALLER_URL=https://www.python.org/ftp/python/3.9.13/python-3.9.13-amd64.exe
    set PYTHON_INSTALLER_NAME=python-installer.exe

    echo 正在下载Python安装程序...
    powershell -Command "Invoke-WebRequest -Uri '%PYTHON_INSTALLER_URL%' -OutFile '%PYTHON_INSTALLER_NAME%'"

    echo 正在安装Python，请稍候...
    %PYTHON_INSTALLER_NAME% /quiet InstallAllUsers=1 PrependPath=1 Include_test=0

    del %PYTHON_INSTALLER_NAME%

    REM 刷新环境变量
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python39;%LOCALAPPDATA%\Programs\Python\Python39\Scripts"
)
```

## 使用说明

1. **用户只需运行对应平台的安装脚本**：
   - macOS: `install.sh`
   - Windows: `install.bat`

2. **安装脚本会自动处理**：
   - 环境检测
   - 缺失依赖的自动安装
   - Chrome扩展配置

3. **用户手动步骤**：
   - 在Chrome中加载扩展（按脚本提示操作）

## 进一步优化建议

1. **完全自动化安装**：
   - 创建一个统一的安装程序，自动检测操作系统并执行对应脚本
   - 在Windows上使用Inno Setup或NSIS创建安装包
   - 在macOS上创建PKG安装包或使用pkgbuild/productbuild

2. **依赖打包**：
   - 将Python依赖打包到分发包中，避免安装时下载
   - 使用pyinstaller将native_host.py打包为可执行文件，消除Python依赖

3. **扩展自动加载**：
   - 在Windows上，可能可以通过注册表修改实现扩展自动加载
   - 在macOS上，可能需要用户手动加载扩展

这样的分发包可以让用户一键安装，即使环境中没有Python也能自动安装所需环境。