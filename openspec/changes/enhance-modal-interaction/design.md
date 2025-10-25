# 模态框交互增强 - 设计文档

## 技术方案

### 拖动功能实现

#### 1. 拖动区域设计
- **标题栏拖动**：点击模态框标题栏区域可以拖动整个模态框
- **拖动状态视觉反馈**：拖动时改变鼠标样式和模态框阴影
- **边界限制**：确保模态框不会被拖动到屏幕可视区域外

#### 2. 拖动算法
```javascript
// 拖动状态管理
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let modalStartX = 0;
let modalStartY = 0;

// 拖动事件处理
function handleMouseDown(e) {
    if (e.target.closest('.modal-header')) {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        modalStartX = modal.offsetLeft;
        modalStartY = modal.offsetTop;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
}

function handleMouseMove(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    let newX = modalStartX + deltaX;
    let newY = modalStartY + deltaY;

    // 边界检查
    const maxX = window.innerWidth - modal.offsetWidth;
    const maxY = window.innerHeight - modal.offsetHeight;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    modal.style.left = newX + 'px';
    modal.style.top = newY + 'px';
    modal.style.transform = 'none'; // 取消居中定位
}
```

### 伸缩功能实现

#### 1. 伸缩控制点设计
- **8个控制点**：四个角 + 四条边的中点
- **控制点样式**：小方块，hover时高亮显示
- **鼠标指针**：根据位置显示对应的resize光标

#### 2. 伸缩算法
```javascript
// 伸缩状态管理
let isResizing = false;
let resizeDirection = null; // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartLeft = 0;
let resizeStartTop = 0;

// 伸缩处理函数
function handleResizeStart(e, direction) {
    isResizing = true;
    resizeDirection = direction;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartWidth = modal.offsetWidth;
    resizeStartHeight = modal.offsetHeight;
    resizeStartLeft = modal.offsetLeft;
    resizeStartTop = modal.offsetTop;
}

function handleResizeMove(e) {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartX;
    const deltaY = e.clientY - resizeStartY;

    let newWidth = resizeStartWidth;
    let newHeight = resizeStartHeight;
    let newLeft = resizeStartLeft;
    let newTop = resizeStartTop;

    switch (resizeDirection) {
        case 'se': // 右下角
            newWidth = resizeStartWidth + deltaX;
            newHeight = resizeStartHeight + deltaY;
            break;
        case 'sw': // 左下角
            newWidth = resizeStartWidth - deltaX;
            newHeight = resizeStartHeight + deltaY;
            newLeft = resizeStartLeft + deltaX;
            break;
        // ... 其他方向的处理
    }

    // 应用尺寸限制
    newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));
    newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT));

    // 应用新尺寸和位置
    modal.style.width = newWidth + 'px';
    modal.style.height = newHeight + 'px';
    modal.style.left = newLeft + 'px';
    modal.style.top = newTop + 'px';
}
```

### CSS样式设计

#### 1. 拖动样式
```css
.modal-header {
    cursor: move;
    user-select: none;
}

.modal-dragging {
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    opacity: 0.95;
}
```

#### 2. 伸缩控制点样式
```css
.resize-handle {
    position: absolute;
    background: #ccc;
    opacity: 0;
    transition: opacity 0.2s;
}

.resize-handle:hover {
    opacity: 1;
    background: #2196F3;
}

.resize-handle-nw { top: 0; left: 0; cursor: nw-resize; }
.resize-handle-ne { top: 0; right: 0; cursor: ne-resize; }
.resize-handle-sw { bottom: 0; left: 0; cursor: sw-resize; }
.resize-handle-se { bottom: 0; right: 0; cursor: se-resize; }
.resize-handle-n { top: 0; left: 50%; cursor: n-resize; }
.resize-handle-s { bottom: 0; left: 50%; cursor: s-resize; }
.resize-handle-w { left: 0; top: 50%; cursor: w-resize; }
.resize-handle-e { right: 0; top: 50%; cursor: e-resize; }
```

#### 3. 控制点尺寸
```css
.resize-handle {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.resize-handle-n,
.resize-handle-s {
    width: 20px;
    height: 8px;
    border-radius: 4px;
    left: 50%;
    transform: translateX(-50%);
}

.resize-handle-w,
.resize-handle-e {
    width: 8px;
    height: 20px;
    border-radius: 4px;
    top: 50%;
    transform: translateY(-50%);
}
```

### 配置参数

```javascript
const MODAL_CONFIG = {
    // 尺寸限制
    MIN_WIDTH: 400,
    MIN_HEIGHT: 300,
    MAX_WIDTH: window.innerWidth * 0.9,
    MAX_HEIGHT: window.innerHeight * 0.9,

    // 控制点配置
    HANDLE_SIZE: 8,
    HANDLE_THICKNESS: 20,

    // 拖动配置
    DRAG_THRESHOLD: 5, // 开始拖动的最小移动距离
    SNAP_THRESHOLD: 10, // 吸附到边缘的阈值
};
```

### 性能优化

#### 1. 事件节流
```javascript
// 使用requestAnimationFrame优化拖动性能
let rafId = null;

function handleMouseMove(e) {
    if (!isDragging) return;

    if (rafId) {
        cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
        updateModalPosition(e);
    });
}
```

#### 2. 内存管理
```javascript
// 清理事件监听器
function cleanupDragEvents() {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}
```

### 兼容性考虑

#### 1. 浏览器兼容性
- 使用标准DOM API，确保跨浏览器兼容
- 添加touch事件支持，适配移动设备
- 提供polyfill支持旧版浏览器

#### 2. 响应式设计
- 在小屏幕设备上限制最大尺寸
- 根据屏幕尺寸调整控制点大小
- 支持键盘导航（方向键微调位置）

### 用户体验优化

#### 1. 视觉反馈
- 拖动时显示半透明效果
- 伸缩时显示尺寸预览
- 控制点hover状态明显

#### 2. 操作便利性
- 双击标题栏最大化/还原
- ESC键取消当前操作
- 滚轮支持快速缩放

#### 3. 状态保持
- 记住用户上次设置的模态框位置和大小
- 页面刷新后恢复模态框状态
- 不同屏幕尺寸下的智能适配