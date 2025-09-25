#!/usr/bin/env node

/**
 * AnnotateFlow Assistant 打包和分发工具
 * 用于构建和打包Chrome扩展和Native Host
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

// 导入javascript-obfuscator（如果可用）
let JavaScriptObfuscator;
try {
    JavaScriptObfuscator = require('javascript-obfuscator');
} catch (e) {
    console.warn('警告：无法加载javascript-obfuscator，将使用简化版混淆');
    JavaScriptObfuscator = null;
}

// 读取配置文件
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
let obfuscatorConfig = {};
try {
    obfuscatorConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'javascript-obfuscator-config.json'), 'utf8'));
} catch (e) {
    console.warn('警告：无法加载javascript-obfuscator配置，将使用默认配置');
}

console.log(`开始构建 ${config.projectName} v${config.version}`);

// 创建输出目录
const distDir = path.join(__dirname, config.build.outputDir);
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// 构建Chrome扩展
function buildChromeExtension() {
    console.log('正在构建Chrome扩展...');

    const extensionDir = path.join(__dirname, '..', config.build.chromeExtensionDir);
    const distExtensionDir = path.join(distDir, 'extension');

    // 创建扩展目录
    if (!fs.existsSync(distExtensionDir)) {
        fs.mkdirSync(distExtensionDir, { recursive: true });
    }

    // 复制必要文件
    const essentialFiles = [
        'manifest.json',
        'popup.html',
        'popup.js',
        'background.js',
        'content.js',
        'cardkey-validator.js',
        'resource-extractor.js',
        'runninghub-config.json',
        'icon.png'
    ];

    essentialFiles.forEach(file => {
        const srcPath = path.join(extensionDir, file);
        const destPath = path.join(distExtensionDir, file);

        if (fs.existsSync(srcPath)) {
            if (fs.lstatSync(srcPath).isDirectory()) {
                copyDir(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    });

    // 混淆JavaScript文件
    if (config.obfuscation.enabled) {
        config.obfuscation.chromeExtensionFiles.forEach(file => {
            const filePath = path.join(distExtensionDir, file);
            if (fs.existsSync(filePath)) {
                obfuscateJavaScript(filePath);
            }
        });
    }

    console.log('Chrome扩展构建完成');
}

// 构建Native Host
function buildNativeHost() {
    console.log('正在构建Native Host...');

    const nativeHostDir = config.build.nativeHostDir;
    const nativeHostFile = config.build.nativeHostFile;
    const distNativeHostDir = path.join(distDir, 'native-host');

    // 创建Native Host目录
    if (!fs.existsSync(distNativeHostDir)) {
        fs.mkdirSync(distNativeHostDir, { recursive: true });
    }

    // 复制Native Host文件
    const srcPath = path.join(__dirname, '..', nativeHostFile);
    const destPath = path.join(distNativeHostDir, nativeHostFile);

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);

        // 混淆Python文件（简化处理，实际可能需要更复杂的混淆）
        if (config.obfuscation.enabled) {
            obfuscatePython(destPath);
        }
    }

    // 复制安装脚本
    copyInstallScripts(distNativeHostDir);

    // 创建requirements.txt文件
    createRequirementsFile(distNativeHostDir);

    console.log('Native Host构建完成');
}

// 复制目录
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 混淆JavaScript文件
function obfuscateJavaScript(filePath) {
    console.log(`正在混淆JavaScript文件: ${filePath}`);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const obfuscatedContent = obfuscateJavaScriptContent(content);
        fs.writeFileSync(filePath, obfuscatedContent, 'utf8');
        console.log(`JavaScript文件混淆完成: ${filePath}`);
    } catch (error) {
        console.error(`混淆JavaScript文件失败: ${filePath}`, error.message);
    }
}

// JavaScript混淆函数
function obfuscateJavaScriptContent(content) {
    // 如果javascript-obfuscator可用，使用它进行专业混淆
    if (JavaScriptObfuscator) {
        try {
            const obfuscationResult = JavaScriptObfuscator.obfuscate(content, obfuscatorConfig);
            return obfuscationResult.getObfuscatedCode();
        } catch (error) {
            console.error('JavaScript混淆失败，使用简化版混淆:', error.message);
        }
    }

    // 如果javascript-obfuscator不可用或失败，使用简化版混淆
    console.warn('使用简化版JavaScript混淆');
    return content
        .replace(/console\.log/g, 'c.log')
        .replace(/debugLog/g, 'd.log');
}

// 混淆Python文件（简化处理）
function obfuscatePython(filePath) {
    console.log(`正在处理Python文件: ${filePath}`);

    try {
        // 这里应该使用pyarmor或其他Python混淆工具
        // 简化处理，只做基本的重命名
        const content = fs.readFileSync(filePath, 'utf8');
        const obfuscatedContent = simpleObfuscatePython(content);
        fs.writeFileSync(filePath, obfuscatedContent, 'utf8');
        console.log(`Python文件处理完成: ${filePath}`);
    } catch (error) {
        console.error(`处理Python文件失败: ${filePath}`, error.message);
    }
}

// 简单的Python混淆（实际项目中应使用专业的混淆器）
function simpleObfuscatePython(content) {
    // 这只是一个示例
    return content;
}

// 创建requirements.txt文件
function createRequirementsFile(dir) {
    const requirements = `# Python dependencies for AnnotateFlow Assistant Native Host
# This file lists all required Python packages

# Base requirements
requests>=2.25.1
`;

    fs.writeFileSync(path.join(dir, 'requirements.txt'), requirements);
}

// 复制或创建安装脚本
function copyInstallScripts(dir) {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    const version = config.version;

    // Windows安装脚本内容
    const windowsScriptContent = `@echo off
REM AnnotateFlow-Assistant Windows 安装脚本
REM 版本: ${version}

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
    set "PATH=%PATH%;%LOCALAPPDATA%\\Programs\\Python\\Python39;%LOCALAPPDATA%\\Programs\\Python\\Python39\\Scripts"
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

REM 检查LOCALAPPDATA环境变量
if "%LOCALAPPDATA%"=="" (
    echo 错误：LOCALAPPDATA环境变量未设置
    echo 尝试使用默认路径...
    set USERPROFILE_PATH=%USERPROFILE%
    if "%USERPROFILE_PATH%"=="" (
        echo 错误：无法确定用户目录
        pause
        exit /b 1
    )
    set NATIVE_HOST_DIR=%USERPROFILE_PATH%\AppData\Local\Google\Chrome\User Data\NativeMessagingHosts\com.annotateflow.assistant
) else (
    set NATIVE_HOST_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\com.annotateflow.assistant
)

echo Native Host目录: %NATIVE_HOST_DIR%

REM 创建Native Host目录
echo 正在创建Native Host目录...
if not exist "%NATIVE_HOST_DIR%" (
    mkdir "%NATIVE_HOST_DIR%"
    if %errorlevel% neq 0 (
        echo 错误：无法创建Native Host目录
        echo 请检查权限或手动创建目录
        pause
        exit /b 1
    )
)

REM 复制native_host.py到适当位置
echo 正在复制Native Host文件...
copy "native_host.py" "%NATIVE_HOST_DIR%\native_host.py"
if %errorlevel% neq 0 (
    echo 错误：无法复制Native Host文件
    pause
    exit /b 1
)

REM 创建manifest.json
echo 正在创建manifest.json...
(
echo {^
echo   "name": "com.annotateflow.assistant",^
echo   "description": "Chrome extension for Tencent QLabel annotation platform with PS integration",^
echo   "path": "%NATIVE_HOST_DIR:\=\\%\\native_host.py",^
echo   "type": "stdio",^
echo   "allowed_origins": [^
echo     "chrome-extension://__MSG_@@extension_id__/"]^
echo }
) > "%NATIVE_HOST_DIR%\com.annotateflow.assistant.json"

if %errorlevel% neq 0 (
    echo 错误：无法创建manifest.json文件
    pause
    exit /b 1
)

echo 安装完成！
echo.
echo 请在Chrome中加载扩展：
echo 1. 打开Chrome浏览器
echo 2. 进入 chrome://extensions/
echo 3. 启用"开发者模式"
echo 4. 点击"加载已解压的扩展程序"
echo 5. 选择extension文件夹
echo.
pause`;

    // macOS安装脚本内容
    const macosScriptContent = `#!/bin/bash
# AnnotateFlow-Assistant macOS 安装脚本
# 版本: ${version}

echo "正在安装 AnnotateFlow-Assistant..."

# 检查Homebrew
if ! command -v brew &> /dev/null
then
    echo "未检测到Homebrew，正在安装..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ $? -ne 0 ]; then
        echo "Homebrew安装失败，请手动安装后再运行此脚本"
        exit 1
    fi
fi

# 检查Python环境
if ! command -v python3 &> /dev/null
then
    echo "未检测到Python环境，正在通过Homebrew安装..."
    brew install python
    if [ $? -ne 0 ]; then
        echo "Python安装失败"
        exit 1
    fi
fi

# 验证Python安装
PYTHON_VERSION=$(python3 --version 2>&1)
if [ $? -ne 0 ]; then
    echo "Python安装验证失败"
    exit 1
fi

echo "Python环境已准备就绪: $PYTHON_VERSION"

# 安装Python依赖（如果需要）
echo "正在安装Python依赖..."
pip3 install -r requirements.txt 2>/dev/null || echo "警告：无法安装Python依赖，可能需要手动安装"

# 配置Chrome Native Messaging Host
echo "正在配置Chrome Native Messaging Host..."

# 检查HOME环境变量
if [ -z "$HOME" ]; then
    echo "错误：HOME环境变量未设置"
    exit 1
fi

NATIVE_HOST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.annotateflow.assistant"
echo "Native Host目录: $NATIVE_HOST_DIR"

# 检查Chrome目录是否存在
CHROME_DIR="$HOME/Library/Application Support/Google/Chrome"
if [ ! -d "$CHROME_DIR" ]; then
    echo "警告：Chrome目录不存在，可能Chrome从未运行过"
    echo "请先启动Chrome浏览器，然后重新运行此脚本"
    # 询问用户是否继续
    read -p "是否仍然继续创建目录？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建Native Host目录
echo "正在创建Native Host目录..."
mkdir -p "$NATIVE_HOST_DIR"
if [ $? -ne 0 ]; then
    echo "错误：无法创建Native Host目录"
    echo "请尝试以下解决方案："
    echo "1. 手动创建目录：mkdir -p \"$NATIVE_HOST_DIR\""
    echo "2. 检查权限：ls -la \"$HOME/Library/Application Support/Google/\""
    echo "3. 确保Chrome已运行过至少一次"
    exit 1
fi

# 复制native_host.py到适当位置
echo "正在复制Native Host文件..."
cp native_host.py "$NATIVE_HOST_DIR/native_host.py"
if [ $? -ne 0 ]; then
    echo "错误：无法复制Native Host文件"
    exit 1
fi

# 创建manifest.json
echo "正在创建manifest.json..."
cat > "$NATIVE_HOST_DIR/com.annotateflow.assistant.json" << EOF
{
  "name": "com.annotateflow.assistant",
  "description": "Chrome extension for Tencent QLabel annotation platform with PS integration",
  "path": "$NATIVE_HOST_DIR/native_host.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://__MSG_@@extension_id__/"
  ]
}
EOF

if [ $? -ne 0 ]; then
    echo "错误：无法创建manifest.json文件"
    exit 1
fi

echo "安装完成！"
echo ""
echo "请在Chrome中加载扩展："
echo "1. 打开Chrome浏览器"
echo "2. 进入 chrome://extensions/"
echo "3. 启用\\"开发者模式\\""
echo "4. 点击\\"加载已解压的扩展程序\\""
echo "5. 选择extension文件夹"`;

    // 创建Windows安装脚本
    const windowsScriptPath = path.join(dir, 'install.bat');
    fs.writeFileSync(windowsScriptPath, windowsScriptContent);

    // 创建macOS安装脚本
    const macosScriptPath = path.join(dir, 'install.sh');
    fs.writeFileSync(macosScriptPath, macosScriptContent);
    fs.chmodSync(macosScriptPath, 0o755);
}

// 创建分发包
function createDistribution() {
    console.log('正在创建分发包...');

    const packageName = `${config.projectName}-v${config.version}`;
    const packageDir = path.join(distDir, packageName);

    // 创建包目录
    if (!fs.existsSync(packageDir)) {
        fs.mkdirSync(packageDir, { recursive: true });
    }

    // 复制构建文件
    copyDir(path.join(distDir, 'extension'), path.join(packageDir, 'extension'));
    copyDir(path.join(distDir, 'native-host'), path.join(packageDir, 'native-host'));

    // 创建README文件
    const readme = `# ${config.projectName} v${config.version}

${config.description}

## 安装说明

### Windows
1. 运行 \`install.bat\` 脚本
2. 按照提示操作

### macOS
1. 运行 \`install.sh\` 脚本
2. 按照提示操作

## 功能特性
- Chrome扩展支持D键下载图片、空格键跳过、S键提交等快捷键
- PS插件集成，支持自动上传修改图和蒙版图
- 设备指纹验证和卡密验证
- 支持RunningHub AI图像处理功能

## 系统要求
- Chrome浏览器
- Python 3.9或更高版本
- Windows/macOS操作系统

## 技术架构
- Chrome扩展 (Manifest V3)
- Native Messaging Host (Python)
- HTTP服务器用于PS插件通信

如有问题，请联系开发团队。
`;

    fs.writeFileSync(path.join(packageDir, 'README.txt'), readme);

    console.log(`分发包创建完成: ${packageName}`);
}

// 主函数
function main() {
    try {
        buildChromeExtension();
        buildNativeHost();
        createDistribution();
        console.log('构建和打包完成！');
    } catch (error) {
        console.error('构建过程出错:', error);
        process.exit(1);
    }
}

// 执行主函数
main();