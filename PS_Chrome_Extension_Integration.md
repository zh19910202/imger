# PS插件与Chrome扩展集成方案

## 项目概述

本方案旨在实现 Photoshop 插件与 Chrome 扩展之间的双向通信，通过增强现有的 `native_host.py` 程序，使其同时支持 Native Messaging 和 HTTP 服务，从而建立完整的通信桥梁。

## 技术架构

### 整体架构图

```
PS插件(CEP/UXP) 
    ↓ HTTP POST (JSON + Base64图片)
native_host.py (HTTP服务器 + Native Messaging客户端)
    ↓ Native Messaging 协议
Chrome扩展
    ↓ 业务逻辑处理
Chrome扩展
    ↓ Native Messaging 响应
native_host.py
    ↓ HTTP Response (JSON)
PS插件接收处理结果
```

### 核心组件

1. **HTTP 服务器模块**
   - 监听本地端口（默认8888）
   - 处理 PS插件 的 HTTP 请求
   - 支持文本和图片数据传输

2. **Native Messaging 客户端**
   - 与 Chrome 扩展双向通信
   - 遵循 Chrome Native Messaging 协议

3. **消息队列系统**
   - 异步处理 HTTP 请求
   - 请求-响应匹配机制
   - 线程安全的消息传递

4. **请求管理器**
   - 生成唯一请求ID
   - 管理待处理请求
   - 超时处理机制

## 数据流设计

### 请求流程

1. **PS插件发起请求**
   ```json
   POST http://localhost:8888/api/process
   {
     "action": "process_data",
     "text_data": "用户输入的文本内容",
     "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
     "metadata": {
       "image_format": "png",
       "image_width": 1920,
       "image_height": 1080
     }
   }
   ```

2. **native_host.py 处理**
   - 生成唯一 `request_id`
   - 将请求转换为 Native Messaging 格式
   - 发送给 Chrome 扩展

3. **Chrome扩展处理**
   ```json
   {
     "action": "ps_request",
     "request_id": "req_1234567890",
     "text_data": "用户输入的文本内容",
     "image_data": "base64编码的图片数据",
     "metadata": {...}
   }
   ```

4. **Chrome扩展响应**
   ```json
   {
     "action": "ps_response",
     "request_id": "req_1234567890",
     "success": true,
     "result_data": "处理后的文本结果",
     "processed_image": "data:image/png;base64,处理后的图片",
     "metadata": {
       "processing_time": 1500,
       "operations_applied": ["filter", "resize"]
     }
   }
   ```

5. **返回给PS插件**
   ```json
   HTTP 200 OK
   {
     "success": true,
     "result_data": "处理后的文本结果",
     "processed_image": "data:image/png;base64,处理后的图片",
     "metadata": {...}
   }
   ```

### 错误处理流程

1. **超时处理**
   - 默认超时时间：30秒
   - 超时后返回错误响应

2. **Chrome扩展错误**
   ```json
   {
     "action": "ps_response",
     "request_id": "req_1234567890",
     "success": false,
     "error": "处理失败的具体原因",
     "error_code": "PROCESSING_ERROR"
   }
   ```

## 技术实现细节

### 多线程架构

```python
主线程 (Native Messaging)
├── 处理Chrome扩展消息
├── 检查HTTP请求队列
└── 匹配响应并通知HTTP线程

HTTP服务线程
├── 监听HTTP请求
├── 生成请求ID
├── 放入请求队列
└── 等待响应并返回结果

消息队列
├── http_request_queue (HTTP → Native Messaging)
├── pending_requests (等待响应的请求)
└── 线程安全的数据结构
```

### 关键数据结构

```python
# 待处理请求
pending_requests = {
    "req_1234567890": {
        "timestamp": 1634567890,
        "response_event": threading.Event(),
        "response_data": None,
        "http_response_handler": response_callback
    }
}

# HTTP请求队列项
http_request_item = {
    "request_id": "req_1234567890",
    "action": "process_data",
    "text_data": "...",
    "image_data": "...",
    "metadata": {...}
}
```

### API 端点设计

#### POST /api/process
**功能**: 处理PS插件的数据请求

**请求格式**:
- Content-Type: application/json
- 支持文本和Base64编码图片

**响应格式**:
- 成功: HTTP 200 + JSON结果
- 失败: HTTP 400/500 + 错误信息

#### GET /api/health
**功能**: 健康检查端点

**响应**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "chrome_extension_connected": true
}
```

## 配置参数

### HTTP服务器配置
```python
HTTP_SERVER_CONFIG = {
    "host": "localhost",
    "port": 8888,
    "timeout": 30,  # 请求超时时间(秒)
    "max_request_size": 50 * 1024 * 1024,  # 50MB
    "allowed_origins": ["*"]  # CORS设置
}
```

### Native Messaging配置
```python
NATIVE_MESSAGING_CONFIG = {
    "max_message_size": 1024 * 1024,  # 1MB
    "encoding": "utf-8",
    "protocol_version": "1.0"
}
```

## 安全考虑

1. **本地绑定**: HTTP服务器只绑定到 localhost，外部无法访问
2. **请求验证**: 验证请求格式和数据完整性
3. **资源限制**: 限制请求大小和并发数量
4. **错误隐藏**: 不暴露系统内部错误信息

## 部署说明

### 依赖安装
```bash
# 无需额外依赖，使用Python标准库
# - threading: 多线程支持
# - http.server: HTTP服务器
# - queue: 线程安全队列
# - json: JSON处理
# - base64: 图片编码处理
```

### 启动方式
```bash
# 作为Native Messaging Host启动（由Chrome扩展触发）
python3 native_host.py

# 手动测试启动
python3 native_host.py --test-mode
```

### PS插件集成示例
```javascript
// CEP/UXP 中的HTTP请求示例
async function sendToChrome(textData, imageData) {
    const response = await fetch('http://localhost:8888/api/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'process_data',
            text_data: textData,
            image_data: imageData,
            metadata: {
                timestamp: Date.now(),
                source: 'photoshop'
            }
        })
    });
    
    return await response.json();
}
```

## 测试方案

### 单元测试
- HTTP服务器功能测试
- Native Messaging 通信测试
- 消息队列和异步处理测试

### 集成测试
- PS插件 → Chrome扩展 完整流程测试
- 错误处理和超时机制测试
- 并发请求处理测试

### 性能测试
- 大图片传输性能
- 并发请求处理能力
- 内存使用情况监控

## 扩展性考虑

1. **多应用支持**: 除了PS插件，还可支持其他应用程序
2. **协议扩展**: 可添加WebSocket支持实现实时通信
3. **插件化架构**: 支持不同类型的数据处理插件
4. **配置管理**: 支持外部配置文件和动态配置更新

## 版本规划

### v1.0 (当前版本)
- [x] 基础Native Messaging功能
- [x] 文件操作功能

### v2.0 (目标版本)
- [ ] HTTP服务器集成
- [ ] PS插件通信支持
- [ ] 异步请求处理
- [ ] 错误处理和超时机制

### v3.0 (未来版本)
- [ ] WebSocket支持
- [ ] 多应用程序支持
- [ ] 性能优化和监控
- [ ] 配置管理界面