# RunningHub API 测试脚本使用说明

## 概述
这个脚本用于测试RunningHub的AI应用API功能，验证R键模态框的集成是否正确。

## 使用方法

### 1. 准备工作
确保您有：
- RunningHub API Key
- 测试图片文件 (1.png 已存在)
- 网络连接

### 2. 运行测试
```bash
# 方法1: 直接运行（会提示输入API Key）
./test_runninghub.sh

# 方法2: 设置环境变量后运行
export RUNNINGHUB_API_KEY="your_api_key_here"
./test_runninghub.sh
```

### 3. 测试流程
脚本会自动执行以下步骤：

1. **依赖检查** - 验证curl等工具是否可用
2. **API密钥验证** - 确认API Key已配置
3. **图片文件检查** - 验证1.png文件存在且大小合适
4. **图片上传** - 调用 `/task/openapi/upload` 上传图片
5. **创建AI应用任务** - 调用 `/task/openapi/ai-app/run` 创建任务
6. **状态轮询** - 每5秒查询一次任务状态，最多5分钟
7. **获取结果** - 任务完成后获取生成的图片

### 4. 输出文件
脚本会在当前目录生成以下JSON响应文件：
- `upload_response.json` - 图片上传响应
- `task_response.json` - 任务创建响应
- `status_response.json` - 最后一次状态查询响应
- `outputs_response.json` - 任务输出响应

### 5. 预期结果
如果一切正常，您应该看到：
- ✅ 图片上传成功
- ✅ 任务创建成功 (获得任务ID)
- ✅ 任务状态从 QUEUED → RUNNING → SUCCESS
- ✅ 获得生成图片的URL

### 6. 故障排除

#### 常见错误及解决方案

**API Key相关:**
- `APIKEY_NOT_FOUND` - API Key无效
- `APIKEY_BALANCE_INSUFFICIENT` - 余额不足

**文件相关:**
- `APIKEY_FILE_SIZE_EXCEEDED` - 文件过大(超过30MB)
- 文件格式不支持 - 确保是图片格式

**任务相关:**
- `APIKEY_TASK_STATUS_ERROR` - 任务状态异常
- `APIKEY_TASK_NOT_FOUND` - 任务ID不存在

**网络相关:**
- 超时错误 - 检查网络连接
- DNS解析失败 - 检查域名访问

### 7. 配置说明

脚本中使用的配置：
- **webappId**: `1967790629851922434` (AI应用ID)
- **节点189**: image输入节点
- **节点191**: prompt输入节点
- **默认提示词**: "1 girl in classroom"

这些配置与 `runninghub-config.json` 文件一致。

### 8. 验证R键功能
测试脚本成功后，说明：
1. ✅ API端点配置正确
2. ✅ 参数结构匹配
3. ✅ 图片上传流程正常
4. ✅ AI应用任务创建正常
5. ✅ 状态轮询机制有效

R键模态框功能应该能够正常工作。

## 注意事项
- 测试会消耗您的RunningHub积分
- 图片生成可能需要1-5分钟
- 保管好您的API Key，不要泄露
- 建议在测试环境中先验证功能