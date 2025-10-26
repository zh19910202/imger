# 设计文档：模态框拖动和伸缩优化

## 问题分析

### 当前实现的问题

1. **混合坐标系统**
   ```javascript
   // 当前实现混合使用 transform 和 left/top
   modal.style.cssText = `
       position: fixed;
       top: 50%;
       left: 50%;
       transform: translate(-50%, -50%);
   `;
   // 但在拖动时又使用 left/top
   modalContainer.style.left = bounds.x + 'px';
   modalContainer.style.top = bounds.y + 'px';
   ```

2. **复杂的初始化逻辑**
   - 缺少明确的模态框位置初始化函数
   - 首次显示时依赖 transform 居中，后续又切换到 left/top

3. **事件处理复杂性**
   - 拖动和伸缩事件处理逻辑比参考实现更复杂
   - 状态管理不够清晰

### 参考实现的优势

从 `tests/modal.html` 中可以看到：

1. **统一的坐标系统**
   ```javascript
   // 完全使用 left/top + position: fixed
   modalContainer.style.left = (windowWidth - modalWidth) / 2 + 'px';
   modalContainer.style.top = (windowHeight - modalHeight) / 2 + 'px';
   ```

2. **简洁的拖动逻辑**
   ```javascript
   // 直接使用 getBoundingClientRect() 获取位置
   const rect = modalContainer.getBoundingClientRect();
   modalStartLeft = rect.left;
   modalStartTop = rect.top;
   ```

3. **清晰的初始化函数**
   ```javascript
   function initModalPosition() {
       const windowWidth = window.innerWidth;
       const windowHeight = window.innerHeight;
       const modalWidth = 600;
       const modalHeight = 500;

       modalContainer.style.width = modalWidth + 'px';
       modalContainer.style.height = modalHeight + 'px';
       modalContainer.style.left = (windowWidth - modalWidth) / 2 + 'px';
       modalContainer.style.top = (windowHeight - modalHeight) / 2 + 'px';
   }
   ```

## 设计方案

### 1. 坐标系统统一

**目标**：完全移除 transform 定位，统一使用 left/top + position: fixed

**实现**：
```javascript
function initializeModalPosition() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const modalWidth = 600; // 或从配置获取
    const modalHeight = 500; // 或从配置获取

    modalContainer.style.width = modalWidth + 'px';
    modalContainer.style.height = modalHeight + 'px';
    modalContainer.style.left = (windowWidth - modalWidth) / 2 + 'px';
    modalContainer.style.top = (windowHeight - modalHeight) / 2 + 'px';
    modalContainer.style.position = 'fixed';
    modalContainer.style.transform = 'none'; // 明确移除 transform
}
```

### 2. 拖动逻辑简化

**目标**：采用参考实现的简洁拖动计算方式

**实现**：
```javascript
function startDrag(e) {
    if (e.target.closest('.modal-close')) return;

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    // 使用 getBoundingClientRect() 获取当前位置
    const rect = modalContainer.getBoundingClientRect();
    modalStartLeft = rect.left;
    modalStartTop = rect.top;

    modalContainer.classList.add('modal-dragging');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
}

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
    // ... 处理伸缩
}
```

### 3. 伸缩逻辑优化

**目标**：简化伸缩计算，确保所有方向都能正确工作

**实现**：
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
}

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
        // ... 其他方向
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

### 4. 视觉反馈改进

**目标**：添加更好的用户体验反馈

**实现**：
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

.modal-container.modal-resizing {
    opacity: 0.95;
}
```

### 5. 事件处理优化

**目标**：简化事件管理，确保清晰的分离

**实现**：
```javascript
function cleanupEvents() {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    isDragging = false;
    isResizing = false;
    resizeDirection = null;
    modalContainer.classList.remove('modal-dragging', 'modal-resizing');
}
```

## 实现策略

### 阶段 1：坐标系统统一
1. 移除所有 transform 相关的样式
2. 实现 `initializeModalPosition()` 函数
3. 确保模态框创建时正确初始化位置

### 阶段 2：拖动逻辑简化
1. 重写 `startDrag` 函数
2. 简化 `handleMouseMove` 中的拖动处理
3. 添加视觉反馈样式

### 阶段 3：伸缩逻辑优化
1. 重写 `startResize` 和 `handleResize` 函数
2. 确保所有方向的伸缩都正常工作
3. 优化尺寸限制逻辑

### 阶段 4：测试和优化
1. 全面测试各种使用场景
2. 性能优化
3. 边界情况处理

## 风险评估

### 低风险
- 坐标系统统一：逻辑清晰，参考实现已经验证
- 视觉反馈添加：纯样式改进，不影响核心功能

### 中等风险
- 拖动逻辑简化：需要确保与现有约束系统的兼容性
- 伸缩逻辑优化：需要验证所有方向的正确性

### 缓解措施
- 保留现有的事件处理框架，逐步替换核心计算逻辑
- 充分测试各种边界情况和极端使用场景
- 保持向后兼容性，确保不破坏现有功能

## 成功标准

1. **功能正确性**：所有拖动和伸缩功能都能正常工作
2. **性能表现**：保持或改善现有的性能水平
3. **用户体验**：无抖动、无跳跃，交互流畅自然
4. **兼容性**：在各种屏幕尺寸和浏览器环境下正常工作
5. **可维护性**：代码结构清晰，易于理解和维护