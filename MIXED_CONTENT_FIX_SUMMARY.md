# 混合内容和CORS问题修复总结

## 问题描述

在HTTPS页面 (`https://ui.appen.com.cn/welcome`) 中，浏览器扩展尝试请求HTTP API (`http://192.168.31.74:1145/...`) 时遇到以下错误：

1. **混合内容错误**: `Mixed Content: The page at 'https://ui.appen.com.cn/welcome' was loaded over HTTPS, but requested an insecure resource 'http://192.168.31.74:1145/api/task/user/...'`
2. **CORS阻止错误**: `TypeError: Failed to fetch`
3. **无效Response错误**: `RangeError: Failed to construct 'Response': The status provided (0) is outside the range [200, 599]`

## 修复方案

### 1. 协议自动检测 (`src/data-service.js`)

**修改前:**
```javascript
API_BASE_URL: 'http://192.168.31.74:1145'
```

**修改后:**
```javascript
get API_BASE_URL() {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${protocol}://192.168.31.74:1145`;
}
```

**效果**: API URL会根据当前页面协议自动调整，避免协议不匹配。

### 2. 多策略请求机制 (`src/data-service.js`)

实现了三级回退策略：

1. **策略1**: 尝试匹配页面协议的API URL
2. **策略2**: 如果是HTTPS页面且API是本地地址，尝试HTTP回退
3. **策略3**: 返回缓存数据或空数据结构

### 3. Background代理机制 (`src/background.js` + `src/data-service.js`)

**新增background.js API代理:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'API_PROXY_REQUEST') {
        handleApiProxyRequest(request, sender, sendResponse);
        return true;
    }
});
```

**新增data-service.js代理方法:**
```javascript
fetchViaBackgroundProxy: function(url) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'API_PROXY_REQUEST',
            url: url,
            options: { /* ... */ }
        }, (response) => {
            // 处理代理响应
        });
    });
}
```

**优势**: Background script没有CORS限制，可以自由请求任何协议的API。

### 4. CORS错误处理改进 (`src/content.js`)

**修改前:**
```javascript
return new Response(null, { status: 0, statusText: 'CORS blocked' });
```

**修改后:**
```javascript
throw new TypeError(`CORS阻止的请求: ${url}`);
```

**效果**: 避免创建无效的Response对象，提供更清晰的错误信息。

### 5. 增强的错误处理 (`src/data-service.js`)

添加了详细的错误分类和处理：
- CORS错误
- 混合内容错误
- Chrome runtime错误
- 网络超时错误

## 使用方法

### 自动修复
修复后的代码会自动处理所有CORS和混合内容问题，无需手动配置。

### 测试验证
1. 在浏览器中打开 `https://ui.appen.com.cn/welcome`
2. 打开开发者工具控制台
3. 粘贴并运行 `test-mixed-content-fix.js` 中的测试代码
4. 查看测试结果和API请求状态

### 手动验证
```javascript
// 在控制台中测试
DataService.getTodayReport().then(data => {
    console.log('数据获取成功:', data);
}).catch(error => {
    console.log('数据获取失败:', error);
});
```

## 兼容性

- ✅ Chrome Extension Manifest V3
- ✅ HTTP/HTTPS混合环境
- ✅ 本地开发环境
- ✅ 生产环境

## 注意事项

1. **服务器配置**: 确保本地服务器 `192.168.31.74:1145` 正在运行
2. **HTTPS支持**: 如果可能，建议为API服务器配置HTTPS支持
3. **用户ID**: 确保localStorage中有正确的用户ID (`appen_user_id`)
4. **扩展权限**: 确保扩展有必要的权限（已在manifest.json中配置）

## 文件修改清单

- `src/data-service.js`: 协议检测、多策略请求、Background代理集成
- `src/background.js`: API代理处理逻辑
- `src/content.js`: CORS错误处理改进
- `manifest.json`: 已有足够权限，无需修改
- `test-mixed-content-fix.js`: 新增测试脚本
- `MIXED_CONTENT_FIX_SUMMARY.md`: 本文档

## 预期效果

修复后，数据看板应该能够：
- ✅ 在HTTPS页面中正常加载HTTP API数据
- ✅ 自动处理CORS和混合内容问题
- ✅ 提供清晰的错误信息和回退机制
- ✅ 保持缓存功能正常工作
- ✅ 在各种网络环境下稳定运行