# Design Document: Modal Drag and Resize Fix

## Problem Analysis

### Current Issues

1. **Coordinate System Mismatch**
   - 当前代码在拖动时使用 `getBoundingClientRect()` 获取模态框位置
   - `getBoundingClientRect()` 返回的是相对于视口的坐标
   - 但模态框已使用 `position: fixed`，其 `left`/`top` 直接对应视口坐标
   - 这导致双重坐标转换，最终产生位置跳跃/抖动

2. **Resize Position Calculation**
   - 伸缩逻辑在处理左/上方向时计算不正确
   - 当从左边拖拽时，需要同时更新 `width` 和 `left`，但算法中的限制处理有缺陷
   - 从上边拖拽时的位置计算也存在类似问题

3. **State Management Complexity**
   - 使用多个互相关联的状态变量，容易出现不一致
   - RAF（requestAnimationFrame）的管理也不够清晰

### Reference from React Component

测试组件 `/Users/snow/auxis/tests/modal.js` 提供了更清晰的状态管理模式：

```javascript
// 简化的拖动逻辑
const handleMouseMove = (e) => {
  if (isDragging) {
    setPosition({
      x: e.clientX - dragOffset.x,  // 直接用鼠标坐标减去偏移
      y: e.clientY - dragOffset.y
    });
  }
};

const handleHeaderMouseDown = (e) => {
  setDragOffset({
    x: e.clientX - position.x,  // 记录鼠标相对于模态框的偏移
    y: e.clientY - position.y
  });
};
```

这个模式的优点：
- 清晰的状态转换
- 坐标计算简单直观
- 易于理解和维护

## Solution Architecture

### 1. State Structure

```javascript
// 拖动状态
let isDragging = false;
let dragStartX = 0;      // 鼠标按下时的 clientX
let dragStartY = 0;      // 鼠标按下时的 clientY
let dragOffsetX = 0;     // 鼠标相对于模态框左上角的偏移
let dragOffsetY = 0;

// 伸缩状态
let isResizing = false;
let resizeStartX = 0;    // 鼠标按下时的 clientX
let resizeStartY = 0;    // 鼠标按下时的 clientY
let resizeDirection = null;
let resizeStartState = {
  left: 0,
  top: 0,
  width: 0,
  height: 0
};

// 模态框当前状态
let currentLeft = 0;     // 从样式中解析
let currentTop = 0;
let currentWidth = 0;
let currentHeight = 0;
```

### 2. Helper Functions

```javascript
function getModalPosition() {
  const left = parseInt(modalContainer.style.left) || 0;
  const top = parseInt(modalContainer.style.top) || 0;
  return { left, top };
}

function getModalSize() {
  const width = modalContainer.offsetWidth;
  const height = modalContainer.offsetHeight;
  return { width, height };
}

function setModalPosition(left, top) {
  modalContainer.style.left = left + 'px';
  modalContainer.style.top = top + 'px';
}

function setModalSize(width, height) {
  modalContainer.style.width = width + 'px';
  modalContainer.style.height = height + 'px';
}

function constrainPosition(left, top, width, height) {
  const maxLeft = Math.max(0, window.innerWidth - width);
  const maxTop = Math.max(0, window.innerHeight - height);
  return {
    left: Math.max(0, Math.min(left, maxLeft)),
    top: Math.max(0, Math.min(top, maxTop))
  };
}
```

### 3. Drag Implementation

```javascript
function startDrag(e) {
  const pos = getModalPosition();
  const size = getModalSize();

  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragOffsetX = e.clientX - pos.left;
  dragOffsetY = e.clientY - pos.top;

  modalContainer.classList.add('modal-dragging');
}

function handleDrag(e) {
  if (!isDragging) return;

  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    const size = getModalSize();
    let newLeft = e.clientX - dragOffsetX;
    let newTop = e.clientY - dragOffsetY;

    const bounds = constrainPosition(newLeft, newTop, size.width, size.height);
    setModalPosition(bounds.left, bounds.top);
  });
}
```

### 4. Resize Implementation

每个方向的伸缩计算：

```javascript
function handleResize(e) {
  if (!isResizing) return;

  const deltaX = e.clientX - resizeStartX;
  const deltaY = e.clientY - resizeStartY;

  let newWidth = resizeStartState.width;
  let newHeight = resizeStartState.height;
  let newLeft = resizeStartState.left;
  let newTop = resizeStartState.top;

  // 根据方向调整
  if (resizeDirection.includes('e')) {  // 右边
    newWidth = resizeStartState.width + deltaX;
  }
  if (resizeDirection.includes('s')) {  // 下边
    newHeight = resizeStartState.height + deltaY;
  }
  if (resizeDirection.includes('w')) {  // 左边
    newWidth = resizeStartState.width - deltaX;
    newLeft = resizeStartState.left + deltaX;
  }
  if (resizeDirection.includes('n')) {  // 上边
    newHeight = resizeStartState.height - deltaY;
    newTop = resizeStartState.top + deltaY;
  }

  // 应用最小尺寸限制
  if (newWidth < MIN_WIDTH) {
    newWidth = MIN_WIDTH;
    if (resizeDirection.includes('w')) {
      newLeft = resizeStartState.left + (resizeStartState.width - MIN_WIDTH);
    }
  }

  if (newHeight < MIN_HEIGHT) {
    newHeight = MIN_HEIGHT;
    if (resizeDirection.includes('n')) {
      newTop = resizeStartState.top + (resizeStartState.height - MIN_HEIGHT);
    }
  }

  // 边界检查
  const bounds = constrainPosition(newLeft, newTop, newWidth, newHeight);

  setModalSize(newWidth, newHeight);
  setModalPosition(bounds.left, bounds.top);
}
```

## Migration Path

1. 保持现有的事件监听器注册方式
2. 逐步替换 `startDrag`、`handleMouseMove`、`handleResize` 中的逻辑
3. 保持 CSS 样式不变
4. 保持外部 API 不变（`showCollectionModal` 函数签名）

## Testing Considerations

- 测试各个方向的伸缩：nw, n, ne, w, e, sw, s, se
- 测试边界约束：模态框不应超出窗口
- 测试最小尺寸：宽度 300px，高度 200px
- 测试拖动的平滑性：不应出现抖动或跳跃
- 测试快速拖动：RAF 应正确取消前一帧动画
