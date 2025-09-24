#!/usr/bin/env node

/**
 * 构建系统测试脚本
 * 用于验证构建和分发工具是否正常工作
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 测试配置
const testConfig = {
  buildDir: path.join(__dirname),
  distDir: path.join(__dirname, 'dist'),
  expectedFiles: [
    'extension/manifest.json',
    'extension/background.js',
    'extension/content.js',
    'native-host/native_host.py',
    'native-host/install.bat',
    'native-host/install.sh',
    'native-host/requirements.txt'
  ]
};

console.log('🧪 开始测试构建系统...');

// 检查构建目录是否存在
if (!fs.existsSync(testConfig.buildDir)) {
  console.error('❌ 构建目录不存在:', testConfig.buildDir);
  process.exit(1);
}

console.log('✅ 构建目录存在');

// 检查配置文件
const configFiles = ['config.json', 'javascript-obfuscator-config.json'];
for (const configFile of configFiles) {
  const configPath = path.join(testConfig.buildDir, configFile);
  if (!fs.existsSync(configPath)) {
    console.error('❌ 配置文件缺失:', configFile);
    process.exit(1);
  }
  console.log('✅ 配置文件存在:', configFile);
}

console.log('✅ 所有配置文件检查通过');

// 运行构建脚本
console.log('\n🚀 运行构建脚本...');
const buildProcess = spawn('node', ['build.js'], {
  cwd: testConfig.buildDir,
  stdio: 'inherit'
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ 构建脚本执行失败，退出码:', code);
    process.exit(code);
  }

  console.log('✅ 构建脚本执行完成');

  // 检查输出文件
  console.log('\n🔍 检查输出文件...');
  let allFilesExist = true;

  for (const expectedFile of testConfig.expectedFiles) {
    const filePath = path.join(testConfig.distDir, expectedFile);
    if (!fs.existsSync(filePath)) {
      console.error('❌ 期望的输出文件缺失:', expectedFile);
      allFilesExist = false;
    } else {
      console.log('✅ 输出文件存在:', expectedFile);
    }
  }

  if (!allFilesExist) {
    console.error('❌ 部分输出文件缺失');
    process.exit(1);
  }

  console.log('✅ 所有期望的输出文件都存在');

  // 检查安装脚本权限 (macOS)
  const macosInstallScript = path.join(testConfig.distDir, 'native-host', 'install.sh');
  if (fs.existsSync(macosInstallScript)) {
    try {
      const stats = fs.statSync(macosInstallScript);
      const isExecutable = (stats.mode & 0o111) !== 0;
      if (isExecutable) {
        console.log('✅ macOS安装脚本具有执行权限');
      } else {
        console.warn('⚠️  macOS安装脚本缺少执行权限');
      }
    } catch (err) {
      console.warn('⚠️  无法检查macOS安装脚本权限:', err.message);
    }
  }

  console.log('\n🎉 构建系统测试通过!');
  console.log('📦 分发包已生成在:', path.join(testConfig.distDir, 'AnnotateFlow-Assistant-v2.0.0'));
});