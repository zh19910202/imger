# 统一模态框坐标系统

## MODIFIED Requirements

### Requirement: 统一坐标定位系统
模态框必须(MUST)使用统一的坐标系统进行定位，避免混合使用 `transform` 和 `left/top` 定位方式。

模态框必须(MUST)完全基于 `position: fixed` + `left/top` 进行定位。
模态框必须(MUST)将 `transform` 属性设置为 `none` 以避免坐标系统冲突。
模态框应该(SHOULD)在首次显示时在视口中居中显示。

#### Scenario:
当用户首次打开模态框时，系统应该使用统一的坐标系统进行定位，而不是混合使用 `transform` 和 `left/top` 定位方式。

**Given** 用户点击显示模态框的按钮
**When** 模态框被创建并显示时
**Then** 模态框应该使用 `position: fixed` + `left/top` 进行定位
**And** 模态框的 `transform` 属性应该设置为 `none`
**And** 模态框应该在视口中居中显示

### Requirement: 模态框位置初始化
模态框必须(MUST)有一个明确的初始化函数来设置其位置和尺寸。

模态框必须(MUST)在初始化时设置默认的宽度和高度。
模态框必须(MUST)根据窗口尺寸计算居中位置。
模态框应该(SHOULD)使用窗口和模态框的尺寸差值来计算居中坐标。

#### Scenario:
当模态框显示时，应该有一个明确的初始化函数来设置其位置和尺寸。

**Given** 模态框元素已创建
**When** 调用初始化函数时
**Then** 模态框的宽度应该设置为默认值（如600px）
**And** 模态框的高度应该设置为默认值（如500px）
**And** 模态框的左边距应该设置为 `(窗口宽度 - 模态框宽度) / 2`
**And** 模态框的上边距应该设置为 `(窗口高度 - 模态框高度) / 2`

### Requirement: 坐标计算一致性
模态框必须(MUST)在整个交互过程中使用一致的坐标参考系统。

模态框必须(MUST)基于 `left` 和 `top` 样式属性进行所有坐标计算。
模态框不应该(SHOULD NOT)混合使用 `getBoundingClientRect()` 和样式坐标。
模态框应该(SHOULD)在拖动和伸缩过程中保持坐标系统的一致性。

#### Scenario:
在进行拖动和伸缩操作时，所有的坐标计算应该使用一致的参考系统。

**Given** 模态框正在被拖动或伸缩
**When** 计算新位置时
**Then** 所有坐标计算都应该基于 `left` 和 `top` 样式属性
**And** 不应该混合使用 `getBoundingClientRect()` 和样式坐标
**And** 坐标系统应该在整个交互过程中保持一致

### Requirement: 位置状态管理
模态框必须(MUST)在初始化时明确建立位置状态，而不是在交互过程中才确定。

模态框必须(MUST)有明确的 `left` 和 `top` 像素值。
模态框必须(MUST)使用 `position: fixed` 定位。
模态框必须(MUST)将 `transform` 设置为 `none`。

#### Scenario:
模态框的位置状态应该在初始化时就明确建立，而不是在交互过程中才确定。

**Given** 模态框已初始化
**When** 检查模态框位置状态时
**Then** `modal.style.left` 应该有一个明确的像素值
**And** `modal.style.top` 应该有一个明确的像素值
**And** `modal.style.position` 应该设置为 `fixed`
**And** `modal.style.transform` 应该设置为 `none`

### Requirement: 窗口尺寸适应
模态框必须(MUST)在浏览器窗口尺寸变化时保持正确的坐标系统。

模态框必须(MUST)保持在可视区域内。
模态框必须(MUST)继续基于 `left/top` 系统进行坐标计算。
模态框不应该(SHOULD NOT)因为窗口变化而产生坐标系统混乱。

#### Scenario:
当浏览器窗口尺寸发生变化时，模态框的坐标系统应该能够正确适应。

**Given** 浏览器窗口尺寸发生变化
**When** 检查模态框位置时
**Then** 模态框应该保持在可视区域内
**And** 模态框的坐标计算仍然基于 `left/top` 系统
**And** 不应该因为窗口变化而产生坐标系统混乱

## REMOVED Requirements

### 混合定位系统
移除之前使用 `transform: translate(-50%, -50%)` 进行居中，然后在拖动时切换到 `left/top` 的混合定位方式。

### Transform依赖定位
移除依赖 `transform` 属性进行模态框初始定位的实现方式。

## IMPLEMENTATION Notes

### 关键变化点

1. **模态框创建时的样式设置**
   ```javascript
   // 旧方式
   modal.style.cssText = `
       position: fixed;
       top: 50%;
       left: 50%;
       transform: translate(-50%, -50%);
   `;

   // 新方式
   modal.style.cssText = `
       position: fixed;
       transform: none;
   `;
   // 然后调用 initializeModalPosition()
   ```

2. **初始化函数实现**
   ```javascript
   function initializeModalPosition() {
       const windowWidth = window.innerWidth;
       const windowHeight = window.innerHeight;
       const modalWidth = MODAL_CONFIG.DEFAULT_WIDTH || 600;
       const modalHeight = MODAL_CONFIG.DEFAULT_HEIGHT || 500;

       modalContainer.style.width = modalWidth + 'px';
       modalContainer.style.height = modalHeight + 'px';
       modalContainer.style.left = (windowWidth - modalWidth) / 2 + 'px';
       modalContainer.style.top = (windowHeight - modalHeight) / 2 + 'px';
       modalContainer.style.position = 'fixed';
       modalContainer.style.transform = 'none';
   }
   ```

3. **坐标获取方式**
   ```javascript
   // 在拖动开始时，使用 getBoundingClientRect() 获取当前实际位置
   const rect = modalContainer.getBoundingClientRect();
   modalStartLeft = rect.left;
   modalStartTop = rect.top;
   ```

### 兼容性考虑

- 保持现有的约束系统（`constrainToBounds` 函数）
- 维持 `requestAnimationFrame` 性能优化
- 确保与现有的事件处理框架兼容