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

    // 启动智能图片对比 (包含回退逻辑)
    triggerSmartComparisonWithFallback() {
        debugLog('启动智能图片对比 (包含回退逻辑)');

        // 访问全局变量
        const {
            capturedOriginalImage,
            capturedModifiedImage,
            uploadedImage,
            originalImage,
            shouldAutoCompare,
            cosImageCache
        } = window;

        debugLog('📊 图片对比状态检查:', {
            capturedOriginalImage,
            capturedModifiedImage,
            uploadedImage: uploadedImage ? uploadedImage.src : null,
            originalImage: !!originalImage,
            shouldAutoCompare,
            cosImageCache: cosImageCache ? cosImageCache.size : 0
        });

        let comparisonPair = null;

        // 策略1: 使用COS拦截的图片（最优）
        if (capturedOriginalImage && capturedModifiedImage) {
            comparisonPair = {
                image1: { src: capturedOriginalImage, label: '原图' },
                image2: { src: capturedModifiedImage, label: '修改图' },
                mode: 'COS原图vs修改图'
            };
            debugLog('策略1: 使用COS拦截图片', comparisonPair);
            if (typeof showNotification === 'function') {
                showNotification('🎯 使用COS拦截图片对比', 1000);
            }
        }
        // 策略2: 原图 vs 用户上传图片
        else if (capturedOriginalImage && uploadedImage) {
            comparisonPair = {
                image1: { src: capturedOriginalImage, label: '原图' },
                image2: { src: uploadedImage.src, label: '上传图片' },
                mode: 'COS原图vs上传图'
            };
            debugLog('策略2: COS原图vs用户上传', comparisonPair);
            if (typeof showNotification === 'function') {
                showNotification('📷 原图vs上传图对比', 1000);
            }
        }
        // 策略3: 现有逻辑 - 原图 vs 上传图片
        else if (originalImage && uploadedImage) {
            comparisonPair = {
                image1: { src: originalImage.src, label: '页面原图' },
                image2: { src: uploadedImage.src, label: '上传图片' },
                mode: '页面原图vs上传图'
            };
            debugLog('策略3: 页面原图vs用户上传', comparisonPair);
            if (typeof showNotification === 'function') {
                showNotification('📋 页面原图vs上传图对比', 1000);
            }
        }
        // 策略4: 如果只有COS原图，与页面其他图片对比
        else if (capturedOriginalImage) {
            const pageImages = document.querySelectorAll('img');
            if (pageImages.length >= 2) {
                comparisonPair = {
                    image1: { src: capturedOriginalImage, label: '原图' },
                    image2: { src: pageImages[1].src, label: '页面图片' },
                    mode: '原图vs页面图片'
                };
                debugLog('策略4: 原图vs页面图片', comparisonPair);
                if (typeof showNotification === 'function') {
                    showNotification('🔄 原图vs页面图片对比', 1000);
                }
            }
        }
        // 策略5: 页面图片互相对比（回退）
        else {
            const pageImages = document.querySelectorAll('img');
            if (pageImages.length >= 2) {
                comparisonPair = {
                    image1: { src: pageImages[0].src, label: '页面图片1' },
                    image2: { src: pageImages[1].src, label: '页面图片2' },
                    mode: '页面图片对比'
                };
                debugLog('策略5: 页面图片对比', comparisonPair);
                if (typeof showNotification === 'function') {
                    showNotification('🖼️ 页面图片对比', 1000);
                }
            }
        }

        if (comparisonPair) {
            debugLog('执行图片对比', comparisonPair.mode);
            if (typeof showSmartComparison === 'function') {
                showSmartComparison(comparisonPair);
            }
            window.shouldAutoCompare = false;
        } else {
            debugLog('无可用图片进行对比');
            if (typeof showNotification === 'function') {
                showNotification('❌ 无可用图片进行对比', 2000);
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