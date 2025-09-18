# Content.js 版本测试指南

## 🎯 如何区分原版和重构版本

### 📋 问题背景
当前项目中同时存在：
- `content.js` - 原始版本 (8373行, 300KB+)
- `src/content.js` - 重构版本 (模块化架构)

需要明确知道浏览器扩展加载的是哪个版本。

## 🔍 版本识别方法

### 方法一：版本标识检查 (推荐)

#### 1. 修改manifest.json指向重构版本
```json
{
  "content_scripts": [{
    "matches": ["*://*/*"],
    "js": ["src/content.js"],
    "type": "module"
  }]
}
```

#### 2. 在重构版本中添加明确标识
在 `src/content.js` 的初始化函数中添加：
```javascript
console.log('🚀 AnnotateFlow Assistant v2.0 (重构版本) 已加载');
console.log('版本信息:', {
    version: '2.0.0',
    architecture: 'modular',
    buildDate: '2025-09-18',
    modules: Object.keys(this.modules || {})
});

// 在window对象上设置版本标识
window.ANNOTATEFLOW_VERSION = {
    version: '2.0.0',
    type: 'refactored',
    loadTime: new Date().toISOString()
};
```

#### 3. 在原版本中添加对比标识
在原 `content.js` 顶部添加：
```javascript
console.log('📜 AnnotateFlow Assistant v1.0 (原始版本) 已加载');
window.ANNOTATEFLOW_VERSION = {
    version: '1.0.0',
    type: 'original',
    loadTime: new Date().toISOString()
};
```

### 方法二：功能特征检查

#### 重构版本特有功能
```javascript
// 在控制台中检查
console.log('应用实例:', window.AnnotateFlowApp);
console.log('模块状态:', window.getAppInfo?.());
console.log('状态管理器:', window.AnnotateFlowApp?.stateManager);
```

#### 原版本特有特征
```javascript
// 原版本的全局变量
console.log('原版全局变量存在:', typeof lastHoveredImage !== 'undefined');
console.log('原版调试模式:', typeof debugMode !== 'undefined');
```

### 方法三：文件加载检查

#### 检查Network面板
1. 打开开发者工具 → Network
2. 刷新页面
3. 查看加载的JS文件：
   - 如果看到 `src/content.js` → 重构版本
   - 如果看到 `content.js` → 原始版本

#### 检查Sources面板
1. 开发者工具 → Sources
2. 查看扩展文件结构：
   - 重构版本：会看到 `src/modules/` 目录结构
   - 原始版本：只有单个 `content.js` 文件

## 🧪 测试切换方案

### 方案A：通过manifest.json切换

#### 使用原始版本
```json
{
  "content_scripts": [{
    "matches": ["*://*/*"],
    "js": ["content.js"]
  }]
}
```

#### 使用重构版本
```json
{
  "content_scripts": [{
    "matches": ["*://*/*"],
    "js": ["src/content.js"],
    "type": "module"
  }]
}
```

### 方案B：文件重命名切换

#### 测试重构版本
```bash
# 备份原文件
mv content.js content.js.backup
# 使用重构版本
cp src/content.js content.js
cp -r src/modules ./
cp -r src/config ./
```

#### 恢复原始版本
```bash
# 恢复原文件
mv content.js.backup content.js
# 清理重构文件
rm -rf modules config
```

### 方案C：条件加载切换

创建一个切换器文件 `content-loader.js`：
```javascript
// content-loader.js
const USE_REFACTORED_VERSION = true; // 切换标志

if (USE_REFACTORED_VERSION) {
    console.log('🚀 加载重构版本...');
    import('./src/content.js');
} else {
    console.log('📜 加载原始版本...');
    // 动态加载原始版本的逻辑
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content.js');
    document.head.appendChild(script);
}
```

## 🔧 实用测试命令

### 控制台快速检查
```javascript
// 检查当前版本
console.log('当前版本:', window.ANNOTATEFLOW_VERSION);

// 检查应用类型
if (window.AnnotateFlowApp) {
    console.log('✅ 重构版本正在运行');
    console.log('模块信息:', window.getAppInfo());
} else if (typeof debugMode !== 'undefined') {
    console.log('📜 原始版本正在运行');
    console.log('调试模式:', debugMode);
} else {
    console.log('❌ 未检测到任何版本');
}

// 检查功能可用性
console.log('功能检查:', {
    downloadImage: typeof downloadImage === 'function',
    showNotification: typeof showNotification === 'function',
    debugLog: typeof debugLog === 'function'
});
```

### 键盘测试验证
```javascript
// 测试D键下载功能
document.addEventListener('keydown', function(e) {
    if (e.key === 'd') {
        console.log('D键被按下 - 版本:', window.ANNOTATEFLOW_VERSION?.type);
    }
});
```

## 📊 版本对比测试清单

### ✅ 功能一致性测试
- [ ] D键下载图片
- [ ] 空格键跳过
- [ ] S键提交
- [ ] A键上传
- [ ] F键历史
- [ ] W键对比
- [ ] Z键调试
- [ ] ESC关闭模态框

### ✅ 性能对比测试
- [ ] 页面加载时间
- [ ] 内存使用量
- [ ] 响应速度
- [ ] 错误日志

### ✅ 兼容性测试
- [ ] Chrome浏览器
- [ ] Firefox浏览器
- [ ] Edge浏览器
- [ ] 不同网站兼容性

## 🎯 推荐测试流程

### 第一阶段：基础验证
1. 修改manifest.json指向重构版本
2. 重新加载扩展
3. 检查控制台版本信息
4. 测试核心键盘快捷键

### 第二阶段：功能对比
1. 使用原始版本测试所有功能
2. 记录功能表现和响应时间
3. 切换到重构版本
4. 重复相同测试，对比结果

### 第三阶段：稳定性测试
1. 长时间使用重构版本
2. 监控错误日志
3. 测试边界情况
4. 验证内存泄漏

## 🚨 注意事项

1. **扩展重新加载**：每次切换版本后都要重新加载扩展
2. **缓存清理**：可能需要清理浏览器缓存
3. **控制台监控**：始终保持开发者工具打开监控日志
4. **备份重要**：测试前确保原文件已备份

## 🎉 测试完成标准

当重构版本通过以下测试时，可以考虑移除原始版本：
- ✅ 所有功能100%正常工作
- ✅ 性能表现不低于原版
- ✅ 无错误日志产生
- ✅ 连续使用1周无问题
- ✅ 团队成员验收通过

---

*测试指南创建时间: 2025年9月18日*  
*建议测试周期: 1-2周*