# 图片自动打开功能测试指南

## 🔧 功能修复说明

### 修复内容
1. **改进了自动打开逻辑**: 现在优先使用Chrome原生API (`chrome.downloads.open`)，Native Host作为备用方案
2. **增强了错误处理**: 提供更详细的错误信息和调试日志
3. **提供了多种测试工具**: 包括测试脚本和测试页面

### 自动打开方法优先级
1. **方法1 (推荐)**: `chrome.downloads.open` - Chrome原生API，最稳定
2. **方法2 (备用)**: Native Host - 需要额外安装，适用于特殊情况

## 🧪 测试步骤

### 1. 基础功能测试

#### 在Chrome扩展中测试:
1. 打开Chrome浏览器
2. 进入 `chrome://extensions/`
3. 找到 "AnnotateFlow Assistant" 扩展
4. 点击 "检查视图" -> "background page" (或 "service worker")
5. 在控制台中粘贴并运行:
   ```javascript
   // 加载测试脚本
   fetch(chrome.runtime.getURL('test_auto_open_function.js'))
     .then(response => response.text())
     .then(script => {
       eval(script);
       // 运行所有测试
       testAutoOpenFunction.runAllTests();
     });
   ```

#### 使用测试页面:
1. 在浏览器中打开 `test_download_auto_open.html`
2. 点击 "下载图片" 按钮
3. 观察状态日志中的信息
4. 检查图片是否自动打开

### 2. 扩展设置检查

1. 点击扩展图标打开popup
2. 确保 "下载完成后自动打开图片" 开关已启用
3. 如果开关是关闭的，请启用它

### 3. 实际使用测试

1. 访问支持的网站 (如 `https://qlabel.tencent.com/*`)
2. 将鼠标悬停在图片上
3. 按 `D` 键下载图片
4. 等待下载完成，图片应该自动打开

## 🔍 故障排除

### 问题1: 图片下载后没有自动打开

**可能原因和解决方案:**

1. **扩展设置未启用**
   - 解决方案: 打开扩展popup，启用 "下载完成后自动打开图片"

2. **Chrome权限问题**
   - 检查: 在background控制台运行 `chrome.downloads.open`
   - 解决方案: 确保扩展有downloads权限

3. **文件关联问题**
   - 现象: 出现 "No application is associated with this file" 错误
   - 解决方案: 在Windows中为图片文件设置默认应用程序

4. **Native Host未安装** (仅当Chrome API失败时)
   - 解决方案: 运行 `install_native_host.bat` 安装Native Host支持

### 问题2: 控制台出现错误信息

**常见错误和解决方案:**

1. **"No application is associated with this file"**
   ```
   解决方案:
   1. 右键点击任意图片文件
   2. 选择 "打开方式" -> "选择其他应用"
   3. 选择图片查看器 (如Windows照片应用)
   4. 勾选 "始终使用此应用打开.jpg文件"
   ```

2. **"Native Host未连接"**
   ```
   这是正常的，表示正在使用Chrome原生API
   只有当Chrome API失败时才会尝试Native Host
   ```

3. **"chrome.downloads.open失败"**
   ```
   解决方案:
   1. 检查文件是否存在
   2. 检查文件关联设置
   3. 尝试手动打开下载的文件
   ```

## 📊 测试结果判断

### ✅ 成功标志
- 控制台显示: "方法1成功: 图片已通过默认应用打开"
- 图片文件自动在默认应用中打开
- 没有错误信息

### ⚠️ 部分成功
- 控制台显示: "方法1失败" 但随后显示Native Host成功
- 图片最终还是打开了，但使用的是备用方法

### ❌ 失败标志
- 控制台显示多个错误信息
- 图片下载完成但没有自动打开
- 出现权限相关错误

## 🛠️ 高级调试

### 启用详细日志
在background控制台中运行:
```javascript
// 启用详细日志
console.log('=== 开始调试模式 ===');

// 监听所有下载事件
chrome.downloads.onChanged.addListener((delta) => {
  console.log('下载事件:', delta);
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('存储变化:', changes, namespace);
});
```

### 手动测试下载API
```javascript
// 测试下载功能
chrome.downloads.download({
  url: 'https://picsum.photos/400/300?test=' + Date.now(),
  filename: 'manual_test.jpg',
  saveAs: false
}, (downloadId) => {
  console.log('手动测试下载ID:', downloadId);
  
  // 等待下载完成后尝试打开
  setTimeout(() => {
    chrome.downloads.open(downloadId, () => {
      if (chrome.runtime.lastError) {
        console.error('手动打开失败:', chrome.runtime.lastError);
      } else {
        console.log('手动打开成功');
      }
    });
  }, 3000);
});
```

## 📝 版本信息

- **修复版本**: v2.2+
- **主要改进**: 使用Chrome原生API作为主要方法
- **兼容性**: Chrome 88+
- **测试环境**: Windows 10/11

## 🤝 反馈

如果遇到问题，请提供以下信息:
1. Chrome版本
2. 操作系统版本
3. 控制台错误信息
4. 扩展设置截图
5. 测试步骤和结果