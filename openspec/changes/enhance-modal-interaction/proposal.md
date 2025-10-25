## Why
当前Appen数据收集模态框位置固定在屏幕中央，大小也是固定的。用户在查看模态框内容时可能需要移动模态框以查看页面其他内容，或者需要调整模态框大小以更好地查看大量数据。为了提升用户体验和界面的灵活性，需要引入模态框自由拖动和伸缩功能。

## What Changes
- 为Appen数据收集模态框添加拖动功能，允许用户自由移动模态框位置
- 实现模态框边角和边缘的拖拽伸缩功能
- 添加最小/最大尺寸限制，确保模态框可用性
- 保持现有功能的完整性和兼容性
- 优化拖动和伸缩的视觉反馈

## Impact
- **Affected specs**: modal-interaction（需要创建新的交互规范）
- **Affected code**: `src/appen-data-collector.js` 中的 `showDataModal` 函数和相关CSS样式
- **UI impact**: 模态框将显示拖动手柄和伸缩控制点
- **Interaction impact**: 新增鼠标拖动和滚轮缩放交互方式
- **Performance impact**: 需要处理频繁的DOM更新和事件监听