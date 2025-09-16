# 原图检测逻辑优化

## 优化内容概述

本次优化主要增强了插件中查找原图的逻辑，确保能更好地检测和处理后端图片链接。

## 主要改进

### 1. 增强原图候选检测 (`isOriginalImageCandidate`)

**新增后端API路径检测：**
- `/api/`, `/upload/`, `/image/`, `/media/`, `/file/`
- `/attachment/`, `/resource/`, `/assets/`, `/static/`
- `/target/`, `/origin/`, `/source/`, `/raw/`

**增强文件名指示器检测：**
- 文件名中的原图标识：`original`, `source`, `master`, `raw`, `full`
- 尺寸指示器：`large`, `big`, `huge`, `xl`, `xxl`, `max`

**新增质量参数检测：**
- URL参数：`quality=80-100`, `q=80-100`
- 高质量关键词：`high`, `hd`, `uhd`, `4k`, `8k`
- 尺寸参数：`width/height >= 500px`

### 2. 优化图片URL识别 (`isImageUrl`)

**后端API图片路径：**
- `/api/image`, `/api/upload`, `/api/file`, `/api/media`
- `/upload/image`, `/media/image`, `/storage/image`

**动态图片API检测：**
- 路径模式：`/(image|img|picture|photo|media|upload|file)[/\?]`
- Base64图片：`data:image/`
- Blob URL：`blob:`

### 3. 增强响应头检测 (`hasImageHeaders`)

**支持多种响应对象：**
- Fetch Response对象
- XMLHttpRequest对象
- 自定义响应对象

**Content-Disposition检测：**
- 文件名扩展名检测
- 二进制内容类型检测

### 4. 服务器修改图检测增强 (`isServerModifiedImageUrl`)

**通用后端修改图特征：**
- 路径关键词：`/modified/`, `/edited/`, `/processed/`, `/converted/`
- 文件名前缀：`modified_`, `edited_`, `processed_`, `thumb_`
- API路径：`/api/image/modify`, `/api/media/transform`
- 查询参数：`action=modify`, `type=processed`, `transform=`

### 5. 网络请求拦截优化

**background.js 增强：**
- 扩展URL过滤器，包含后端API路径
- 增加请求类型：`xmlhttprequest`, `other`
- 新增后端图片API检测逻辑

**content.js 网络处理：**
- 多维度图片检测：URL + Headers + Size + Backend Pattern
- 后端API特征检测
- 响应状态码验证

### 6. DOM选择器优化 (`recordOriginalImages`)

**三级优先级选择器：**
1. **精确DOM选择器**：特定属性和类名组合
2. **后端图片选择器**：包含后端API路径的图片
3. **高质量图片选择器**：包含质量关键词的图片

## 技术实现

### 检测策略

1. **URL模式匹配**：检测后端API路径模式
2. **关键词识别**：多语言原图关键词检测
3. **参数分析**：解析URL参数中的尺寸和质量信息
4. **响应头分析**：Content-Type和Content-Disposition检测
5. **文件特征**：文件名和扩展名模式识别

### 调试支持

所有新增检测逻辑都包含详细的调试日志，方便问题排查：

```javascript
if (isCandidate) {
    debugLog('识别为原图候选', {
        url: url.substring(0, 100) + '...',
        hasBackendPath,
        hasOriginalKeyword,
        // ... 其他检测结果
    });
}
```

## 兼容性

- 保持与现有COS图片检测的完全兼容
- 向后兼容原有的DOM选择器逻辑
- 不影响现有的用户交互功能

## 使用场景

这些优化特别适用于：

1. **RESTful API**：`/api/images/{id}` 类型的后端图片接口
2. **文件上传系统**：`/upload/` 路径下的图片资源
3. **CDN资源**：包含质量参数的图片URL
4. **动态生成图片**：后端实时处理的图片API
5. **多媒体平台**：`/media/` 路径下的图片资源

通过这些优化，插件现在能够更准确地识别和处理各种来源的原图，包括后端API返回的图片链接。
