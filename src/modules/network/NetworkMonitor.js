/**
 * 网络监听器
 * 保持原有的网络请求监听逻辑完全不变
 */
import { Logger } from '../utils/Logger.js';

export class NetworkMonitor {
    constructor(stateManager, notificationManager) {
        this.stateManager = stateManager;
        this.notificationManager = notificationManager;
        this.requestHistory = [];
        this.isMonitoring = false;
        
        this.initializeNetworkMonitoring();
    }

    /**
     * 初始化网络监听 - 原逻辑保持不变
     */
    initializeNetworkMonitoring() {
        try {
            // 监听fetch请求
            this.interceptFetch();
            
            // 监听XMLHttpRequest
            this.interceptXHR();
            
            this.isMonitoring = true;
            Logger.debugLog('网络监听已启动');
            
        } catch (error) {
            Logger.debugLog('网络监听初始化失败:', error);
        }
    }

    /**
     * 拦截fetch请求
     */
    interceptFetch() {
        const originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
            const startTime = Date.now();
            const url = args[0];
            const options = args[1] || {};
            
            try {
                // 记录请求开始
                this.logRequest('fetch', url, options, startTime);
                
                // 执行原始请求
                const response = await originalFetch.apply(window, args);
                
                // 记录响应
                this.logResponse('fetch', url, response, startTime);
                
                return response;
                
            } catch (error) {
                // 记录错误
                this.logError('fetch', url, error, startTime);
                throw error;
            }
        };
    }

    /**
     * 拦截XMLHttpRequest
     */
    interceptXHR() {
        const originalXHR = window.XMLHttpRequest;
        const self = this;
        
        window.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            const startTime = Date.now();
            let url = '';
            let method = '';
            
            // 拦截open方法
            const originalOpen = xhr.open;
            xhr.open = function(m, u, ...args) {
                method = m;
                url = u;
                return originalOpen.apply(this, [m, u, ...args]);
            };
            
            // 拦截send方法
            const originalSend = xhr.send;
            xhr.send = function(data) {
                // 记录请求开始
                self.logRequest('xhr', url, { method, data }, startTime);
                
                // 监听状态变化
                xhr.addEventListener('readystatechange', function() {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            self.logResponse('xhr', url, xhr, startTime);
                        } else {
                            self.logError('xhr', url, new Error(`HTTP ${xhr.status}`), startTime);
                        }
                    }
                });
                
                return originalSend.apply(this, arguments);
            };
            
            return xhr;
        };
    }

    /**
     * 记录请求
     */
    logRequest(type, url, options, startTime) {
        const requestData = {
            id: this.generateRequestId(),
            type,
            url,
            method: options.method || 'GET',
            startTime,
            status: 'pending'
        };
        
        this.requestHistory.push(requestData);
        Logger.debugLog('网络请求:', requestData);
        
        // 检查是否是图片请求
        if (this.isImageRequest(url)) {
            this.handleImageRequest(requestData);
        }
        
        // 检查是否是API请求
        if (this.isAPIRequest(url)) {
            this.handleAPIRequest(requestData);
        }
    }

    /**
     * 记录响应
     */
    logResponse(type, url, response, startTime) {
        const duration = Date.now() - startTime;
        const requestData = this.findRequest(url, startTime);
        
        if (requestData) {
            requestData.status = 'success';
            requestData.duration = duration;
            requestData.response = {
                status: response.status || (response.readyState === 4 ? response.status : 200),
                statusText: response.statusText || 'OK',
                headers: this.extractHeaders(response)
            };
            
            Logger.debugLog('网络响应:', requestData);
            
            // 处理图片响应
            if (this.isImageRequest(url)) {
                this.handleImageResponse(requestData, response);
            }
        }
    }

    /**
     * 记录错误
     */
    logError(type, url, error, startTime) {
        const duration = Date.now() - startTime;
        const requestData = this.findRequest(url, startTime);
        
        if (requestData) {
            requestData.status = 'error';
            requestData.duration = duration;
            requestData.error = {
                message: error.message,
                stack: error.stack
            };
            
            Logger.debugLog('网络错误:', requestData);
        }
    }

    /**
     * 生成请求ID
     */
    generateRequestId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 查找请求记录
     */
    findRequest(url, startTime) {
        return this.requestHistory.find(req => 
            req.url === url && req.startTime === startTime
        );
    }

    /**
     * 提取响应头
     */
    extractHeaders(response) {
        const headers = {};
        
        if (response.headers) {
            if (typeof response.headers.forEach === 'function') {
                // fetch Response对象
                response.headers.forEach((value, key) => {
                    headers[key] = value;
                });
            } else if (typeof response.headers.entries === 'function') {
                // 其他Headers对象
                for (const [key, value] of response.headers.entries()) {
                    headers[key] = value;
                }
            }
        } else if (response.getAllResponseHeaders) {
            // XMLHttpRequest对象
            const headerString = response.getAllResponseHeaders();
            headerString.split('\r\n').forEach(line => {
                const [key, value] = line.split(': ');
                if (key && value) {
                    headers[key.toLowerCase()] = value;
                }
            });
        }
        
        return headers;
    }

    /**
     * 检查是否是图片请求
     */
    isImageRequest(url) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
        const urlLower = url.toLowerCase();
        
        return imageExtensions.some(ext => urlLower.includes(ext)) ||
               urlLower.includes('image') ||
               urlLower.includes('img');
    }

    /**
     * 检查是否是API请求
     */
    isAPIRequest(url) {
        const apiKeywords = ['api', 'ajax', 'json', 'xml'];
        const urlLower = url.toLowerCase();
        
        return apiKeywords.some(keyword => urlLower.includes(keyword));
    }

    /**
     * 处理图片请求
     */
    handleImageRequest(requestData) {
        Logger.debugLog('检测到图片请求:', requestData.url);
        
        // 更新状态
        const imageRequests = this.stateManager.get('imageRequests') || [];
        imageRequests.push(requestData);
        this.stateManager.set('imageRequests', imageRequests);
    }

    /**
     * 处理图片响应
     */
    handleImageResponse(requestData, response) {
        if (requestData.response.status >= 200 && requestData.response.status < 300) {
            Logger.debugLog('图片加载成功:', requestData.url);
            
            // 通知图片加载完成
            const loadedImages = this.stateManager.get('loadedImages') || [];
            loadedImages.push({
                url: requestData.url,
                timestamp: Date.now(),
                size: response.headers ? response.headers.get('content-length') : null
            });
            this.stateManager.set('loadedImages', loadedImages);
        }
    }

    /**
     * 处理API请求
     */
    handleAPIRequest(requestData) {
        Logger.debugLog('检测到API请求:', requestData.url);
        
        // 更新状态
        const apiRequests = this.stateManager.get('apiRequests') || [];
        apiRequests.push(requestData);
        this.stateManager.set('apiRequests', apiRequests);
    }

    /**
     * 获取请求历史
     */
    getRequestHistory(filter = {}) {
        let history = [...this.requestHistory];
        
        // 按类型筛选
        if (filter.type) {
            history = history.filter(req => req.type === filter.type);
        }
        
        // 按状态筛选
        if (filter.status) {
            history = history.filter(req => req.status === filter.status);
        }
        
        // 按URL筛选
        if (filter.urlContains) {
            history = history.filter(req => req.url.includes(filter.urlContains));
        }
        
        // 按时间范围筛选
        if (filter.startTime && filter.endTime) {
            history = history.filter(req => 
                req.startTime >= filter.startTime && req.startTime <= filter.endTime
            );
        }
        
        return history;
    }

    /**
     * 获取网络统计信息
     */
    getNetworkStats() {
        const total = this.requestHistory.length;
        const success = this.requestHistory.filter(req => req.status === 'success').length;
        const error = this.requestHistory.filter(req => req.status === 'error').length;
        const pending = this.requestHistory.filter(req => req.status === 'pending').length;
        
        const avgDuration = this.requestHistory
            .filter(req => req.duration)
            .reduce((sum, req) => sum + req.duration, 0) / (total - pending);
        
        return {
            total,
            success,
            error,
            pending,
            avgDuration: Math.round(avgDuration) || 0,
            successRate: total > 0 ? Math.round((success / total) * 100) : 0
        };
    }

    /**
     * 清理请求历史
     */
    clearHistory() {
        this.requestHistory = [];
        Logger.debugLog('网络请求历史已清理');
    }

    /**
     * 停止网络监听
     */
    stopMonitoring() {
        this.isMonitoring = false;
        Logger.debugLog('网络监听已停止');
    }

    /**
     * 获取监听状态
     */
    getMonitoringStatus() {
        return {
            isMonitoring: this.isMonitoring,
            requestCount: this.requestHistory.length,
            stats: this.getNetworkStats()
        };
    }
}