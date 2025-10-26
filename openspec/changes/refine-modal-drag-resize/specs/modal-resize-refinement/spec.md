# 优化伸缩交互逻辑

## MODIFIED Requirements

### Requirement: 简化伸缩起始逻辑
系统必须(MUST)简化伸缩起始逻辑，确保在用户开始伸缩时能够快速获取当前状态信息。
系统应该(SHOULD)使用一致的坐标和尺寸获取方式，避免混合使用不同的方法。
系统必须(MUST)在伸缩开始时正确设置状态标志和方向信息，为后续操作做好准备。

#### Scenario:
当用户开始伸缩模态框时，伸缩起始逻辑应该直接获取当前状态信息。

**Given** 用户在伸缩控制点按下鼠标
**When** 触发伸缩开始事件时
**Then** 系统应该设置 `isResizing` 状态为 `true`
**And** 系统应该记录鼠标起始位置 `e.clientX` 和 `e.clientY`
**And** 系统应该使用 `getBoundingClientRect()` 获取模态框当前尺寸和位置
**And** 系统应该记录伸缩方向（如 'se', 'sw', 'ne', 'nw', 'n', 's', 'e', 'w'）
**And** 系统应该添加伸缩状态的 CSS 类

### Requirement: 伸缩过程计算优化
系统必须(MUST)优化伸缩过程中的尺寸和位置计算逻辑，根据不同方向采用相应的简单算法。
系统应该(SHOULD)避免复杂的尺寸转换和计算，使用统一的数学模型进行更新。
系统必须(MUST)保持高性能的伸缩操作，确保用户体验流畅和响应及时。

#### Scenario:
在伸缩过程中，尺寸和位置计算应该根据不同方向采用相应的简单逻辑。

**Given** 用户正在伸缩模态框
**When** 鼠标移动时
**Then** 系统应该计算鼠标移动增量 `deltaX = e.clientX - startX`, `deltaY = e.clientY - startY`
**And** 系统应该根据伸缩方向计算新的宽度和高度
**And** 对于需要调整位置的伸缩方向（如左上、左边、上边），系统应该同时计算新的位置
**And** 系统应该应用最小和最大尺寸限制

### Requirement: 各方向伸缩逻辑
系统必须(MUST)为每个伸缩方向提供相应的计算逻辑，确保不同方向的伸缩行为正确。
系统应该(SHOULD)根据伸缩方向决定是否需要调整位置，以及调整的具体计算方式。
系统必须(MUST)确保八个方向（上、下、左、右、左上、右上、左下、右下）的伸缩功能都能正常工作。

#### Scenario:
不同方向的伸缩应该有相应的计算逻辑。

**Given** 伸缩方向为右下角 ('se')
**When** 鼠标移动时
**Then** `newWidth = startWidth + deltaX`
**And** `newHeight = startHeight + deltaY`
**And** 位置不需要调整

**Given** 伸缩方向为左下角 ('sw')
**When** 鼠标移动时
**Then** `newWidth = startWidth - deltaX`
**And** `newHeight = startHeight + deltaY`
**And** `newLeft = resizeStartLeft + deltaX`

**Given** 伸缩方向为右上角 ('ne')
**When** 鼠标移动时
**Then** `newWidth = startWidth + deltaX`
**And** `newHeight = startHeight - deltaY`
**And** `newTop = resizeStartTop + deltaY`

**Given** 伸缩方向为左上角 ('nw')
**When** 鼠标移动时
**Then** `newWidth = startWidth - deltaX`
**And** `newHeight = startHeight - deltaY`
**And** `newLeft = resizeStartLeft + deltaX`
**And** `newTop = resizeStartTop + deltaY`

### Requirement: 尺寸限制应用
系统必须(MUST)在伸缩过程中正确应用最小和最大尺寸限制，确保模态框不会变得过大或过小。
系统应该(SHOULD)在达到尺寸限制时能够智能处理位置调整，特别是从左边或上边伸缩的情况。
系统必须(MUST)提供可配置的尺寸限制参数，支持不同场景下的尺寸需求。

#### Scenario:
伸缩过程中应该正确应用最小和最大尺寸限制。

**Given** 计算得到新的模态框尺寸
**When** 应用尺寸限制时
**Then** 系统应该确保 `newWidth >= MIN_WIDTH` 且 `newWidth <= MAX_WIDTH`
**And** 系统应该确保 `newHeight >= MIN_HEIGHT` 且 `newHeight <= MAX_HEIGHT`
**And** 当达到最小尺寸时，如果从左边或上边伸缩，系统应该相应调整位置
**And** 系统应该应用限制后的最终尺寸和位置

### Requirement: 伸缩状态视觉反馈
系统必须(MUST)提供清晰的视觉反馈，让用户明确知道当前处于伸缩状态。
系统应该(SHOULD)使用适当的光标样式和CSS类来指示不同的伸缩方向。
系统必须(MUST)确保视觉反馈与伸缩状态保持同步，增强用户体验和操作直观性。

#### Scenario:
伸缩过程中应该提供清晰的视觉反馈。

**Given** 模态框正在被伸缩
**When** 检查模态框样式时
**Then** 模态框应该有 `modal-resizing` CSS 类
**And** 伸缩控制点应该显示相应的光标样式（如 `nwse-resize`, `nesw-resize` 等）
**And** 模态框可以有轻微的透明度变化

### Requirement: 伸缩结束处理
系统必须(MUST)在伸缩结束时正确清理所有相关状态和事件监听器。
系统应该(SHOULD)移除所有临时的视觉反馈效果，恢复模态框的正常状态。
系统必须(MUST)释放所有资源，确保没有内存泄漏或事件监听器残留，保持系统稳定性。

#### Scenario:
当用户停止伸缩时，系统应该正确清理状态。

**Given** 用户释放鼠标按钮
**When** 触发鼠标释放事件时
**Then** 系统应该设置 `isResizing` 状态为 `false`
**And** 系统应该重置 `resizeDirection` 为 `null`
**And** 系统应该移除 `modal-resizing` CSS 类
**And** 系统应该移除事件监听器和清理动画帧状态

## REMOVED Requirements

### 复杂的尺寸计算逻辑
移除之前在伸缩过程中过度复杂的尺寸和位置计算方式。

### 不一致的尺寸获取方式
移除混合使用不同方法获取模态框尺寸的不一致做法。

### 冗余的位置调整
移除在伸缩过程中不必要的重复位置调整和计算。

## IMPLEMENTATION Notes

### 关键实现点

1. **伸缩开始函数**
   ```javascript
   function startResize(e, direction) {
       isResizing = true;
       resizeDirection = direction;
       startX = e.clientX;
       startY = e.clientY;

       // 获取当前状态
       const rect = modalContainer.getBoundingClientRect();
       startWidth = rect.width;
       startHeight = rect.height;
       resizeStartLeft = rect.left;
       resizeStartTop = rect.top;

       modalContainer.classList.add('modal-resizing');
       document.addEventListener('mousemove', handleMouseMove);
       document.addEventListener('mouseup', handleMouseUp);
       e.preventDefault();
       e.stopPropagation();
   }
   ```

2. **伸缩处理函数**
   ```javascript
   function handleResize(e) {
       const deltaX = e.clientX - startX;
       const deltaY = e.clientY - startY;

       let newWidth = startWidth;
       let newHeight = startHeight;
       let newLeft = resizeStartLeft;
       let newTop = resizeStartTop;

       // 根据方向计算新尺寸和位置
       switch (resizeDirection) {
           case 'se': // 右下角
               newWidth = startWidth + deltaX;
               newHeight = startHeight + deltaY;
               break;
           case 'sw': // 左下角
               newWidth = startWidth - deltaX;
               newHeight = startHeight + deltaY;
               newLeft = resizeStartLeft + deltaX;
               break;
           case 'ne': // 右上角
               newWidth = startWidth + deltaX;
               newHeight = startHeight - deltaY;
               newTop = resizeStartTop + deltaY;
               break;
           case 'nw': // 左上角
               newWidth = startWidth - deltaX;
               newHeight = startHeight - deltaY;
               newLeft = resizeStartLeft + deltaX;
               newTop = resizeStartTop + deltaY;
               break;
           case 'n': // 上边
               newHeight = startHeight - deltaY;
               newTop = resizeStartTop + deltaY;
               break;
           case 's': // 下边
               newHeight = startHeight + deltaY;
               break;
           case 'w': // 左边
               newWidth = startWidth - deltaX;
               newLeft = resizeStartLeft + deltaX;
               break;
           case 'e': // 右边
               newWidth = startWidth + deltaX;
               break;
       }

       // 应用尺寸限制
       newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));
       newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT));

       // 应用新尺寸和位置
       modalContainer.style.width = newWidth + 'px';
       modalContainer.style.height = newHeight + 'px';
       modalContainer.style.left = newLeft + 'px';
       modalContainer.style.top = newTop + 'px';
   }
   ```

3. **CSS 样式和光标**
   ```css
   .resize-handle.right {
       right: 0;
       top: 0;
       bottom: 0;
       width: 10px;
       cursor: ew-resize;
   }

   .resize-handle.bottom {
       left: 0;
       right: 0;
       bottom: 0;
       height: 10px;
       cursor: ns-resize;
   }

   .resize-handle.corner {
       right: 0;
       bottom: 0;
       width: 20px;
       height: 20px;
       cursor: nwse-resize;
   }

   .modal-container.modal-resizing {
       opacity: 0.95;
   }
   ```

### 性能考虑

- 保持 `requestAnimationFrame` 优化，避免频繁的 DOM 更新
- 在伸缩结束时及时清理事件监听器
- 使用高效的 CSS 选择器和样式应用

### 兼容性

- 确保所有八个方向的伸缩功能都能正常工作
- 保持与拖动功能的兼容性，不会相互干扰
- 维持现有的模态框约束系统和边界检查