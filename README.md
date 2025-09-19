# PS插件与Chrome扩展集成方案

这个项目实现了 Photoshop 插件与 Chrome 扩展之间的双向通信，通过增强的 Native Host 程序作为桥梁，支持文本和图片数据的传输处理。

## 项目结构

```
auxis/
├── native_host.py                    # 增强的Native Host程序
├── PS_Chrome_Extension_Integration.md # 详细技术方案文档
├── test_ps_integration.py            # 集成测试脚本
├── chrome_extension_example.js       # Chrome扩展示例代码
├── ps_plugin_example.js             # PS插件示例代码
└── README.md                         # 项目说明文档
```

## 功能特性

### 🔄 双向通信
- PS插件 → HTTP请求 → Native Host → Native Messaging → Chrome扩展
- Chrome扩展 → Native Messaging → Native Host → HTTP响应 → PS插件

### 📊 数据支持
- ✅ 文本数据传输
- ✅ Base64编码图片传输
- ✅ 元数据和配置参数
- ✅ 异步请求处理

### 🛡️ 安全特性
- 本地绑定（localhost）
- 请求大小限制（50MB）
- 超时保护（30秒）
- 错误处理和恢复

### 🔧 原有功能保持
- 文件打开功能
- 文件状态检查
- 跨平台兼容性

## 快速开始

### 1. 环境准备

确保你有以下环境：
- Python 3.6+
- Chrome浏览器
- Photoshop（支持CEP/UXP插件）

### 2. 启动Native Host

```bash
# 直接启动（用于测试）
python3 native_host.py

# 或者通过Chrome扩展自动启动（生产环境）
```

### 3. 测试连接

```bash
# 运行集成测试
python3 test_ps_integration.py
```

### 4. 部署Chrome扩展

1. 将 `chrome_extension_example.js` 的代码集成到你的Chrome扩展中
2. 在 `manifest.json` 中添加 `nativeMessaging` 权限
3. 配置Native Messaging Host清单文件

### 5. 开发PS插件

1. 使用 `ps_plugin_example.js` 作为参考
2. 在CEP/UXP环境中集成HTTP请求功能
3. 调用 `http://localhost:8888/api/process` 端点

## API 接口

### HTTP 端点

#### POST /api/process
处理来自PS插件的数据请求

**请求格式：**
```json
{
  "action": "process_data",
  "text_data": "文本内容",
  "image_data": "data:image/png;base64,iVBORw0KGgo...",
  "metadata": {
    "image_format": "png",
    "timestamp": 1634567890
  }
}
```

**响应格式：**
```json
{
  "success": true,
  "result_data": "处理结果文本",
  "processed_image": "data:image/png;base64,处理后的图片",
  "metadata": {
    "processing_time": 1500,
    "operations_applied": ["filter", "resize"]
  }
}
```

#### GET /api/health
健康检查端点

**响应格式：**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "chrome_extension_connected": true,
  "pending_requests": 0
}
```

### Native Messaging 消息

#### ps_request (Native Host → Chrome扩展)
```json
{
  "action": "ps_request",
  "request_id": "req_1634567890_abc123",
  "text_data": "文本内容",
  "image_data": "base64图片数据",
  "metadata": {...}
}
```

#### ps_response (Chrome扩展 → Native Host)
```json
{
  "action": "ps_response",
  "request_id": "req_1634567890_abc123",
  "success": true,
  "result_data": "处理结果",
  "processed_image": "处理后的图片",
  "metadata": {...}
}
```

## 使用示例

### PS插件中发送请求

```javascript
const integration = new PSChromeIntegration();

// 发送文本和图片到Chrome扩展
const result = await integration.sendToChrome(
  "请处理这张图片",
  imageBase64Data,
  { operation: "enhance" }
);

if (result.success) {
  console.log("处理结果:", result.result_data);
  // 创建新图层显示处理后的图片
  await integration.createLayerFromBase64(result.processed_image);
}
```

### Chrome扩展中处理请求

```javascript
// 监听Native Messaging消息
port.onMessage.addListener(async (message) => {
  if (message.action === "ps_request") {
    // 处理PS插件的请求
    const result = await processDataFromPS({
      text_data: message.text_data,
      image_data: message.image_data,
      metadata: message.metadata
    });
    
    // 发送响应
    port.postMessage({
      action: "ps_response",
      request_id: message.request_id,
      success: true,
      result_data: result.text,
      processed_image: result.image
    });
  }
});
```

## 测试

### 运行测试脚本

```bash
# 基础功能测试
python3 test_ps_integration.py
```

测试包括：
- ✅ 健康检查端点
- ✅ 基本请求响应
- ✅ 并发请求处理
- ✅ 超时机制
- ✅ 错误处理

### 手动测试

```bash
# 测试健康检查
curl http://localhost:8888/api/health

# 测试数据处理（需要Chrome扩展响应）
curl -X POST http://localhost:8888/api/process \
  -H "Content-Type: application/json" \
  -d '{"action":"process_data","text_data":"测试文本"}'
```

## 配置选项

### HTTP服务器配置

```python
HTTP_SERVER_CONFIG = {
    "host": "localhost",        # 绑定地址
    "port": 8888,              # 监听端口
    "timeout": 30,             # 请求超时时间(秒)
    "max_request_size": 50 * 1024 * 1024,  # 最大请求大小(50MB)
}
```

### 自定义配置

你可以通过修改 `native_host.py` 中的配置常量来调整行为：

- 修改端口号避免冲突
- 调整超时时间适应处理需求
- 设置请求大小限制

## 故障排除

### 常见问题

1. **连接失败**
   - 确保 `native_host.py` 正在运行
   - 检查端口8888是否被占用
   - 验证Chrome扩展是否正确安装

2. **请求超时**
   - 检查Chrome扩展是否正确处理 `ps_request` 消息
   - 确认扩展发送了 `ps_response` 响应
   - 考虑增加超时时间

3. **图片传输失败**
   - 验证Base64编码格式正确
   - 检查图片大小是否超过限制
   - 确认图片格式支持

### 调试模式

启用详细日志：

```python
# 在native_host.py中添加调试输出
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 扩展开发

### 添加新的数据类型

1. 在HTTP请求中添加新字段
2. 在Native Messaging消息中传递
3. 在Chrome扩展中处理新数据类型

### 支持更多应用程序

1. 复制HTTP服务器模式
2. 为不同应用创建专用端点
3. 实现应用特定的数据格式

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 许可证

MIT License - 详见LICENSE文件

## 更新日志

### v2.0.0 (当前版本)
- ✅ 添加HTTP服务器支持
- ✅ 实现PS插件通信
- ✅ 异步请求处理
- ✅ 完整的错误处理
- ✅ 并发请求支持

### v1.0.0
- ✅ 基础Native Messaging功能
- ✅ 文件操作支持
- ✅ 跨平台兼容性