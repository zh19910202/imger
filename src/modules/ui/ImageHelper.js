/**
 * 图片助手模块
 * 负责管理页面上图片的交互，如高亮、选择、尺寸提示等
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    window.debugLog = function(message, data) {
        console.log('[ImageHelper]', message, data || '');
    };
}

class ImageHelper {
    constructor() {
        this.lastHoveredImage = null;
        this.selectedImage = null;
        this.tooltip = null;
        this.initialized = false;
    }

    isInitialized() {
        return this.initialized;
    }

    initialize() {
        try {
            debugLog('初始化 ImageHelper');
            // 创建尺寸提示框
            this.createTooltip();
            this.initialized = true;
            debugLog('ImageHelper 初始化完成');
        } catch (error) {
            debugLog('ImageHelper 初始化失败:', error);
            throw error;
        }
    }

    // 创建尺寸提示框
    createTooltip() {
        if (this.tooltip) return;

        this.tooltip = document.createElement('div');
        this.tooltip.id = 'image-dimensions-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-family: Arial, sans-serif;
            pointer-events: none;
            z-index: 10000;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(4px);
            display: none;
        `;
        document.body.appendChild(this.tooltip);
    }

    // 为所有图片添加事件监听器
    addImageEventListeners() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            this.addImageListeners(img);
        });
    }

    // 为单个图片添加事件监听器
    addImageListeners(img) {
        // 鼠标悬停事件
        img.addEventListener('mouseenter', (event) => {
            this.lastHoveredImage = event.target;
            this.highlightImage(event.target, true);
            this.showImageDimensions(event.target, event);
        });

        img.addEventListener('mouseleave', (event) => {
            if (this.lastHoveredImage === event.target) {
                this.highlightImage(event.target, false);
            }
            this.hideImageDimensions();
        });

        // 鼠标移动事件 - 更新提示框位置
        img.addEventListener('mousemove', (event) => {
            this.updateTooltipPosition(event);
        });

        // 点击选择事件
        img.addEventListener('click', (event) => {
            // 如果按住Ctrl键点击，选择图片
            if (event.ctrlKey) {
                event.preventDefault();
                this.selectImage(event.target);
            }
        });

        // 双击下载事件
        img.addEventListener('dblclick', (event) => {
            event.preventDefault();
            if (typeof downloadImage === 'function') {
                downloadImage(event.target);
            }
        });
    }

    // 高亮图片
    highlightImage(img, highlight) {
        if (highlight) {
            img.style.transition = 'all 0.2s ease';
            img.style.outline = '2px solid #4CAF50';
            img.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.5)';
        } else {
            // 只有当图片不是选中状态时才移除高亮
            if (this.selectedImage !== img) {
                img.style.outline = '';
                img.style.boxShadow = '';
            }
        }
    }

    // 选择图片
    selectImage(img) {
        // 清除之前选中的图片样式
        if (this.selectedImage) {
            this.selectedImage.style.outline = '';
            this.selectedImage.style.boxShadow = '';
        }

        // 设置新选中的图片
        this.selectedImage = img;
        img.style.outline = '3px solid #2196F3';
        img.style.boxShadow = '0 0 15px rgba(33, 150, 243, 0.7)';

        if (typeof showNotification === 'function') {
            showNotification('图片已选中，按D键下载');
        }
    }

    // 获取要下载的图片
    getImageToDownload() {
        // 优先级：选中的图片 > 鼠标悬停的图片
        return this.selectedImage || this.lastHoveredImage;
    }

    // 显示图片尺寸
    showImageDimensions(img, event) {
        if (!this.tooltip) return;

        // 获取图片实际尺寸
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;

        // 获取显示尺寸
        const displayWidth = img.width;
        const displayHeight = img.height;

        // 构建提示文本
        let tooltipText = `实际: ${naturalWidth} × ${naturalHeight}`;

        // 如果显示尺寸与实际尺寸不同，也显示显示尺寸
        if (naturalWidth !== displayWidth || naturalHeight !== displayHeight) {
            tooltipText += `\n显示: ${displayWidth} × ${displayHeight}`;
        }

        // 如果是原图，添加标记
        if (window.originalImages && window.originalImages.has(img.src)) {
            tooltipText += '\n原图';
        }

        this.tooltip.textContent = tooltipText;
        this.tooltip.style.display = 'block';
        this.updateTooltipPosition(event);
    }

    // 隐藏图片尺寸提示
    hideImageDimensions() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }

    // 更新提示框位置
    updateTooltipPosition(event) {
        if (!this.tooltip || this.tooltip.style.display === 'none') return;

        const tooltipWidth = this.tooltip.offsetWidth;
        const tooltipHeight = this.tooltip.offsetHeight;

        let x = event.pageX + 15;
        let y = event.pageY + 15;

        // 防止提示框超出右边界
        if (x + tooltipWidth > window.innerWidth) {
            x = window.innerWidth - tooltipWidth - 10;
        }

        // 防止提示框超出下边界
        if (y + tooltipHeight > window.innerHeight) {
            y = window.innerHeight - tooltipHeight - 10;
        }

        // 防止提示框超出左边界
        if (x < 0) {
            x = 10;
        }

        // 防止提示框超出上边界
        if (y < 0) {
            y = 10;
        }

        this.tooltip.style.left = x + 'px';
        this.tooltip.style.top = y + 'px';
    }

    // 清除选中的图片
    clearSelectedImage() {
        if (this.selectedImage) {
            this.selectedImage.style.outline = '';
            this.selectedImage.style.boxShadow = '';
            this.selectedImage = null;
        }
    }

    // 获取当前选中的图片
    getSelectedImage() {
        return this.selectedImage;
    }

    // 获取当前悬停的图片
    getLastHoveredImage() {
        return this.lastHoveredImage;
    }
}

// 全局实例
let imageHelperInstance = null;

// 获取全局实例
function getImageHelper() {
    if (!imageHelperInstance) {
        imageHelperInstance = new ImageHelper();
        // 设置到全局变量以保持兼容性
        window.imageHelper = imageHelperInstance;
    }
    return imageHelperInstance;
}

// 兼容性函数 - 保持向后兼容
function getImageToDownload() {
    const helper = getImageHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.getImageToDownload();
}

function selectImage(img) {
    const helper = getImageHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.selectImage(img);
}

function highlightImage(img, highlight) {
    const helper = getImageHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.highlightImage(img, highlight);
}

function showImageDimensions(img, event) {
    const helper = getImageHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.showImageDimensions(img, event);
}

function hideImageDimensions() {
    const helper = getImageHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.hideImageDimensions();
}

function updateTooltipPosition(event) {
    const helper = getImageHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    return helper.updateTooltipPosition(event);
}

// 初始化函数
function initializeImageHelper() {
    try {
        const helper = getImageHelper();
        helper.initialize();
        debugLog('ImageHelper 全局初始化完成');
        return helper;
    } catch (error) {
        debugLog('ImageHelper 全局初始化失败:', error);
        throw error;
    }
}

// 导出到全局作用域
window.ImageHelper = ImageHelper;
window.getImageHelper = getImageHelper;
window.initializeImageHelper = initializeImageHelper;

// 兼容性函数导出
window.getImageToDownload = getImageToDownload;
window.selectImage = selectImage;
window.highlightImage = highlightImage;
window.showImageDimensions = showImageDimensions;
window.hideImageDimensions = hideImageDimensions;
window.updateTooltipPosition = updateTooltipPosition;

// 监听动态添加的图片（从content.js迁移）
function observeImageChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查新添加的元素是否是图片
                    if (node.tagName === 'IMG') {
                        handleNewImage(node);
                    }
                    // 检查新添加的元素内部是否有图片
                    const images = node.querySelectorAll && node.querySelectorAll('img');
                    if (images) {
                        images.forEach(img => handleNewImage(img));
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    debugLog('图片变化监听器已启动');
    return observer;
}

// 处理新图片（从content.js迁移）
function handleNewImage(img) {
    // 如果 ImageHelper 可用，使用它来处理
    if (typeof addImageListeners === 'function') {
        addImageListeners(img);
    }
    
    // 检查是否需要更新原图
    if (typeof recordOriginalImages === 'function') {
        // 延迟检测，等待图片加载
        setTimeout(() => {
            recordOriginalImages();
        }, 500);
    }
    
    debugLog('处理新图片', { src: img.src?.substring(0, 50) });
}

// 为所有现有图片添加监听器
function addImageEventListenersToAll() {
    const helper = getImageHelper();
    if (!helper.isInitialized()) {
        helper.initialize();
    }
    helper.addImageEventListeners();
    debugLog('已为所有现有图片添加事件监听器');
}

// 导出addImageListeners函数
window.addImageListeners = function(img) {
    const helper = getImageHelper();
    if (helper && helper.isInitialized()) {
        return helper.addImageListeners(img);
    } else {
        console.warn('ImageHelper未初始化，无法为图片添加事件监听器');
    }
};

// 导出新增的函数
window.observeImageChanges = observeImageChanges;
window.handleNewImage = handleNewImage;
window.addImageEventListenersToAll = addImageEventListenersToAll;

debugLog('ImageHelper 模块加载完成');