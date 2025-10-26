# Refine Modal Drag and Resize Implementation

## Why

尽管之前已经完成了 `fix-modal-drag-resize` 的修复，但用户反馈模态框的拖动和伸缩功能仍然存在问题。通过对比 `/Users/snow/auxis/tests/modal.html` 中的参考实现，发现当前实现存在以下关键差异：

1. **坐标系统不一致**：当前实现仍然混合使用 `transform` 和 `left/top` 定位，导致坐标计算混乱
2. **初始化逻辑缺失**：缺少明确的模态框位置初始化函数，导致首次显示时位置不正确
3. **事件处理结构复杂**：当前的事件处理逻辑比参考实现更复杂，容易出现边界情况问题
4. **缺少视觉反馈**：参考实现中有更好的拖动状态视觉反馈（如 `cursor: grabbing`）

## What Changes

### 核心改进

1. **统一坐标系统** (initializeModalPosition 函数)
   - 完全移除 `transform` 定位，统一使用 `left/top` + `position: fixed`
   - 添加明确的模态框初始化函数，确保首次显示时正确定位
   - 参考测试文件中的 `initModalPosition()` 实现模式

2. **简化拖动逻辑** (dragStart 和 handleMouseMove 函数)
   - 采用参考实现中的简单直接的坐标计算方式
   - 使用 `getBoundingClientRect()` 获取起始位置，但确保坐标系统一致性
   - 添加拖动状态的视觉反馈（`cursor: grabbing`）

3. **优化伸缩处理** (resizeStart 和 handleResize 函数)
   - 参考测试文件的简洁伸缩逻辑
   - 改进最小/最大尺寸限制的处理方式
   - 确保所有方向的伸缩都能正确计算位置

4. **事件处理优化**
   - 简化事件监听器的管理
   - 确保拖动和伸缩事件不会相互干扰
   - 添加更好的边界检查和约束

### 实现策略

- 保持现有的 `requestAnimationFrame` 性能优化
- 维持与现有代码架构的兼容性
- 采用参考实现中经过验证的交互模式
- 确保在不同屏幕尺寸下的一致表现

## Summary

当前的模态框拖动和伸缩实现虽然经过修复，但仍存在坐标系统不一致和逻辑复杂的问题。通过参考 `tests/modal.html` 中的简洁实现，我们可以：

1. **统一坐标系统**：完全使用 `left/top` 定位，避免 `transform` 和 `left/top` 混用
2. **简化逻辑**：采用参考实现中经过验证的简单直接的计算方式
3. **改善用户体验**：添加更好的视觉反馈和状态管理
4. **提高可靠性**：减少边界情况，确保在各种使用场景下都能正常工作

## Key Improvements

- 移除混合定位系统，统一使用 `position: fixed` + `left/top`
- 添加明确的模态框初始化函数，确保首次显示正确
- 简化拖动和伸缩的计算逻辑，参考测试文件的实现
- 改进视觉反馈，包括拖动时的光标状态变化
- 确保事件处理的清晰分离，避免状态冲突

## Related Specs

- [modal-coordinate-system](./specs/modal-coordinate-system/spec.md) - 统一模态框坐标系统
- [modal-drag-refinement](./specs/modal-drag-refinement/spec.md) - 优化拖动交互逻辑
- [modal-resize-refinement](./specs/modal-resize-refinement/spec.md) - 优化伸缩交互逻辑