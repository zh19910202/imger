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
    console.log('已加载javascript-obfuscator，将使用专业混淆');
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
        .replace(/console\.log/g, 'c_log')
        .replace(/debugLog/g, 'd_log')
        // 修复属性名混淆问题
        .replace(/\bd\.logs\b/g, 'debugLogs')
        .replace(/\bc\.logs\b/g, 'consoleLogs')
        .replace(/\bd_logs\b/g, 'debugLogs')
        .replace(/\bc_logs\b/g, 'consoleLogs');
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

    // Windows启动器脚本内容
    const windowsLauncherContent = `@echo off
:: Native Host Launcher for Windows
:: This script is called by Chrome to launch the native host

python "%~dp0native_host.py" %*`;

    // Windows安装脚本内容（更新版）
    const windowsScriptContent = `# AnnotateFlow-Assistant Windows Installation Script (Simple Version)
# Version: ${version}

Write-Host "Installing AnnotateFlow-Assistant..."

# Check Python environment
python --version 2>$null
if (-not $?) {
    Write-Host "Error: Python environment not found"
    Write-Host "Please install Python 3.9 or higher first"
    $null = Read-Host "Press any key to exit..."
    exit 1
}

Write-Host "Python environment is ready"

# Install Python dependencies (if needed)
Write-Host "Installing Python dependencies..."
pip install -r requirements.txt 2>$null
if (-not $?) {
    Write-Host "Warning: Unable to install Python dependencies, you may need to install them manually"
}

# Configure Chrome Native Messaging Host
Write-Host "Configuring Chrome Native Messaging Host..."

# Set Native Host base directory
$nativeMessagingBaseDir = "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\NativeMessagingHosts"
$nativeHostDir = "$nativeMessagingBaseDir\\com.annotateflow.assistant"
Write-Host "Native Host directory: $nativeHostDir"

# Create Native Host directory
Write-Host "Creating Native Host directory..."
New-Item -ItemType Directory -Path $nativeHostDir -Force 2>$null
if (-not $?) {
    Write-Host "Error: Unable to create Native Host directory"
    $null = Read-Host "Press any key to exit..."
    exit 1
}

# Copy native_host.py to appropriate location
Write-Host "Copying Native Host file..."
Copy-Item "native_host.py" "$nativeHostDir\\native_host.py" -Force
if (-not $?) {
    Write-Host "Error: Unable to copy Native Host file"
    $null = Read-Host "Press any key to exit..."
    exit 1
}

# Create launcher scripts
Write-Host "Creating launcher scripts..."
Set-Content "$nativeHostDir\\native_host_launcher.cmd" '@echo off
:: Native Host Launcher for Windows
:: This script is called by Chrome to launch the native host

python "%~dp0native_host.py" %*'

# Create manifest.json
Write-Host "Creating manifest.json..."
$manifestContent = @{
    name = "com.annotateflow.assistant"
    description = "Chrome extension for Tencent QLabel annotation platform with PS integration"
    path = "$nativeHostDir\\native_host_launcher.cmd"
    type = "stdio"
    allowed_origins = @("chrome-extension://phkoioegfpgodahcdamjdkbmkemphobd/")
} | ConvertTo-Json -Depth 10

# 保存manifest.json到Native Messaging Hosts根目录而不是子目录
$manifestPath = "$nativeMessagingBaseDir\\com.annotateflow.assistant.json"
$manifestContent | Set-Content $manifestPath

if (-not $?) {
    Write-Host "Error: Unable to create manifest.json file"
    $null = Read-Host "Press any key to exit..."
    exit 1
}

Write-Host "Installation completed!"
Write-Host ""
Write-Host "Please load the extension in Chrome:"
Write-Host "1. Open Chrome browser"
Write-Host "2. Go to chrome://extensions/"
Write-Host "3. Enable ""Developer mode"""
Write-Host "4. Click ""Load unpacked extension"""
Write-Host "5. Select the extension folder"
Write-Host ""
$null = Read-Host "Press any key to exit..."`;

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
    const windowsScriptPath = path.join(dir, 'install.ps1');
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