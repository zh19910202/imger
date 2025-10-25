# Fix Modal Drag and Resize Issues

## Why

用户在使用模态框的拖动和伸缩功能时遇到了多个问题：

1. **拖动时出现抖动**：由于使用 `getBoundingClientRect()` 与 `position: fixed` 的坐标系统不匹配，导致拖动时模态框位置计算错误，产生明显的抖动现象。

2. **伸缩计算错误**：从左边或上边拖拽伸缩控制点时，模态框位置计算不正确，导致伸缩行为异常，最小尺寸限制也没有正确处理。

3. **维护复杂度高**：现有实现过于复杂，难以维护和扩展。

## What Changes

### 核心修复

1. **拖动坐标系统修复** (startDrag 函数)
   - 替换 `getBoundingClientRect()` 为 `parseInt(style.left)` 和 `parseInt(style.top)`
   - 确保使用的坐标系统与 `position: fixed` 一致

2. **伸缩初始化修复** (startResize 函数)
   - 使用 `offsetWidth/offsetHeight` 替代 `getBoundingClientRect().width/height`
   - 使用样式坐标替代视口相对坐标

3. **伸缩逻辑改进** (handleResize 函数)
   - 改进最小尺寸限制逻辑
   - 从左/上方向拖拽时正确调整位置以保持基准点
   - 分别处理宽度和高度的限制

4. **位置初始化** (initializeModalPosition 函数)
   - 添加 modal 初始化函数
   - 从居中定位（transform）转换为固定坐标（left/top）
   - 确保 DOM 渲染完成后再初始化

## Summary

现在的模态框拖动和伸缩功能有多个问题需要修复：

1. **拖动问题**：使用 `getBoundingClientRect()` 得到的坐标值是相对于视口的，但模态框已使用 `fixed` 定位，导致坐标转换错误，造成抖动现象。

2. **伸缩问题**：在伸缩时，当用户从左边或上边拖拽时，模态框位置计算不正确，导致伸缩行为异常。

3. **代码架构问题**：现有的 JavaScript 原生实现过于复杂，参考 React 测试组件的状态管理模式可以大幅简化实现。

## Key Improvements

- 修复拖动时的坐标计算，直接使用 `left` 和 `top` 样式值而非 `getBoundingClientRect()`
- 改进伸缩逻辑，确保所有方向（四角、四边）的伸缩都能正确计算新位置
- 统一事件处理流程，清楚地区分拖动和伸缩的起始、进行、结束三个阶段
- 保持与 React 组件相同的逻辑流程，便于后续维护

## Related Specs

- [modal-drag](./specs/modal-drag/spec.md) - 模态框拖动功能修复
- [modal-resize](./specs/modal-resize/spec.md) - 模态框伸缩功能修复
