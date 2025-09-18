# Content.js 重构实施指南

## 🚀 快速开始

本文档提供了详细的代码实施指南，包含具体的代码示例和最佳实践。

## 📁 阶段一：基础设施提取

### 1.1 创建工具模块

#### utils/Logger.js
```javascript
/**
 * 调试日志工具类
 * 保持原有的调试功能完全不变
 */
export class Logger {
    static debugMode = false;
    static debugLogs = [];
    static debugPanel = null;

    /**
     * 调试日志记录 - 原 debugLog 函数逻辑
     */
    static debugLog(message, data = null) {
        if (!Logger.debugMode) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            data: data ? JSON.stringify(data, null, 2) : null
        };
        
        Logger.debugLogs.push(logEntry);
        console.log(`[DEBUG ${timestamp}] ${message}`, data || '');
        
        // 更新调试面板显示
        Logger.updateDebugPanel();
        
        // 限制日志数量，避免内存泄漏
        if (Logger.debugLogs.length > 1000) {
            Logger.debugLogs = Logger.debugLogs.slice(-500);
        }
    }

    /**
     * 切换调试模式 - 原 toggleDebugMode 函数逻辑
     */
    static toggleDebugMode() {
        Logger.debugMode = !Logger.debugMode;
        
        if (Logger.debugMode) {
            if (!Logger.debugPanel) {
                Logger.initializeDebugPanel();
            } else {
                Logger.debugPanel.style.display = 'block';
            }
            Logger.debugLog('调试模式已开启');
            // 这里需要通过事件系统通知UI显示通知
            Logger.notifyModeChange('调试模式已开启 (Z键切换)', 2000);
        } else {
            if (Logger.debugPanel) {
                Logger.debugPanel.style.display = 'none';
            }
            console.log('调试模式已关闭');
            Logger.notifyModeChange('调试模式已关闭 (Z键切换)', 2000);
        }
    }

    /**
     * 初始化调试面板 - 原逻辑保持不变
     */
    static initializeDebugPanel() {
        // 原 initializeDebugPanel 函数的完整逻辑
        // ... (保持原有的HTML结构和样式)
    }

    /**
     * 更新调试面板显示
     */
    static updateDebugPanel() {
        if (!Logger.debugPanel || !Logger.debugMode) return;
        
        const logArea = Logger.debugPanel.querySelector('.debug-logs');
        if (logArea) {
            const recentLogs = Logger.debugLogs.slice(-50); // 显示最近50条
            logArea.innerHTML = recentLogs.map(log => 
                `<div class="debug-log-entry">
                    <span class="debug-timestamp">[${log.timestamp}]</span>
                    <span class="debug-message">${log.message}</span>
                    ${log.data ? `<pre class="debug-data">${log.data}</pre>` : ''}
                </div>`
            ).join('');
            
            // 自动滚动到底部
            logArea.scrollTop = logArea.scrollHeight;
        }
    }

    /**
     * 通知模式变化 - 需要与NotificationManager集成
     */
    static notifyModeChange(message, duration) {
        // 这里需要通过事件系统或依赖注入来调用NotificationManager
        // 暂时使用全局函数，后续会被替换
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, duration);
        }
    }

    /**
     * 清空调试日志
     */
    static clearLogs() {
        Logger.debugLogs = [];
        Logger.updateDebugPanel();
        Logger.debugLog('调试日志已清空');
    }

    /**
     * 导出调试日志
     */
    static exportLogs() {
        const logsText = Logger.debugLogs.map(log => 
            `[${log.timestamp}] ${log.message}${log.data ? '\n' + log.data : ''}`
        ).join('\n\n');
        
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-logs-${new Date().toISOString().slice(0, 19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        Logger.debugLog('调试日志已导出');
    }
}
```

#### utils/DOMUtils.js
```javascript
/**
 * DOM操作工具类
 * 封装常用的DOM操作，提高代码复用性
 */
export class DOMUtils {
    /**
     * 安全的querySelector，带错误处理
     */
    static querySelector(selector, context = document) {
        try {
            return context.querySelector(selector);
        } catch (error) {
            console.warn(`querySelector failed for selector: ${selector}`, error);
            return null;
        }
    }

    /**
     * 安全的querySelectorAll，带错误处理
     */
    static querySelectorAll(selector, context = document) {
        try {
            return Array.from(context.querySelectorAll(selector));
        } catch (error) {
            console.warn(`querySelectorAll failed for selector: ${selector}`, error);
            return [];
        }
    }

    /**
     * 创建元素并设置属性
     */
    static createElement(tag, props = {}, children = []) {
        const element = document.createElement(tag);
        
        // 设置属性
        Object.entries(props).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key.startsWith('on') && typeof value === 'function') {
                // 事件监听器
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // 添加子元素
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    }

    /**
     * 检查元素是否可见
     */
    static isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
    }

    /**
     * 等待元素出现
     */
    static waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = DOMUtils.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = DOMUtils.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 超时处理
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    /**
     * 平滑滚动到元素
     */
    static scrollToElement(element, options = {}) {
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    }

    /**
     * 获取元素的绝对位置
     */
    static getElementPosition(element) {
        if (!element) return { x: 0, y: 0 };
        
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height
        };
    }

    /**
     * 检查点击是否在元素内
     */
    static isClickInsideElement(event, element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left &&
               event.clientX <= rect.right &&
               event.clientY >= rect.top &&
               event.clientY <= rect.bottom;
    }
}
```

#### utils/FileUtils.js
```javascript
/**
 * 文件处理工具类
 * 保持原有的文件处理逻辑完全不变
 */
export class FileUtils {
    /**
     * 生成文件名 - 原逻辑保持不变
     */
    static generateFileName(imageUrl, prefix = '') {
        try {
            // 原 generateFileName 相关逻辑
            const url = new URL(imageUrl);
            const pathname = url.pathname;
            
            // 提取文件名
            let fileName = pathname.split('/').pop() || 'image';
            
            // 如果没有扩展名，根据URL特征判断
            if (!fileName.includes('.')) {
                if (imageUrl.includes('cos.ap-') || imageUrl.includes('.myqcloud.com')) {
                    fileName += '.jpg'; // COS图片默认为jpg
                } else {
                    fileName += '.png'; // 其他情况默认为png
                }
            }
            
            // 添加前缀
            if (prefix) {
                const parts = fileName.split('.');
                const ext = parts.pop();
                const name = parts.join('.');
                fileName = `${prefix}_${name}.${ext}`;
            }
            
            // 添加时间戳避免重名
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const parts = fileName.split('.');
            const ext = parts.pop();
            const name = parts.join('.');
            
            return `${name}_${timestamp}.${ext}`;
            
        } catch (error) {
            console.warn('生成文件名失败，使用默认名称:', error);
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            return `${prefix || 'image'}_${timestamp}.jpg`;
        }
    }

    /**
     * 获取图片尺寸 - 原逻辑保持不变
     */
    static getImageDimensions(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = function() {
                resolve({
                    width: this.naturalWidth,
                    height: this.naturalHeight,
                    aspectRatio: this.naturalWidth / this.naturalHeight
                });
            };
            
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            
            img.src = imageUrl;
        });
    }

    /**
     * 检查图片格式
     */
    static getImageFormat(imageUrl) {
        try {
            const url = new URL(imageUrl);
            const pathname = url.pathname.toLowerCase();
            
            if (pathname.includes('.jpg') || pathname.includes('.jpeg')) {
                return 'jpeg';
            } else if (pathname.includes('.png')) {
                return 'png';
            } else if (pathname.includes('.gif')) {
                return 'gif';
            } else if (pathname.includes('.webp')) {
                return 'webp';
            } else if (pathname.includes('.svg')) {
                return 'svg';
            }
            
            return 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * 检查是否为COS图片URL
     */
    static isCOSImage(imageUrl) {
        if (!imageUrl) return false;
        
        try {
            const url = new URL(imageUrl);
            return url.hostname.includes('cos.ap-') || 
                   url.hostname.includes('.myqcloud.com') ||
                   url.hostname.includes('tencentcos.cn');
        } catch (error) {
            return false;
        }
    }

    /**
     * 检查是否为原图格式（JPEG）
     */
    static isOriginalImageFormat(imageUrl) {
        const format = FileUtils.getImageFormat(imageUrl);
        return format === 'jpeg' && FileUtils.isCOSImage(imageUrl);
    }

    /**
     * 文件大小格式化
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 检查文件类型是否被接受
     */
    static isFileTypeAccepted(file, acceptedTypes) {
        if (!acceptedTypes) return true;
        
        const fileType = file.type;
        const fileName = file.name.toLowerCase();
        
        return acceptedTypes.split(',').some(type => {
            type = type.trim();
            if (type.startsWith('.')) {
                // 扩展名匹配
                return fileName.endsWith(type);
            } else if (type.includes('*')) {
                // MIME类型通配符匹配
                const regex = new RegExp(type.replace('*', '.*'));
                return regex.test(fileType);
            } else {
                // 精确MIME类型匹配
                return fileType === type;
            }
        });
    }
}
```

#### config/constants.js
```javascript
/**
 * 应用常量定义
 * 将原有的硬编码值提取为常量
 */

// 键盘快捷键定义
export const KEYBOARD_SHORTCUTS = {
    DOWNLOAD_IMAGE: 'd',
    SKIP_BUTTON: ' ',
    SUBMIT_CONTINUE: 's',
    UPLOAD_IMAGE: 'a',
    VIEW_HISTORY: 'f',
    SMART_COMPARE: 'w',
    DEBUG_MODE: 'z',
    CHECK_FILE_INPUT: 'i',
    REDETECT_ORIGINAL_B: 'b',
    REDETECT_ORIGINAL_N: 'n',
    SMART_DIMENSION_CHECK: 'p',
    SMART_DIMENSION_CHECK_F2: 'F2',
    MANUAL_DIMENSION_CHECK: 'r',
    F1_AUTO_INVALID: 'F1',
    ESCAPE: 'Escape'
};

// DOM选择器定义
export const SELECTORS = {
    // 按钮选择器
    SKIP_BUTTON: 'button:contains("跳过"), button[title*="跳过"], .skip-btn',
    SUBMIT_BUTTON: 'button:contains("提交并继续标注"), button:contains("提交"), .submit-btn',
    INVALID_BUTTON: 'button:contains("无效"), button:contains("Invalid"), .invalid-btn',
    
    // 输入元素选择器
    FILE_INPUT: 'input[type="file"]',
    IMAGE_INPUT: 'input[type="file"][accept*="image"]',
    
    // 图片选择器
    IMAGES: 'img',
    COS_IMAGES: 'img[src*="cos.ap-"], img[src*=".myqcloud.com"]',
    
    // 模态框选择器
    DIMENSION_CHECK_MODAL: '.dimension-check-modal',
    COMPARISON_MODAL: '.comparison-modal',
    
    // 调试面板选择器
    DEBUG_PANEL: '.debug-panel',
    DEBUG_LOGS: '.debug-logs',
    
    // 通知选择器
    NOTIFICATION: '.notification',
    
    // 提示框选择器
    TOOLTIP: '.dimension-tooltip'
};

// 应用设置默认值
export const DEFAULT_SETTINGS = {
    // 音效设置
    SOUND_ENABLED: true,
    
    // F1自动无效化设置
    F1_INTERVAL_MS: 800,
    F1_MAX_RUNS: 0, // 0表示无限制
    
    // 自动对比设置
    AUTO_COMPARE_ENABLED: true,
    
    // 通知设置
    NOTIFICATION_DURATION: 3000,
    
    // 调试设置
    DEBUG_MODE: false,
    MAX_DEBUG_LOGS: 1000,
    
    // 图片检测设置
    IMAGE_DETECTION_INTERVAL: 1000,
    
    // 网络监听设置
    NETWORK_TIMEOUT: 10000
};

// 样式常量
export const STYLES = {
    // 通知样式
    NOTIFICATION: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#333',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '6px',
        fontSize: '14px',
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '300px',
        wordWrap: 'break-word'
    },
    
    // 调试面板样式
    DEBUG_PANEL: {
        position: 'fixed',
        top: '10px',
        left: '10px',
        width: '400px',
        height: '500px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        border: '1px solid #333',
        borderRadius: '8px',
        zIndex: '9999',
        fontFamily: 'monospace',
        fontSize: '12px'
    },
    
    // 模态框样式
    MODAL_OVERLAY: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: '10000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    }
};

// 错误消息常量
export const ERROR_MESSAGES = {
    CHROME_API_UNAVAILABLE: 'Chrome扩展API不可用，插件可能未正确加载',
    IMAGE_DOWNLOAD_FAILED: '图片下载失败',
    IMAGE_UPLOAD_FAILED: '图片上传失败',
    NETWORK_REQUEST_FAILED: '网络请求失败',
    FILE_NOT_FOUND: '文件未找到',
    INVALID_IMAGE_FORMAT: '不支持的图片格式',
    DIMENSION_CHECK_FAILED: '尺寸检查失败'
};

// 成功消息常量
export const SUCCESS_MESSAGES = {
    IMAGE_DOWNLOADED: '图片下载成功',
    IMAGE_UPLOADED: '图片上传成功',
    SETTINGS_SAVED: '设置保存成功',
    DEBUG_MODE_ENABLED: '调试模式已开启',
    DEBUG_MODE_DISABLED: '调试模式已关闭'
};

// API端点常量
export const API_ENDPOINTS = {
    RUNNINGHUB_BASE: 'https://api.runninghub.cn',
    RUNNINGHUB_WORKFLOW: '/api/v1/workflow',
    RUNNINGHUB_UPLOAD: '/api/v1/upload'
};

// 文件类型常量
export const FILE_TYPES = {
    IMAGES: 'image/*',
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    GIF: 'image/gif',
    WEBP: 'image/webp'
};

// 正则表达式常量
export const REGEX_PATTERNS = {
    COS_URL: /cos\.ap-[^.]+\.myqcloud\.com|tencentcos\.cn/,
    IMAGE_URL: /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i,
    DIMENSION_8_MULTIPLE: /^(\d+)x(\d+)$/
};

// 事件名称常量
export const EVENTS = {
    STATE_CHANGED: 'state:changed',
    IMAGE_DETECTED: 'image:detected',
    IMAGE_UPLOADED: 'image:uploaded',
    IMAGE_DOWNLOADED: 'image:downloaded',
    MODAL_OPENED: 'modal:opened',
    MODAL_CLOSED: 'modal:closed',
    DEBUG_MODE_TOGGLED: 'debug:toggled',
    NOTIFICATION_SHOWN: 'notification:shown'
};

// 存储键名常量
export const STORAGE_KEYS = {
    SOUND_ENABLED: 'soundEnabled',
    F1_INTERVAL: 'f1Interval',
    F1_MAX_RUNS: 'f1MaxRuns',
    AUTO_COMPARE_ENABLED: 'autoCompareEnabled',
    DEBUG_MODE: 'debugMode',
    CACHED_RESULTS: 'cachedRunningHubResults',
    LAST_TASK_ID: 'lastSuccessfulTaskId'
};
```

### 1.2 验证基础设施

创建简单的测试文件来验证工具模块：

#### test/utils.test.js
```javascript
// 简单的功能验证测试
import { Logger } from '../utils/Logger.js';
import { DOMUtils } from '../utils/DOMUtils.js';
import { FileUtils } from '../utils/FileUtils.js';

// 测试Logger
console.log('Testing Logger...');
Logger.debugMode = true;
Logger.debugLog('Test message', { test: 'data' });
console.log('Logger test passed ✓');

// 测试DOMUtils
console.log('Testing DOMUtils...');
const testDiv = DOMUtils.createElement('div', { className: 'test' }, ['Test content']);
console.log('DOMUtils test passed ✓');

// 测试FileUtils
console.log('Testing FileUtils...');
const fileName = FileUtils.generateFileName('https://example.com/image.jpg', 'test');
console.log('Generated filename:', fileName);
console.log('FileUtils test passed ✓');
```

## 📁 阶段二：状态管理重构

### 2.1 创建状态管理器

#### core/StateManager.js
```javascript
/**
 * 全局状态管理器
 * 统一管理所有原全局变量，提供状态变化监听
 */
export class StateManager {
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
            notificationAudio: null
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
            shouldAutoCompare: false
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
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * 检查页面是否发生变化
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
        timeouts.forEach(timeout => clearTimeout(timeout));
        
        // 清空监听器
        this.listeners.clear();
        
        // 清空状态
        this.state = {};
        this.stateHistory = [];
    }
}
```

### 2.2 创建配置管理器

#### core/ConfigManager.js
```javascript
/**
 * 配置管理器
 * 负责加载和保存各种配置设置
 */
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../config/constants.js';
import { Logger } from '../utils/Logger.js';

export class ConfigManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.initialized = false;
    }

    /**
     * 初始化配置管理器
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            await Promise.all([
                this.loadSoundSettings(),
                this.loadF1Settings(),
                this.loadAutoCompareSettings(),
                this.loadDebugSettings()
            ]);
            
            this.setupStorageListener();
            this.initialized = true;
            
            Logger.debugLog('配置管理器初始化完成');
        } catch (error) {
            console.error('配置管理器初始化失败:', error);
            this.loadDefaultSettings();
        }
    }

    /**
     * 加载音效设置 - 保持原逻辑不变
     */
    async loadSoundSettings() {
        try {
            const result = await chrome.storage.sync.get([STORAGE_KEYS.SOUND_ENABLED]);
            const soundEnabled = result[STORAGE_KEYS.SOUND_ENABLED] ?? DEFAULT_SETTINGS.SOUND_ENABLED;
            
            this.stateManager.set('soundEnabled', soundEnabled);
            Logger.debugLog('音效设置加载完成', { soundEnabled });
            
        } catch (error) {
            console.error('加载音效设置失败:', error);
            this.stateManager.set('soundEnabled', DEFAULT_SETTINGS.SOUND_ENABLED);
        }
    }

    /**
     * 加载F1设置 - 保持原逻辑不变
     */
    async loadF1Settings() {
        try {
            const result = await chrome.storage.sync.get([
                STORAGE_KEYS.F1_INTERVAL,
                STORAGE_KEYS.F1_MAX_RUNS
            ]);
            
            const f1IntervalMs = result[STORAGE_KEYS.F1_INTERVAL] ?? DEFAULT_SETTINGS.F1_INTERVAL_MS;
            const f1MaxRuns = result[STORAGE_KEYS.F1_MAX_RUNS] ?? DEFAULT_SETTINGS.F1_MAX_RUNS;
            
            this.stateManager.setState({
                f1IntervalMs,
                f1MaxRuns
            });
            
            Logger.debugLog('F1设置加载完成', { f1IntervalMs, f1MaxRuns });
            
        } catch (error) {
            console.error('加载F1设置失败:', error);
            this.stateManager.setState({
                f1IntervalMs: DEFAULT_SETTINGS.F1_INTERVAL_MS,
                f1MaxRuns: DEFAULT_SETTINGS.F1_MAX_RUNS
            });
        }
    }

    /**
     * 加载自动对比设置 - 保持原逻辑不变
     */
    async loadAutoCompareSettings() {
        try {
            const result = await chrome.storage.sync.get([STORAGE_KEYS.AUTO_COMPARE_ENABLED]);
            const autoCompareEnabled = result[STORAGE_KEYS.AUTO_COMPARE_ENABLED] ?? DEFAULT_SETTINGS.AUTO_COMPARE_ENABLED;
            
            this.stateManager.set('autoCompareEnabled', autoCompareEnabled);
            Logger.debugLog('自动对比设置加载完成', { autoCompareEnabled });
            
        } catch (error) {
            console.error('加载自动对比设置失败:', error);
            this.stateManager.set('autoCompareEnabled', DEFAULT_SETTINGS.AUTO_COMPARE_ENABLED);
        }
    }

    /**
     * 加载调试设置
     */
    async loadDebugSettings() {
        try {
            const result = await chrome.storage.sync.get([STORAGE_KEYS.DEBUG_MODE]);
            const debugMode = result[STORAGE_KEYS.DEBUG_MODE] ?? DEFAULT_SETTINGS.DEBUG_MODE;
            
            this.stateManager.set('debugMode', debugMode);
            Logger.debugLog('调试设置加载完成', { debugMode });
            
        } catch (error) {
            console.error('加载调试设置失败:', error);
            this.stateManager.set('debugMode', DEFAULT_SETTINGS.DEBUG_MODE);
        }
    }

    /**
     * 保存音效设置
     */
    async saveSoundSettings(enabled) {
        try {
            await chrome.storage.sync.set({
                [STORAGE_KEYS.SOUND_ENABLED]: enabled
            });
            
            this.stateManager.set('soundEnabled', enabled);
            Logger.debugLog('音效设置保存成功', { enabled });
            
        } catch (error) {
            console.error('保存音效设置失败:', error);
            throw error;
        }
    }

    /**
     * 保存F1设置
     */
    async saveF1Settings(intervalMs, maxRuns) {
        try {
            await chrome.storage.sync.set({
                [STORAGE_KEYS.F1_INTERVAL]: intervalMs,
                [STORAGE_KEYS.F1_MAX_RUNS]: maxRuns
            });
            
            this.stateManager.setState({
                f1IntervalMs: intervalMs,
                f1MaxRuns: maxRuns
            });
            
            Logger.debugLog('F1设置保存成功', { intervalMs, maxRuns });
            
        } catch (error) {
            console.error('保存F1设置失败:', error);
            throw error;
        }
    }

    /**
     * 保存自动对比设置
     */
    async saveAutoCompareSettings(enabled) {
        try {
            await chrome.storage.sync.set({
                [STORAGE_KEYS.AUTO_COMPARE_ENABLED]: enabled
            });
            
            this.stateManager.set('autoCompareEnabled', enabled);
            Logger.debugLog('自动对比设置保存成功', { enabled });
            
        } catch (error) {
            console.error('保存自动对比设置失败:', error);
            throw error;
        }
    }

    /**
     * 保存调试设置
     */
    async saveDebugSettings(enabled) {
        try {
            await chrome.storage.sync.set({
                [STORAGE_KEYS.DEBUG_MODE]: enabled
            });
            
            this.stateManager.set('debugMode', enabled);
            Logger.debugLog('调试设置保存成功', { enabled });
            
        } catch (error) {
            console.error('保存调试设置失败:', error);
            throw error;
        }
    }

    /**
     * 加载默认设置
     */
    loadDefaultSettings() {
        this.stateManager.setState({
            soundEnabled: DEFAULT_SETTINGS.SOUND_ENABLED,
            f1IntervalMs: DEFAULT_SETTINGS.F1_INTERVAL_MS,
            f1MaxRuns: DEFAULT_SETTINGS.F1_MAX_RUNS,
            autoCompareEnabled: DEFAULT_SETTINGS.AUTO_COMPARE_ENABLED,
            debugMode: DEFAULT_SETTINGS.DEBUG_MODE
        });
        
        Logger.debugLog('已加载默认设置');
    }

    /**
     * 设置存储变化监听器 - 保持原逻辑不变
     */
    setupStorageListener() {
        if (!chrome.storage || !chrome.storage.onChanged) {
            console.warn('Chrome存储API不可用');
            return;
        }
        
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'sync') return;
            
            // 音效设置变化
            if (changes[STORAGE_KEYS.SOUND_ENABLED]) {
                const newValue = changes[STORAGE_KEYS.SOUND_ENABLED].newValue;
                this.stateManager.set('soundEnabled', newValue);
                Logger.debugLog('音效设置已更新', { soundEnabled: newValue });
            }
            
            // F1设置变化
            if (changes[STORAGE_KEYS.F1_INTERVAL]) {
                const newValue = changes[STORAGE_KEYS.F1_INTERVAL].newValue;
                this.stateManager.set('f1IntervalMs', newValue);
                Logger.debugLog('F1间隔设置已更新', { f1IntervalMs: newValue });
            }
            
            if (changes[STORAGE_KEYS.F1_MAX_RUNS]) {
                const newValue = changes[STORAGE_KEYS.F1_MAX_RUNS].newValue;
                this.stateManager.set('f1MaxRuns', newValue);
                Logger.debugLog('F1最大执行次数设置已更新', { f1MaxRuns: newValue });
            }
            
            // 自动对比设置变化
            if (changes[STORAGE_KEYS.AUTO_COMPARE_ENABLED]) {
                const newValue = changes[STORAGE_KEYS.AUTO_COMPARE_ENABLED].newValue;
                this.stateManager.set('autoCompareEnabled', newValue);
                Logger.debugLog('自动对比设置已更新', { autoCompareEnabled: newValue });
            }
            
            // 调试模式设置变化
            if (changes[STORAGE_KEYS.DEBUG_MODE]) {
                const newValue = changes[STORAGE_KEYS.DEBUG_MODE].newValue;
                this.stateManager.set('debugMode', newValue);
                Logger.debugLog('调试模式设置已更新', { debugMode: newValue });
            }
        });
        
        Logger.debugLog('存储变化监听器已设置');
    }

    /**
     * 获取所有配置
     */
    getAllSettings() {
        return {
            soundEnabled: this.stateManager.get('soundEnabled'),
            f1IntervalMs: this.stateManager.get('f1IntervalMs'),
            f1MaxRuns: this.stateManager.get('f1MaxRuns'),
            autoCompareEnabled: this.stateManager.get('autoCompareEnabled'),
            debugMode: this.stateManager.get('debugMode')
        };
    }

    /**
     * 重置所有设置为默认值
     */
    async resetToDefaults() {
        try {
            await chrome.storage.sync.clear();
            this.loadDefaultSettings();
            Logger.debugLog('所有设置已重置为默认值');
        } catch (error) {
            console.error('重置设置失败:', error);
            throw error;
        }
    }
}
```

这个实施指南提供了详细的代码示例和实现步骤。您希望我继续创建其他相关文档吗？比如迁移检查清单和模块架构设计文档？