/**
 * 智能对比管理器模块
 * 负责智能图片对比的核心业务逻辑
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    window.debugLog = function(message, data) {
        console.log('[SmartComparisonManager]', message, data || '');
    };
}

class SmartComparisonManager {
    constructor() {
        this.initialized = false;
    }

    isInitialized() {
        return this.initialized;
    }

    initialize() {
        try {
            debugLog('初始化 SmartComparisonManager');
            this.initialized = true;
            debugLog('SmartComparisonManager 初始化完成');
        } catch (error) {
            debugLog('SmartComparisonManager 初始化失败:', error);
            throw error;
        }
    }

    // 启动智能图片对比 (直接使用已检测的原图)
    triggerSmartComparisonWithFallback() {
        debugLog('启动智能图片对比');

        // 直接访问全局变量
        const { originalImage, uploadedImage } = window;

        debugLog('📊 图片对比状态检查:', {
            hasOriginalImage: !!originalImage,
            hasUploadedImage: !!uploadedImage,
            originalSrc: originalImage ? originalImage.src.substring(0, 100) + '...' : '无',
            originalWidth: originalImage ? originalImage.width : '无',
            originalHeight: originalImage ? originalImage.height : '无',
            uploadedSrc: uploadedImage ? uploadedImage.src.substring(0, 100) + '...' : '无',
            uploadedWidth: uploadedImage ? uploadedImage.width : '无',
            uploadedHeight: uploadedImage ? uploadedImage.height : '无'
        });

        // 最简单的逻辑：直接使用已检测的原图和上传图片
        if (originalImage && originalImage.src && uploadedImage && uploadedImage.src) {
            const comparisonPair = {
                image1: { src: originalImage.src, label: '页面原图' },
                image2: { src: uploadedImage.src, label: '上传图片' },
                mode: '页面原图vs上传图'
            };

            debugLog('使用已检测的原图和上传图片进行对比', comparisonPair);
            if (typeof showNotification === 'function') {
                showNotification('📋 页面原图vs上传图对比', 1000);
            }

            if (typeof showSmartComparison === 'function') {
                showSmartComparison(comparisonPair);
            }
            window.shouldAutoCompare = false;
        } else if (originalImage && originalImage.src) {
            // 如果只有原图没有上传图片，提示用户上传
            debugLog('只有原图，缺少上传图片');
            if (typeof showNotification === 'function') {
                showNotification('📤 请先上传图片再进行对比', 2000);
            }
        } else if (uploadedImage && uploadedImage.src) {
            // 如果只有上传图片没有原图，提示用户检测原图
            debugLog('只有上传图片，缺少原图');
            if (typeof showNotification === 'function') {
                showNotification('🎯 已检测到上传图片，但未找到页面原图，请按B键检测原图', 2500);
            }
        } else {
            // 如果都没有
            debugLog('未检测到任何图片');
            if (typeof showNotification === 'function') {
                showNotification('📤 请先上传图片，然后按B键检测原图', 2500);
            }
        }
    }
}

// 全局实例
let smartComparisonManagerInstance = null;

// 获取全局实例
function getSmartComparisonManager() {
    if (!smartComparisonManagerInstance) {
        smartComparisonManagerInstance = new SmartComparisonManager();
        // 设置到全局变量以保持兼容性
        window.smartComparisonManager = smartComparisonManagerInstance;
    }
    return smartComparisonManagerInstance;
}

// 兼容性函数 - 保持向后兼容
function triggerSmartComparisonWithFallback() {
    const manager = getSmartComparisonManager();
    if (!manager.isInitialized()) {
        manager.initialize();
    }
    return manager.triggerSmartComparisonWithFallback();
}

// 初始化函数
function initializeSmartComparisonManager() {
    try {
        const manager = getSmartComparisonManager();
        manager.initialize();
        debugLog('SmartComparisonManager 全局初始化完成');
        return manager;
    } catch (error) {
        debugLog('SmartComparisonManager 全局初始化失败:', error);
        throw error;
    }
}

// 导出到全局作用域
window.SmartComparisonManager = SmartComparisonManager;
window.getSmartComparisonManager = getSmartComparisonManager;
window.initializeSmartComparisonManager = initializeSmartComparisonManager;

// 兼容性函数导出
window.triggerSmartComparisonWithFallback = triggerSmartComparisonWithFallback;

debugLog('SmartComparisonManager 模块加载完成');