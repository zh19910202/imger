/**
 * 键盘管理器模块
 * 负责所有快捷键处理和事件管理，统一键盘交互逻辑
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    window.debugLog = function(message, data) {
        console.log('[KeyboardManager]', message, data || '');
    };
}

class KeyboardManager {
    constructor() {
        this.initialized = false;
        this.keyHandlers = new Map();
        this.isEnabled = true;
        this.f1Manager = new F1BatchManager();
        this.escapeManager = new EscapeKeyManager();
    }

    isInitialized() {
        return this.initialized;
    }

    initialize() {
        try {
            debugLog('初始化 KeyboardManager');
            this.setupKeyHandlers();
            this.bindEventListeners();
            this.initialized = true;
            debugLog('KeyboardManager 初始化完成');
        } catch (error) {
            debugLog('KeyboardManager 初始化失败:', error);
            throw error;
        }
    }

    // 设置所有快捷键处理器
    setupKeyHandlers() {
        // D键 - 下载图片
        this.keyHandlers.set('d', {
            description: '下载图片',
            closeModal: true,
            handler: (event) => this.handleDownloadKey(event)
        });

        // Space键 - 跳过
        this.keyHandlers.set('space', {
            description: '跳过',
            closeModal: false, // 继续执行跳过功能
            handler: (event) => this.handleSkipKey(event)
        });

        // S键 - 提交
        this.keyHandlers.set('s', {
            description: '提交并继续标注',
            closeModal: false,
            handler: (event) => this.handleSubmitKey(event)
        });

        // A键 - 上传图片
        this.keyHandlers.set('a', {
            description: '上传图片',
            closeModal: false,
            handler: (event) => this.handleUploadKey(event)
        });

        // F键 - 查看历史
        this.keyHandlers.set('f', {
            description: '查看历史',
            closeModal: false,
            handler: (event) => this.handleHistoryKey(event)
        });

        // X键 - 标记无效
        this.keyHandlers.set('x', {
            description: '标记无效',
            closeModal: true,
            handler: (event) => this.handleInvalidKey(event)
        });

        // R键 - RunningHub尺寸检查
        this.keyHandlers.set('r', {
            description: 'RunningHub尺寸检查',
            closeModal: false,
            handler: (event) => this.handleRunningHubKey(event)
        });

        // F1键 - 批量标记无效
        this.keyHandlers.set('f1', {
            description: '批量标记无效',
            closeModal: true,
            handler: (event) => this.handleF1Key(event)
        });

        // F2键 - 智能尺寸检查
        this.keyHandlers.set('f2', {
            description: '智能尺寸检查',
            closeModal: false,
            handler: (event) => this.handleF2Key(event)
        });

        // N键 - 重新检测原图
        this.keyHandlers.set('n', {
            description: '重新检测原图',
            closeModal: false,
            handler: (event) => this.handleDetectKey(event)
        });

        // P键 - 智能尺寸检查
        this.keyHandlers.set('p', {
            description: '智能尺寸检查',
            closeModal: false,
            handler: (event) => this.handlePKey(event)
        });

        // W键 - 智能图片对比
        this.keyHandlers.set('w', {
            description: '智能图片对比',
            closeModal: false,
            handler: (event) => this.handleSmartComparisonKey(event)
        });
    }

    // 绑定事件监听器
    bindEventListeners() {
        document.addEventListener('keydown', (event) => this.handleKeydown(event));
        debugLog('键盘事件监听器已绑定');
    }

    // 主键盘事件处理器
    handleKeydown(event) {
        if (!this.isEnabled) return;

        // 检查是否在输入框中
        if (this.isInInputField(event.target)) {
            return; // 在输入框中，不处理快捷键
        }

        // 处理特殊键
        if (event.key === 'F1') {
            return this.keyHandlers.get('f1').handler(event);
        } else if (event.key === 'F2') {
            return this.keyHandlers.get('f2').handler(event);
        } else if (event.code === 'Space') {
            return this.keyHandlers.get('space').handler(event);
        }

        // 处理普通字母键
        const key = event.key.toLowerCase();
        const keyHandler = this.keyHandlers.get(key);

        if (keyHandler) {
            // 检查是否需要关闭模态框
            if (keyHandler.closeModal && typeof checkAndCloseModalIfOpen === 'function') {
                if (checkAndCloseModalIfOpen(key)) {
                    return; // 如果关闭了模态框，停止执行
                }
            }

            return keyHandler.handler(event);
        }
    }

    // 检查是否在输入字段中
    isInInputField(element) {
        if (!element) return false;

        const tagName = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();

        return (
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            element.contentEditable === 'true' ||
            element.isContentEditable ||
            (tagName === 'input' && ['text', 'password', 'email', 'search', 'url', 'tel'].includes(type))
        );
    }

    // D键处理 - 下载图片
    handleDownloadKey(event) {
        event.preventDefault();

        // 获取要下载的图片
        const imageToDownload = typeof getImageToDownload === 'function' ? getImageToDownload() : null;

        if (imageToDownload && typeof downloadImage === 'function') {
            downloadImage(imageToDownload);
        } else {
            console.log('没有找到可下载的图片');
            if (typeof showNotification === 'function') {
                showNotification('请先鼠标悬停在图片上，然后按D键下载');
            }
        }
    }

    // Space键处理 - 跳过
    handleSkipKey(event) {
        // 检查并关闭模态框（但不停止执行）
        if (typeof checkAndCloseModalIfOpen === 'function') {
            checkAndCloseModalIfOpen('space');
        }

        // 如果对比页面打开，先关闭对比
        if (window.isComparisonModalOpen && typeof closeComparisonModal === 'function') {
            closeComparisonModal();
            // 延迟执行跳过功能
            setTimeout(() => {
                this.executeSkipAction(event);
            }, 100);
        } else {
            this.executeSkipAction(event);
        }
    }

    executeSkipAction(event) {
        const skipButton = typeof findButtonByText === 'function' ?
            findButtonByText(['跳过', 'Skip', '跳過']) : null;

        if (skipButton && typeof clickButton === 'function') {
            event.preventDefault();
            clickButton(skipButton, '跳过');
        }
    }

    // S键处理 - 提交
    handleSubmitKey(event) {
        // 检查并关闭模态框（但不停止执行）
        if (typeof checkAndCloseModalIfOpen === 'function') {
            checkAndCloseModalIfOpen('s');
        }

        // 如果对比页面打开，先关闭对比
        if (window.isComparisonModalOpen && typeof closeComparisonModal === 'function') {
            closeComparisonModal();
            setTimeout(() => {
                this.executeSubmitAction(event);
            }, 100);
        } else {
            this.executeSubmitAction(event);
        }
    }

    executeSubmitAction(event) {
        const submitButton = typeof findButtonByText === 'function' ?
            findButtonByText(['提交并继续标注', '提交', 'Submit', '继续标注', 'Continue']) : null;

        if (submitButton && typeof clickButton === 'function') {
            event.preventDefault();
            // 播放音效
            if (typeof playNotificationSound === 'function') {
                playNotificationSound();
            }
            clickButton(submitButton, '提交并继续标注');
        }
    }

    // A键处理 - 上传图片
    handleUploadKey(event) {
        // 检查并关闭模态框
        if (typeof checkAndCloseModalIfOpen === 'function') {
            checkAndCloseModalIfOpen('a');
        }

        const uploadButton = typeof findButtonByText === 'function' ?
            findButtonByText(['上传图片', '上传', 'Upload', '选择图片', '选择文件']) : null;

        if (uploadButton && typeof clickButton === 'function') {
            event.preventDefault();
            clickButton(uploadButton, '上传图片');
        } else if (typeof showNotification === 'function') {
            showNotification('未找到上传图片按钮');
        }
    }

    // F键处理 - 查看历史
    handleHistoryKey(event) {
        // 检查并关闭模态框
        if (typeof checkAndCloseModalIfOpen === 'function') {
            checkAndCloseModalIfOpen('f');
        }

        const historyLink = typeof findLinkByText === 'function' ?
            findLinkByText(['点击查看历史', '查看历史', '历史', 'History', '历史记录', '查看记录']) : null;

        if (historyLink && typeof clickLink === 'function') {
            event.preventDefault();
            clickLink(historyLink, '查看历史');
        } else if (typeof showNotification === 'function') {
            showNotification('未找到查看历史链接');
        }
    }

    // X键处理 - 标记无效
    handleInvalidKey(event) {
        // 如果对比页面打开，先关闭对比
        if (window.isComparisonModalOpen && typeof closeComparisonModal === 'function') {
            closeComparisonModal();
            setTimeout(() => {
                this.executeInvalidAction(event);
            }, 100);
        } else {
            this.executeInvalidAction(event);
        }
    }

    executeInvalidAction(event) {
        const invalidButton = typeof findButtonByText === 'function' ?
            findButtonByText(['标记无效', '无效', 'Invalid', '标记为无效', 'Mark Invalid', '标记不合格']) : null;

        if (invalidButton && typeof clickButton === 'function') {
            event.preventDefault();
            clickButton(invalidButton, '标记无效');
            // 尝试自动确认可能弹出的模态框
            if (typeof autoConfirmModalAfterAction === 'function') {
                autoConfirmModalAfterAction();
            }
        } else if (typeof showNotification === 'function') {
            showNotification('未找到标记无效按钮');
        }
    }

    // R键处理 - RunningHub尺寸检查
    handleRunningHubKey(event) {
        event.preventDefault();
        debugLog('R键触发 - 手动检查图片尺寸是否为8的倍数');

        if (typeof manualDimensionCheck === 'function') {
            manualDimensionCheck();
        } else {
            debugLog('manualDimensionCheck 函数不可用');
        }
    }

    // F1键处理 - 批量标记无效
    handleF1Key(event) {
        event.preventDefault();
        this.f1Manager.toggleBatchInvalid();
    }

    // F2键处理 - 智能尺寸检查
    handleF2Key(event) {
        event.preventDefault();
        debugLog('F2键触发 - 检查图片尺寸');

        if (typeof checkImageDimensionsAndShowModal === 'function') {
            checkImageDimensionsAndShowModal();
        } else {
            debugLog('checkImageDimensionsAndShowModal 函数不可用');
        }
    }

    // N键处理 - 重新检测原图
    handleDetectKey(event) {
        if (typeof recordOriginalImages === 'function') {
            event.preventDefault();
            recordOriginalImages();
            if (typeof showNotification === 'function') {
                showNotification('已重新检测原图，查看调试面板', 2000);
            }
        }
    }

    // P键处理 - 智能尺寸检查
    handlePKey(event) {
        if (typeof checkImageDimensionsAndShowModal === 'function') {
            event.preventDefault();
            checkImageDimensionsAndShowModal();
        }
    }

    // W键处理 - 智能图片对比
    handleSmartComparisonKey(event) {
        event.preventDefault();
        
        // 使用SmartComparisonManager处理智能对比
        if (typeof getSmartComparisonManager === 'function') {
            const manager = getSmartComparisonManager();
            if (!manager.isInitialized()) {
                manager.initialize();
            }
            manager.triggerSmartComparisonWithFallback();
        } else if (typeof triggerSmartComparisonWithFallback === 'function') {
            // 回退到全局函数（兼容性）
            triggerSmartComparisonWithFallback();
        } else {
            console.warn('W键智能对比功能不可用：SmartComparisonManager 或 triggerSmartComparisonWithFallback 函数未找到');
        }
    }

    // 启用/禁用键盘管理器
    setEnabled(enabled) {
        this.isEnabled = enabled;
        debugLog('KeyboardManager', enabled ? '已启用' : '已禁用');
    }

    // 获取所有快捷键信息
    getShortcuts() {
        const shortcuts = [];
        for (const [key, config] of this.keyHandlers) {
            shortcuts.push({
                key: key.toUpperCase(),
                description: config.description
            });
        }
        return shortcuts;
    }
}

// F1 批量管理器
class F1BatchManager {
    constructor() {
        this.isActive = false;
        this.runCount = 0;
        this.timerId = null;
        this.intervalMs = 800;
        this.maxRuns = 0; // 0表示无限制
    }

    toggleBatchInvalid() {
        // 检查并关闭模态框
        if (typeof checkAndCloseModalIfOpen === 'function') {
            if (checkAndCloseModalIfOpen('f1')) {
                return; // 如果关闭了模态框，停止执行
            }
        }

        if (!this.isActive) {
            this.startBatchInvalid();
        } else {
            this.stopBatchInvalid();
        }
    }

    startBatchInvalid() {
        this.isActive = true;
        this.runCount = 0;

        if (typeof showNotification === 'function') {
            showNotification(`F1 连续无效化启动（间隔 ${this.intervalMs}ms）`);
        }

        const runOnce = () => {
            if (!this.isActive) return;

            // 检查是否有次数限制且已达到限制
            if (this.maxRuns > 0 && this.runCount >= this.maxRuns) {
                this.isActive = false;
                if (typeof showNotification === 'function') {
                    showNotification('F1 连续无效化已达最大次数，自动停止');
                }
                return;
            }

            this.runCount++;

            // 复用 X 键逻辑：查找"标记无效"并点击
            const invalidButton = typeof findButtonByText === 'function' ?
                findButtonByText(['标记无效', '无效', 'Invalid', '标记为无效', 'Mark Invalid', '标记不合格']) : null;

            if (invalidButton && typeof clickButton === 'function') {
                clickButton(invalidButton, `标记无效 (#${this.runCount})`);
                if (typeof autoConfirmModalAfterAction === 'function') {
                    autoConfirmModalAfterAction();
                }
            }

            // 安排下一次
            if (this.isActive) {
                this.timerId = setTimeout(runOnce, this.intervalMs);
            }
        };

        runOnce();
    }

    stopBatchInvalid() {
        this.isActive = false;
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        if (typeof showNotification === 'function') {
            showNotification('F1 连续无效化已停止');
        }
    }

    isRunning() {
        return this.isActive;
    }

    setInterval(intervalMs) {
        this.intervalMs = intervalMs;
    }

    setMaxRuns(maxRuns) {
        this.maxRuns = maxRuns;
    }
}

// Escape键管理器
class EscapeKeyManager {
    constructor() {
        this.handlers = [];
    }

    addHandler(handler) {
        this.handlers.push(handler);
    }

    removeHandler(handler) {
        const index = this.handlers.indexOf(handler);
        if (index > -1) {
            this.handlers.splice(index, 1);
        }
    }

    handleEscape(event) {
        // 依次调用所有注册的ESC处理器
        for (const handler of this.handlers) {
            try {
                if (handler(event) === true) {
                    // 如果处理器返回true，表示已处理，停止后续处理器
                    break;
                }
            } catch (error) {
                debugLog('ESC处理器执行失败:', error);
            }
        }
    }
}

// 全局实例
let keyboardManagerInstance = null;

// 获取全局实例
function getKeyboardManager() {
    if (!keyboardManagerInstance) {
        keyboardManagerInstance = new KeyboardManager();
        // 设置到全局变量以保持兼容性
        window.keyboardManager = keyboardManagerInstance;
    }
    return keyboardManagerInstance;
}

// 兼容性函数 - 保持向后兼容
function handleKeydown(event) {
    const manager = getKeyboardManager();
    if (!manager.isInitialized()) {
        manager.initialize();
    }
    return manager.handleKeydown(event);
}

function isInInputField(element) {
    const manager = getKeyboardManager();
    return manager.isInInputField(element);
}

// 初始化函数
function initializeKeyboardManager() {
    try {
        const manager = getKeyboardManager();
        manager.initialize();
        debugLog('KeyboardManager 全局初始化完成');
        return manager;
    } catch (error) {
        debugLog('KeyboardManager 全局初始化失败:', error);
        throw error;
    }
}

// 兼容模式的键盘事件处理（从content.js迁移）
function handleKeydownFallback(event) {
    // 检查是否在输入框中
    if (isInInputField(event.target)) {
        return;
    }
    
    const key = event.key.toLowerCase();
    
    switch (key) {
        case 'd':
            event.preventDefault();
            handleDownloadImageFallback();
            break;
        case ' ':
            event.preventDefault();
            handleSkipButtonFallback();
            break;
        case 's':
            event.preventDefault();
            handleSubmitButtonFallback();
            break;
        case 'a':
            event.preventDefault();
            handleUploadImageFallback();
            break;
        case 'w':
            event.preventDefault();
            handleImageComparisonFallback();
            break;
        default:
            // 其他键不处理
            break;
    }
}

// 兼容模式处理函数
function handleDownloadImageFallback() {
    if (typeof downloadImage === 'function') {
        const img = getImageToDownloadFallback();
        if (img) {
            downloadImage(img);
        } else {
            if (typeof showNotification === 'function') {
                showNotification('未找到可下载的图片', 2000);
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('下载功能不可用', 2000);
        }
    }
}

function getImageToDownloadFallback() {
    // 如果 ImageHelper 可用，使用它
    if (typeof getImageHelper === 'function') {
        const imageHelper = getImageHelper();
        return imageHelper.getImageToDownload();
    }
    
    // 兼容模式：简单查找图片
    const images = document.querySelectorAll('img');
    for (const img of images) {
        if (img.naturalWidth > 100 && img.naturalHeight > 100) {
            return img;
        }
    }
    
    return null;
}

function handleSkipButtonFallback() {
    if (typeof findButtonByText === 'function') {
        const skipButton = findButtonByText(['跳过', 'Skip', '下一个', 'Next']);
        if (skipButton) {
            skipButton.click();
            if (typeof showNotification === 'function') {
                showNotification('已点击跳过按钮', 1000);
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification('未找到跳过按钮', 2000);
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('按钮查找功能不可用', 2000);
        }
    }
}

function handleSubmitButtonFallback() {
    if (typeof findButtonByText === 'function') {
        const submitButton = findButtonByText(['提交', 'Submit', '提交并继续标注', '继续']);
        if (submitButton) {
            submitButton.click();
            if (typeof showNotification === 'function') {
                showNotification('已点击提交按钮', 1000);
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification('未找到提交按钮', 2000);
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('按钮查找功能不可用', 2000);
        }
    }
}

function handleUploadImageFallback() {
    if (typeof findButtonByText === 'function') {
        const uploadButton = findButtonByText(['上传图片', '上传', 'Upload', '选择图片']);
        if (uploadButton) {
            uploadButton.click();
            if (typeof showNotification === 'function') {
                showNotification('已触发上传功能', 1000);
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification('未找到上传按钮', 2000);
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('上传功能不可用', 2000);
        }
    }
}

function handleImageComparisonFallback() {
    if (typeof performImageComparison === 'function') {
        performImageComparison();
    } else {
        if (typeof showNotification === 'function') {
            showNotification('图片对比功能不可用', 2000);
        }
    }
}

// 导出到全局作用域
window.KeyboardManager = KeyboardManager;
window.getKeyboardManager = getKeyboardManager;
window.initializeKeyboardManager = initializeKeyboardManager;

// 兼容性函数导出
window.handleKeydown = handleKeydown;
window.isInInputField = isInInputField;
window.handleKeydownFallback = handleKeydownFallback;

debugLog('KeyboardManager 模块加载完成');