/**
 * AnnotateFlow Assistant - 重构版本
 * 主入口文件 - 整合所有模块
 * 保持原有功能完全不变，仅改变代码组织方式
 */

// 版本标识
console.log('🚀 AnnotateFlow Assistant v2.0.0 (重构版本) 已加载');
console.log('📦 模块架构: StateManager, EventManager, ConfigManager, NotificationManager, ModalManager, ImageDownloader, ImageDetector, NetworkMonitor');

// 设置全局版本信息
window.ANNOTATEFLOW_VERSION = {
    version: "2.0.0",
    type: "refactored", 
    architecture: "modular",
    modules: ["StateManager", "EventManager", "ConfigManager", "NotificationManager", "ModalManager", "ImageDownloader", "ImageDetector", "NetworkMonitor"]
};

/**
 * AnnotateFlow Assistant 主应用类
 */
class AnnotateFlowAssistant {
    constructor() {
        this.version = '2.0.0';
        this.initialized = false;
        
        // 初始化所有模块
        this.initializeModules();
    }

    /**
     * 初始化所有模块
     */
    initializeModules() {
        try {
            // 核心模块
            this.stateManager = new window.StateManager();
            this.configManager = new window.ConfigManager(this.stateManager);

            // UI模块
            this.notificationManager = new window.NotificationManager(this.stateManager);
            this.modalManager = new window.ModalManager(this.stateManager);

            // 工具模块
            this.fileInputChecker = new window.FileInputChecker(this.stateManager, this.notificationManager);
            
            // 图片模块
            this.imageDownloader = new window.ImageDownloader(this.stateManager, this.notificationManager);
            this.imageDetector = new window.ImageDetector(this.stateManager);
            this.dimensionChecker = new window.DimensionChecker(this.stateManager, this.notificationManager, this.modalManager);
            
            // 网络模块
            this.networkMonitor = new window.NetworkMonitor(this.stateManager, this.notificationManager);
            
            // 事件管理器 - 最后初始化，因为它依赖其他模块
            this.eventManager = new window.EventManager(
                this.stateManager,
                this.imageDownloader,
                this.notificationManager,
                this.modalManager,
                this.imageDetector,
                this.dimensionChecker,
                this.fileInputChecker
            );
            
            window.Logger.debugLog('所有模块初始化完成');
            
        } catch (error) {
            console.error('模块初始化失败:', error);
            throw error;
        }
    }

    /**
     * 应用初始化 - 保持原有的初始化逻辑
     */
    async initialize() {
        if (this.initialized) {
            window.Logger.debugLog('应用已经初始化');
            return;
        }

        try {
            // 明确的版本标识
            console.log(`🚀 AnnotateFlow Assistant v${this.version} (重构版本) 已加载 ===`);
            console.log('版本信息:', {
                version: this.version,
                architecture: 'modular',
                buildDate: '2025-09-18',
                totalModules: 12,
                loadTime: new Date().toISOString()
            });
            
            // 在window对象上设置版本标识
            window.ANNOTATEFLOW_VERSION = {
                version: this.version,
                type: 'refactored',
                architecture: 'modular',
                loadTime: new Date().toISOString(),
                modules: [
                    'StateManager', 'EventManager', 'ConfigManager',
                    'ImageDownloader', 'ImageDetector', 'NetworkMonitor',
                    'NotificationManager', 'ModalManager',
                    'window.Logger', 'DOMUtils', 'FileUtils'
                ]
            };
            
            // 加载所有配置 - 原逻辑保持不变
            await this.configManager.loadAllSettings();
            
            // 记录原图 - 原逻辑保持不变
            this.imageDetector.recordOriginalImages();
            
            // 开始监听新图片
            this.imageDetector.watchForNewImages();
            
            // 检测原图
            const originalImage = this.imageDetector.detectOriginalImage();
            if (originalImage) {
                this.notificationManager.showSuccess('已检测到原图');
            }
            
            // 显示初始化完成通知
            this.notificationManager.showSuccess('AnnotateFlow Assistant 已启动');
            
            this.initialized = true;
            window.Logger.debugLog('应用初始化完成');
            
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.notificationManager.showError('初始化失败: ' + error.message);
        }
    }

    /**
     * 获取应用状态
     */
    getAppState() {
        return {
            version: this.version,
            initialized: this.initialized,
            modules: {
                stateManager: !!this.stateManager,
                configManager: !!this.configManager,
                eventManager: !!this.eventManager,
                notificationManager: !!this.notificationManager,
                modalManager: !!this.modalManager,
                imageDownloader: !!this.imageDownloader,
                imageDetector: !!this.imageDetector,
                networkMonitor: !!this.networkMonitor
            },
            stats: {
                detectedImages: this.imageDetector?.getDetectionStats(),
                networkRequests: this.networkMonitor?.getNetworkStats(),
                currentSettings: this.configManager?.getCurrentSettings()
            }
        };
    }

    /**
     * 清理资源
     */
    cleanup() {
        try {
            if (this.eventManager) {
                this.eventManager.removeEventListeners();
            }
            
            if (this.imageDetector) {
                this.imageDetector.cleanup();
            }
            
            if (this.networkMonitor) {
                this.networkMonitor.stopMonitoring();
            }
            
            if (this.notificationManager) {
                this.notificationManager.clearAllNotifications();
            }
            
            if (this.modalManager) {
                this.modalManager.closeAllModals();
            }
            
            window.Logger.debugLog('应用资源已清理');
            
        } catch (error) {
            console.error('清理资源失败:', error);
        }
    }

    /**
     * 重启应用
     */
    async restart() {
        window.Logger.debugLog('重启应用...');
        
        this.cleanup();
        this.initialized = false;
        
        // 重新初始化模块
        this.initializeModules();
        
        // 重新初始化应用
        await this.initialize();
        
        this.notificationManager.showSuccess('应用已重启');
    }

    /**
     * 获取调试信息
     */
    getDebugInfo() {
        return {
            appState: this.getAppState(),
            logs: window.Logger.debugLogs,
            eventState: this.eventManager?.getEventState(),
            monitoringStatus: this.networkMonitor?.getMonitoringStatus()
        };
    }
}

// 全局应用实例
let app = null;

/**
 * 初始化脚本 - 保持原有的初始化方式
 */
function initializeScript() {
    try {
        if (app) {
            window.Logger.debugLog('应用已存在，跳过初始化');
            return;
        }

        app = new AnnotateFlowAssistant();
        app.initialize();
        
        // 将应用实例暴露到全局，方便调试
        if (typeof window !== 'undefined') {
            window.AnnotateFlowApp = app;
        }
        
    } catch (error) {
        console.error('脚本初始化失败:', error);
    }
}

/**
 * 页面卸载时清理资源
 */
function cleanupOnUnload() {
    if (app) {
        app.cleanup();
        app = null;
    }
}

// 监听页面卸载事件
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanupOnUnload);
    window.addEventListener('unload', cleanupOnUnload);
}

// DOM加载完成后初始化 - 保持原有逻辑
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScript);
} else {
    // DOM已经加载完成
    initializeScript();
}

// 为了向后兼容，保持一些全局函数
if (typeof window !== 'undefined') {
    // 全局调试函数
    window.toggleDebugMode = () => {
        if (app) {
            window.Logger.toggleDebugMode();
            app.notificationManager.showInfo(
                window.Logger.debugMode ? '调试模式已开启' : '调试模式已关闭'
            );
        }
    };
    
    // 全局下载函数
    window.downloadImage = (imageUrl) => {
        if (app && app.imageDownloader) {
            app.imageDownloader.downloadImage(imageUrl);
        }
    };
    
    // 全局通知函数
    window.showNotification = (message, duration) => {
        if (app && app.notificationManager) {
            app.notificationManager.showNotification(message, duration);
        }
    };
    
    // 全局应用信息函数
    window.getAppInfo = () => {
        return app ? app.getDebugInfo() : null;
    };
}

// 将主应用类添加到全局作用域
window.AnnotateFlowAssistant = AnnotateFlowAssistant;