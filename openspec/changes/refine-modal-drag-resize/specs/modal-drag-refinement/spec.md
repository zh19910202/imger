# 优化拖动交互逻辑

## MODIFIED Requirements

### Requirement: 简化拖动起始逻辑
系统必须(MUST)简化拖动起始逻辑，确保在用户开始拖动时能够快速准确地获取必要的坐标信息。
系统应该(SHOULD)使用一致的坐标获取方式，避免混合使用不同的坐标系统。
系统必须(MUST)在拖动开始时正确设置状态标志，为后续的拖动操作做好准备。

#### Scenario:
当用户开始拖动模态框时，拖动起始逻辑应该简洁明了，直接获取必要的坐标信息。

**Given** 用户在模态框头部按下鼠标
**When** 触发拖动开始事件时
**Then** 系统应该记录鼠标起始位置 `e.clientX` 和 `e.clientY`
**And** 系统应该使用 `getBoundingClientRect()` 获取模态框当前位置
**And** 系统应该设置 `isDragging` 状态为 `true`
**And** 系统应该添加拖动状态的 CSS 类

### Requirement: 拖动过程计算优化
系统必须(MUST)优化拖动过程中的位置计算逻辑，采用简单直接的坐标计算方式。
系统应该(SHOULD)避免复杂的坐标转换，使用统一的坐标系统进行位置更新。
系统必须(MUST)保持高性能的拖动操作，确保用户体验流畅。

#### Scenario:
在拖动过程中，位置计算应该直接简单，避免复杂的坐标转换。

**Given** 用户正在拖动模态框
**When** 鼠标移动时
**Then** 系统应该计算鼠标移动的增量 `deltaX = e.clientX - dragStartX`
**And** 系统应该计算新位置 `newX = modalStartLeft + deltaX`
**And** 系统应该直接应用新位置到 `modal.style.left` 和 `modal.style.top`
**And** 系统应该保持 `requestAnimationFrame` 性能优化

### Requirement: 拖动边界约束
系统必须(MUST)在拖动过程中应用有效的边界约束，确保模态框不会超出可视区域。
系统应该(SHOULD)实时检查并调整模态框位置，防止部分内容移出视口。
系统必须(MUST)提供准确的边界检测算法，确保约束的一致性和可靠性。

#### Scenario:
拖动过程中应该确保模态框不会超出视口边界。

**Given** 模态框正在被拖动
**When** 计算新位置时
**Then** 系统应该调用 `constrainToBounds(newX, newY, width, height)` 函数
**And** 系统应该应用约束后的位置到模态框
**And** 模态框应该完全保持在可视区域内

### Requirement: 拖动状态视觉反馈
系统必须(MUST)提供清晰的视觉反馈，让用户明确知道当前处于拖动状态。
系统应该(SHOULD)使用适当的光标样式和CSS类来增强用户体验。
系统必须(MUST)确保视觉反馈与拖动状态保持同步，避免状态不一致。

#### Scenario:
拖动过程中应该提供清晰的视觉反馈，让用户知道当前处于拖动状态。

**Given** 模态框正在被拖动
**When** 检查模态框样式时
**Then** 模态框头部应该显示 `cursor: grabbing` 光标
**And** 模态框应该有 `modal-dragging` CSS 类
**And** 模态框可以有轻微的透明度变化或阴影增强效果

### Requirement: 拖动结束处理
系统必须(MUST)在拖动结束时正确清理所有相关状态和事件监听器。
系统应该(SHOULD)移除所有临时的视觉反馈效果，恢复模态框的正常状态。
系统必须(MUST)释放所有资源，确保没有内存泄漏或事件监听器残留。

#### Scenario:
当用户停止拖动时，系统应该正确清理状态和事件监听器。

**Given** 用户释放鼠标按钮
**When** 触发鼠标释放事件时
**Then** 系统应该设置 `isDragging` 状态为 `false`
**And** 系统应该移除 `modal-dragging` CSS 类
**And** 系统应该移除鼠标移动和释放事件监听器
**And** 系统应该清理 `requestAnimationFrame` 相关状态

### Requirement: 关闭按钮排除
系统必须(MUST)正确识别并排除关闭按钮区域，避免在点击关闭按钮时触发拖动功能。
系统应该(SHOULD)使用精确的元素检测逻辑，确保关闭按钮的正常功能不受影响。
系统必须(MUST)在拖动事件处理前进行目标元素检查，防止功能冲突。

#### Scenario:
当用户点击模态框关闭按钮时，不应该触发拖动功能。

**Given** 用户点击模态框头部的关闭按钮区域
**When** 检测到鼠标按下事件时
**Then** 系统应该检查点击目标是否在 `.modal-close` 内
**And** 如果是关闭按钮，系统应该不启动拖动功能
**And** 系统应该允许关闭按钮的正常点击行为

## REMOVED Requirements

### 复杂的坐标转换逻辑
移除之前在拖动过程中混合使用不同坐标获取方式的复杂逻辑。

### 重复的位置计算
移除在拖动过程中重复计算和转换坐标的冗余步骤。

### 不一致的状态管理
移除拖动状态管理中的不一致性和混乱状态。

## IMPLEMENTATION Notes

### 关键实现点

1. **拖动开始函数**
   ```javascript
   function startDrag(e) {
       // 排除关闭按钮
       if (e.target.closest('.modal-close')) return;

       isDragging = true;
       dragStartX = e.clientX;
       dragStartY = e.clientY;

       // 直接获取当前实际位置
       const rect = modalContainer.getBoundingClientRect();
       modalStartLeft = rect.left;
       modalStartTop = rect.top;

       // 添加视觉反馈
       modalContainer.classList.add('modal-dragging');

       // 添加事件监听器
       document.addEventListener('mousemove', handleMouseMove);
       document.addEventListener('mouseup', handleMouseUp);
       e.preventDefault();
   }
   ```

2. **拖动处理函数**
   ```javascript
   function handleMouseMove(e) {
       if (isDragging) {
           if (rafId) cancelAnimationFrame(rafId);
           rafId = requestAnimationFrame(() => {
               const deltaX = e.clientX - dragStartX;
               const deltaY = e.clientY - dragStartY;

               let newX = modalStartLeft + deltaX;
               let newY = modalStartTop + deltaY;

               // 应用边界约束
               const bounds = constrainToBounds(newX, newY,
                   modalContainer.offsetWidth, modalContainer.offsetHeight);

               modalContainer.style.left = bounds.x + 'px';
               modalContainer.style.top = bounds.y + 'px';
           });
       }
   }
   ```

3. **CSS 视觉反馈**
   ```css
   .modal-header {
       cursor: move;
       user-select: none;
   }

   .modal-header:active {
       cursor: grabbing;
   }

   .modal-container.modal-dragging {
       opacity: 0.95;
       box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
   }
   ```

### 性能考虑

- 保持 `requestAnimationFrame` 优化，避免频繁的 DOM 更新
- 在拖动结束时及时清理事件监听器和动画帧
- 使用 CSS 类切换而不是内联样式修改来提供视觉反馈

### 兼容性

- 保持与现有约束系统的完全兼容
- 确保拖动功能不影响伸缩功能的正常工作
- 维持现有的模态框显示/隐藏逻辑不变