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
        'resource-extractor.js',
        'runninghub-config.json',
        'icons'
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

// 复制安装脚本
function copyInstallScripts(dir) {
    // 复制Windows安装脚本
    const windowsScriptPath = path.join(__dirname, '..', 'build', 'dist', 'native-host', 'install.bat');
    if (fs.existsSync(windowsScriptPath)) {
        fs.copyFileSync(windowsScriptPath, path.join(dir, 'install.bat'));
    }

    // 复制macOS安装脚本
    const macosScriptPath = path.join(__dirname, '..', 'build', 'dist', 'native-host', 'install.sh');
    if (fs.existsSync(macosScriptPath)) {
        fs.copyFileSync(macosScriptPath, path.join(dir, 'install.sh'));
        fs.chmodSync(path.join(dir, 'install.sh'), 0o755);
    }
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