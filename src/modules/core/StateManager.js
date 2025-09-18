/**
 * 全局状态管理器
 * 统一管理所有原全局变量，提供状态变化监听
 */
window.StateManager = class StateManager {
    constructor() {
        // 将所有原全局变量迁移到state对象中
        this.state = {
            // 图片相关状态
            lastHoveredImage: null,
            selectedImage: null,
            originalImage: null,
            uploadedImage: null,
            originalImageLocked: false,
            capturedOriginalImage: null,
            capturedModifiedImage: null,
            originalImageFromNetwork: null,
            
            // 功能开关状态
            soundEnabled: true,
            autoCompareEnabled: true,
            debugMode: false,
            
            // UI状态
            dimensionTooltip: null,
            comparisonModal: null,
            isComparisonModalOpen: false,
            debugPanel: null,
            
            // F1自动无效化状态
            f1AutoInvalidating: false,
            f1IntervalMs: 800,
            f1MaxRuns: 0,
            f1TimerId: null,
            f1RunCount: 0,
            
            // 页面状态
            currentPageUrl: '',
            currentPageTaskInfo: null,
            lastSuccessfulTaskId: null,
            
            // 缓存状态
            cosImageCache: new Map(),
            capturedImageRequests: new Map(),
            cachedRunningHubResults: null,
            pendingComparisonTimeouts: [],
            
            // 其他状态
            shouldAutoCompare: false,
            notificationAudio: null,
            
            // 兼容性变量（逐步清理中）
            serverReturnedModifiedImage: null,
            userUploadedImage: null
        };
        
        // 状态变化监听器
        this.listeners = new Map();
        
        // 状态变化历史（用于调试）
        this.stateHistory = [];
        
        // 初始化
        this.initializeState();
    }

    /**
     * 初始化状态
     */
    initializeState() {
        // 记录当前页面URL
        this.set('currentPageUrl', window.location.href);
        
        // 初始化缓存
        this.set('cosImageCache', new Map());
        this.set('capturedImageRequests', new Map());
        this.set('pendingComparisonTimeouts', []);
    }

    /**
     * 获取状态值
     */
    get(key) {
        return this.state[key];
    }

    /**
     * 设置状态值
     */
    set(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        
        // 记录状态变化历史
        this.recordStateChange(key, oldValue, value);
        
        // 通知监听器
        this.notifyListeners(key, value, oldValue);
        
        return this;
    }

    /**
     * 批量设置状态
     */
    setState(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
        return this;
    }

    /**
     * 订阅状态变化
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        
        // 返回取消订阅函数
        return () => {
            const callbacks = this.listeners.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * 订阅多个状态变化
     */
    subscribeMultiple(keys, callback) {
        const unsubscribeFunctions = keys.map(key => this.subscribe(key, callback));
        
        // 返回取消所有订阅的函数
        return () => {
            unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
        };
    }

    /**
     * 通知监听器
     */
    notifyListeners(key, newValue, oldValue) {
        const callbacks = this.listeners.get(key) || [];
        callbacks.forEach(callback => {
            try {
                callback(newValue, oldValue, key);
            } catch (error) {
                console.error(`State listener error for key "${key}":`, error);
            }
        });
    }

    /**
     * 记录状态变化历史
     */
    recordStateChange(key, oldValue, newValue) {
        if (this.get('debugMode')) {
            this.stateHistory.push({
                timestamp: Date.now(),
                key,
                oldValue,
                newValue
            });
            
            // 限制历史记录数量
            if (this.stateHistory.length > 1000) {
                this.stateHistory = this.stateHistory.slice(-500);
            }
        }
    }

    /**
     * 获取状态变化历史
     */
    getStateHistory() {
        return [...this.stateHistory];
    }

    /**
     * 清空状态变化历史
     */
    clearStateHistory() {
        this.stateHistory = [];
    }

    /**
     * 重置特定状态
     */
    reset(key) {
        const defaultValues = {
            lastHoveredImage: null,
            selectedImage: null,
            originalImage: null,
            uploadedImage: null,
            originalImageLocked: false,
            isComparisonModalOpen: false,
            f1AutoInvalidating: false,
            f1RunCount: 0,
            shouldAutoCompare: false,
            dimensionTooltip: null,
            comparisonModal: null,
            capturedOriginalImage: null,
            capturedModifiedImage: null,
            originalImageFromNetwork: null,
            serverReturnedModifiedImage: null,
            userUploadedImage: null
        };
        
        if (key in defaultValues) {
            this.set(key, defaultValues[key]);
        }
    }

    /**
     * 重置所有状态
     */
    resetAll() {
        Object.keys(this.state).forEach(key => {
            this.reset(key);
        });
    }

    /**
     * 获取当前状态快照
     */
    getSnapshot() {
        // 深拷贝状态，但排除不可序列化的对象
        const snapshot = {};
        Object.entries(this.state).forEach(([key, value]) => {
            try {
                if (value instanceof Map) {
                    snapshot[key] = Object.fromEntries(value);
                } else if (value instanceof Set) {
                    snapshot[key] = Array.from(value);
                } else if (typeof value === 'function' || value instanceof Node) {
                    snapshot[key] = '[Object]';
                } else {
                    snapshot[key] = JSON.parse(JSON.stringify(value));
                }
            } catch (error) {
                snapshot[key] = '[Unserializable]';
            }
        });
        return snapshot;
    }

    /**
     * 检查页面是否发生变化 - 原逻辑保持不变
     */
    checkPageChange() {
        const currentUrl = window.location.href;
        const previousUrl = this.get('currentPageUrl');
        
        if (currentUrl !== previousUrl) {
            this.set('currentPageUrl', currentUrl);
            this.set('originalImageLocked', false);
            this.set('originalImage', null);
            this.set('uploadedImage', null);
            
            // 通知页面变化
            this.notifyListeners('pageChanged', currentUrl, previousUrl);
            
            return true;
        }
        
        return false;
    }

    /**
     * 获取图片相关状态
     */
    getImageStates() {
        return {
            lastHoveredImage: this.get('lastHoveredImage'),
            selectedImage: this.get('selectedImage'),
            originalImage: this.get('originalImage'),
            uploadedImage: this.get('uploadedImage'),
            originalImageLocked: this.get('originalImageLocked'),
            capturedOriginalImage: this.get('capturedOriginalImage'),
            capturedModifiedImage: this.get('capturedModifiedImage')
        };
    }

    /**
     * 获取UI状态
     */
    getUIStates() {
        return {
            dimensionTooltip: this.get('dimensionTooltip'),
            comparisonModal: this.get('comparisonModal'),
            isComparisonModalOpen: this.get('isComparisonModalOpen'),
            debugPanel: this.get('debugPanel'),
            debugMode: this.get('debugMode')
        };
    }

    /**
     * 获取功能开关状态
     */
    getFeatureStates() {
        return {
            soundEnabled: this.get('soundEnabled'),
            autoCompareEnabled: this.get('autoCompareEnabled'),
            debugMode: this.get('debugMode')
        };
    }

    /**
     * 获取F1相关状态
     */
    getF1States() {
        return {
            f1AutoInvalidating: this.get('f1AutoInvalidating'),
            f1IntervalMs: this.get('f1IntervalMs'),
            f1MaxRuns: this.get('f1MaxRuns'),
            f1TimerId: this.get('f1TimerId'),
            f1RunCount: this.get('f1RunCount')
        };
    }

    /**
     * 检查是否可以进行图片对比
     */
    canPerformComparison() {
        const originalImage = this.get('originalImage');
        const uploadedImage = this.get('uploadedImage');
        return originalImage && uploadedImage;
    }

    /**
     * 检查是否有活动的模态框
     */
    hasActiveModal() {
        return this.get('isComparisonModalOpen') || 
               this.get('dimensionTooltip') !== null ||
               this.get('comparisonModal') !== null;
    }

    /**
     * 清理过期的缓存
     */
    cleanupCache() {
        const cosImageCache = this.get('cosImageCache');
        const capturedImageRequests = this.get('capturedImageRequests');
        
        // 清理超过1小时的缓存
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        
        if (cosImageCache instanceof Map) {
            for (const [key, value] of cosImageCache.entries()) {
                if (value.timestamp && value.timestamp < oneHourAgo) {
                    cosImageCache.delete(key);
                }
            }
        }
        
        if (capturedImageRequests instanceof Map) {
            for (const [key, value] of capturedImageRequests.entries()) {
                if (value.timestamp && value.timestamp < oneHourAgo) {
                    capturedImageRequests.delete(key);
                }
            }
        }
    }

    /**
     * 获取调试信息
     */
    getDebugInfo() {
        return {
            stateCount: Object.keys(this.state).length,
            listenerCount: Array.from(this.listeners.values()).reduce((sum, callbacks) => sum + callbacks.length, 0),
            historyCount: this.stateHistory.length,
            cacheSize: {
                cosImageCache: this.get('cosImageCache')?.size || 0,
                capturedImageRequests: this.get('capturedImageRequests')?.size || 0
            },
            currentPage: this.get('currentPageUrl'),
            debugMode: this.get('debugMode')
        };
    }

    /**
     * 验证状态完整性
     */
    validateState() {
        const requiredKeys = [
            'lastHoveredImage', 'selectedImage', 'originalImage', 'uploadedImage',
            'soundEnabled', 'autoCompareEnabled', 'debugMode',
            'f1IntervalMs', 'f1MaxRuns', 'currentPageUrl'
        ];
        
        const missingKeys = requiredKeys.filter(key => !(key in this.state));
        
        if (missingKeys.length > 0) {
            console.warn('Missing state keys:', missingKeys);
            return false;
        }
        
        return true;
    }

    /**
     * 销毁状态管理器
     */
    destroy() {
        // 清理定时器
        const timerId = this.get('f1TimerId');
        if (timerId) {
            clearInterval(timerId);
        }
        
        // 清理待执行的超时任务
        const timeouts = this.get('pendingComparisonTimeouts');
        if (Array.isArray(timeouts)) {
            timeouts.forEach(timeout => clearTimeout(timeout));
        }
        
        // 清空监听器
        this.listeners.clear();
        
        // 清空状态
        this.state = {};
        this.stateHistory = [];
    }

    /**
     * 导出状态数据
     */
    exportState() {
        return {
            snapshot: this.getSnapshot(),
            history: this.getStateHistory(),
            debugInfo: this.getDebugInfo(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 从导出的数据恢复状态
     */
    importState(exportedData) {
        if (!exportedData || !exportedData.snapshot) {
            throw new Error('Invalid state data');
        }
        
        // 恢复状态快照
        Object.entries(exportedData.snapshot).forEach(([key, value]) => {
            if (key === 'cosImageCache' && typeof value === 'object') {
                this.set(key, new Map(Object.entries(value)));
            } else if (key === 'capturedImageRequests' && typeof value === 'object') {
                this.set(key, new Map(Object.entries(value)));
            } else if (value !== '[Object]' && value !== '[Unserializable]') {
                this.set(key, value);
            }
        });
        
        // 恢复历史记录
        if (exportedData.history) {
            this.stateHistory = [...exportedData.history];
        }
    }
}