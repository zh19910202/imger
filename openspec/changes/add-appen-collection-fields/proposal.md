## Why
根据更新的API文档要求，Appen数据收集器需要新增关键字段以满足服务端数据结构需求，确保数据完整性和业务逻辑正确性。

## What Changes
- 在Appen数据收集器中添加新字段：`taskName`、`jobTenantId`、`projectId`、`projectDisplayId`、`topicUrl`
- `taskName`字段值使用当前任务ID对应的值
- `jobTenantId`、`projectId`、`projectDisplayId`字段从页面URL参数中提取
- `topicUrl`字段为可选字段，默认设置为空值
- 确保现有字段兼容性，不影响已有功能

## Impact
- **Affected specs**: data-collection（需要创建新规范或修改现有数据收集规范）
- **Affected code**: `src/appen-data-collector.js` 中的数据收集和URL解析逻辑
- **API impact**: 新增字段将发送到 `http://www.skytree.ink/api/Task/add` 端点
- **Testing impact**: 需要验证新字段在不同URL格式下的正确提取