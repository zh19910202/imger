# RunningHub 多工作流配置设计

## 目标
1. 支持多个工作流配置
2. 允许用户导入/导出配置
3. 允许用户编辑现有配置
4. 允许增加/删除节点信息
5. 在RunningHub任务页中添加设置入口

## 新配置结构

```json
{
  "version": "1.0",
  "workflows": {
    "default": {
      "name": "默认工作流",
      "description": "默认的图像处理工作流",
      "webappId": "1967790629851922434",
      "nodeInfoList": [
        {
          "nodeId": "189",
          "fieldName": "image",
          "fieldValue": "{IMAGE_FILE}",
          "description": "image",
          "fieldType": "image",
          "required": true
        },
        {
          "nodeId": "191",
          "fieldName": "prompt",
          "fieldValue": "{PROMPT}",
          "description": "prompt",
          "fieldType": "text",
          "required": true
        }
      ]
    },
    "enhancement": {
      "name": "图像增强工作流",
      "description": "用于图像增强和优化的工作流",
      "webappId": "1967790629851922435",
      "nodeInfoList": [
        {
          "nodeId": "190",
          "fieldName": "input_image",
          "fieldValue": "{IMAGE_FILE}",
          "description": "输入图像",
          "fieldType": "image",
          "required": true
        },
        {
          "nodeId": "192",
          "fieldName": "enhancement_type",
          "fieldValue": "sharpen",
          "description": "增强类型",
          "fieldType": "select",
          "options": ["sharpen", "blur", "contrast", "brightness"],
          "required": true
        }
      ]
    }
  },
  "settings": {
    "defaultWorkflow": "default",
    "autoSave": true,
    "lastUsedWorkflow": "default"
  }
}
```

## 配置字段说明

### 工作流(workflow)字段
- `name`: 工作流名称(显示用)
- `description`: 工作流描述
- `webappId`: RunningHub应用ID
- `nodeInfoList`: 节点信息列表

### 节点(node)字段
- `nodeId`: 节点ID
- `fieldName`: 字段名称
- `fieldValue`: 字段值(支持占位符)
- `description`: 字段描述
- `fieldType`: 字段类型(image, text, number, boolean, select等)
- `required`: 是否必填
- `options`: 选项列表(用于select类型)

### 设置(settings)字段
- `defaultWorkflow`: 默认工作流
- `autoSave`: 是否自动保存
- `lastUsedWorkflow`: 最后使用的工作流

## 功能需求

### 1. 配置导入/导出
- 支持JSON格式导入
- 支持JSON格式导出
- 导入时验证配置格式

### 2. 配置编辑界面
- 工作流列表展示
- 添加/删除工作流
- 编辑工作流基本信息
- 节点列表管理
- 添加/删除/编辑节点

### 3. 设置入口
- 在RunningHub任务页添加设置按钮
- 点击后弹出配置管理界面

### 4. 工作流选择
- 在任务提交时选择工作流
- 记住用户最后选择的工作流