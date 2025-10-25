## Why
当前Appen数据收集模态框显示内容较多且混杂，用户体验有待提升。同时，模态框只能通过点击关闭按钮来关闭，缺乏直观的背景点击关闭功能。为了提升用户体验和界面的组织性，需要引入标签页切换和背景点击关闭功能。

## What Changes
- 为Appen数据收集模态框添加标签页功能，将不同类型的信息分组显示
- 实现背景点击关闭模态框的功能
- 保持现有功能的完整性和兼容性
- 优化界面布局和用户交互体验

## Impact
- **Affected specs**: modal-display（需要创建新的标签页显示规范）
- **Affected code**: `src/appen-data-collector.js` 中的 `showDataModal` 函数
- **UI impact**: 模态框界面结构将重新设计，增加标签页导航
- **Interaction impact**: 新增背景点击关闭功能，提升操作便利性