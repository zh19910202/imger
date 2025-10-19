# AnnotateFlow Assistant 分发包说明

## 分发包结构
```
build/dist/AnnotateFlow-Assistant-v2.0.0/
├── extension/                 # Chrome扩展文件
│   ├── manifest.json          # 扩展配置文件
│   ├── background.js          # 后台脚本
│   ├── content.js             # 内容脚本
│   ├── popup.html             # 弹出窗口HTML
│   ├── popup.js               # 弹出窗口脚本
│   ├── resource-extractor.js  # 资源提取脚本
│   ├── runninghub-config.json # RunningHub配置
│   └── icons/                 # 图标文件
├── native-host/               # Native Host相关文件
│   ├── native_host.py         # Python Native Host程序
│   ├── install.sh             # macOS安装脚本
│   ├── install.bat            # Windows安装脚本
│   └── requirements.txt       # Python依赖列表
└── README.txt                 # 使用说明
```

## 一键安装功能

### Windows 平台
分发包包含 `install.bat` 脚本，用户只需双击运行即可：
1. 自动检测Python环境
2. 如果未安装Python，自动下载并安装Python 3.9+
3. 自动安装Python依赖
4. 自动配置Chrome Native Messaging Host
5. 提示用户如何在Chrome中加载扩展

### macOS 平台
分发包包含 `install.sh` 脚本，用户只需在终端中运行即可：
1. 自动检测和安装Homebrew（如果未安装）
2. 自动检测和安装Python 3.9+（通过Homebrew）
3. 自动安装Python依赖
4. 自动配置Chrome Native Messaging Host
5. 提示用户如何在Chrome中加载扩展

## 自动安装Python的实现

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

## 构建和分发

### 构建命令
```bash
# 构建分发包
npm run build-dist
```

### 构建过程
1. 构建Chrome扩展并混淆JavaScript文件
2. 复制和处理Native Host文件
3. 复制安装脚本到分发包
4. 创建完整的分发包目录结构
5. 生成README.txt文件

## 使用说明

1. **用户只需运行对应平台的安装脚本**：
   - Windows: 双击 `install.bat`
   - macOS: 在终端中运行 `./install.sh`

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