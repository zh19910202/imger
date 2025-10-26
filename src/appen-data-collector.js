// Appen数据收集器 - Content Script
// 专门用于收集https://ui.appen.com.cn/域名下的标注人员作业情况
// 实现即时收集模式，在标注完成时立即推送数据

(function() {
    'use strict';

    // 强制调试输出 - 确保脚本开始执行
    console.log('[Appen-新旧题] ========== 脚本开始执行 ==========');

    // 配置参数
    const CONFIG = {
        // 数据推送的API端点
        API_ENDPOINT: 'http://192.168.31.74:1145/api/Task/apple/add', //http://192.168.31.74:1145/api/Task/apple/add  http://www.skytree.ink/api/Task/add
        // 认证信息同步的API端点
        AUTH_SYNC_ENDPOINT: 'http://www.skytree.ink/api/Task/apple/sync',
        // 最大重试次数
        MAX_RETRY_ATTEMPTS: 3,
        // 重试间隔（毫秒）
        RETRY_DELAY: 5000,
        // 防抖延迟（毫秒），避免短时间内重复推送
        DEBOUNCE_DELAY: 2000,
        // 特定URL模式匹配
        TARGET_URL_PATTERN: /^https:\/\/ui\.appen\.com\.cn\/ssr\/v3\/annotation-task-start\?.*$/,
        // 计时最大时长（毫秒）- 1小时
        MAX_ELAPSED_TIME: 3600000
    };

    // 日志级别配置
    const LOG_LEVEL = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3
    };

    // 生产环境使用WARN级别，开发环境可以使用DEBUG级别
    const CURRENT_LOG_LEVEL = LOG_LEVEL.DEBUG;

    // 统一日志函数
    function log(level, message, data = null) {
        if (level <= CURRENT_LOG_LEVEL) {
            const timestamp = new Date().toISOString();
            const logMessage = `[Appen Data Collector] ${message}`;

            switch(level) {
                case LOG_LEVEL.ERROR:
                    if (data) {
                        console.error(logMessage, data);
                    } else {
                        console.error(logMessage);
                    }
                    break;
                case LOG_LEVEL.WARN:
                    if (data) {
                        console.warn(logMessage, data);
                    } else {
                        console.warn(logMessage);
                    }
                    break;
                case LOG_LEVEL.INFO:
                    if (data) {
                        console.info(logMessage, data);
                    } else {
                        console.info(logMessage);
                    }
                    break;
                case LOG_LEVEL.DEBUG:
                    if (data) {
                        console.log(logMessage, data);
                    } else {
                        console.log(logMessage);
                    }
                    break;
            }
        }
    }

    // Chrome Storage Utility Functions
    const ChromeStorage = {
        // Check if chrome.storage is available
        isAvailable: function() {
            return typeof chrome !== 'undefined' && chrome.storage;
        },

        // Get data from local storage
        get: function(keys) {
            return new Promise((resolve, reject) => {
                if (!this.isAvailable()) {
                    log(LOG_LEVEL.WARN, 'chrome.storage 不可用');
                    resolve(null);
                    return;
                }

                chrome.storage.local.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        log(LOG_LEVEL.WARN, '获取缓存出错:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(result);
                    }
                });
            });
        },

        // Set data to local storage
        set: function(data) {
            return new Promise((resolve, reject) => {
                if (!this.isAvailable()) {
                    log(LOG_LEVEL.WARN, 'chrome.storage 不可用');
                    resolve(false);
                    return;
                }

                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        log(LOG_LEVEL.WARN, '保存缓存出错:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(true);
                    }
                });
            });
        },

        // Remove data from local storage
        remove: function(keys) {
            return new Promise((resolve, reject) => {
                if (!this.isAvailable()) {
                    log(LOG_LEVEL.WARN, 'chrome.storage 不可用');
                    resolve(false);
                    return;
                }

                chrome.storage.local.remove(keys, () => {
                    if (chrome.runtime.lastError) {
                        log(LOG_LEVEL.WARN, '删除缓存出错:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(true);
                    }
                });
            });
        }
    };

    // Element Selection Utility Functions
    const ElementSelector = {
        // Select a single element with multiple fallback selectors
        select: function(selectors) {
            if (typeof selectors === 'string') {
                return document.querySelector(selectors);
            }

            if (Array.isArray(selectors)) {
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        return element;
                    }
                }
            }

            return null;
        },

        // Select multiple elements with multiple fallback selectors
        selectAll: function(selectors) {
            if (typeof selectors === 'string') {
                return document.querySelectorAll(selectors);
            }

            if (Array.isArray(selectors)) {
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements && elements.length > 0) {
                        return elements;
                    }
                }
            }

            return [];
        },

        // Select within a context with fallback selectors
        selectInContext: function(context, selectors) {
            if (!context) return null;

            if (typeof selectors === 'string') {
                return context.querySelector(selectors);
            }

            if (Array.isArray(selectors)) {
                for (const selector of selectors) {
                    const element = context.querySelector(selector);
                    if (element) {
                        return element;
                    }
                }
            }

            return null;
        },

        // Select all within a context with fallback selectors
        selectAllInContext: function(context, selectors) {
            if (!context) return [];

            if (typeof selectors === 'string') {
                return context.querySelectorAll(selectors);
            }

            if (Array.isArray(selectors)) {
                for (const selector of selectors) {
                    const elements = context.querySelectorAll(selector);
                    if (elements && elements.length > 0) {
                        return elements;
                    }
                }
            }

            return [];
        }
    };

    // Enhanced Element Selection with Multiple Strategies
    const EnhancedElementSelector = {
        // Find element using multiple strategies with fallback
        findElementByMultipleStrategies: function(strategies) {
            for (const strategy of strategies) {
                try {
                    let element = null;

                    switch (strategy.type) {
                        case 'selector':
                            element = ElementSelector.select(strategy.value);
                            break;
                        case 'xpath':
                            const result = document.evaluate(strategy.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                            element = result.singleNodeValue;
                            break;
                        case 'content':
                            const allElements = document.querySelectorAll('*');
                            for (let i = 0; i < allElements.length; i++) {
                                const el = allElements[i];
                                const text = el.textContent || el.innerText || '';
                                if (text.includes(strategy.value)) {
                                    element = el;
                                    break;
                                }
                            }
                            break;
                        case 'svg':
                            // 专门处理SVG内容定位
                            const svgElements = document.querySelectorAll('svg');
                            for (let i = 0; i < svgElements.length; i++) {
                                const svg = svgElements[i];
                                const pathElements = svg.querySelectorAll('path');
                                for (let j = 0; j < pathElements.length; j++) {
                                    const path = pathElements[j];
                                    const dAttr = path.getAttribute('d') || '';
                                    if (dAttr.includes(strategy.value)) {
                                        element = svg; // 返回包含该path的svg元素
                                        break;
                                    }
                                }
                                if (element) break;
                            }
                            break;
                        case 'attribute':
                            const attrElements = document.querySelectorAll(`[${strategy.name}="${strategy.value}"]`);
                            if (attrElements.length > 0) {
                                element = attrElements[0];
                            }
                            break;
                        case 'classPattern':
                            const classElements = document.querySelectorAll('[class]');
                            for (let i = 0; i < classElements.length; i++) {
                                const el = classElements[i];
                                const className = el.className;
                                if (className && className.includes(strategy.value)) {
                                    element = el;
                                    break;
                                }
                            }
                            break;
                        case 'idPattern':
                            const idElements = document.querySelectorAll('[id]');
                            for (let i = 0; i < idElements.length; i++) {
                                const el = idElements[i];
                                const id = el.id;
                                if (id && id.includes(strategy.value)) {
                                    element = el;
                                    break;
                                }
                            }
                            break;
                        case 'structure':
                            // Find element by structural position
                            if (strategy.parentSelector && strategy.childIndex !== undefined) {
                                const parent = document.querySelector(strategy.parentSelector);
                                if (parent && parent.children[strategy.childIndex]) {
                                    element = parent.children[strategy.childIndex];
                                }
                            }
                            break;
                    }

                    if (element) {
                        log(LOG_LEVEL.DEBUG, `[EnhancedElementSelector] 找到元素，使用策略: ${strategy.type}`);
                        return {
                            element: element,
                            strategy: strategy.type
                        };
                    }
                } catch (error) {
                    ErrorHandler.handleDOMError(error, `[EnhancedElementSelector] 策略执行失败: ${strategy.type}`, null);
                }
            }

            log(LOG_LEVEL.DEBUG, '[EnhancedElementSelector] 未找到元素，所有策略均已尝试');
            return null;
        },

        // Find multiple elements using multiple strategies
        findElementsByMultipleStrategies: function(strategies) {
            for (const strategy of strategies) {
                try {
                    let elements = [];

                    switch (strategy.type) {
                        case 'selector':
                            elements = Array.from(ElementSelector.selectAll(strategy.value));
                            break;
                        case 'xpath':
                            const result = document.evaluate(strategy.value, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            for (let i = 0; i < result.snapshotLength; i++) {
                                elements.push(result.snapshotItem(i));
                            }
                            break;
                        case 'content':
                            const allElements = document.querySelectorAll('*');
                            for (let i = 0; i < allElements.length; i++) {
                                const el = allElements[i];
                                const text = el.textContent || el.innerText || '';
                                if (text.includes(strategy.value)) {
                                    elements.push(el);
                                }
                            }
                            break;
                        case 'svg':
                            // 专门处理SVG内容定位
                            const svgElements = document.querySelectorAll('svg');
                            for (let i = 0; i < svgElements.length; i++) {
                                const svg = svgElements[i];
                                const pathElements = svg.querySelectorAll('path');
                                for (let j = 0; j < pathElements.length; j++) {
                                    const path = pathElements[j];
                                    const dAttr = path.getAttribute('d') || '';
                                    if (dAttr.includes(strategy.value)) {
                                        elements.push(svg); // 返回包含该path的svg元素
                                        break;
                                    }
                                }
                            }
                            break;
                        case 'attribute':
                            elements = Array.from(document.querySelectorAll(`[${strategy.name}="${strategy.value}"]`));
                            break;
                        case 'classPattern':
                            const classElements = document.querySelectorAll('[class]');
                            for (let i = 0; i < classElements.length; i++) {
                                const el = classElements[i];
                                const className = el.className;
                                if (className && className.includes(strategy.value)) {
                                    elements.push(el);
                                }
                            }
                            break;
                        case 'idPattern':
                            const idElements = document.querySelectorAll('[id]');
                            for (let i = 0; i < idElements.length; i++) {
                                const el = idElements[i];
                                const id = el.id;
                                if (id && id.includes(strategy.value)) {
                                    elements.push(el);
                                }
                            }
                            break;
                    }

                    if (elements.length > 0) {
                        log(LOG_LEVEL.DEBUG, `[EnhancedElementSelector] 找到 ${elements.length} 个元素，使用策略: ${strategy.type}`);
                        return {
                            elements: elements,
                            strategy: strategy.type
                        };
                    }
                } catch (error) {
                    ErrorHandler.handleDOMError(error, `[EnhancedElementSelector] 策略执行失败: ${strategy.type}`, null);
                }
            }

            log(LOG_LEVEL.DEBUG, '[EnhancedElementSelector] 未找到元素，所有策略均已尝试');
            return null;
        }
    };

    // Enhanced Text Content Extraction Utility Functions
    const TextExtractor = {
        // 提取元素文本内容，支持多种策略和清理选项
        extractText: function(element, options = {}) {
            if (!element) {
                log(LOG_LEVEL.DEBUG, '[TextExtractor] 元素为空');
                return '';
            }

            const {
                clean = true,
                maxLength = 0,
                preserveNewlines = false,
                preserveSpaces = false,
                removeExtraWhitespace = true,
                allowedTags = []
            } = options;

            try {
                let text = '';

                // 方法1: 使用textContent (首选，包含隐藏文本)
                if (element.textContent !== undefined) {
                    text = element.textContent;
                }
                // 方法2: 使用innerText (仅可见文本)
                else if (element.innerText !== undefined) {
                    text = element.innerText;
                }
                // 方法3: 使用nodeValue (适用于文本节点)
                else if (element.nodeValue !== undefined) {
                    text = element.nodeValue;
                }
                // 方法4: 使用textContent属性
                else if (element.textContent !== undefined) {
                    text = element.textContent;
                }
                // 方法5: 转换为字符串
                else {
                    text = element.toString();
                }

                // 清理文本内容
                if (clean) {
                    text = this.cleanText(text, {
                        preserveNewlines,
                        preserveSpaces,
                        removeExtraWhitespace,
                        allowedTags
                    });
                }

                // 限制文本长度
                if (maxLength > 0 && text.length > maxLength) {
                    text = text.substring(0, maxLength);
                }

                log(LOG_LEVEL.DEBUG, `[TextExtractor] 成功提取文本，长度: ${text.length}`);
                return text;
            } catch (error) {
                return ErrorHandler.handleTextExtractionError(error, '[TextExtractor] 提取文本时出错', '');
            }
        },

        // 清理文本内容
        cleanText: function(text, options = {}) {
            if (!text || typeof text !== 'string') {
                return '';
            }

            const {
                preserveNewlines = false,
                preserveSpaces = false,
                removeExtraWhitespace = true,
                allowedTags = []
            } = options;

            try {
                let cleanedText = text;

                // 移除HTML标签（如果需要）
                if (allowedTags.length === 0) {
                    cleanedText = cleanedText.replace(/<[^>]*>/g, '');
                } else {
                    // 只移除不允许的标签
                    const allowedTagPattern = allowedTags.map(tag => `<${tag}[^>]*>|</${tag}>`).join('|');
                    const disallowedTagPattern = `<(?!/?(${allowedTags.join('|')})\\b)[^>]*>`;
                    cleanedText = cleanedText.replace(new RegExp(disallowedTagPattern, 'g'), '');
                }

                // 处理换行符
                if (!preserveNewlines) {
                    cleanedText = cleanedText.replace(/\n/g, ' ');
                }

                // 处理多余的空白字符
                if (removeExtraWhitespace) {
                    if (preserveNewlines) {
                        // 保留换行符但清理其他空白
                        cleanedText = cleanedText.replace(/[ \t]+/g, ' ')
                                                   .replace(/[\r\f\v]+/g, '')
                                                   .replace(/^[ \t]+|[ \t]+$/gm, '');
                    } else {
                        // 清理所有多余的空白
                        cleanedText = cleanedText.replace(/\s+/g, ' ');
                    }
                }

                // 处理空格
                if (!preserveSpaces) {
                    cleanedText = cleanedText.trim();
                }

                // 移除不可见字符
                cleanedText = cleanedText.replace(/[\u200B-\u200D\uFEFF]/g, '');

                log(LOG_LEVEL.DEBUG, `[TextExtractor] 文本清理完成，原始长度: ${text.length}, 清理后长度: ${cleanedText.length}`);
                return cleanedText;
            } catch (error) {
                ErrorHandler.handle(error, '[TextExtractor] 清理文本时出错', text, LOG_LEVEL.WARN);
                return text;
            }
        },

        // 提取多个元素的文本内容
        extractTexts: function(elements, options = {}) {
            if (!elements || !elements.length) {
                log(LOG_LEVEL.DEBUG, '[TextExtractor] 元素数组为空');
                return [];
            }

            const texts = [];
            for (let i = 0; i < elements.length; i++) {
                const text = this.extractText(elements[i], options);
                if (text) {
                    texts.push(text);
                }
            }

            log(LOG_LEVEL.DEBUG, `[TextExtractor] 成功提取 ${texts.length} 个文本内容`);
            return texts;
        },

        // 从元素中提取结构化文本信息
        extractStructuredText: function(element, options = {}) {
            if (!element) {
                log(LOG_LEVEL.DEBUG, '[TextExtractor] 元素为空');
                return null;
            }

            const {
                includeAttributes = false,
                includeChildren = true,
                maxDepth = 3
            } = options;

            try {
                const result = {
                    text: this.extractText(element, options),
                    length: element.textContent ? element.textContent.length : 0
                };

                // 包含属性信息
                if (includeAttributes && element.attributes) {
                    result.attributes = {};
                    for (let i = 0; i < element.attributes.length; i++) {
                        const attr = element.attributes[i];
                        result.attributes[attr.name] = attr.value;
                    }
                }

                // 包含子元素文本
                if (includeChildren && maxDepth > 0 && element.children) {
                    result.children = [];
                    for (let i = 0; i < element.children.length; i++) {
                        const child = element.children[i];
                        if (child.textContent && child.textContent.trim()) {
                            result.children.push({
                                text: this.extractText(child, options),
                                tag: child.tagName ? child.tagName.toLowerCase() : 'unknown',
                                length: child.textContent.length
                            });
                        }
                    }
                }

                log(LOG_LEVEL.DEBUG, '[TextExtractor] 结构化文本提取完成');
                return result;
            } catch (error) {
                ErrorHandler.handle(error, '[TextExtractor] 结构化文本提取时出错', null, LOG_LEVEL.WARN);
                return null;
            }
        }
    };

    // Unified Error Handler Utility Functions
    const ErrorHandler = {
        // 降级策略配置
        degradationStrategies: {
            // 默认降级策略
            default: {
                maxRetries: 3,
                timeout: 5000,
                fallbackValue: null,
                logLevel: LOG_LEVEL.WARN
            },

            // DOM操作降级策略
            dom: {
                maxRetries: 2,
                timeout: 3000,
                fallbackValue: null,
                logLevel: LOG_LEVEL.WARN,
                // 降级方法列表
                fallbackMethods: [
                    'querySelector',
                    'querySelectorAll',
                    'getElementById',
                    'getElementsByClassName'
                ]
            },

            // 网络请求降级策略
            network: {
                maxRetries: 3,
                timeout: 10000,
                fallbackValue: null,
                logLevel: LOG_LEVEL.WARN,
                // 降级方法列表
                fallbackMethods: [
                    'fetch',
                    'XMLHttpRequest',
                    'localStorage'
                ]
            },

            // 文本提取降级策略
            textExtraction: {
                maxRetries: 1,
                timeout: 2000,
                fallbackValue: '',
                logLevel: LOG_LEVEL.WARN,
                // 降级方法列表
                fallbackMethods: [
                    'textContent',
                    'innerText',
                    'nodeValue'
                ]
            }
        },
        // Handle errors with consistent logging and optional fallback
        handle: function(error, context, fallbackValue = null, logLevel = LOG_LEVEL.WARN, strategyType = 'default') {
            log(logLevel, `${context}:`, error);

            // Log additional error details if available
            if (error && error.stack) {
                log(LOG_LEVEL.DEBUG, `${context} - 错误堆栈:`, error.stack);
            }

            // 记录错误统计
            this.recordError(context, error);

            // 应用降级策略
            const strategy = this.degradationStrategies[strategyType] || this.degradationStrategies.default;
            if (strategy.fallbackValue !== undefined) {
                return strategy.fallbackValue;
            }

            return fallbackValue;
        },

        // Handle async errors with consistent logging and optional fallback
        handleAsync: async function(asyncFunction, context, fallbackValue = null, logLevel = LOG_LEVEL.WARN, strategyType = 'default') {
            try {
                return await asyncFunction();
            } catch (error) {
                return this.handle(error, context, fallbackValue, logLevel, strategyType);
            }
        },

        // Handle errors that should be re-thrown
        handleAndRethrow: function(error, context, strategyType = 'default') {
            log(LOG_LEVEL.ERROR, `${context}:`, error);

            // Log additional error details if available
            if (error && error.stack) {
                log(LOG_LEVEL.DEBUG, `${context} - 错误堆栈:`, error.stack);
            }

            // 记录错误统计
            this.recordError(context, error);

            // 应用降级策略
            const strategy = this.degradationStrategies[strategyType] || this.degradationStrategies.default;
            if (strategy.logLevel === LOG_LEVEL.ERROR) {
                // 如果策略要求记录错误，则不抛出异常
                return strategy.fallbackValue !== undefined ? strategy.fallbackValue : null;
            }

            throw error;
        },

        // Handle DOM-related errors
        handleDOMError: function(error, context, fallbackValue = null) {
            return this.handle(error, `${context} (DOM操作错误)`, fallbackValue, LOG_LEVEL.WARN, 'dom');
        },

        // Handle network-related errors
        handleNetworkError: function(error, context, fallbackValue = null) {
            return this.handle(error, `${context} (网络错误)`, fallbackValue, LOG_LEVEL.WARN, 'network');
        },

        // Handle storage-related errors
        handleStorageError: function(error, context, fallbackValue = null) {
            return this.handle(error, `${context} (存储错误)`, fallbackValue, LOG_LEVEL.WARN, 'default');
        },

        // Handle text extraction errors
        handleTextExtractionError: function(error, context, fallbackValue = '') {
            return this.handle(error, `${context} (文本提取错误)`, fallbackValue, LOG_LEVEL.WARN, 'textExtraction');
        },

        // 降级策略管理器
        degradationManager: {
            // 检查是否应该应用降级策略
            shouldDegrade: function(context, errorCount) {
                // 基于错误统计决定是否降级
                const stats = ErrorHandler.getErrorStats();
                const key = Object.keys(stats).find(k => k.includes(context));
                if (key && stats[key].count > 5) {
                    return true;
                }
                return false;
            },

            // 获取降级后的替代方法
            getFallbackMethod: function(strategyType, methodName) {
                const strategy = ErrorHandler.degradationStrategies[strategyType];
                if (strategy && strategy.fallbackMethods) {
                    const index = strategy.fallbackMethods.indexOf(methodName);
                    if (index >= 0 && index < strategy.fallbackMethods.length - 1) {
                        return strategy.fallbackMethods[index + 1];
                    }
                }
                return null;
            },

            // 应用降级策略
            applyDegrade: function(context, strategyType = 'default') {
                const strategy = ErrorHandler.degradationStrategies[strategyType] || ErrorHandler.degradationStrategies.default;

                // 记录降级事件
                log(LOG_LEVEL.INFO, `[DegradationManager] 应用降级策略: ${context}`, {
                    strategyType: strategyType,
                    maxRetries: strategy.maxRetries,
                    timeout: strategy.timeout
                });

                return strategy;
            }
        },

        // 记录错误统计
        errorStats: {},

        recordError: function(context, error) {
            try {
                const errorType = error ? error.constructor.name : 'UnknownError';
                const key = `${context}::${errorType}`;

                if (!this.errorStats[key]) {
                    this.errorStats[key] = {
                        count: 0,
                        firstOccurrence: new Date(),
                        lastOccurrence: new Date(),
                        error: error
                    };
                }

                this.errorStats[key].count++;
                this.errorStats[key].lastOccurrence = new Date();

                // 如果错误发生频率过高，记录警告
                if (this.errorStats[key].count > 10) {
                    log(LOG_LEVEL.WARN, `[ErrorHandler] 错误发生频率过高: ${key}, 次数: ${this.errorStats[key].count}`);
                }
            } catch (statsError) {
                // 忽略统计记录错误，避免递归错误处理
                log(LOG_LEVEL.DEBUG, '[ErrorHandler] 记录错误统计时出错:', statsError);
            }
        },

        // 获取错误统计
        getErrorStats: function() {
            return this.errorStats;
        },

        // 重置错误统计
        resetErrorStats: function() {
            this.errorStats = {};
        },

        // 处理超时错误
        handleTimeoutError: function(context, timeoutMs = 5000, fallbackValue = null) {
            const error = new Error(`操作超时 (${timeoutMs}ms)`);
            return this.handle(error, `${context} (超时错误)`, fallbackValue, LOG_LEVEL.WARN);
        },

        // 处理验证错误
        handleValidationError: function(error, context, fallbackValue = null) {
            return this.handle(error, `${context} (验证错误)`, fallbackValue, LOG_LEVEL.WARN);
        },

        // 处理业务逻辑错误
        handleBusinessError: function(error, context, fallbackValue = null) {
            return this.handle(error, `${context} (业务错误)`, fallbackValue, LOG_LEVEL.WARN);
        },

        // 创建带有重试机制的处理函数
        withRetry: function(operation, context, maxRetries = 3, delayMs = 1000) {
            return async function(...args) {
                let lastError;

                for (let i = 0; i <= maxRetries; i++) {
                    try {
                        return await operation(...args);
                    } catch (error) {
                        lastError = error;

                        if (i < maxRetries) {
                            log(LOG_LEVEL.WARN, `${context} - 第${i + 1}次尝试失败，${delayMs}ms后重试:`, error);
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                        }
                    }
                }

                return ErrorHandler.handle(lastError, `${context} - 所有重试都失败`, null, LOG_LEVEL.ERROR);
            };
        },

        // 创建带有超时机制的处理函数
        withTimeout: function(operation, context, timeoutMs = 5000) {
            return async function(...args) {
                return new Promise((resolve, reject) => {
                    // 设置超时计时器
                    const timeoutId = setTimeout(() => {
                        const error = new Error(`${context} - 操作超时 (${timeoutMs}ms)`);
                        reject(error);
                    }, timeoutMs);

                    // 执行操作
                    operation(...args)
                        .then(result => {
                            clearTimeout(timeoutId);
                            resolve(result);
                        })
                        .catch(error => {
                            clearTimeout(timeoutId);
                            reject(error);
                        });
                }).catch(error => {
                    return ErrorHandler.handle(error, context, null, LOG_LEVEL.WARN);
                });
            };
        }
    };

    const COMPLETION_STORAGE_KEY = 'appen_completion_stats';

    let completionStats = {
        totalValidCompletions: 0,
        totalInvalidCompletions: 0,
        totalReworkCompletions: 0,
        totalTopicsCompleted: 0,
        totalReworkTopics: 0,
        totalQuestions: 0,
        reworkQuestions: 0,
        perPage: {}
    };

    // 全局变量
    let collectedData = {
        userId: null,
        taskId: null,
        topicId: null,
        topicUrl: null,
        startTime: Date.now(),
        elapsedTime: 0,
        topicNum: 0,
        totalValidCompletions: 0,
        pageCompletionCounts: {}
    };

    // 通知队列管理系统
    const notificationManager = {
        queue: [],  // 待显示的通知队列
        activeNotifications: [],  // 当前显示中的通知
        maxVisible: 3,  // 最多同时显示3个通知
        notificationHeight: 80,  // 每个通知的高度（像素），增加以适应多行文本
        spacing: 15,  // 通知之间的间距，增加以提供更好的视觉分离
        
        // 添加通知到队列
        add: function(message, type = 'info', duration = 5000) {
            const notification = {
                message,
                type,
                duration,
                id: Date.now() + Math.random(),
                element: null
            };
            this.queue.push(notification);
            this.processQueue();
        },
        
        // 处理队列中的通知
        processQueue: function() {
            while (this.queue.length > 0 && this.activeNotifications.length < this.maxVisible) {
                const notification = this.queue.shift();
                this.display(notification);
            }
        },
        
        // 显示通知
        display: function(notification) {
            const element = createSystemNotification(notification.message, notification.type, notification.duration);
            if (element) {
                notification.element = element;
                this.activeNotifications.push(notification);
                this.updatePositions();
                
                // 通知显示完毕后从活动列表移除
                setTimeout(() => {
                    const index = this.activeNotifications.indexOf(notification);
                    if (index > -1) {
                        this.activeNotifications.splice(index, 1);
                        this.updatePositions();
                    }
                    this.processQueue();
                }, notification.duration);
            } else {
                this.processQueue();
            }
        },
        
        // 更新所有通知的位置
        updatePositions: function() {
            let topOffset = 20;
            this.activeNotifications.forEach((notification) => {
                if (notification.element) {
                    notification.element.style.top = topOffset + 'px';
                    // 使用通知的实际高度而不是固定高度
                    const actualHeight = notification.element.offsetHeight || this.notificationHeight;
                    topOffset += actualHeight + this.spacing;
                }
            });
        }
    };

    // 用于跟踪上一个任务ID以检测任务变化
    let lastTaskId = null;
    // 用于跟踪上一个题目ID以检测标注页面变化
    let lastTopicId = null;

    let isCollectorActive = true;
    let lastPushTime = 0;

    // 添加用于缓存指定元素 ID 的变量
    let lastSpecifiedElementId = null;
    let currentPageUrl = null;
    let specifiedElementIdAsTopicId = null; // 用于存储指定元素 ID 作为题目 ID

    // 从缓存获取任务开始时间
    async function getCachedStartTime() {
        try {
            const result = await ChromeStorage.get(['appen_task_start_time']);
            if (result && result.appen_task_start_time) {
                log(LOG_LEVEL.DEBUG, '从缓存读取任务开始时间');
                return result.appen_task_start_time;
            }
            return null;
        } catch (error) {
            return ErrorHandler.handleStorageError(error, '从缓存获取开始时间失败', null);
        }
    }

    // 保存任务开始时间到缓存
    async function saveCachedStartTime(startTime) {
        try {
            const result = await ChromeStorage.set({ appen_task_start_time: startTime });
            if (result) {
                log(LOG_LEVEL.DEBUG, '任务开始时间已保存:', startTime);
                return true;
            }
            return false;
        } catch (error) {
            return ErrorHandler.handleStorageError(error, '保存开始时间异常', false);
        }
    }

    // 清除缓存的开始时间
    async function clearCachedStartTime() {
        try {
            const result = await ChromeStorage.remove(['appen_task_start_time']);
            if (result) {
                log(LOG_LEVEL.DEBUG, '任务开始时间已清除');
                return true;
            }
            return false;
        } catch (error) {
            return ErrorHandler.handleStorageError(error, '清除开始时间失败', false);
        }
    }

    function syncCollectedDataWithCompletionStats() {
        collectedData.totalValidCompletions = completionStats.totalValidCompletions || 0;
        collectedData.totalInvalidCompletions = completionStats.totalInvalidCompletions || 0;
        collectedData.totalReworkCompletions = completionStats.totalReworkCompletions || 0;
        collectedData.totalTopicsCompleted = completionStats.totalTopicsCompleted || 0;
        collectedData.totalReworkTopics = completionStats.totalReworkTopics || 0;
        collectedData.totalQuestions = completionStats.totalQuestions || 0;
        collectedData.reworkQuestions = completionStats.reworkQuestions || 0;
        collectedData.pageCompletionCounts = { ...completionStats.perPage };
    }

    // 清除标注完成统计
    async function clearCompletionStats() {
        completionStats = {
            totalValidCompletions: 0,
            totalInvalidCompletions: 0,
            totalReworkCompletions: 0,
            totalTopicsCompleted: 0,
            totalReworkTopics: 0,
            totalQuestions: 0,
            reworkQuestions: 0,
            perPage: {}
        };

        syncCollectedDataWithCompletionStats();

        if (!ChromeStorage.isAvailable()) {
            return false;
        }

        try {
            const result = await ChromeStorage.remove([COMPLETION_STORAGE_KEY]);
            if (result) {
                log(LOG_LEVEL.DEBUG, '标注完成统计已清除');
                return true;
            }
            return false;
        } catch (error) {
            return ErrorHandler.handleStorageError(error, '清除标注完成统计异常', false);
        }
    }

    async function loadCompletionStats() {
        if (!ChromeStorage.isAvailable()) {
            syncCollectedDataWithCompletionStats();
            return Promise.resolve(false);
        }

        try {
            const result = await ChromeStorage.get([COMPLETION_STORAGE_KEY]);
            if (result && result[COMPLETION_STORAGE_KEY]) {
                const stored = result[COMPLETION_STORAGE_KEY];
                if (stored && typeof stored === 'object') {
                    completionStats = {
                        totalValidCompletions: Number(stored.totalValidCompletions) || 0,
                        totalInvalidCompletions: Number(stored.totalInvalidCompletions) || 0,
                        totalReworkCompletions: Number(stored.totalReworkCompletions) || 0,
                        totalTopicsCompleted: Number(stored.totalTopicsCompleted) || 0,
                        totalReworkTopics: Number(stored.totalReworkTopics) || 0,
                        totalQuestions: Number(stored.totalQuestions) || 0,
                        reworkQuestions: Number(stored.reworkQuestions) || 0,
                        perPage: stored.perPage && typeof stored.perPage === 'object' ? stored.perPage : {}
                    };

                    // 迁移旧格式的perPage数据
                    for (const [pageKey, pageData] of Object.entries(completionStats.perPage)) {
                        if (typeof pageData === 'object' && pageData !== null) {
                            // 检查是否是旧格式（只有completions和topicCount）
                            if (pageData.completions !== undefined && pageData.topicCount !== undefined &&
                                pageData.topicId === undefined) {
                                // 迁移到新格式
                                completionStats.perPage[pageKey] = {
                                    completions: Number(pageData.completions) || 0,
                                    topicId: 'unknown_topic', // 旧数据没有topicId
                                    topicCount: Number(pageData.topicCount) || 0,
                                    elapsedSeconds: 0, // 旧数据没有耗时信息
                                    isValid: true, // 假设旧的完成记录都是有效的
                                    hasRework: false, // 旧数据没有返修信息
                                    isSecondaryRework: false, // 旧数据没有二次返修标记
                                    rejectReason: '', // 旧数据没有驳回理由
                                    firstCompletionTime: Date.now(), // 旧数据没有时间戳
                                    lastCompletionTime: Date.now()
                                };
                            } else if (pageData.hasRework === undefined) {
                                // 确保所有页面数据都有hasRework字段
                                pageData.hasRework = false;
                            }

                            // 确保所有页面数据都有rejectReason字段
                            if (pageData.rejectReason === undefined) {
                                pageData.rejectReason = '';
                            }

                            // 确保所有页面数据都有isSecondaryRework字段
                            if (pageData.isSecondaryRework === undefined) {
                                pageData.isSecondaryRework = false;
                            }
                        }
                    }
                }
            }

            // 更新总题目数
            updateTotalQuestions();

            syncCollectedDataWithCompletionStats();
            return true;
        } catch (error) {
            syncCollectedDataWithCompletionStats();
            return ErrorHandler.handleStorageError(error, '加载标注完成统计异常', false);
        }
    }

    async function saveCompletionStats() {
        syncCollectedDataWithCompletionStats();

        if (!ChromeStorage.isAvailable()) {
            return false;
        }

        try {
            const result = await ChromeStorage.set({ [COMPLETION_STORAGE_KEY]: completionStats });
            return result;
        } catch (error) {
            return ErrorHandler.handleStorageError(error, '保存标注完成统计异常', false);
        }
    }

    function getCurrentPageKey() {
        if (collectedData.topicId && collectedData.topicId !== 'unknown_topic') {
            return `${collectedData.taskId || 'unknown_task'}::${collectedData.topicId}`;
        }
        return collectedData.topicUrl || window.location.href || 'unknown_page';
    }

    function getTopicCountForRecording() {
        const topicCount = collectedData.responseElements?.userSelectionStatus?.topicCount || collectedData.responseElements?.userSelectionStatus?.editRounds || collectedData.topicNum || 0;
        log(LOG_LEVEL.DEBUG, '获取题目数量:', {
            topicCountFromResponse: collectedData.responseElements?.userSelectionStatus?.topicCount,
            editRoundsFromResponse: collectedData.responseElements?.userSelectionStatus?.editRounds,
            topicNum: collectedData.topicNum,
            finalTopicCount: topicCount
        });
        return topicCount;
    }

    async function recordValidCompletion() {
        try {
            const pageKey = getCurrentPageKey();
            log(LOG_LEVEL.DEBUG, '记录有效完成 - 页面标识:', pageKey);
            const topicCount = getTopicCountForRecording();
            const currentTime = Date.now();
            const elapsedSeconds = Math.floor((currentTime - collectedData.startTime) / 1000);

            // 检查是否有驳回信息（返修页面）
            const hasRework = !!(collectedData.responseElements?.qualityCheckRecord?.hasRecord &&
                               collectedData.responseElements?.qualityCheckRecord?.latestRecord?.type === 'REJECTED');

            // 获取当前页面的驳回理由（如果有的话）
            const pageRejectReason = hasRework && collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment
                ? collectedData.responseElements.qualityCheckRecord.latestRecord.comment
                : '';

            // 检查是否是二次返修（之前已经完成过且有返修记录）
            const isSecondaryRework = hasRework &&
                completionStats.perPage[pageKey] &&
                completionStats.perPage[pageKey].hasRework === true;

            if (!completionStats.perPage[pageKey]) {
                completionStats.perPage[pageKey] = {
                    completions: 0,
                    topicId: collectedData.topicId || 'unknown_topic',
                    topicCount: topicCount,
                    elapsedSeconds: elapsedSeconds,
                    isValid: true,
                    hasRework: hasRework,
                    isSecondaryRework: isSecondaryRework,
                    rejectReason: pageRejectReason,
                    firstCompletionTime: currentTime,
                    lastCompletionTime: currentTime
                };
            }

            completionStats.perPage[pageKey].completions += 1;
            completionStats.perPage[pageKey].topicCount = topicCount;
            completionStats.perPage[pageKey].elapsedSeconds = elapsedSeconds;
            completionStats.perPage[pageKey].lastCompletionTime = currentTime;
            completionStats.perPage[pageKey].hasRework = hasRework;
            completionStats.perPage[pageKey].isSecondaryRework = isSecondaryRework;
            completionStats.perPage[pageKey].rejectReason = pageRejectReason;

            // 如果是返修页面，记录到返修统计中；否则记录到常规统计中
            if (hasRework) {
                completionStats.totalReworkCompletions += 1;
                // 返修页面不计入常规有效完成次数和题目总数
            } else {
                completionStats.totalValidCompletions += 1;
                completionStats.totalTopicsCompleted += topicCount;
            }

            // 更新总题目数
            updateTotalQuestions();

            syncCollectedDataWithCompletionStats();

            await saveCompletionStats();

            log(LOG_LEVEL.DEBUG, '已记录有效标注完成:', {
                pageKey,
                totalValidCompletions: completionStats.totalValidCompletions,
                totalReworkCompletions: completionStats.totalReworkCompletions,
                totalTopicsCompleted: completionStats.totalTopicsCompleted,
                perPage: completionStats.perPage[pageKey]
            });
        } catch (error) {
            ErrorHandler.handle(error, '记录标注完成统计异常', null, LOG_LEVEL.WARN);
        }
    }

    // 记录无效页面完成
    async function recordInvalidCompletion() {
        try {
            const pageKey = getCurrentPageKey();
            log(LOG_LEVEL.DEBUG, '记录无效完成 - 页面标识:', pageKey);
            const topicCount = getTopicCountForRecording();
            const currentTime = Date.now();
            const elapsedSeconds = Math.floor((currentTime - collectedData.startTime) / 1000);

            // 检查是否有驳回信息（返修页面）
            const hasRework = !!(collectedData.responseElements?.qualityCheckRecord?.hasRecord &&
                               collectedData.responseElements?.qualityCheckRecord?.latestRecord?.type === 'REJECTED');

            // 获取当前页面的驳回理由（如果有的话）
            const pageRejectReason = hasRework && collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment
                ? collectedData.responseElements.qualityCheckRecord.latestRecord.comment
                : '';

            // 检查是否是二次返修（之前已经完成过且有返修记录）
            const isSecondaryRework = hasRework &&
                completionStats.perPage[pageKey] &&
                completionStats.perPage[pageKey].hasRework === true;

            if (!completionStats.perPage[pageKey]) {
                completionStats.perPage[pageKey] = {
                    completions: 0,
                    topicId: collectedData.topicId || 'unknown_topic',
                    topicCount: topicCount,
                    elapsedSeconds: elapsedSeconds,
                    isValid: false,
                    hasRework: hasRework,
                    isSecondaryRework: isSecondaryRework,
                    rejectReason: pageRejectReason,
                    firstCompletionTime: currentTime,
                    lastCompletionTime: currentTime
                };
            }

            // 如果页面之前被标记为有效，需要调整计数器
            if (completionStats.perPage[pageKey].isValid === true) {
                if (completionStats.perPage[pageKey].hasRework) {
                    // 如果之前是返修页面，从返修统计中减去
                    completionStats.totalReworkCompletions = Math.max(0, completionStats.totalReworkCompletions - 1);
                } else {
                    // 如果之前是常规页面，从常规统计中减去
                    completionStats.totalValidCompletions = Math.max(0, completionStats.totalValidCompletions - 1);
                    completionStats.totalTopicsCompleted = Math.max(0, completionStats.totalTopicsCompleted - completionStats.perPage[pageKey].topicCount);
                }
            }

            completionStats.perPage[pageKey].completions += 1;
            completionStats.perPage[pageKey].topicCount = topicCount;
            completionStats.perPage[pageKey].elapsedSeconds = elapsedSeconds;
            completionStats.perPage[pageKey].lastCompletionTime = currentTime;
            completionStats.perPage[pageKey].isValid = false;
            completionStats.perPage[pageKey].hasRework = hasRework;

            // 只有当页面之前不是无效状态时才增加计数器
            if (completionStats.perPage[pageKey].isValid !== false || completionStats.perPage[pageKey].completions === 1) {
                // 根据是否是返修页面来决定增加哪个计数器
                if (hasRework) {
                    completionStats.totalReworkCompletions += 1;
                    // 返修页面不计入常规无效完成次数
                } else {
                    completionStats.totalInvalidCompletions += 1;
                }
            }

            // 更新总题目数
            updateTotalQuestions();

            syncCollectedDataWithCompletionStats();

            await saveCompletionStats();

            log(LOG_LEVEL.DEBUG, '已记录无效标注完成:', {
                pageKey,
                totalInvalidCompletions: completionStats.totalInvalidCompletions,
                totalReworkCompletions: completionStats.totalReworkCompletions,
                perPage: completionStats.perPage[pageKey]
            });
        } catch (error) {
            ErrorHandler.handle(error, '记录无效标注完成统计异常', null, LOG_LEVEL.WARN);
        }
    }

    // 检查页面是否有返修信息（驳回信息）
    function isReworkPage(pageData) {
        // 检查页面数据中是否有返修标记
        if (pageData && typeof pageData === 'object' && pageData.hasRework !== undefined) {
            return pageData.hasRework === true;
        }

        // 如果没有明确标记，返回false（默认不是返修页面）
        return false;
    }

    // 存储当前页面的驳回状态，避免同一页内状态变化
    let currentPageRejectedStatus = null;
    let currentPageKey = null;

    // 通过HTML元素定位检测QA驳回状态
    function detectRejectByHtmlElement() {
        try {
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 开始通过HTML元素定位检测QA驳回状态');

            // 使用精确的CSS选择器定位QA驳回元素
            // 目标HTML结构: <div class="flex flex-row justify-between items-center h-10 px-4" style="background-color:#fff;color:#0F121A">被 QA1 Rejected 请修订<span>...</span></div>
            const rejectDivs = document.querySelectorAll('div.flex.flex-row.justify-between.items-center.h-10.px-4');

            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 找到可能的QA驳回div元素数量:', rejectDivs.length);

            for (let i = 0; i < rejectDivs.length; i++) {
                const div = rejectDivs[i];

                // 验证元素的样式
                const computedStyle = window.getComputedStyle(div);
                const bgColor = computedStyle.backgroundColor;
                const color = computedStyle.color;

                log(LOG_LEVEL.DEBUG, `[Appen Data Collector] div ${i} 样式 - 背景色: ${bgColor}, 文字颜色: ${color}`);

                // 检查是否具有预期的样式
                const hasExpectedStyling = bgColor.includes('255, 255, 255') || bgColor === 'rgb(255, 255, 255)' || bgColor.includes('#fff');
                const hasExpectedTextColor = color.includes('15, 18, 26') || color === 'rgb(15, 18, 26)' || color.includes('#0F121A');

                // 检查元素文本内容
                const divText = (div.innerText || div.textContent || '').trim();
                const hasRejectText = divText.includes('被 QA1 Rejected 请修订');

                log(LOG_LEVEL.DEBUG, `[Appen Data Collector] div ${i} 检查结果 - 样式匹配: ${hasExpectedStyling && hasExpectedTextColor}, 文本匹配: ${hasRejectText}`);
                log(LOG_LEVEL.DEBUG, `[Appen Data Collector] div ${i} 文本内容: ${divText.substring(0, 100)}`);

                // 如果元素具有预期的样式和文本内容，则确认为QA驳回
                if ((hasExpectedStyling && hasExpectedTextColor) && hasRejectText) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过HTML元素定位检测到QA驳回状态');
                    log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 匹配的div元素:', div);
                    return true;
                }
            }

            // 如果没有找到匹配的元素，尝试更宽松的匹配
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 尝试宽松匹配...');

            // 查找包含特定类名和文本的元素
            const potentialRejectElements = document.querySelectorAll('div[class*="flex"][class*="row"][class*="justify-between"]');

            for (let i = 0; i < potentialRejectElements.length; i++) {
                const element = potentialRejectElements[i];
                const elementText = (element.innerText || element.textContent || '').trim();

                if (elementText.includes('被 QA1 Rejected 请修订')) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过宽松匹配检测到QA驳回状态');
                    log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 宽松匹配的元素文本:', elementText.substring(0, 100));
                    return true;
                }
            }

            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 未通过HTML元素定位检测到QA驳回状态');
            return false;
        } catch (error) {
            log(LOG_LEVEL.WARN, '[Appen Data Collector] HTML元素定位检测QA驳回状态时出错:', error);
            return false;
        }
    }

    // 检查当前页面是否被QA驳回
    function isCurrentPageRejected() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始检查当前页面是否被QA驳回');

            // 强制调试输出，确保函数被调用
            console.log('[Appen-新旧题] [强制调试] isCurrentPageRejected函数被调用');

            // 获取当前页面键值
            const currentKey = getCurrentPageKey();
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 当前页面键值:', currentKey);
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 之前记录的页面键值:', currentPageKey);
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 之前记录的驳回状态:', currentPageRejectedStatus);

            // 如果是新页面，重置状态缓存
            if (currentKey !== currentPageKey) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到新页面，重置驳回状态缓存');
                console.log('[Appen-新旧题] [调试] 检测到新页面，重置驳回状态缓存');
                currentPageRejectedStatus = null;
                currentPageKey = currentKey;
            }

            // 如果之前已经检测到驳回状态，直接返回true（状态锁定）
            if (currentPageRejectedStatus === true) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 状态已锁定为驳回，直接返回true');
                console.log('[Appen-新旧题] [调试] 状态已锁定为驳回，直接返回true');
                return true;
            }

            // 首先尝试通过HTML元素定位检测QA驳回状态（最高优先级）
            const isRejectedByHtml = detectRejectByHtmlElement();
            if (isRejectedByHtml) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过HTML元素定位检测到QA驳回状态');
                console.log('[Appen-新旧题] [调试] 通过HTML元素定位检测到QA驳回状态');
                currentPageRejectedStatus = true;
                return true;
            }

            // 检查页面文本中是否包含QA驳回信息
            const pageText = document.body.innerText;
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 页面文本总长度:', pageText.length);
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 当前时间戳:', new Date().toISOString());

            // 简化日志输出，只显示关键信息
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 页面是否包含QA驳回信息:');
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 包含"被 QA1 Rejected 请修订":', pageText.includes("被 QA1 Rejected 请修订"));
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 包含"被 QA":', pageText.includes("被 QA"));
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 包含"Rejected":', pageText.includes("Rejected"));
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 包含"请修订":', pageText.includes("请修订"));

            console.log('[Appen-新旧题] [调试] 页面文本总长度:', pageText.length);
            console.log('[Appen-新旧题] [调试] 当前时间戳:', new Date().toISOString());

            // 简化日志输出，只显示关键信息
            console.log('[Appen-新旧题] [调试] 页面是否包含QA驳回信息:');
            console.log('[Appen-新旧题] [调试] 包含"被 QA1 Rejected 请修订":', pageText.includes("被 QA1 Rejected 请修订"));
            console.log('[Appen-新旧题] [调试] 包含"被 QA":', pageText.includes("被 QA"));
            console.log('[Appen-新旧题] [调试] 包含"Rejected":', pageText.includes("Rejected"));
            console.log('[Appen-新旧题] [调试] 包含"请修订":', pageText.includes("请修订"));

            // 检查实际的QA驳回格式
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 包含"被QA1 Rejected，请修订":', pageText.includes("被QA1 Rejected，请修订"));
            console.log('[Appen-新旧题] [调试] 包含"被QA1 Rejected，请修订":', pageText.includes("被QA1 Rejected，请修订"));

            // 显示包含这些关键词的上下文
            const lines = pageText.split('\n');
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 页面总行数:', lines.length);
            console.log('[Appen-新旧题] [调试] 页面总行数:', lines.length);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('QA') && line.includes('Rejected')) {
                    log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 找到QA驳回相关行:', line.trim());
                    console.log('[Appen-新旧题] [调试] 找到QA驳回相关行:', line.trim());
                }
            }

            // 特别检查包含"被 QA1 Rejected 请修订"的行
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('被 QA1 Rejected 请修订')) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 精确匹配到QA1驳回行:', line.trim());
                    console.log('[Appen-新旧题] [调试] 精确匹配到QA1驳回行:', line.trim());
                    console.log('[Appen-新旧题] [调试] 精确匹配找到QA1驳回信息');
                    currentPageRejectedStatus = true;
                    return true;
                }
            }

            // 检查实际的QA驳回格式
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('被QA1 Rejected，请修订')) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 精确匹配到实际QA1驳回行:', line.trim());
                    console.log('[Appen-新旧题] [调试] 精确匹配到实际QA1驳回行:', line.trim());
                    console.log('[Appen-新旧题] [调试] 精确匹配找到实际QA1驳回信息');
                    currentPageRejectedStatus = true;
                    return true;
                }
            }

            if (pageText.includes("被 QA1 Rejected 请修订")) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 找到QA1驳回信息');
                console.log('[Appen-新旧题] [调试] 找到QA1驳回信息');
                currentPageRejectedStatus = true;
                return true; // 找到QA1驳回信息
            }

            // 检查实际的QA驳回格式
            if (pageText.includes("被QA1 Rejected，请修订")) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 找到实际QA1驳回信息');
                console.log('[Appen-新旧题] [调试] 找到实际QA1驳回信息');
                currentPageRejectedStatus = true;
                return true; // 找到实际QA1驳回信息
            }

            // 检查其他可能的QA驳回模式
            if (pageText.includes("被 QA") && pageText.includes("Rejected") && pageText.includes("请修订")) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 找到其他QA驳回信息');
                console.log('[Appen-新旧题] [调试] 找到其他QA驳回信息');
                currentPageRejectedStatus = true;
                return true; // 找到其他QA的驳回信息
            }

            // 检查实际的QA驳回模式
            if (pageText.includes("被QA") && pageText.includes("Rejected") && pageText.includes("请修订")) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 找到其他实际QA驳回信息');
                console.log('[Appen-新旧题] [调试] 找到其他实际QA驳回信息');
                currentPageRejectedStatus = true;
                return true; // 找到其他实际QA的驳回信息
            }

            // 检查多种可能的JavaScript变量名
            const possibleDataVars = [
                'window.__INITIAL_DATA__',
                'window.INITIAL_DATA',
                'window.initialData',
                'window.appenData',
                'window.taskData'
            ];

            for (const varName of possibleDataVars) {
                try {
                    const varValue = eval(varName);
                    if (varValue) {
                        log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 找到变量 ${varName}:`, typeof varValue);
                        console.log(`[Appen-新旧题] [调试] 找到变量 ${varName}:`, typeof varValue);
                        // 检查任务类型
                        if (varValue.taskMessage && varValue.taskMessage.taskType === "REWORK") {
                            log(LOG_LEVEL.INFO, `[Appen Data Collector] 任务在${varName}中被标记为返修`);
                            console.log(`[Appen-新旧题] [调试] 任务在${varName}中被标记为返修`);
                            currentPageRejectedStatus = true;
                            return true;
                        }
                        if (varValue.taskType === "REWORK") {
                            log(LOG_LEVEL.INFO, `[Appen Data Collector] 任务在${varName}中被标记为返修`);
                            console.log(`[Appen-新旧题] [调试] 任务在${varName}中被标记为返修`);
                            currentPageRejectedStatus = true;
                            return true;
                        }
                    }
                } catch (e) {
                    // 变量不存在，继续检查下一个
                }
            }

            // 检查页面上的特定元素
            const rejectElements = document.querySelectorAll('[class*="reject"], [class*="Reject"], [class*="驳回"]');
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 找到可能的驳回相关元素数量:', rejectElements.length);
            console.log('[Appen-新旧题] [调试] 找到可能的驳回相关元素数量:', rejectElements.length);

            for (let i = 0; i < Math.min(rejectElements.length, 5); i++) {
                const elementText = (rejectElements[i].innerText || rejectElements[i].textContent || '').trim();
                if (elementText.length > 0) {
                    log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 驳回相关元素 ${i}:`, elementText.substring(0, 100));
                    console.log(`[Appen-新旧题] [调试] 驳回相关元素 ${i}:`, elementText.substring(0, 100));
                    // 检查元素文本中是否包含驳回信息
                    if (elementText.includes("被 QA") && elementText.includes("Rejected") && elementText.includes("请修订")) {
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 在元素中找到QA驳回信息');
                        console.log('[Appen-新旧题] [调试] 在元素中找到QA驳回信息');
                        currentPageRejectedStatus = true;
                        return true;
                    }
                    if (elementText.includes("被QA") && elementText.includes("Rejected") && elementText.includes("请修订")) {
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 在元素中找到实际QA驳回信息');
                        console.log('[Appen-新旧题] [调试] 在元素中找到实际QA驳回信息');
                        currentPageRejectedStatus = true;
                        return true;
                    }
                }
            }

            log(LOG_LEVEL.INFO, '[Appen Data Collector] 没有检测到QA驳回信息');
            console.log('[Appen-新旧题] [调试] 没有检测到QA驳回信息');
            // 只有在之前没有检测到驳回状态时才设置为false
            if (currentPageRejectedStatus === null) {
                currentPageRejectedStatus = false;
            }
            return currentPageRejectedStatus;
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 检查页面驳回状态时出错:', error);
            console.log('[Appen-新旧题] [调试] 检查页面驳回状态时出错:', error.message);
            // 发生错误时保持之前的状态
            return currentPageRejectedStatus === true;
        }
    }

    // 检测页面是否具有有效状态
    function hasValidStatus() {
        try {
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 开始检测页面是否具有有效状态');

            // 查找包含"是否有效"文本的标签元素
            const labels = document.querySelectorAll('label');
            let validityLabel = null;
            for (const label of labels) {
                if (label.textContent.includes('是否有效')) {
                    validityLabel = label;
                    break;
                }
            }

            if (!validityLabel) {
                log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 未找到"是否有效"标签');
                return false;
            }

            // 查找选中的"有效"单选按钮
            // 首先尝试直接查找被选中的单选按钮
            let validRadio = document.querySelector('input[type="radio"][value="有效"]:checked');
            if (validRadio) {
                log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 找到选中的"有效"单选按钮');
                return true;
            }

            // 如果没有找到，尝试在"是否有效"标签附近查找
            const radioContainer = validityLabel.closest('div, span, p') || validityLabel.parentElement;
            if (radioContainer) {
                const radios = radioContainer.querySelectorAll('input[type="radio"]');
                for (const radio of radios) {
                    if (radio.checked && radio.value === '有效') {
                        log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 在标签附近找到选中的"有效"单选按钮');
                        return true;
                    }
                }
            }

            // 检查页面上所有单选按钮，看是否有"有效"选项被选中
            const allRadios = document.querySelectorAll('input[type="radio"]');
            for (const radio of allRadios) {
                // 检查单选按钮的值是否为"有效"且被选中
                if (radio.value === '有效' && radio.checked) {
                    log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 找到选中的"有效"单选按钮（全局搜索）');
                    return true;
                }

                // 检查单选按钮旁边的文本是否包含"有效"且被选中
                const nextElement = radio.nextElementSibling;
                if (nextElement && nextElement.textContent.includes('有效') && radio.checked) {
                    log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 找到选中的"有效"单选按钮（通过相邻文本）');
                    return true;
                }
            }

            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 未找到选中的"有效"单选按钮');
            return false;
        } catch (error) {
            log(LOG_LEVEL.WARN, '[Appen Data Collector] 检测有效状态时出错:', error);
            return false;
        }
    }

    // 检测页面的编辑轮数
    function getEditRoundCount() {
        try {
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 开始检测页面的编辑轮数');

            // 查找包含"判断编辑轮数"文本的标签元素
            const labels = document.querySelectorAll('label');
            let editRoundLabel = null;
            for (const label of labels) {
                if (label.textContent.includes('判断编辑轮数')) {
                    editRoundLabel = label;
                    break;
                }
            }

            if (!editRoundLabel) {
                log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 未找到"判断编辑轮数"标签');
                return 0;
            }

            // 查找选中的编辑轮数单选按钮
            // 首先尝试在"判断编辑轮数"标签附近查找
            const radioContainer = editRoundLabel.closest('div, span, p') || editRoundLabel.parentElement;
            if (radioContainer) {
                const radios = radioContainer.querySelectorAll('input[type="radio"]');
                for (const radio of radios) {
                    if (radio.checked) {
                        // 查找单选按钮旁边的文本以确定轮数
                        const nextElement = radio.nextElementSibling;
                        if (nextElement) {
                            const match = nextElement.textContent.match(/(\d+)轮/);
                            if (match) {
                                const roundCount = parseInt(match[1]);
                                log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 找到选中的编辑轮数:', roundCount);
                                return roundCount;
                            }
                        }
                    }
                }
            }

            // 检查页面上所有单选按钮，看是否有包含轮数的选项被选中
            const allRadios = document.querySelectorAll('input[type="radio"]');
            for (const radio of allRadios) {
                if (radio.checked) {
                    // 查找单选按钮旁边的文本以确定轮数
                    const nextElement = radio.nextElementSibling;
                    if (nextElement) {
                        const match = nextElement.textContent.match(/(\d+)轮/);
                        if (match) {
                            const roundCount = parseInt(match[1]);
                            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 找到选中的编辑轮数（全局搜索）:', roundCount);
                            return roundCount;
                        }
                    }
                }
            }

            // 如果没有找到明确选中的单选按钮，检查默认状态
            // 通常默认是"1轮"
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 未找到明确选中的编辑轮数，返回默认值1');
            return 1;
        } catch (error) {
            log(LOG_LEVEL.WARN, '[Appen Data Collector] 检测编辑轮数时出错:', error);
            return 0;
        }
    }

    // 获取页面的新旧题状态
    // 获取页面的新旧题状态
    function getPageNewOldStatus(pageData) {
        log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始获取页面的新旧题状态');
        log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 传入的pageData:', pageData);

        // 检查当前页面是否被QA驳回（最高优先级）
        const isRejected = isCurrentPageRejected();
        log(LOG_LEVEL.DEBUG, '[Appen Data Collector] isCurrentPageRejected返回值:', isRejected);

        if (isRejected) {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 当前页面被QA驳回，标记为旧题');
            return '旧'; // 当前页面显示QA驳回
        }

        // 检查是否具有有效状态且编辑轮数>=1（新增的判断条件）
        try {
            const isValidStatus = hasValidStatus();
            const editRoundCount = getEditRoundCount();

            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 有效状态检测结果:', isValidStatus);
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 编辑轮数检测结果:', editRoundCount);

            if (isValidStatus && editRoundCount >= 1) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 页面具有有效状态且编辑轮数>=1，标记为旧题');
                return '旧';
            }
        } catch (error) {
            log(LOG_LEVEL.WARN, '[Appen Data Collector] 检测新增条件时出错:', error);
        }

        // 如果没有当前驳回，且不满足新增条件，认为是新题
        log(LOG_LEVEL.INFO, '[Appen Data Collector] 当前页面未被QA驳回且不满足新增条件，标记为新题');
        return '新'; // 新题
    }
    // 获取当前页面的返修状态（新/旧）
    function getCurrentPageReworkStatus() {
        const pageKey = getCurrentPageKey();
        const pageData = completionStats.perPage[pageKey];
        return getPageNewOldStatus(pageData);
    }

    // 更新总题目数（排除返修页面）
    function updateTotalQuestions() {
        let regularTotal = 0;
        let reworkTotal = 0;

        for (const [pageKey, pageData] of Object.entries(completionStats.perPage)) {
            if (typeof pageData === 'object' && pageData !== null) {
                const topicCount = Number(pageData.topicCount) || 0;
                if (isReworkPage(pageData)) {
                    reworkTotal += topicCount;
                } else {
                    regularTotal += topicCount;
                }
            }
        }

        completionStats.totalQuestions = regularTotal;
        completionStats.reworkQuestions = reworkTotal;
    }

    // 更新返修题目数
    function updateReworkQuestions() {
        updateTotalQuestions(); // updateTotalQuestions已经处理了返修题目的计算
    }

    // 从缓存获取题目ID
    async function getCachedTopicId() {
        try {
            const result = await ChromeStorage.get(['appen_last_topic_id']);
            if (result && result.appen_last_topic_id) {
                log(LOG_LEVEL.DEBUG, '从缓存读取题目ID:', result.appen_last_topic_id);
                return result.appen_last_topic_id;
            }
            return null;
        } catch (error) {
            return ErrorHandler.handleStorageError(error, '从缓存获取题目ID失败', null);
        }
    }

    // 保存题目ID到缓存
    async function saveCachedTopicId(topicId) {
        try {
            const result = await ChromeStorage.set({ appen_last_topic_id: topicId });
            if (result) {
                log(LOG_LEVEL.DEBUG, '题目ID已保存到缓存:', topicId);
                return true;
            }
            return false;
        } catch (error) {
            return ErrorHandler.handleStorageError(error, '保存题目ID异常', false);
        }
    }

    // 从缓存获取用户ID
    async function getCachedUserId() {
        try {
            const result = await ChromeStorage.get(['appen_user_id']);
            if (result && result.appen_user_id) {
                log(LOG_LEVEL.DEBUG, '从缓存读取用户ID:', result.appen_user_id);
                return result.appen_user_id;
            }
            return null;
        } catch (error) {
            return ErrorHandler.handleStorageError(error, '从缓存获取用户ID失败', null);
        }
    }

    // 保存用户ID到缓存
    async function saveCachedUserId(userId) {
        try {
            const result = await ChromeStorage.set({ appen_user_id: userId });
            if (result) {
                log(LOG_LEVEL.DEBUG, '用户ID已保存到缓存:', userId);
                return true;
            }
            return false;
        } catch (error) {
            return ErrorHandler.handleStorageError(error, '保存用户ID异常', false);
        }
    }

    // 检查是否为欢迎页面（用于提取和保存用户ID）
    function isWelcomePage() {
        const currentUrl = window.location.href;
        return currentUrl.includes('ui.appen.com.cn/welcome');
    }

    // 初始化数据收集器
    async function initializeDataCollector() {
        log(LOG_LEVEL.DEBUG, '初始化即时数据收集器');

        await loadCompletionStats();

        // 显示测试提示，确认数据收集器已加载
        showTestNotification();

        // 检查是否为欢迎页面
        if (isWelcomePage()) {
            log(LOG_LEVEL.DEBUG, 'welcome页面，从页面提取用户ID并保存到缓存');
            waitForAccountElement();
        } else {
            // 其他页面，只从缓存读取用户ID
            log(LOG_LEVEL.DEBUG, '非welcome页面，从缓存读取用户ID');
            const cachedUserId = await getCachedUserId();
            if (cachedUserId) {
                log(LOG_LEVEL.DEBUG, '从缓存读取用户ID:', cachedUserId);
                collectedData.userId = cachedUserId;
            } else {
                log(LOG_LEVEL.DEBUG, '缓存中无用户ID');
                collectedData.userId = 'unknown_user';
            }
        }

        // 如果是标注页面，检查题目ID并初始化
        if (isTargetPage()) {
            log(LOG_LEVEL.DEBUG, '检测到目标页面，开始初始化');

            // 从缓存恢复上一个题目ID
            const cachedTopicId = await getCachedTopicId();
            log(LOG_LEVEL.DEBUG, '========== 初始化 - 从缓存恢复题目ID ==========');
            log(LOG_LEVEL.DEBUG, '缓存的题目ID:', cachedTopicId);
            if (cachedTopicId) {
                log(LOG_LEVEL.DEBUG, '从缓存恢复题目ID:', cachedTopicId);
                lastTopicId = cachedTopicId;
                log(LOG_LEVEL.DEBUG, 'lastTopicId 已设置为:', lastTopicId);
            } else {
                log(LOG_LEVEL.DEBUG, '缓存中无题目ID（首次加载或缓存已清除）');
            }

            // 获取当前题目ID
            setTimeout(async () => {
                const currentTopicId = getSpecifiedElementId(false);
                log(LOG_LEVEL.DEBUG, '========== 初始化 - 获取当前题目ID ==========');
                log(LOG_LEVEL.DEBUG, '获取当前题目ID:', currentTopicId);
                log(LOG_LEVEL.DEBUG, '上一个题目ID(lastTopicId):', lastTopicId);

                // 比较题目ID，判断是否进入新的标注页
                if (lastTopicId !== currentTopicId) {
                    log(LOG_LEVEL.DEBUG, '⚠️ 题目ID变化，进入新的标注页');
                    log(LOG_LEVEL.DEBUG, '旧ID:', lastTopicId, '新ID:', currentTopicId);
                    log(LOG_LEVEL.DEBUG, '比较结果: lastTopicId(' + lastTopicId + ') !== currentTopicId(' + currentTopicId + ')');

                    // 重置计时器
                    const newStartTime = Date.now();
                    collectedData.startTime = newStartTime;
                    log(LOG_LEVEL.DEBUG, '重置计时器，新的开始时间:', new Date(newStartTime).toISOString());

                    // 保存新的开始时间到缓存
                    await saveCachedStartTime(newStartTime);
                    log(LOG_LEVEL.DEBUG, '新的开始时间已保存到缓存');
                } else {
                    log(LOG_LEVEL.DEBUG, '✓ 题目ID相同，继续使用当前计时，从缓存读取开始时间');
                    log(LOG_LEVEL.DEBUG, '比较结果: lastTopicId(' + lastTopicId + ') === currentTopicId(' + currentTopicId + ')');
                    // 从缓存立即读取开始时间（使用await改为同步）
                    const cachedStartTime = await getCachedStartTime();
                    if (cachedStartTime) {
                        log(LOG_LEVEL.DEBUG, '从缓存恢复开始时间:', new Date(cachedStartTime).toISOString());
                        collectedData.startTime = cachedStartTime;
                        log(LOG_LEVEL.DEBUG, 'collectedData.startTime 已更新为缓存时间');
                    } else {
                        log(LOG_LEVEL.DEBUG, '缓存中无开始时间，记录当前时间');
                        // 缓存中没有开始时间，说明是第一次标注或缓存被清除，记录当前时间
                        const newStartTime = Date.now();
                        collectedData.startTime = newStartTime;
                        await saveCachedStartTime(newStartTime);
                        log(LOG_LEVEL.DEBUG, '已记录并保存当前开始时间:', new Date(newStartTime).toISOString());
                    }
                }

                // 更新lastTopicId为当前题目ID并保存到缓存
                lastTopicId = currentTopicId;
                if (currentTopicId && currentTopicId !== 'no-id') {
                    saveCachedTopicId(currentTopicId);
                    log(LOG_LEVEL.DEBUG, '已将当前题目ID保存到缓存:', currentTopicId);
                }
                log(LOG_LEVEL.DEBUG, '已更新lastTopicId:', lastTopicId);
                log(LOG_LEVEL.DEBUG, '========== 初始化完成 ==========');
            }, 1000); // 等待页面加载完成

            // 在目标页面上提取响应元素
            setTimeout(() => {
                extractResponseElements();
                // 附加用户选择状态监听器
                setTimeout(attachUserSelectionListeners, 500);
                
                // 关键修复：在初始化时调用handleAnnotationPage来显示系统提示
                setTimeout(() => {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 初始化完成后调用handleAnnotationPage');
                    console.log('[Appen Data Collector] 初始化: 调用handleAnnotationPage()');
                    handleAnnotationPage();
                }, 800); // 减少等待时间，更快响应
            }, 1000); // 减少等待时间，更快响应
        }

        // 获取任务信息
        collectTaskInfo();

        // 获取主题信息
        collectTopicInfo();

        // 开始监听页面活动
        attachEventListeners();

        // 页面卸载时推送数据（已禁用，改为手动推送）
        // window.addEventListener('beforeunload', pushDataOnSubmission);
    }

    // 收集用户信息（完全复制验证过的脚本逻辑）
    function collectUserInfo() {
        try {
            log(LOG_LEVEL.DEBUG, '开始收集用户信息...');

            // 找到账户元素
            const accountElement = ElementSelector.select([
                '.ant-dropdown-trigger.antd-pro-components-global-header-index-action.antd-pro-components-global-header-index-account',
                '.ant-dropdown-trigger.antd-pro-components-global-header-index-action',
                '.account-info',
                '[data-account]'
            ]);

            if (accountElement) {
                log(LOG_LEVEL.DEBUG, '✓ 找到账户元素');

                // 完全按照验证过的脚本逻辑来
                // 获取完整HTML
                const innerHTML = accountElement.innerHTML;
                const textContent = accountElement.textContent.trim();

                log(LOG_LEVEL.DEBUG, '完整HTML:', innerHTML.substring(0, 200));
                log(LOG_LEVEL.DEBUG, '完整文本:', textContent);

                // 获取所有子元素
                const children = accountElement.children;
                log(LOG_LEVEL.DEBUG, '子元素数量:', children.length);

                Array.from(children).forEach((child, index) => {
                    log(LOG_LEVEL.DEBUG, `[${index}] ${child.tagName} - Class: ${child.className}`);
                    log(LOG_LEVEL.DEBUG, `       文本: ${child.textContent.trim().substring(0, 50)}`);
                });

                // 查找所有span元素
                log(LOG_LEVEL.DEBUG, '所有span元素:');
                const spans = accountElement.querySelectorAll('span');

                for (let i = 0; i < spans.length; i++) {
                    const spanText = spans[i].textContent.trim();
                    log(LOG_LEVEL.DEBUG, `span[${i}]: "${spanText}" - Class: ${spans[i].className}`);

                    // 如果这个span看起来像用户ID（不是图标，不是"Appen"，不是"/"）
                    if (spanText &&
                        spanText !== 'Appen' &&
                        spanText !== '/' &&
                        spanText.match(/^[a-zA-Z0-9_-]{5,30}$/) &&
                        !spans[i].className.includes('anticon') &&
                        !spans[i].className.includes('avatar')) {

                        log(LOG_LEVEL.DEBUG, `✓ 找到用户ID: ${spanText}`);
                        collectedData.userId = spanText;
                        saveCachedUserId(spanText);
                        return;
                    }
                }

                log(LOG_LEVEL.DEBUG, '✗ 在span中未找到用户ID');
            } else {
                log(LOG_LEVEL.DEBUG, '✗ 未找到账户元素');
            }

            collectedData.userId = 'unknown_user';
            log(LOG_LEVEL.WARN, '使用默认值');

        } catch (error) {
            ErrorHandler.handle(error, '无法收集用户信息', null, LOG_LEVEL.WARN);
            collectedData.userId = 'unknown_user';
        }
    }

    // 等待账户元素加载完成，然后重新收集用户信息
    function waitForAccountElement() {
        const maxAttempts = 120;  // 最多尝试120次（60秒）
        let attempts = 0;

        const checkInterval = setInterval(() => {
            attempts++;
            const accountElement = ElementSelector.select([
                '.ant-dropdown-trigger.antd-pro-components-global-header-index-action',
                '.ant-dropdown-trigger.antd-pro-components-global-header-index-account',
                '.account-info',
                '[data-account]'
            ]);

            if (accountElement && accountElement.textContent.includes('/')) {
                log(LOG_LEVEL.DEBUG, `✓ 账户元素已加载 (第${attempts}次尝试)`);
                clearInterval(checkInterval);

                // 重新收集用户信息
                collectUserInfo();
            } else {
                if (attempts % 20 === 0) {
                    log(LOG_LEVEL.DEBUG, `等待账户元素加载... (${attempts}/${maxAttempts})`);
                }

                if (attempts >= maxAttempts) {
                    log(LOG_LEVEL.WARN, '账户元素加载超时，尝试直接提取');
                    clearInterval(checkInterval);
                    // 即使超时也尝试提取一次
                    collectUserInfo();
                }
            }
        }, 500);  // 每500ms检查一次
    }

    // 收集任务信息
    function collectTaskInfo() {
        try {
            // 尝试从页面URL或元素中获取任务ID
            const urlParams = new URLSearchParams(window.location.search);

            // 记录提取到的URL参数
            const jobId = urlParams.get('jobId');
            const projectId = urlParams.get('projectId');
            const projectDisplayId = urlParams.get('projectDisplayId');
            const jobTenantId = urlParams.get('jobTenantId');

            if (jobId) {
                log(LOG_LEVEL.DEBUG, '从URL提取jobId:', jobId);
            }
            if (projectId) {
                log(LOG_LEVEL.DEBUG, '从URL提取projectId:', projectId);
            }
            if (projectDisplayId) {
                log(LOG_LEVEL.DEBUG, '从URL提取projectDisplayId:', projectDisplayId);
            }
            if (jobTenantId) {
                log(LOG_LEVEL.DEBUG, '从URL提取jobTenantId:', jobTenantId);
            }

            // 任务ID直接使用jobId参数
            if (jobId) {
                log(LOG_LEVEL.DEBUG, '从URL jobId参数获取任务ID:', jobId);
                collectedData.taskId = jobId;
            } else {
                // 如果没有jobId参数，则尝试其他参数
                collectedData.taskId = urlParams.get('task_id') ||
                                     urlParams.get('taskId') ||
                                     extractTaskIdFromURL();
            }

            // 尝试从页面元素获取任务相关信息
            const taskElement = ElementSelector.select([
                '.task-info',
                '[data-task]',
                '#task',
                '.task-details',
                '[class*="task"]'
            ]);
            if (taskElement) {
                const taskText = taskElement.textContent.trim();
                // 如果没有从URL中获取到taskId，则尝试从页面文本中提取
                if (!collectedData.taskId || collectedData.taskId === 'unknown_task') {
                    const taskMatch = taskText.match(/task[_\-]?(\w+)/i);
                    if (taskMatch) {
                        collectedData.taskId = taskMatch[1];
                    }
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, '无法收集任务信息', null, LOG_LEVEL.WARN);
        }

        // 确保taskId有默认值
        if (!collectedData.taskId) {
            collectedData.taskId = 'unknown_task';
        }
    }

    // 收集主题信息
    function collectTopicInfo() {
        try {
            // 尝试从页面URL获取主题ID和URL
            collectedData.topicUrl = window.location.href;

            // 从URL中提取参数
            const urlParams = new URLSearchParams(window.location.search);
            const jobId = urlParams.get('jobId');
            const projectId = urlParams.get('projectId');
            const projectDisplayId = urlParams.get('projectDisplayId');
            const jobTenantId = urlParams.get('jobTenantId');

            // 记录提取到的URL参数
            if (jobId) {
                log(LOG_LEVEL.DEBUG, '从URL提取jobId:', jobId);
            }
            if (projectId) {
                log(LOG_LEVEL.DEBUG, '从URL提取projectId:', projectId);
            }
            if (projectDisplayId) {
                log(LOG_LEVEL.DEBUG, '从URL提取projectDisplayId:', projectDisplayId);
            }
            if (jobTenantId) {
                log(LOG_LEVEL.DEBUG, '从URL提取jobTenantId:', jobTenantId);
            }

            // 优先使用指定元素 ID 作为题目 ID
            if (specifiedElementIdAsTopicId && specifiedElementIdAsTopicId !== 'no-id') {
                log(LOG_LEVEL.DEBUG, '使用指定元素 ID 作为题目 ID:', specifiedElementIdAsTopicId);
                collectedData.topicId = extractNumericTopicId(specifiedElementIdAsTopicId);
            } else {
                // 从URL中提取主题ID
                const url = new URL(collectedData.topicUrl);
                let topicId = url.searchParams.get('topic_id') ||
                             url.searchParams.get('topicId') ||
                             extractTopicIdFromURL() ||
                             'unknown_topic';

                // 只保留数字部分
                collectedData.topicId = extractNumericTopicId(topicId);
                log(LOG_LEVEL.DEBUG, '使用URL或其他方式提取的题目 ID:', collectedData.topicId);
            }

            // 尝试获取主题数量
            const topicElements = ElementSelector.selectAll([
                '.topic',
                '.question',
                '.item',
                '[class*="topic"]',
                '[data-topic]'
            ]);
            collectedData.topicNum = topicElements.length || 0;
        } catch (error) {
            ErrorHandler.handle(error, '无法收集主题信息', 'unknown_topic', LOG_LEVEL.WARN);
            collectedData.topicId = 'unknown_topic';
            collectedData.topicUrl = window.location.href;
            collectedData.topicNum = 0;
        }
    }

    // 从URL中提取任务ID
    function extractTaskIdFromURL() {
        const url = window.location.href;
        // 根据实际URL结构调整正则表达式
        const taskIdMatch = url.match(/task[_\-]([a-zA-Z0-9]+)/) ||
                           url.match(/id=([a-zA-Z0-9]+)/) ||
                           url.match(/\/([a-zA-Z0-9]+)$/);
        return taskIdMatch ? taskIdMatch[1] : null;
    }

    // 题目ID处理：只保留数字部分
    function extractNumericTopicId(topicId) {
        if (!topicId) return topicId;
        const numericPart = topicId.match(/\d+/);
        return numericPart ? numericPart[0] : topicId;
    }

    // 从URL中提取主题ID
    function extractTopicIdFromURL() {
        const url = window.location.href;
        // 根据实际URL结构调整正则表达式
        const topicIdMatch = url.match(/topic[_\-]([a-zA-Z0-9]+)/) ||
                            url.match(/subject[_\-]([a-zA-Z0-9]+)/) ||
                            url.match(/question[_\-]([a-zA-Z0-9]+)/);
        if (!topicIdMatch) return null;

        // 只保留数字部分
        const numericPart = topicIdMatch[1].match(/\d+/);
        return numericPart ? numericPart[0] : topicIdMatch[1];
    }

    // 附加事件监听器
    function attachEventListeners() {
        // 监听鼠标点击事件
        document.addEventListener('click', function(event) {
            // 检查是否点击了提交按钮
            checkForSubmission(event.target, true);
        });

        // 监听表单提交事件（已禁用，改为手动推送）
        /*
        document.addEventListener('submit', function(event) {
            // 延迟推送数据，确保表单提交完成
            setTimeout(pushDataOnSubmission, 100);
        });
        */

        // 监听键盘事件 - i键显示数据 (已禁用，使用content script中的处理)
        // 监听键盘事件 - i键显示数据 (已禁用，使用content script中的处理)
        /*
        document.addEventListener('keydown', function(event) {
            if (event.key === 'i' || event.key === 'I') {
                try {
                    // 检查当前焦点是否在可编辑元素上
                    const activeElement = document.activeElement;
                    const isEditableElement = activeElement && (
                        activeElement.tagName === 'INPUT' ||
                        activeElement.tagName === 'TEXTAREA' ||
                        activeElement.contentEditable === 'true'
                    );

                    // 只有在不是编辑状态下才触发
                    if (!isEditableElement) {
                        event.preventDefault();
                        showDataModal();
                    }
                } catch (err) {
                    ErrorHandler.handle(err, 'i 键处理异常', null, LOG_LEVEL.ERROR);
                    // 即使有异常也尝试显示模态框
                    try {
                        event.preventDefault();
                        showDataModal();
                    } catch (err2) {
                        ErrorHandler.handle(err2, '显示模态框失败', null, LOG_LEVEL.ERROR);
                    }
                }
            }
        });
        */

        // 特别监听可能的提交按钮
        observeSubmissionButtons();
    }

    // 自动触发质检详情加载
    function autoTriggerQualityCheckDetails() {
        try {
            log(LOG_LEVEL.DEBUG, '开始自动触发质检详情加载');

            // 查找质检详情显示按钮（向下箭头图标）
            const qualityCheckTriggerElements = ElementSelector.selectAll([
                '.anticon-down',
                '[aria-label="down"]',
                '[data-icon="down"]',
                '.icon-down',
                '[class*="arrow"]'
            ]);

            // 查找包含质检状态信息的元素
            const qualityCheckStatusElements = ElementSelector.selectAll([
                '.h-10.px-3',
                '[class*="reject"]',
                '[class*="驳回"]',
                '.status-reject',
                '[data-status*="reject"]'
            ]);

            log(LOG_LEVEL.DEBUG, '找到质检触发元素数量:', qualityCheckTriggerElements.length);
            log(LOG_LEVEL.DEBUG, '找到质检状态元素数量:', qualityCheckStatusElements.length);

            // 如果找到了质检触发元素，模拟点击第一个
            if (qualityCheckTriggerElements.length > 0) {
                const firstTrigger = qualityCheckTriggerElements[0];
                log(LOG_LEVEL.DEBUG, '模拟点击质检详情触发元素:', firstTrigger);

                // 创建并派发点击事件
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                firstTrigger.dispatchEvent(clickEvent);

                // 等待一段时间让内容加载，然后再次点击收起
                setTimeout(() => {
                    log(LOG_LEVEL.DEBUG, '模拟再次点击收起质检详情');
                    firstTrigger.dispatchEvent(clickEvent);
                }, 1000);
            } else if (qualityCheckStatusElements.length > 0) {
                // 如果没有找到触发元素但找到了状态元素，说明可能已经展开
                log(LOG_LEVEL.DEBUG, '检测到质检状态元素，尝试直接提取信息');
            } else {
                log(LOG_LEVEL.DEBUG, '未找到质检相关信息元素');
            }
        } catch (error) {
            ErrorHandler.handle(error, '自动触发质检详情加载时出错', null, LOG_LEVEL.WARN);
        }
    }

    // 记录确认完成时的标注信息
    function recordCompletionOnConfirm() {
        try {
            const userStatus = collectedData.responseElements?.userSelectionStatus;

            if (!userStatus) {
                log(LOG_LEVEL.DEBUG, '无法获取用户选择状态，跳过记录');
                return;
            }

            const pageKey = getCurrentPageKey();
            const topicCount = getTopicCountForRecording();

            log(LOG_LEVEL.DEBUG, '========== 确认完成时记录标注信息 ==========');
            log(LOG_LEVEL.DEBUG, '页面标识:', pageKey);
            log(LOG_LEVEL.DEBUG, '当前页面做题数量:', topicCount);
            log(LOG_LEVEL.DEBUG, '用户有效状态:', userStatus.isValid);

            // 计算当前页面的耗时
            const currentTime = Date.now();
            const elapsedSeconds = Math.floor((currentTime - collectedData.startTime) / 1000);

            // 检查是否有驳回信息（返修页面）
            const hasRework = !!(collectedData.responseElements?.qualityCheckRecord?.hasRecord &&
                               collectedData.responseElements?.qualityCheckRecord?.latestRecord?.type === 'REJECTED');

            // 获取当前页面的驳回理由（如果有的话）
            const pageRejectReason = hasRework && collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment
                ? collectedData.responseElements.qualityCheckRecord.latestRecord.comment
                : '';

            // 检查是否是二次返修（之前已经完成过且有返修记录）
            const isSecondaryRework = hasRework &&
                completionStats.perPage[pageKey] &&
                completionStats.perPage[pageKey].hasRework === true;

            if (!completionStats.perPage[pageKey]) {
                completionStats.perPage[pageKey] = {
                    completions: 0,
                    topicId: collectedData.topicId || 'unknown_topic',
                    topicCount: topicCount,
                    elapsedSeconds: elapsedSeconds,
                    isValid: userStatus.isValid === true,
                    hasRework: hasRework,
                    isSecondaryRework: isSecondaryRework,
                    rejectReason: pageRejectReason,
                    firstCompletionTime: currentTime,
                    lastCompletionTime: currentTime
                };
            }

            completionStats.perPage[pageKey].completions += 1;
            completionStats.perPage[pageKey].topicCount = topicCount;
            completionStats.perPage[pageKey].elapsedSeconds = elapsedSeconds;
            completionStats.perPage[pageKey].lastCompletionTime = currentTime;
            completionStats.perPage[pageKey].hasRework = hasRework;
            completionStats.perPage[pageKey].isSecondaryRework = isSecondaryRework;
            completionStats.perPage[pageKey].rejectReason = pageRejectReason;

            // 根据状态和是否有返修信息更新计数器
            if (hasRework) {
                // 返修页面的处理
                if (completionStats.perPage[pageKey].hasRework !== true) {
                    // 如果之前不是返修页面，需要调整计数器
                    if (completionStats.perPage[pageKey].isValid === true) {
                        // 之前是有效常规页面
                        completionStats.totalValidCompletions = Math.max(0, completionStats.totalValidCompletions - 1);
                        completionStats.totalTopicsCompleted = Math.max(0, completionStats.totalTopicsCompleted - completionStats.perPage[pageKey].topicCount);
                    } else if (completionStats.perPage[pageKey].isValid === false) {
                        // 之前是无效常规页面
                        completionStats.totalInvalidCompletions = Math.max(0, completionStats.totalInvalidCompletions - 1);
                    }
                }

                // 更新状态
                completionStats.perPage[pageKey].isValid = userStatus.isValid === true;

                // 增加返修计数器
                if (completionStats.perPage[pageKey].hasRework !== true || completionStats.perPage[pageKey].completions === 1) {
                    completionStats.totalReworkCompletions += 1;
                }

                // 返修页面不计入常规统计
            } else {
                // 常规页面的处理
                if (completionStats.perPage[pageKey].hasRework === true) {
                    // 如果之前是返修页面，需要从返修统计中减去
                    completionStats.totalReworkCompletions = Math.max(0, completionStats.totalReworkCompletions - 1);
                }

                // 更新状态并按常规方式处理
                completionStats.perPage[pageKey].isValid = userStatus.isValid === true;

                if (userStatus.isValid === true) {
                    // 如果页面之前被标记为无效，需要调整计数器
                    if (completionStats.perPage[pageKey].isValid === false) {
                        completionStats.totalInvalidCompletions = Math.max(0, completionStats.totalInvalidCompletions - 1);
                    }
                    completionStats.totalValidCompletions += 1;
                    completionStats.totalTopicsCompleted += topicCount;
                } else if (userStatus.isValid === false) {
                    // 如果页面之前被标记为有效，需要调整计数器
                    if (completionStats.perPage[pageKey].isValid === true) {
                        completionStats.totalValidCompletions = Math.max(0, completionStats.totalValidCompletions - 1);
                        completionStats.totalTopicsCompleted = Math.max(0, completionStats.totalTopicsCompleted - completionStats.perPage[pageKey].topicCount);
                    }
                    // 只有当页面之前不是无效状态时才增加计数器
                    if (completionStats.perPage[pageKey].isValid !== false || completionStats.perPage[pageKey].completions === 1) {
                        completionStats.totalInvalidCompletions += 1;
                    }
                } else {
                    // 未知状态，保持原来的状态
                    log(LOG_LEVEL.DEBUG, '用户状态未知，保持原来的状态');
                }
            }

            // 更新总题目数
            updateTotalQuestions();

            syncCollectedDataWithCompletionStats();

            log(LOG_LEVEL.DEBUG, '已记录确认完成时的标注信息:', {
                pageKey,
                completions: completionStats.perPage[pageKey].completions,
                topicCount: completionStats.perPage[pageKey].topicCount,
                isValid: completionStats.perPage[pageKey].isValid,
                hasRework: completionStats.perPage[pageKey].hasRework,
                totalValidCompletions: completionStats.totalValidCompletions,
                totalInvalidCompletions: completionStats.totalInvalidCompletions,
                totalReworkCompletions: completionStats.totalReworkCompletions,
                totalTopicsCompleted: completionStats.totalTopicsCompleted
            });

            saveCompletionStats();

            // 自动发送数据到服务器
            log(LOG_LEVEL.DEBUG, '确认完成记录完成，自动发送数据到服务器');
            pushDataOnSubmission();

        } catch (error) {
            ErrorHandler.handle(error, '记录确认完成时的标注信息异常', null, LOG_LEVEL.WARN);
        }
    }

    // 检查是否点击了提交按钮
    function checkForSubmission(element, triggeredByUserEvent = false) {
        if (!element || !(element instanceof Element)) {
            return;
        }

        const targetElement = element.closest ? (element.closest('button, [role="button"], [type="submit"], .btn, .submit') || element) : element;

        // 检查元素是否为提交按钮
        const submitButtonSelectors = [
            '提交并继续标注', '提交', 'Submit', '继续标注', 'Continue',
            '[type="submit"]', '.submit', '#submit', '.btn-submit'
        ];

        const buttonText = element.textContent || element.value || '';
        const isSubmitButton = submitButtonSelectors.some(selector => {
            if (selector.startsWith('[') || selector.startsWith('.') || selector.startsWith('#')) {
                // CSS选择器
                return element.matches && element.matches(selector);
            } else {
                // 文本匹配
                return buttonText.includes(selector);
            }
        });

        if (isSubmitButton) {
            log(LOG_LEVEL.DEBUG, '检测到提交按钮点击（已禁用自动推送，等待手动推送）');
            // 延迟推送数据，确保提交操作完成（已禁用）
            // setTimeout(pushDataOnSubmission, 300);
        }

        // 检查是否点击了"确认完成"按钮
        const isConfirmCompleteButton = buttonText.includes('确认完成');
        if (isConfirmCompleteButton) {
            log(LOG_LEVEL.DEBUG, '检测到"确认完成"按钮点击');
            recordCompletionOnConfirm();
        }
    }

    // 观察可能的提交按钮
    function observeSubmissionButtons() {
        // 使用MutationObserver观察DOM变化
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 检查新添加的元素是否为提交按钮
                            checkForSubmission(node);

                            // 检查新添加元素的子元素
                            const buttons = node.querySelectorAll && node.querySelectorAll('button, [type="submit"]');
                            if (buttons) {
                                buttons.forEach(checkForSubmission);
                            }
                        }
                    });
                }
            });
        });

        // 开始观察
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 显示通知消息（toast）- 支持流动水动画
    function showNotification(message, type = 'info', infiniteProgress = false) {
        try {
            // 创建通知容器
            const notification = document.createElement('div');

            // 根据类型设置样式
            let bgColor = '#2196F3';
            if (type === 'success') {
                bgColor = '#4CAF50';
            } else if (type === 'error') {
                bgColor = '#f44336';
            } else if (type === 'loading') {
                bgColor = '#2196F3';
            }

            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
                z-index: 999999;
                animation: slideIn 0.3s ease-out;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-family: Arial, sans-serif;
                min-width: 300px;
                background: ${bgColor};
                color: white;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            `;

            // 创建文本容器
            const textContainer = document.createElement('span');
            textContainer.textContent = message;
            textContainer.style.flex = '1';
            textContainer.style.position = 'relative';
            textContainer.style.zIndex = '10';
            notification.appendChild(textContainer);

            // 如果需要显示进度条，添加进度条元素
            let progressBar = null;
            if (infiniteProgress) {
                progressBar = document.createElement('div');
                progressBar.style.cssText = `
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background: linear-gradient(
                        90deg,
                        rgba(255,255,255,0.3),
                        rgba(255,255,255,1),
                        rgba(255,255,255,0.3)
                    );
                    background-size: 200% 100%;
                    border-radius: 0 0 4px 0;
                    width: 100%;
                    animation: waterFlow 1.5s ease-in-out infinite;
                    z-index: 1000;
                `;
                notification.appendChild(progressBar);
            }

            // 添加动画样式（如果还没有的话）
            if (!document.querySelector('style[data-notification-animations]')) {
                const style = document.createElement('style');
                style.setAttribute('data-notification-animations', 'true');
                style.textContent = `
                    @keyframes slideIn {
                        from {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    @keyframes slideOut {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                    }
                    @keyframes waterFlow {
                        0% {
                            background-position: 0% 0%;
                        }
                        50% {
                            background-position: 100% 0%;
                        }
                        100% {
                            background-position: 0% 0%;
                        }
                    }
                    @keyframes progressAnimation {
                        from {
                            width: 0%;
                        }
                        to {
                            width: 100%;
                        }
                    }
                `;
                document.head.appendChild(style);
            }

            // 添加到页面
            document.body.appendChild(notification);

            // 返回控制对象，允许外部更新或移除通知
            const controller = {
                element: notification,
                progressBar: progressBar,
                textContainer: textContainer,

                // 更新消息内容
                updateMessage: function(newMessage) {
                    textContainer.textContent = newMessage;
                },

                // 更新通知类型和颜色
                updateType: function(newType) {
                    let newBgColor = '#2196F3';
                    if (newType === 'success') {
                        newBgColor = '#4CAF50';
                    } else if (newType === 'error') {
                        newBgColor = '#f44336';
                    } else if (newType === 'loading') {
                        newBgColor = '#2196F3';
                    }
                    notification.style.background = newBgColor;
                },

                // 停止流动动画并显示最终结果
                finalize: function(finalMessage, finalType) {
                    if (progressBar) {
                        progressBar.style.animation = 'none';
                        progressBar.style.background = 'rgba(255,255,255,1)';
                        progressBar.style.width = '100%';
                    }
                    this.updateMessage(finalMessage);
                    this.updateType(finalType);

                    // 自动移除通知（3秒后）
                    setTimeout(() => {
                        notification.style.animation = 'slideOut 0.3s ease-out';
                        setTimeout(() => {
                            notification.remove();
                        }, 300);
                    }, 3000);
                },

                // 立即移除通知
                remove: function() {
                    notification.style.animation = 'slideOut 0.3s ease-out';
                    setTimeout(() => {
                        notification.remove();
                    }, 300);
                }
            };

            // 如果不是无限进度，则自动移除（仅用于简单的成功/错误通知）
            if (!infiniteProgress) {
                const duration = 3000;
                setTimeout(() => {
                    notification.style.animation = 'slideOut 0.3s ease-out';
                    setTimeout(() => {
                        notification.remove();
                    }, 300);
                }, duration);
            }

            log(LOG_LEVEL.DEBUG, `通知 [${type.toUpperCase()}]: ${message}`);

            return controller;
        } catch (error) {
            console.error('显示通知失败:', error);
            // 仅记录到控制台，不显示alert
            log(LOG_LEVEL.ERROR, `无法显示通知: ${message}`);
            return null;
        }
    }

    // 在标注完成时推送数据
    function pushDataOnSubmission() {
        log(LOG_LEVEL.DEBUG, '标注完成，准备推送数据');

        // 防抖处理，避免短时间内重复推送
        const now = Date.now();
        if (now - lastPushTime < CONFIG.DEBOUNCE_DELAY) {
            log(LOG_LEVEL.DEBUG, '防抖处理，取消本次推送');
            return;
        }

        lastPushTime = now;
        pushData();
    }

    // 推送数据到服务器
    async function pushData() {
        if (!isCollectorActive) return;

        // 显示正在推送的通知（带流动水动画）
        const notificationController = showNotification('⏳ 正在推送数据...', 'loading', true);

        // 更新耗时，并限制最大时长为1小时
        let elapsedTime = Date.now() - collectedData.startTime;
        if (elapsedTime > CONFIG.MAX_ELAPSED_TIME) {
            log(LOG_LEVEL.DEBUG, '耗时已超过最大值(1小时)，固定为1小时');
            elapsedTime = CONFIG.MAX_ELAPSED_TIME;
        }
        collectedData.elapsedTime = Math.floor(elapsedTime / 1000);

        // 构造符合API要求的数据（使用camelCase）
        // 新增字段说明：
        // - taskName: 任务名称，使用当前任务ID对应的值
        // - jobTenantId: 租户ID，从URL参数提取
        // - projectId: 项目ID，从URL参数提取
        // - projectDisplayId: 项目显示ID，从URL参数提取
        // - topicUrl: 标注访问页面URL，可选字段默认为空
        const dataToSend = {
            appleUserId: collectedData.userId || 'unknown_user',
            taskId: collectedData.taskId || 'unknown_task',
            taskName: collectedData.responseElements?.title || 'unknown_task', // 任务名称使用URL title参数
            topicId: collectedData.topicId || 'unknown_topic',
            topicUrl: '', // 可选字段，默认设置为空值
            jobTenantId: collectedData.responseElements?.jobTenantId || 'unknown',
            projectId: collectedData.responseElements?.projectId || 'unknown',
            projectDisplayId: collectedData.responseElements?.projectDisplayId || 'unknown',
            isValid: collectedData.responseElements?.userSelectionStatus?.isValid ?? true,
            editRounds: collectedData.responseElements?.userSelectionStatus?.editRounds || null,
            isRedo: false,
            updateTime: new Date().toISOString(),
            elapsedTime: collectedData.elapsedTime || 0,
            isReplace: false,
            topicNum: collectedData.responseElements?.userSelectionStatus?.topicCount || collectedData.responseElements?.userSelectionStatus?.editRounds || collectedData.topicNum || 0,
            userSelectionStatus: collectedData.responseElements?.userSelectionStatus || null,
            qualityCheckRecord: collectedData.responseElements?.qualityCheckRecord || null
        };

        log(LOG_LEVEL.DEBUG, '准备推送数据:', dataToSend);

        let attempts = 0;
        while (attempts < CONFIG.MAX_RETRY_ATTEMPTS) {
            try {
                // 通过background script发送HTTP请求，避免Mixed Content限制
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: 'pushAppenData',
                        endpoint: CONFIG.API_ENDPOINT,
                        data: dataToSend
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else if (response && response.success) {
                            resolve(response);
                        } else {
                            reject(new Error(response?.error || '推送失败'));
                        }
                    });
                });

                log(LOG_LEVEL.DEBUG, '数据推送成功:', response);

                // 推送成功后清除缓存的开始时间
                await clearCachedStartTime();

                // 停止流动水动画并显示成功通知
                if (notificationController) {
                    notificationController.finalize('✅ 数据推送成功！', 'success');
                }

                return;
            } catch (error) {
                attempts++;
                ErrorHandler.handleNetworkError(error, `数据推送失败 (尝试 ${attempts}/${CONFIG.MAX_RETRY_ATTEMPTS})`);

                if (attempts < CONFIG.MAX_RETRY_ATTEMPTS) {
                    // 等待后重试
                    await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
                }
            }
        }

        log(LOG_LEVEL.ERROR, '数据推送最终失败，已达到最大重试次数');

        // 停止流动水动画并显示失败通知
        if (notificationController) {
            notificationController.finalize('❌ 数据推送失败，请检查网络连接', 'error');
        }
    }

    // 创建并显示数据展示模态窗口
    function showDataModal() {
        try {
            log(LOG_LEVEL.DEBUG, 'showDataModal 被调用');
            log(LOG_LEVEL.DEBUG, '当前 collectedData.userId:', collectedData.userId);

            // 模态框交互配置参数
            const MODAL_CONFIG = {
                MIN_WIDTH: 400,
                MIN_HEIGHT: 300,
                MAX_WIDTH: window.innerWidth * 0.9,
                MAX_HEIGHT: window.innerHeight * 0.9,
                HANDLE_SIZE: 8,
                DRAG_THRESHOLD: 5
            };

            // 拖动状态管理
            let isDragging = false;
            let isResizing = false;
            let dragStartX = 0;
            let dragStartY = 0;
            let modalStartX = 0;
            let modalStartY = 0;
            let resizeStartWidth = 0;
            let resizeStartHeight = 0;
            let resizeStartLeft = 0;
            let resizeStartTop = 0;
            let resizeDirection = null;
            let rafId = null;

            // 模态框初始化函数
            function initializeModalPosition() {
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                const modalWidth = 600;
                const modalHeight = 500;

                modalContainer.style.width = modalWidth + 'px';
                modalContainer.style.height = modalHeight + 'px';
                modalContainer.style.left = (windowWidth - modalWidth) / 2 + 'px';
                modalContainer.style.top = (windowHeight - modalHeight) / 2 + 'px';
                modalContainer.style.position = 'fixed';
                modalContainer.style.transform = 'none';
            }

            // 清理事件监听器函数
            function cleanupEvents() {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                isDragging = false;
                isResizing = false;
                resizeDirection = null;
                modalContainer.classList.remove('modal-dragging', 'modal-resizing');
            }

            // 边界检查函数
            function constrainToBounds(x, y, width, height) {
                const maxX = Math.max(0, window.innerWidth - width);
                const maxY = Math.max(0, window.innerHeight - height);
                return {
                    x: Math.max(0, Math.min(x, maxX)),
                    y: Math.max(0, Math.min(y, maxY))
                };
            }

            // 拖动处理函数
            function handleMouseMove(e) {
                if (isDragging) {
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = requestAnimationFrame(() => {
                        const deltaX = e.clientX - dragStartX;
                        const deltaY = e.clientY - dragStartY;
                        let newX = modalStartX + deltaX;
                        let newY = modalStartY + deltaY;

                        const bounds = constrainToBounds(newX, newY, modalContainer.offsetWidth, modalContainer.offsetHeight);
                        modalContainer.style.left = bounds.x + 'px';
                        modalContainer.style.top = bounds.y + 'px';
                        modalContainer.style.position = 'fixed';
                        modalContainer.style.transform = 'none';
                    });
                } else if (isResizing) {
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = requestAnimationFrame(() => {
                        handleResize(e);
                    });
                }
            }

            function handleMouseUp() {
                if (isDragging || isResizing) {
                    isDragging = false;
                    isResizing = false;
                    resizeDirection = null;
                    modalContainer.classList.remove('modal-dragging', 'modal-resizing');
                    cleanupEvents();
                }
            }

            // 伸缩处理函数
            function handleResize(e) {
                const deltaX = e.clientX - dragStartX;
                const deltaY = e.clientY - dragStartY;

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
                    case 'ne': // 右上角
                        newWidth = resizeStartWidth + deltaX;
                        newHeight = resizeStartHeight - deltaY;
                        newTop = resizeStartTop + deltaY;
                        break;
                    case 'nw': // 左上角
                        newWidth = resizeStartWidth - deltaX;
                        newHeight = resizeStartHeight - deltaY;
                        newLeft = resizeStartLeft + deltaX;
                        newTop = resizeStartTop + deltaY;
                        break;
                    case 'n': // 上边
                        newHeight = resizeStartHeight - deltaY;
                        newTop = resizeStartTop + deltaY;
                        break;
                    case 's': // 下边
                        newHeight = resizeStartHeight + deltaY;
                        break;
                    case 'w': // 左边
                        newWidth = resizeStartWidth - deltaX;
                        newLeft = resizeStartLeft + deltaX;
                        break;
                    case 'e': // 右边
                        newWidth = resizeStartWidth + deltaX;
                        break;
                }

                // 应用尺寸限制（必须在位置调整之前）
                const minWidth = MODAL_CONFIG.MIN_WIDTH;
                const minHeight = MODAL_CONFIG.MIN_HEIGHT;

                if (newWidth < minWidth) {
                    newWidth = minWidth;
                    // 如果从左边拖拽，需要调整左边位置以保持右边界
                    if (resizeDirection.includes('w')) {
                        newLeft = resizeStartLeft + (resizeStartWidth - minWidth);
                    }
                }

                if (newHeight < minHeight) {
                    newHeight = minHeight;
                    // 如果从上边拖拽，需要调整上边位置以保持下边界
                    if (resizeDirection.includes('n')) {
                        newTop = resizeStartTop + (resizeStartHeight - minHeight);
                    }
                }

                // 限制最大尺寸
                newWidth = Math.min(newWidth, MODAL_CONFIG.MAX_WIDTH);
                newHeight = Math.min(newHeight, MODAL_CONFIG.MAX_HEIGHT);

                // 确保位置不超出边界
                const bounds = constrainToBounds(newLeft, newTop, newWidth, newHeight);

                // 应用新尺寸和位置
                modalContainer.style.width = newWidth + 'px';
                modalContainer.style.height = newHeight + 'px';
                modalContainer.style.left = bounds.x + 'px';
                modalContainer.style.top = bounds.y + 'px';
                modalContainer.style.position = 'fixed';
                modalContainer.style.transform = 'none';
            }

            // 开始拖动
            function startDrag(e) {
                // 如果点击的是关闭按钮，不触发拖动
                if (e.target.closest('#close-modal-btn')) return;

                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;

                // 使用 getBoundingClientRect() 获取当前位置
                const rect = modalContainer.getBoundingClientRect();
                modalStartX = rect.left;
                modalStartY = rect.top;

                modalContainer.classList.add('modal-dragging');
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                e.preventDefault();
            }

            // 开始伸缩
            function startResize(e, direction) {
                isResizing = true;
                resizeDirection = direction;
                dragStartX = e.clientX;
                dragStartY = e.clientY;

                // 获取当前状态
                const rect = modalContainer.getBoundingClientRect();
                resizeStartWidth = rect.width;
                resizeStartHeight = rect.height;
                resizeStartLeft = rect.left;
                resizeStartTop = rect.top;

                modalContainer.classList.add('modal-resizing');
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                e.preventDefault();
                e.stopPropagation();
            }

            // 如果已有模态窗口则关闭
            const existingModal = document.getElementById('appen-data-modal');
            if (existingModal) {
                log(LOG_LEVEL.DEBUG, '模态框已存在，关闭后重新打开');
                existingModal.remove();
            }

            // 尝试从页面实时获取用户ID（如果还没有的话）
            if (!collectedData.userId || collectedData.userId === 'unknown_user') {
                log(LOG_LEVEL.DEBUG, '用户ID为空或unknown，尝试从页面提取');
                collectUserInfo();
                log(LOG_LEVEL.DEBUG, 'collectUserInfo 执行后，userId:', collectedData.userId);
            }

            // 立即触发一次状态检测以确保获取最新数据
            if (isTargetPage() && collectedData.responseElements) {
                log(LOG_LEVEL.DEBUG, '显示模态框前立即检测最新状态');
                detectUserSelectionStatus(collectedData.responseElements);
                // 直接提取质检记录（现已优化为从初始数据提取，无需触发面板）
                log(LOG_LEVEL.DEBUG, '显示模态框前提取质检记录');
            } else if (isTargetPage()) {
                // 如果还没有responseElements，先创建它
                log(LOG_LEVEL.DEBUG, '第一次打开模态框，初始化responseElements');
                extractResponseElements();
            }

            log(LOG_LEVEL.DEBUG, '准备创建模态框');
            log(LOG_LEVEL.DEBUG, 'isTargetPage():', isTargetPage());
            log(LOG_LEVEL.DEBUG, 'collectedData.responseElements:', collectedData.responseElements);
            log(LOG_LEVEL.DEBUG, 'qualityCheckRecord:', collectedData.responseElements?.qualityCheckRecord);

            // 计算当前耗时，并限制最大值为1小时
            let currentElapsedTime = Math.floor((Date.now() - collectedData.startTime) / 1000);
            if (currentElapsedTime > CONFIG.MAX_ELAPSED_TIME / 1000) {
                log(LOG_LEVEL.DEBUG, '当前耗时已超过最大值(1小时)，显示为1小时');
                currentElapsedTime = CONFIG.MAX_ELAPSED_TIME / 1000;
            }

            // 创建背景覆盖层（用于点击关闭）
            const overlay = document.createElement('div');
            overlay.id = 'appen-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 99998;
                cursor: pointer;
            `;

            // 创建模态容器
            const modal = document.createElement('div');
            modal.id = 'appen-data-modal';
            modal.style.cssText = `
                position: fixed;
                z-index: 99999;
                pointer-events: none;
            `;

            // 创建模态框内容容器
            const modalContainer = document.createElement('div');
            modalContainer.className = 'modal-container';
            modalContainer.style.cssText = `
                background: white;
                border: 2px solid #333;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                max-width: 550px;
                width: 90%;
                max-height: 95vh;
                overflow: hidden;
                min-height: 400px;
                height: auto;
                font-family: Arial, sans-serif;
                cursor: default;
                pointer-events: auto;
                position: relative;
                display: flex;
                flex-direction: column;
            `;

            modalContainer.innerHTML = `
                <!-- 伸缩控制点 -->
                <div class="resize-handle resize-handle-nw" data-direction="nw"></div>
                <div class="resize-handle resize-handle-ne" data-direction="ne"></div>
                <div class="resize-handle resize-handle-sw" data-direction="sw"></div>
                <div class="resize-handle resize-handle-se" data-direction="se"></div>
                <div class="resize-handle resize-handle-n" data-direction="n"></div>
                <div class="resize-handle resize-handle-s" data-direction="s"></div>
                <div class="resize-handle resize-handle-w" data-direction="w"></div>
                <div class="resize-handle resize-handle-e" data-direction="e"></div>
                <div class="modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #ddd;
                    padding: 20px;
                    cursor: move;
                    user-select: none;
                    flex: 0 0 auto;
                ">
                    <h2 style="margin: 0; font-size: 18px; color: #333;">Appen数据收集信息</h2>
                    <button id="close-modal-btn" style="
                        background: #ff4444;
                        color: white;
                        border: none;
                        padding: 8px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">关闭</button>
                </div>

                <!-- 标签页导航 -->
                <div style="
                    display: flex;
                    border-bottom: 1px solid #ddd;
                    padding: 0 20px;
                    flex: 0 0 auto;
                ">
                    <button class="modal-tab" data-tab="basic" style="
                        flex: 1;
                        padding: 10px 5px;
                        background: #e3f2fd;
                        border: none;
                        border-bottom: 2px solid #2196f3;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: bold;
                        color: #1976d2;
                    ">基本信息</button>
                    <button class="modal-tab" data-tab="status" style="
                        flex: 1;
                        padding: 10px 5px;
                        background: #f5f5f5;
                        border: none;
                        border-bottom: 2px solid transparent;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: normal;
                        color: #666;
                    ">实时状态</button>
                    <button class="modal-tab" data-tab="history" style="
                        flex: 1;
                        padding: 10px 5px;
                        background: #f5f5f5;
                        border: none;
                        border-bottom: 2px solid transparent;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: normal;
                        color: #666;
                    ">历史统计</button>
                </div>

                <!-- 标签页内容区域 -->
                <div style="
                    flex: 1 1 auto;
                    overflow-y: auto;
                    padding: 20px;
                    position: relative;
                ">
                    <!-- 基本信息 标签页 -->
                    <div class="tab-content" data-tab="basic" style="
                        background: #e3f2fd;
                        padding: 15px;
                        border-radius: 4px;
                        line-height: 1.8;
                        font-size: 14px;
                        display: block;
                    ">
                        <div><strong style="color: #1976d2;">用户ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.userId || 'N/A')}</span></div>
                        <div><strong style="color: #1976d2;">任务ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.taskId || 'N/A')}</span></div>
                        <div><strong style="color: #1976d2;">任务名称:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.responseElements?.title || 'N/A')}</span></div>
                        <div><strong style="color: #1976d2;">题目ID:</strong> <span id="topic-id-display" style="color: #0066cc;">${escapeHtml(collectedData.topicId || 'N/A')}</span></div>
                        <div><strong style="color: #1976d2;">租户ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.responseElements?.jobTenantId || 'N/A')}</span></div>
                        <div><strong style="color: #1976d2;">项目ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.responseElements?.projectId || 'N/A')}</span></div>
                        <div><strong style="color: #1976d2;">项目显示ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.responseElements?.projectDisplayId || 'N/A')}</span></div>
                    </div>

                    <!-- 实时状态 标签页 -->
                    <div class="tab-content" data-tab="status" style="
                        background: #e8f5e9;
                        padding: 15px;
                        border-radius: 4px;
                        line-height: 1.8;
                        font-size: 14px;
                        display: none;
                    ">
                        <div><strong style="color: #2e7d32;">题目数量:</strong> <span id="topic-count-display" style="color: #0066cc;">${collectedData.responseElements?.userSelectionStatus?.topicCount || collectedData.responseElements?.userSelectionStatus?.editRounds || collectedData.topicNum || 0}</span></div>
                        <div><strong style="color: #2e7d32;">耗时(秒):</strong> <span id="elapsed-time-display" style="color: #0066cc;">${currentElapsedTime}</span></div>
                        <div><strong style="color: #2e7d32;">是否有效:</strong> <span id="valid-status-display" style="color: #0066cc;">${collectedData.responseElements?.userSelectionStatus ? (collectedData.responseElements.userSelectionStatus.isValid === true ? '✓ 有效' : collectedData.responseElements.userSelectionStatus.isValid === false ? '✗ 无效' : '未知') : '未检测到'}</span></div>
                        <div><strong style="color: #2e7d32;">认证Cookie:</strong> <span id="cookie-status-display" style="color: #0066cc; font-size: 12px;">${collectedData.authCookies ? (Object.keys(collectedData.authCookies).length > 0 ? '已获取(' + Object.keys(collectedData.authCookies).length + '个)' : '无有效Cookie') : '未获取'}</span></div>
                        <div><strong style="color: #2e7d32;">新旧题状态:</strong> <span style="color: ${(() => {
                            const pageKey = getCurrentPageKey();
                            const pageData = completionStats.perPage[pageKey];
                            console.log('[Appen-新旧题] [模态框] 计算新旧题状态 - 页面键值:', pageKey);
                            console.log('[Appen-新旧题] [模态框] 页面数据:', pageData);
                            const color = getPageNewOldStatusColor(pageData);
                            console.log('[Appen-新旧题] [模态框] 计算得到的颜色:', color);
                            return color;
                        })()};">${(() => {
                            const status = getCurrentPageReworkStatus();
                            console.log('[Appen-新旧题] [模态框] 计算得到的状态:', status);
                            return status;
                        })()}</span></div>
                        <div><strong style="color: #2e7d32;">驳回理由:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment || '')}</span></div>
                    </div>

                    <!-- 历史统计 标签页 -->
                    <div class="tab-content" data-tab="history" style="
                        background: #fff3e0;
                        padding: 15px;
                        border-radius: 4px;
                        line-height: 1.6;
                        font-size: 14px;
                        display: none;
                    ">
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 15px;
                            padding-bottom: 10px;
                            border-bottom: 2px solid #ff9800;
                        ">
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <div style="font-weight: bold; color: #e65100; font-size: 16px;">✓ 标注完成统计</div>
                                <div id="calendar-toggle-header-btn" style="
                                    display: flex;
                                    align-items: center;
                                    padding: 4px 8px;
                                    background: #fff3e0;
                                    border-radius: 4px;
                                    cursor: pointer;
                                    transition: background-color 0.3s ease;
                                ">
                                    <span style="
                                        font-weight: bold;
                                        color: #e65100;
                                        font-size: 12px;
                                    " id="header-month-text">加载中...</span>
                                    <span style="font-weight: bold; color: #e65100; font-size: 12px; margin-left: 4px;" id="header-day-text">加载中...</span>
                                </div>
                                <button id="clear-completion-stats-btn" style="
                                    background: #f44336;
                                    color: white;
                                    border: none;
                                    padding: 6px 12px;
                                    border-radius: 4px;
                                    cursor: pointer;
                                    font-weight: bold;
                                    font-size: 12px;
                                ">Clear</button>
                            </div>
                        </div>

                        <!-- 统一的日历视图容器 -->
                        <div id="calendar-view-container">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong style="color: #e65100;">总有效完成次数:</strong> <span id="total-completions-display" style="color: #0066cc; font-weight: bold; font-size: 16px;">${completionStats.totalValidCompletions || 0}</span> |
                                    <strong style="color: #e65100;">无效完成次数:</strong> <span id="total-invalid-completions-display" style="color: #f44336; font-weight: bold; font-size: 16px;">${completionStats.totalInvalidCompletions || 0}</span>
                                </div>
                                <div>
                                    <strong style="color: #e65100;">题目总数:</strong> <span id="total-questions-display" style="color: #0066cc; font-weight: bold; font-size: 16px;">${completionStats.totalQuestions || 0}</span>
                                </div>
                            </div>
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                                <strong style="color: #e65100;">返修统计:</strong>
                                <span style="margin-left: 10px;">
                                    <strong style="color: #FF9800;">返修完成次数:</strong>
                                    <span id="total-rework-completions-display" style="color: #FF9800; font-weight: bold; font-size: 16px;">${completionStats.totalReworkCompletions || 0}</span>
                                </span>
                                <span style="margin-left: 15px;">
                                    <strong style="color: #e65100;">返修题目数:</strong>
                                    <span id="rework-questions-display" style="color: #FF9800; font-weight: bold; font-size: 16px;">${completionStats.reworkQuestions || 0}</span>
                                </span>
                            </div>
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                                <strong style="color: #e65100;">耗时统计:</strong>
                                <span style="margin-left: 10px;">
                                    <strong style="color: #4CAF50;">总耗时:</strong>
                                    <span id="total-elapsed-time-display" style="color: #4CAF50; font-weight: bold; font-size: 16px;">
                                        ${formatElapsedTime(calculateTotalElapsedTime())}
                                    </span>
                                </span>
                                <span style="margin-left: 15px;">
                                    <strong style="color: #2196F3;">平均耗时:</strong>
                                    <span id="average-elapsed-time-display" style="color: #2196F3; font-weight: bold; font-size: 16px;">
                                        ${formatElapsedTime(calculateAverageElapsedTime())}/题
                                    </span>
                                </span>
                            </div>
                            <div style="margin-top: 10px; font-size: 13px; color: #555;">
                                <div style="margin-bottom: 5px;"><strong>各页面完成详情:</strong></div>
                                <div id="page-completions-display" style="margin-left: 15px; line-height: 1.6; border: 1px solid #ddd; padding: 5px; border-radius: 3px;">
                                    ${Object.keys(completionStats.perPage).length > 0
                                        ? Object.entries(completionStats.perPage)
                                            .sort((a, b) => {
                                                // 按最后完成时间降序排列（最新的在前）
                                                const timeA = a[1].lastCompletionTime || 0;
                                                const timeB = b[1].lastCompletionTime || 0;
                                                return timeB - timeA;
                                            })
                                            .map(([pageKey, data], index) => {
                                                // 获取驳回理由（使用每个页面自己的驳回理由）
                                                const rejectReason = data.rejectReason || '无驳回';
                                                // 格式化时间戳
                                                const lastCompletionTime = data.lastCompletionTime
                                                    ? new Date(data.lastCompletionTime).toLocaleString('zh-CN')
                                                    : '未知';

                                                return `<div style="margin-bottom: 8px; padding: 5px; border-bottom: 1px solid #eee;">
                                                    <div><strong>${index + 1}. 题目ID:</strong> <span style="color: #0066cc;">${escapeHtml(pageKey.includes('::') ? pageKey.split('::').pop() : pageKey)}</span></div>
                                                    <div style="margin-left: 15px; font-size: 13px;">
                                                        <span>完成次数: <span style="color: #f57c00; font-weight: bold;">${data.completions}</span></span> |
                                                        <span>题数: <span style="color: #0066cc;">${data.topicCount}</span></span> |
                                                        <span>耗时: <span style="color: #4CAF50;">${data.elapsedSeconds || 0}秒</span></span> |
                                                        <span>状态: <span style="color: ${data.isValid === true ? '#4CAF50' : data.isValid === false ? '#f44336' : '#9E9E9E'}; font-weight: bold;">${data.isValid === true ? '✓ 有效' : data.isValid === false ? '✗ 无效' : '未知状态'}</span></span> |
                                                        <span>新旧题: <span style="color: ${getPageNewOldStatusColor(data)}; font-weight: bold;">${getPageNewOldStatus(data)}</span></span>
                                                    </div>
                                                    <div style="margin-left: 15px; font-size: 13px;">
                                                        <span>驳回理由: <span style="color: #f44336;">${escapeHtml(rejectReason.substring(0, 30))}${rejectReason.length > 30 ? '...' : ''}</span></span>
                                                    </div>
                                                    <div style="margin-left: 15px; font-size: 12px; color: #777;">
                                                        最后完成: ${lastCompletionTime}
                                                    </div>
                                                </div>`;
                                            }).join('')
                                        : '<div style="color: #999;">暂无完成记录</div>'}
                                </div>
                                ${Object.keys(completionStats.perPage).length > 0
                                    ? `<div style="margin-top: 5px; font-size: 12px; color: #777;">共${Object.keys(completionStats.perPage).length}条记录。滚动查看全部。</div>`
                                    : ''}
                            </div>
                        </div>
                </div>

                <!-- 底部Footer区域：全局操作按钮栏

                    功能说明：
                    - 提供三个全局操作按钮，用户可在任何tab页面快速访问这些功能
                    - 这些操作不属于特定的tab内容，而是对整个模态框数据的全局操作

                    按钮功能：
                    1. 推送数据（蓝色）- 将收集的标注数据推送到服务器
                    2. 获取Cookie（橙色） - 获取当前会话的认证Cookie信息
                    3. 同步认证信息（紫色） - 将用户认证信息同步到服务端

                    设计特点：
                    - 固定高度70px：(15px padding * 2) + 40px内容高度
                    - 浅灰色背景（#f5f5f5）与顶部边框（#e0e0e0）提供视觉分割
                    - Flexbox布局确保响应式设计和按钮居中对齐
                    - 支持模态框的拖动和调整大小操作

                    交互效果：
                    - 按钮hover时上升2px并增强阴影
                    - 点击时恢复原位置，显示按下效果
                    - 每个按钮有特定的hover颜色变化
                -->
                <div id="modal-footer" style="
                    background-color: #f5f5f5;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 15px 20px;
                    height: 70px;
                    flex: 0 0 70px;
                    position: sticky;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 10;
                    margin-top: 20px;
                    border-radius: 0 0 6px 6px;
                ">
                    <div id="footer-buttons" style="
                        display: flex;
                        gap: 10px;
                        align-items: center;
                    ">
                        <button id="push-data-btn" style="
                            background: #2196F3;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        ">推送数据</button>
                        <button id="get-cookies-btn" style="
                            background: #FF9800;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        ">获取Cookie</button>
                        <button id="sync-auth-btn" style="
                            background: #9C27B0;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        ">同步认证信息</button>
                    </div>
                </div>
        `;

        // 将内容容器添加到模态框
        modal.appendChild(modalContainer);

        // 添加交互样式
        const modalStyles = document.createElement('style');
        modalStyles.textContent = `
            #appen-data-modal .modal-container {
                transition: box-shadow 0.2s ease;
            }

            #appen-data-modal .modal-dragging {
                box-shadow: 0 8px 30px rgba(0,0,0,0.4) !important;
                opacity: 0.95;
            }

            #appen-data-modal .modal-resizing {
                box-shadow: 0 8px 30px rgba(0,0,0,0.4) !important;
                opacity: 0.95;
            }

            #appen-data-modal .modal-header {
                cursor: move;
                user-select: none;
            }

            #appen-data-modal .modal-header:active {
                cursor: grabbing;
            }

            #appen-data-modal .resize-handle {
                position: absolute;
                background: #ccc;
                opacity: 0;
                transition: opacity 0.2s, background 0.2s;
            }

            #appen-data-modal .resize-handle:hover {
                opacity: 1;
                background: #2196F3;
            }

            #appen-data-modal .resize-handle-nw {
                top: 0; left: 0; width: 8px; height: 8px;
                border-radius: 50%; cursor: nw-resize;
            }
            #appen-data-modal .resize-handle-ne {
                top: 0; right: 0; width: 8px; height: 8px;
                border-radius: 50%; cursor: ne-resize;
            }
            #appen-data-modal .resize-handle-sw {
                bottom: 0; left: 0; width: 8px; height: 8px;
                border-radius: 50%; cursor: sw-resize;
            }
            #appen-data-modal .resize-handle-se {
                bottom: 0; right: 0; width: 8px; height: 8px;
                border-radius: 50%; cursor: se-resize;
            }
            #appen-data-modal .resize-handle-n {
                top: 0; left: 50%; width: 20px; height: 8px;
                border-radius: 4px; transform: translateX(-50%); cursor: n-resize;
            }
            #appen-data-modal .resize-handle-s {
                bottom: 0; left: 50%; width: 20px; height: 8px;
                border-radius: 4px; transform: translateX(-50%); cursor: s-resize;
            }
            #appen-data-modal .resize-handle-w {
                left: 0; top: 50%; width: 8px; height: 20px;
                border-radius: 4px; transform: translateY(-50%); cursor: w-resize;
            }
            #appen-data-modal .resize-handle-e {
                right: 0; top: 50%; width: 8px; height: 20px;
                border-radius: 4px; transform: translateY(-50%); cursor: e-resize;
            }

            /* Footer样式 */
            #appen-data-modal #modal-footer {
                flex-shrink: 0;
                box-shadow: inset 0 1px 0 rgba(0,0,0,0.1);
            }

            #appen-data-modal #footer-buttons {
                flex-wrap: wrap;
            }

            /* 按钮hover效果 */
            #appen-data-modal #modal-footer button {
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            #appen-data-modal #modal-footer button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }

            #appen-data-modal #modal-footer button:active {
                transform: translateY(0);
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }

            /* 按钮颜色hover效果 */
            #appen-data-modal #push-data-btn:hover {
                background: #1976d2;
            }

            #appen-data-modal #get-cookies-btn:hover {
                background: #e68900;
            }

            #appen-data-modal #sync-auth-btn:hover {
                background: #7b1fa2;
            }
        `;
        document.head.appendChild(modalStyles);

        // 插入覆盖层和模态框
        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // 使用 setTimeout 确保 DOM 已完全渲染后初始化模态框位置
        setTimeout(() => {
            initializeModalPosition();
        }, 10);

        // 实现模态框自适应高度功能
        function adjustModalHeight() {
            const modalElement = document.getElementById('appen-data-modal');
            const modalContainer = modalElement.querySelector('.modal-container');
            const contentArea = modalElement.querySelector('div[style*="flex: 1 1 auto"]');
            const activeTab = modalElement.querySelector('.tab-content[style*="display: block"]');

            if (modalElement && contentArea && activeTab) {
                // 获取各部分的实际高度
                const headerElement = modalElement.querySelector('.modal-header');
                const tabsElement = modalElement.querySelector('div[style*="flex: 0 0 auto"]');
                const footerElement = modalElement.querySelector('#modal-footer');

                const headerHeight = headerElement ? headerElement.scrollHeight : 60;
                const tabsHeight = tabsElement ? tabsElement.scrollHeight : 50;
                const footerHeight = footerElement ? footerElement.scrollHeight : 70;

                // 临时调整内容区域以测量内容高度
                const originalHeight = contentArea.style.maxHeight;
                contentArea.style.maxHeight = 'none';
                contentArea.style.overflow = 'visible';

                // 测量内容高度
                const contentHeight = activeTab.scrollHeight + 40; // 加上padding

                // 恢复滚动设置
                contentArea.style.maxHeight = originalHeight;
                contentArea.style.overflow = 'auto';

                // 计算总高度
                const totalHeight = headerHeight + tabsHeight + contentHeight + footerHeight;

                // 设置模态框高度
                const maxHeight = window.innerHeight * 0.95; // 最大95vh
                const finalHeight = Math.min(totalHeight, maxHeight);
                const minHeight = 420; // 最小高度（考虑footer）

                modalElement.style.height = Math.max(finalHeight, minHeight) + 'px';
            }
        }

        // 初始调整高度
        setTimeout(adjustModalHeight, 100);

        // 添加标签页切换功能
        const tabs = modal.querySelectorAll('.modal-tab');
        const tabContents = modal.querySelectorAll('.tab-content');

        function switchTab(targetTab) {
            // 重置所有标签页样式
            tabs.forEach(tab => {
                if (tab.dataset.tab === targetTab) {
                    tab.style.background = '#e3f2fd';
                    tab.style.borderBottom = '2px solid #2196f3';
                    tab.style.fontWeight = 'bold';
                    tab.style.color = '#1976d2';
                } else {
                    tab.style.background = '#f5f5f5';
                    tab.style.borderBottom = '2px solid transparent';
                    tab.style.fontWeight = 'normal';
                    tab.style.color = '#666';
                }
            });

            // 切换内容显示
            tabContents.forEach(content => {
                content.style.display = content.dataset.tab === targetTab ? 'block' : 'none';
            });

            // 标签页切换后重新调整高度
            setTimeout(adjustModalHeight, 50);
        }

        // 添加标签页点击事件
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                switchTab(this.dataset.tab);
            });
        });

        // 默认显示实时状态标签页
        switchTab('status');

        // 绑定拖动和伸缩事件
        const modalHeader = modalContainer.querySelector('.modal-header');
        const resizeHandles = modalContainer.querySelectorAll('.resize-handle');

        // 标题栏拖动事件
        if (modalHeader) {
            modalHeader.addEventListener('mousedown', function(e) {
                // 只有当点击的是标题栏本身或其子元素时才开始拖动
                if (e.target.closest('.modal-header') && !e.target.closest('button')) {
                    startDrag(e);
                }
            });
        }

        // 伸缩控制点事件
        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', function(e) {
                const direction = this.dataset.direction;
                startResize(e, direction);
            });
        });

        // 双击标题栏最大化/还原功能
        if (modalHeader) {
            modalHeader.addEventListener('dblclick', function(e) {
                if (!e.target.closest('button')) {
                    const container = modalContainer;
                    if (container.style.width === '90vw') {
                        // 还原到原始大小
                        container.style.width = '';
                        container.style.height = '';
                        container.style.maxWidth = '550px';
                        container.style.maxHeight = '95vh';
                        container.style.top = '50%';
                        container.style.left = '50%';
                        container.style.transform = 'translate(-50%, -50%)';
                    } else {
                        // 最大化
                        container.style.width = '90vw';
                        container.style.height = '90vh';
                        container.style.maxWidth = '';
                        container.style.maxHeight = '';
                        container.style.top = '5vh';
                        container.style.left = '5vw';
                        container.style.transform = 'none';
                    }
                }
            });
        }

        // ESC键取消操作
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && (isDragging || isResizing)) {
                handleMouseUp();
            }
        });

        // 日历功能相关变量
        let currentYear = new Date().getFullYear();
        let currentMonth = new Date().getMonth();
        let selectedDate = null;

        // 视图切换功能
        
        // 更新日历显示
        function updateCalendar() {
            const calendarContainer = document.getElementById('calendar-view-container');
            if (!calendarContainer) return;

            calendarContainer.innerHTML = generateCalendarHTML(currentYear, currentMonth);

            // 添加标题行日历图标的折叠/展开事件
            const headerToggleBtn = document.getElementById('calendar-toggle-header-btn');
            const calendarContent = document.getElementById('calendar-content');
            const headerMonthText = document.getElementById('header-month-text');

            // 更新标题行显示的月份
            if (headerMonthText) {
                headerMonthText.textContent = `${currentYear}年${currentMonth + 1}月`;
            }

            if (headerToggleBtn && calendarContent) {
                headerToggleBtn.addEventListener('click', function() {
                    const isExpanded = calendarContent.style.display !== 'none';

                    if (isExpanded) {
                        // 折叠
                        calendarContent.style.display = 'none';
                        this.style.backgroundColor = '#fff3e0';
                    } else {
                        // 展开
                        calendarContent.style.display = 'block';
                        this.style.backgroundColor = '#ffe0b2';
                    }
                });

                // 添加悬停效果
                headerToggleBtn.addEventListener('mouseenter', function() {
                    this.style.backgroundColor = '#ffe0b2';
                });

                headerToggleBtn.addEventListener('mouseleave', function() {
                    if (calendarContent.style.display === 'none') {
                        this.style.backgroundColor = '#fff3e0';
                    } else {
                        this.style.backgroundColor = '#ffe0b2';
                    }
                });
            }

            // 添加月份导航事件
            const prevBtn = document.getElementById('prev-month');
            const nextBtn = document.getElementById('next-month');

            if (prevBtn) {
                prevBtn.addEventListener('click', function() {
                    currentMonth--;
                    if (currentMonth < 0) {
                        currentMonth = 11;
                        currentYear--;
                    }
                    updateCalendar();
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', function() {
                    currentMonth++;
                    if (currentMonth > 11) {
                        currentMonth = 0;
                        currentYear++;
                    }
                    updateCalendar();
                });
            }

            // 添加日期点击事件（仅在日历内容中查找）
            const dateDays = calendarContent.querySelectorAll('.calendar-day:not(.empty)');
            dateDays.forEach(day => {
                day.addEventListener('click', function() {
                    // 移除之前的选中状态
                    calendarContent.querySelectorAll('.calendar-day').forEach(d => {
                        d.style.border = d.style.border.replace('2px solid #ff9800', '');
                    });

                    // 添加选中状态
                    this.style.border = '2px solid #ff9800';
                    selectedDate = this.dataset.date;

                    // 显示详情
                    showDateDetails(selectedDate);
                });
            });

            // 默认选中今天并显示当天的记录（即使日历折叠也显示）
            const today = new Date();
            const todayStr = today.getFullYear() + '-' +
                           String(today.getMonth() + 1).padStart(2, '0') + '-' +
                           String(today.getDate()).padStart(2, '0');

            // 即使日历内容隐藏，也要选中今天并显示详情
            const todayElement = calendarContent.querySelector(`[data-date="${todayStr}"]`);
            if (todayElement) {
                todayElement.style.border = '2px solid #ff9800';
                selectedDate = todayStr;
                showDateDetails(todayStr);
            } else {
                // 如果找不到今天的元素，仍然尝试显示今天的详情
                selectedDate = todayStr;
                showDateDetails(todayStr);
            }
        }

        
        // 背景点击关闭功能
        overlay.addEventListener('click', function() {
            cleanupEvents();
            if (modalStyles.parentNode) {
                modalStyles.parentNode.removeChild(modalStyles);
            }
            modal.remove();
            overlay.remove();
        });

        // 更新驳回理由显示（确保显示最新的）
        const updateRejectReasonDisplay = function() {
            const rejectReasonSpans = modal.querySelectorAll('span');
            for (const span of rejectReasonSpans) {
                const parentText = span.parentElement.textContent;
                if (parentText.includes('驳回理由:')) {
                    const latestReason = collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment || '未找到';
                    span.textContent = escapeHtml(latestReason);
                    log(LOG_LEVEL.DEBUG, '已更新模态框中的驳回理由显示:', latestReason);
                    break;
                }
            }
        };
        
        // 立即更新一次显示
        updateRejectReasonDisplay();
        
        // 延迟再更新一次，确保最新数据已加载
        setTimeout(updateRejectReasonDisplay, 300);

        // 关闭按钮事件
        document.getElementById('close-modal-btn').addEventListener('click', function() {
            cleanupEvents();
            if (modalStyles.parentNode) {
                modalStyles.parentNode.removeChild(modalStyles);
            }
            modal.remove();
        });

        
        // 推送数据按钮事件
        document.getElementById('push-data-btn').addEventListener('click', function() {
            pushDataOnSubmission();
        });

        // 获取cookie按钮事件
        document.getElementById('get-cookies-btn').addEventListener('click', async function() {
            try {
                const cookies = await getAuthCookies();
                if (cookies) {
                    // 更新内存中的cookie数据
                    collectedData.authCookies = cookies;
                    
                    const cookieJson = JSON.stringify(cookies, null, 2);
                    navigator.clipboard.writeText(cookieJson).then(() => {
                        showNotification('✅ Cookie数据已复制到剪贴板！', 'success');
                        log(LOG_LEVEL.DEBUG, 'Cookie数据:', cookies);
                    }).catch(err => {
                        log(LOG_LEVEL.ERROR, '复制失败:', err);
                        showNotification('⚠️ 获取成功但复制失败，请查看控制台', 'error');
                    });
                    
                    // 更新显示
                    const modalElement = document.getElementById('appen-data-modal');
                    if (modalElement) {
                        const spans = modalElement.querySelectorAll('span');
                        spans.forEach(span => {
                            const parent = span.parentElement;
                            if (parent && parent.textContent.includes('认证Cookie:')) {
                                span.textContent = Object.keys(cookies).length > 0 ? `已获取(${Object.keys(cookies).length}个)` : '无有效Cookie';
                            }
                        });
                    }
                } else {
                    showNotification('❌ 未能获取到认证cookie', 'error');
                    log(LOG_LEVEL.ERROR, '获取cookie失败：未返回数据');
                }
            } catch (error) {
                ErrorHandler.handleNetworkError(error, '获取cookie失败');
                showNotification('❌ 获取cookie失败: ' + error.message, 'error');
                log(LOG_LEVEL.ERROR, '获取cookie异常:', error);
            }
        });

        // 同步认证信息按钮事件
        document.getElementById('sync-auth-btn').addEventListener('click', async function() {
            let notificationController = null;
            try {
                const cookies = await getAuthCookies();
                if (cookies) {
                    notificationController = showNotification('⏳ 正在同步认证信息...', 'loading', true);
                    await syncAuthToServer(cookies);
                    if (notificationController) {
                        notificationController.finalize('✅ 认证信息同步成功！', 'success');
                    }
                } else {
                    showNotification('❌ 未能获取到认证cookie，无法同步', 'error');
                }
            } catch (error) {
                ErrorHandler.handleNetworkError(error, '同步认证信息失败');
                // 停止流动水动画并显示错误信息
                if (notificationController) {
                    notificationController.finalize('❌ 同步认证信息失败: ' + error.message, 'error');
                } else {
                    showNotification('❌ 同步认证信息失败: ' + error.message, 'error');
                }
                log(LOG_LEVEL.ERROR, '同步认证信息异常:', error);
            }
        });

        
        // 清除标注完成统计按钮事件
        document.getElementById('clear-completion-stats-btn').addEventListener('click', async function() {
            if (confirm('确定要清除所有标注完成统计吗？')) {
                await clearCompletionStats();
                showNotification('✅ 标注完成统计已清除！', 'success');
                // 重新显示模态框以更新显示
                showDataModal();
            }
        });

        // 初始化标题行的当前月份和日期显示
        const today = new Date();
        const headerMonthText = document.getElementById('header-month-text');
        const headerDayText = document.getElementById('header-day-text');

        if (headerMonthText) {
            headerMonthText.textContent = `${currentYear}年${currentMonth + 1}月`;
        }

        if (headerDayText) {
            headerDayText.textContent = `${today.getDate()}日`;
        }

        // 检查并清除可能的测试数据（如果数据中有明显错误的日期）
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        // 如果completionStats中有明显不是今天的测试数据，清除它们
        for (const dateKey in completionStats.perPage) {
            const pageData = completionStats.perPage[dateKey];
            if (pageData && pageData.lastCompletionTime) {
                const recordDate = new Date(pageData.lastCompletionTime);
                // 如果记录的日期超过30天，可能是测试数据，清除它
                const daysDiff = (today - recordDate) / (1000 * 60 * 60 * 24);
                if (daysDiff > 30) {
                    delete completionStats.perPage[dateKey];
                    log(LOG_LEVEL.DEBUG, `清除过期的测试数据: ${dateKey}`);
                }
            }
        }

        // 初始化日历并显示当天记录
        updateCalendar();

        log(LOG_LEVEL.DEBUG, '数据展示模态窗口已显示，按i键关闭');
        } catch (error) {
            ErrorHandler.handle(error, '创建模态框异常', null, LOG_LEVEL.ERROR);
            log(LOG_LEVEL.ERROR, '错误堆栈:', error.stack);
            showNotification('❌ 创建模态框失败: ' + error.message, 'error');
        }
    }

    // HTML转义函数，防止XSS
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.toString().replace(/[&<>"']/g, m => map[m]);
    }

    // 计算总耗时
    function calculateTotalElapsedTime() {
        let totalElapsedSeconds = 0;
        for (const [pageKey, pageData] of Object.entries(completionStats.perPage)) {
            // 只计算有效完成的耗时
            if (pageData.isValid !== false) {
                totalElapsedSeconds += pageData.elapsedSeconds || 0;
            }
        }
        return totalElapsedSeconds;
    }

    // 计算平均耗时
    function calculateAverageElapsedTime() {
        const totalElapsedSeconds = calculateTotalElapsedTime();
        const totalQuestions = completionStats.totalQuestions || 0;

        // 防止除零错误
        if (totalQuestions <= 0) {
            return 0;
        }

        return Math.round(totalElapsedSeconds / totalQuestions);
    }

    // 格式化时间显示
    function formatElapsedTime(seconds) {
        if (!seconds || seconds < 60) {
            return `${seconds}秒`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
    }

    // 按日期分组记录数据
    function groupRecordsByDate() {
        const groupedData = {};

        for (const [pageKey, pageData] of Object.entries(completionStats.perPage)) {
            if (pageData.lastCompletionTime) {
                const date = new Date(pageData.lastCompletionTime);
                const dateKey = formatDateKey(date); // YYYY-MM-DD格式

                if (!groupedData[dateKey]) {
                    groupedData[dateKey] = {
                        date: dateKey,
                        records: [],
                        totalCompletions: 0,
                        validCompletions: 0,
                        invalidCompletions: 0,
                        reworkCompletions: 0,
                        totalTopics: 0,
                        validTopics: 0, // 有效题目数（用于计算平均耗时）
                        totalElapsedSeconds: 0
                    };
                }

                groupedData[dateKey].records.push(pageData);
                groupedData[dateKey].totalCompletions += pageData.completions;
                groupedData[dateKey].totalTopics += pageData.topicCount;

                // 只计算有效完成的耗时（与列表视图保持一致）
                if (pageData.isValid !== false) {
                    groupedData[dateKey].totalElapsedSeconds += pageData.elapsedSeconds || 0;
                }

                if (pageData.isValid === true) {
                    groupedData[dateKey].validCompletions += pageData.completions;
                    groupedData[dateKey].validTopics += pageData.topicCount; // 统计有效题目数
                } else if (pageData.isValid === false) {
                    groupedData[dateKey].invalidCompletions += pageData.completions;
                }

                // 统计返修数量
                if (isReworkPage(pageData)) {
                    groupedData[dateKey].reworkCompletions += pageData.completions;
                }
            }
        }

        return groupedData;
    }

    // 获取工作量等级
    function getWorkloadLevel(dateData) {
        const totalTopics = dateData.totalTopics;

        if (totalTopics === 0) return 'none';        // 无工作
        if (totalTopics <= 5) return 'light';        // 轻量工作
        if (totalTopics <= 15) return 'medium';      // 中等工作
        if (totalTopics <= 30) return 'heavy';       // 重度工作
        return 'intensive';                          // 密集工作
    }

    // 格式化日期键值
    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 判断是否为今天
    function isDateToday(year, month, day) {
        const today = new Date();
        return year === today.getFullYear() &&
               month === today.getMonth() &&
               day === today.getDate();
    }

    // 获取月份天数
    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    // 获取月份第一天是星期几
    function getFirstDayOfWeek(year, month) {
        return new Date(year, month, 1).getDay();
    }

    // 获取工作量等级颜色
    function getWorkloadColor(workloadLevel) {
        switch (workloadLevel) {
            case 'none': return '#f5f5f5';
            case 'light': return '#e8f5e9';
            case 'medium': return '#c8e6c9';
            case 'heavy': return '#a5d6a7';
            case 'intensive': return '#81c784';
            default: return '#f5f5f5';
        }
    }

    // 生成日历HTML
    function generateCalendarHTML(year, month) {
        const firstDay = getFirstDayOfWeek(year, month);
        const daysInMonth = getDaysInMonth(year, month);
        const groupedData = groupRecordsByDate();

        let html = `
            <!-- 可折叠的日历内容 -->
            <div class="calendar-content" style="
                display: none;
                margin-bottom: 15px;
            " id="calendar-content">
                <div class="calendar-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    padding: 8px;
                    background: #fff8e1;
                    border-radius: 4px;
                ">
                    <button id="prev-month" style="
                        background: #ff9800;
                        color: white;
                        border: none;
                        padding: 6px 10px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 12px;
                    ">←</button>
                    <span class="current-month" style="
                        font-weight: bold;
                        color: #e65100;
                        font-size: 14px;
                    ">${year}年${month + 1}月</span>
                    <button id="next-month" style="
                        background: #ff9800;
                        color: white;
                        border: none;
                        padding: 6px 10px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 12px;
                    ">→</button>
                </div>
                <div class="calendar-grid" style="
                border: 1px solid #ddd;
                border-radius: 4px;
                overflow: hidden;
            ">
                <div class="weekday-headers" style="
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    background: #ff9800;
                    color: white;
                    font-weight: bold;
                    text-align: center;
                    padding: 8px 0;
                ">
                    <div>日</div><div>一</div><div>二</div><div>三</div>
                    <div>四</div><div>五</div><div>六</div>
                </div>
                <div class="calendar-days" style="
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 1px;
                    background: #ddd;
                ">
        `;

        // 添加空白日期
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="calendar-day empty" style="background: #fafafa; padding: 10px; min-height: 60px;"></div>';
        }

        // 添加日期
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayData = groupedData[dateKey];
            const workloadLevel = dayData ? getWorkloadLevel(dayData) : 'none';
            const isToday = isDateToday(year, month, day);

            html += generateDayHTML(dateKey, day, dayData, workloadLevel, isToday);
        }

        html += `
                </div>
            </div>
            </div>
            <div id="date-details-container" style="margin-top: 20px;"></div>
        `;

        return html;
    }

    // 生成单个日期HTML
    function generateDayHTML(dateKey, dayNumber, dayData, workloadLevel, isToday) {
        const bgColor = getWorkloadColor(workloadLevel);
        const borderStyle = isToday ? 'border: 2px solid #2196f3;' : '';
        const cursorStyle = dayData ? 'cursor: pointer;' : 'cursor: default;';

        if (!dayData) {
            return `<div class="calendar-day empty" data-date="${dateKey}" style="
                background: ${bgColor};
                padding: 10px;
                min-height: 60px;
                ${borderStyle}
                ${cursorStyle}
                display: flex;
                align-items: center;
                justify-content: center;
                color: #999;
                font-size: 14px;
            ">${dayNumber}</div>`;
        }

        return `<div class="calendar-day ${workloadLevel}" data-date="${dateKey}" style="
            background: ${bgColor};
            padding: 8px;
            min-height: 60px;
            ${borderStyle}
            ${cursorStyle}
            border-bottom: 1px solid #ddd;
        ">
            <div style="font-weight: bold; color: #333; margin-bottom: 4px;">${dayNumber}</div>
            <div style="font-size: 12px; color: #666;">
                <div>${dayData.totalTopics}题</div>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    <span style="color: #4CAF50;">${dayData.validCompletions}✓</span>
                    ${dayData.invalidCompletions > 0 ? `<span style="color: #f44336;">${dayData.invalidCompletions}✗</span>` : ''}
                    ${dayData.reworkCompletions > 0 ? `<span style="color: #FF9800;">${dayData.reworkCompletions}↻</span>` : ''}
                </div>
            </div>
        </div>`;
    }

    // 显示选中日期的详情
    function showDateDetails(dateKey) {
        const groupedData = groupRecordsByDate();
        const dayData = groupedData[dateKey];

        if (!dayData) {
            const detailsContainer = document.getElementById('date-details-container');
            if (detailsContainer) {
                detailsContainer.innerHTML = `
                    <div style="
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        border-left: 4px solid #ff9800;
                        text-align: center;
                        color: #666;
                    ">
                        ${dateKey} 无工作记录
                    </div>
                `;
            }
            return;
        }

        const recordsHTML = dayData.records.map((record, index) => {
            const pageKey = Object.keys(completionStats.perPage).find(key =>
                completionStats.perPage[key] === record
            );
            const topicId = pageKey ? (pageKey.includes('::') ? pageKey.split('::').pop() : pageKey) : 'unknown';

            const isRework = isReworkPage(record);
        const borderColor = isRework ? '#FF9800' : (record.isValid === true ? '#4CAF50' : '#f44336');

        return `<div style="
                margin-bottom: 8px;
                padding: 8px;
                background: white;
                border-radius: 3px;
                border-left: 3px solid ${borderColor};
            ">
                <div style="font-weight: bold; color: #333;">
                    题目ID: ${topicId}
                    ${isRework ? '<span style="background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 5px;">返修</span>' : ''}
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">
                    完成: ${record.completions}次 | 题数: ${record.topicCount} | 耗时: ${record.elapsedSeconds || 0}秒
                </div>
            </div>`;
        }).join('');

        const detailsHTML = `
            <div style="
                padding: 15px;
                background: #f8f9fa;
                border-radius: 4px;
                border-left: 4px solid #ff9800;
            ">
                <h4 style="margin: 0 0 15px 0; color: #e65100;">
                    ${dateKey} 工作详情
                </h4>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; flex-wrap: wrap;">
                    <div>完成题目: <strong style="color: #e65100;">${dayData.totalTopics}题</strong></div>
                    <div>总耗时: <strong style="color: #4CAF50;">${formatElapsedTime(dayData.totalElapsedSeconds)}</strong></div>
                    <div>平均耗时: <strong style="color: #2196F3;">${formatElapsedTime(dayData.validTopics > 0 ? Math.round(dayData.totalElapsedSeconds / dayData.validTopics) : 0)}/题</strong></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; flex-wrap: wrap;">
                    <div>有效完成: <strong style="color: #4CAF50;">${dayData.validCompletions}次</strong></div>
                    <div>无效完成: <strong style="color: #f44336;">${dayData.invalidCompletions}次</strong></div>
                    <div>返修完成: <strong style="color: #FF9800;">${dayData.reworkCompletions}次</strong></div>
                </div>
                <div style="margin-bottom: 10px; font-weight: bold; color: #333;">完成记录:</div>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${recordsHTML}
                </div>
            </div>
        `;

        const detailsContainer = document.getElementById('date-details-container');
        if (detailsContainer) {
            detailsContainer.innerHTML = detailsHTML;
        }
    }

    // 检查是否为特定目标页面
    function isTargetPage() {
        const currentUrl = window.location.href;
        const isMatch = CONFIG.TARGET_URL_PATTERN.test(currentUrl);
        log(LOG_LEVEL.DEBUG, 'isTargetPage 检查:', { url: currentUrl, pattern: CONFIG.TARGET_URL_PATTERN, isMatch: isMatch });
        console.log('[Appen Data Collector] isTargetPage 检查结果:', { url: currentUrl, isMatch: isMatch });
        return isMatch;
    }

    // 输出所有质检驳回信息到控制台
    function logAllQualityCheckInfo() {
        try {
            log(LOG_LEVEL.DEBUG, '\n========== 【开始输出所有质检驳回信息】 ==========');

            if (!collectedData) {
                log(LOG_LEVEL.DEBUG, '错误: collectedData 未初始化');
                return;
            }

            // 基本信息
            log(LOG_LEVEL.DEBUG, '【基本信息】');
            log(LOG_LEVEL.DEBUG, '  用户ID:', collectedData.userId || 'N/A');
            log(LOG_LEVEL.DEBUG, '  任务ID:', collectedData.taskId || 'N/A');
            log(LOG_LEVEL.DEBUG, '  题目ID:', collectedData.topicId || 'N/A');
            log(LOG_LEVEL.DEBUG, '  页面URL:', collectedData.topicUrl || 'N/A');

            // 质检记录信息
            if (collectedData.responseElements && collectedData.responseElements.qualityCheckRecord) {
                const qcRecord = collectedData.responseElements.qualityCheckRecord;
                log(LOG_LEVEL.DEBUG, '\n【质检记录信息】');
                log(LOG_LEVEL.DEBUG, '  是否有驳回记录:', qcRecord.hasRecord ? '是' : '否');

                if (qcRecord.latestRecord) {
                    log(LOG_LEVEL.DEBUG, '  状态类型:', qcRecord.latestRecord.type || 'N/A');
                    log(LOG_LEVEL.DEBUG, '  状态详情:', qcRecord.latestRecord.action || 'N/A');
                    log(LOG_LEVEL.DEBUG, '  驳回理由:', qcRecord.latestRecord.comment || 'N/A');
                    log(LOG_LEVEL.DEBUG, '  操作人:', qcRecord.latestRecord.operator || 'N/A');
                    log(LOG_LEVEL.DEBUG, '  操作时间:', qcRecord.latestRecord.operateTime || 'N/A');
                }

                log(LOG_LEVEL.DEBUG, '  检测时间:', qcRecord.timestamp || 'N/A');
            } else {
                log(LOG_LEVEL.DEBUG, '\n【质检记录信息】');
                log(LOG_LEVEL.DEBUG, '  未检测到质检驳回信息');
            }

            // 用户选择状态
            if (collectedData.responseElements && collectedData.responseElements.userSelectionStatus) {
                const uss = collectedData.responseElements.userSelectionStatus;
                log(LOG_LEVEL.DEBUG, '\n【用户选择状态】');
                log(LOG_LEVEL.DEBUG, '  是否有效:', uss.isValid !== null ? (uss.isValid ? '有效' : '无效') : 'N/A');
                log(LOG_LEVEL.DEBUG, '  编辑轮次:', uss.editRounds || 'N/A');
                log(LOG_LEVEL.DEBUG, '  题目数量:', uss.topicCount || 'N/A');
            }

            // 完整JSON输出
            log(LOG_LEVEL.DEBUG, '\n【完整数据JSON】');
            const fullData = {
                userId: collectedData.userId || 'N/A',
                taskId: collectedData.taskId || 'N/A',
                topicId: collectedData.topicId || 'N/A',
                topicUrl: collectedData.topicUrl || 'N/A',
                qualityCheck: collectedData.responseElements?.qualityCheckRecord || null,
                userSelection: collectedData.responseElements?.userSelectionStatus || null,
                extractTime: new Date().toISOString()
            };
            log(LOG_LEVEL.DEBUG, JSON.stringify(fullData, null, 2));

            log(LOG_LEVEL.DEBUG, '========== 【质检驳回信息输出完成】 ==========\n');
        } catch (error) {
            log(LOG_LEVEL.ERROR, '输出质检信息时出错:', error);
        }
    }


    async function getAuthCookies() {
        try {
            // 检查是否在正确的域名下
            if (!window.location.href.includes('ui.appen.com.cn')) {
                log(LOG_LEVEL.DEBUG, '当前不在appen域名下，无法获取cookie');
                return null;
            }

            log(LOG_LEVEL.DEBUG, '尝试通过background script获取cookie');

            // 通过background script获取cookie（使用chrome.cookies API）
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: "getAppenCookies",
                    url: window.location.href
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        log(LOG_LEVEL.ERROR, '与background script通信失败:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    if (response.success) {
                        log(LOG_LEVEL.DEBUG, '通过background script获取的cookie:', response.cookies);
                        resolve(response.cookies);
                    } else {
                        log(LOG_LEVEL.ERROR, 'background script获取cookie失败:', response.error);
                        reject(new Error(response.error));
                    }
                });
            });
        } catch (error) {
            log(LOG_LEVEL.WARN, '获取cookie时出错:', error);
            log(LOG_LEVEL.ERROR, '错误详情:', error.stack);
            return null;
        }
    }

    // 同步认证信息到服务端
    async function syncAuthToServer(authCookies) {
        if (!authCookies) {
            log(LOG_LEVEL.DEBUG, '没有认证信息可同步');
            return;
        }

        const authPayload = {};

        if (authCookies._appen_auth_session) {
            authPayload._appen_auth_session = authCookies._appen_auth_session;
        }

        if (authCookies.appenAuthSession) {
            authPayload._appen_auth_session = authCookies.appenAuthSession;
        }

        if (authCookies.Authorization) {
            authPayload.Authorization = authCookies.Authorization;
        }

        if (authCookies.authorization) {
            authPayload.Authorization = authCookies.authorization;
        }

        if (Object.keys(authPayload).length === 0) {
            log(LOG_LEVEL.DEBUG, '认证信息为空，无需同步');
            log(LOG_LEVEL.DEBUG, '接收到的cookie字段:', Object.keys(authCookies));
            return;
        }

        // 通过background script发送HTTP请求以避免Mixed Content问题
        try {
            log(LOG_LEVEL.DEBUG, '通过background script同步认证信息到服务端:', authPayload);

            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: "syncAuthToServer",
                    data: authPayload,
                    endpoint: CONFIG.AUTH_SYNC_ENDPOINT.replace('https://', 'http://') // 确保使用HTTP
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        log(LOG_LEVEL.ERROR, '与background script通信失败:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    if (response.success) {
                        log(LOG_LEVEL.DEBUG, '认证信息同步成功:', response.result);
                        resolve(response.result);
                    } else {
                        log(LOG_LEVEL.ERROR, 'background script同步认证信息失败:', response.error);
                        reject(new Error(response.error));
                    }
                });
            });
        } catch (error) {
            log(LOG_LEVEL.ERROR, '同步认证信息时出错:', error);
            throw error;
        }
    }

    // 从目标页面提取响应元素
    function extractResponseElements() {
        if (!isTargetPage()) {
            log(LOG_LEVEL.DEBUG, '当前页面不是目标页面，跳过元素提取');
            return null;
        }

        log(LOG_LEVEL.DEBUG, '在目标页面上，开始提取响应元素...');

        // 提取URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('jobId');
        const jobType = urlParams.get('jobType');
        const taskId = urlParams.get('taskId');
        const projectId = urlParams.get('projectId');
        const projectDisplayId = urlParams.get('projectDisplayId');
        const jobTenantId = urlParams.get('jobTenantId');
        const title = urlParams.get('title');

        // 记录新提取的URL参数并进行验证
        if (projectDisplayId) {
            log(LOG_LEVEL.DEBUG, '从URL提取projectDisplayId:', projectDisplayId);
        } else {
            log(LOG_LEVEL.WARN, 'URL中未找到projectDisplayId参数，将使用默认值');
        }

        if (jobTenantId) {
            log(LOG_LEVEL.DEBUG, '从URL提取jobTenantId:', jobTenantId);
            // 验证jobTenantId格式（应该是UUID格式）
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(jobTenantId)) {
                log(LOG_LEVEL.WARN, 'jobTenantId格式可能不正确:', jobTenantId);
            }
        } else {
            log(LOG_LEVEL.WARN, 'URL中未找到jobTenantId参数，将使用默认值');
        }

        // 创建响应元素数据对象
        const responseElements = {
            jobId: jobId || 'unknown',
            jobType: jobType || 'unknown',
            taskId: taskId || 'unknown',
            projectId: projectId || 'unknown',
            projectDisplayId: projectDisplayId || 'unknown',
            jobTenantId: jobTenantId || 'unknown',
            title: decodeURIComponent(title || 'unknown'),
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        // 尝试提取页面上的其他元素
        try {
            // 提取页面标题
            const titleElement = document.querySelector('title');
            if (titleElement) {
                responseElements.pageTitle = titleElement.textContent.trim();
            }

            // 检测用户当前的单选是有效还是无效，以及是第几轮
            detectUserSelectionStatus(responseElements);

            // 质检记录信息现在通过两步交互模式提取，在处理返修页时调用
            log(LOG_LEVEL.INFO, '========== 质检驳回信息将通过两步交互模式提取 ==========');
            log(LOG_LEVEL.INFO, '触发位置: 返修页处理阶段 (collectRejectReason)');
            log(LOG_LEVEL.INFO, '预期结果: 通过关闭通知和双击信息图标获取最新驳回详情');

            // 提取可能的任务相关信息
            const taskElements = ElementSelector.selectAll([
                '[class*="task"]',
                '[id*="task"]',
                '[data-task]',
                '.task-info',
                '#task'
            ]);
            taskElements.forEach((element, index) => {
                const key = `taskElement_${index}`;
                responseElements[key] = {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id,
                    textContent: element.textContent.trim().substring(0, 100)
                };
            });

            // 提取可能的响应按钮或操作元素
            const responseButtons = ElementSelector.selectAll([
                'button',
                '[role="button"]',
                '.btn',
                '[type="button"]'
            ]);
            responseButtons.forEach((button, index) => {
                const buttonText = button.textContent.trim() || button.getAttribute('aria-label') || '';
                if (buttonText) {
                    const key = `responseButton_${index}`;
                    responseElements[key] = {
                        text: buttonText,
                        className: button.className,
                        id: button.id
                    };
                }
            });

            // 特别提取标注相关的元素
            const annotationElements = ElementSelector.selectAll([
                '[class*="annotation"]',
                '[class*="label"]',
                '[data-annotation]',
                '.annotation',
                '.label'
            ]);
            annotationElements.forEach((element, index) => {
                const key = `annotationElement_${index}`;
                responseElements[key] = {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id,
                    textContent: element.textContent.trim().substring(0, 100)
                };
            });

            // 查找提交按钮
            const submitButtons = ElementSelector.selectAll([
                'button[type="submit"]',
                'button[class*="submit"]',
                'button[id*="submit"]',
                '.submit-btn',
                '[data-submit]'
            ]);
            if (submitButtons.length > 0) {
                responseElements.submitButtons = [];
                submitButtons.forEach((button, index) => {
                    responseElements.submitButtons.push({
                        text: button.textContent.trim(),
                        className: button.className,
                        id: button.id
                    });
                });
            }

            // 查找表单元素
            const forms = ElementSelector.selectAll('form');
            if (forms.length > 0) {
                responseElements.forms = [];
                forms.forEach((form, index) => {
                    responseElements.forms.push({
                        className: form.className,
                        id: form.id,
                        action: form.action,
                        method: form.method
                    });
                });
            }

        } catch (error) {
            ErrorHandler.handleDOMError(error, '提取页面元素时出错', null, LOG_LEVEL.WARN);
        }

        log(LOG_LEVEL.DEBUG, '提取的响应元素:', responseElements);

        // 将提取的数据存储到全局变量中，以便后续使用
        collectedData.responseElements = responseElements;

        return responseElements;
    }

    // 获取输入元素的标签文本
    function getInputLabel(inputElement) {
        try {
            // 方法1: 通过for属性查找label
            if (inputElement.id) {
                const label = document.querySelector(`label[for="${inputElement.id}"]`);
                if (label) {
                    return label.textContent.trim();
                }
            }

            // 方法2: 查找父级label元素
            let parent = inputElement.parentElement;
            while (parent && parent.tagName !== 'BODY') {
                if (parent.tagName === 'LABEL') {
                    return parent.textContent.trim();
                }
                parent = parent.parentElement;
            }

            // 方法3: 查找同级的文本或label元素
            const siblings = Array.from(inputElement.parentElement.children);
            for (const sibling of siblings) {
                if (sibling.tagName === 'LABEL' || sibling.tagName === 'SPAN') {
                    const text = sibling.textContent.trim();
                    if (text && text.length > 0 && text.length < 50) {
                        return text;
                    }
                }
            }

            // 方法4: 查找相邻的文本节点
            const nextSibling = inputElement.nextSibling;
            if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                const text = nextSibling.textContent.trim();
                if (text && text.length > 0 && text.length < 50) {
                    return text;
                }
            }

            // 方法5: 检查父元素的文本内容
            if (inputElement.parentElement) {
                const parentText = inputElement.parentElement.textContent.trim();
                if (parentText && parentText.length < 100) {
                    // 移除子元素的文本，只保留标签文本
                    const inputText = inputElement.value || '';
                    const cleanText = parentText.replace(inputText, '').trim();
                    if (cleanText && cleanText.length > 0) {
                        return cleanText;
                    }
                }
            }

            return null;
        } catch (error) {
            log(LOG_LEVEL.WARN, '[Appen Data Collector] 获取输入元素标签失败:', error);
            return null;
        }
    }

    // 检测用户当前的单选是有效还是无效，以及编辑轮次数
    function detectUserSelectionStatus(responseElements) {
        try {
            log(LOG_LEVEL.DEBUG, '开始检测用户选择状态和编辑轮次数');

            // 检测有效/无效状态
            let isValid = null;
            let editRounds = null;

            // 方法1: 查找被选中的单选按钮或复选框
            const checkedInputs = ElementSelector.selectAll([
                'input[type="radio"]:checked',
                'input[type="checkbox"]:checked',
                '[role="radio"][aria-checked="true"]',
                '[role="checkbox"][aria-checked="true"]'
            ]);
            log(LOG_LEVEL.DEBUG, '找到选中的输入元素数量:', checkedInputs.length);

            checkedInputs.forEach((input, index) => {
                const inputValue = input.value ? input.value.toLowerCase() : '';
                const inputLabel = getInputLabel(input);
                const inputText = inputLabel ? inputLabel.toLowerCase() : '';

                log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 选中的输入元素[${index}]:`, {
                    value: input.value,
                    label: inputLabel,
                    name: input.name,
                    id: input.id
                });

                // 检测有效/无效状态
                if (isValid === null) {
                    if (inputValue.includes('有效') || inputValue.includes('valid') || inputValue.includes('true') ||
                        inputText.includes('有效') || inputText.includes('valid')) {
                        isValid = true;
                        log(LOG_LEVEL.DEBUG, '通过选中状态检测到有效:', inputLabel);
                    } else if (inputValue.includes('无效') || inputValue.includes('invalid') || inputValue.includes('false') ||
                               inputText.includes('无效') || inputText.includes('invalid')) {
                        isValid = false;
                        log(LOG_LEVEL.DEBUG, '通过选中状态检测到无效:', inputLabel);
                    }
                }

                // 检测编辑轮次数
                if (editRounds === null) {
                    const roundsMatch = inputText.match(/(\d+)\s*轮/) || inputValue.match(/(\d+)\s*轮/) ||
                                       inputText.match(/round\s*(\d+)/i) || inputValue.match(/round\s*(\d+)/i);
                    if (roundsMatch) {
                        editRounds = parseInt(roundsMatch[1]);
                        log(LOG_LEVEL.DEBUG, '通过选中状态检测到编辑轮次:', editRounds);
                    }
                }
            });

            // 方法2: 查找包含 "active"、"selected"、"checked" 类的元素
            if (isValid === null || editRounds === null) {
                const activeElements = ElementSelector.selectAll([
                    '.active',
                    '.selected',
                    '.checked',
                    '[class*="active"]',
                    '[class*="selected"]',
                    '[class*="checked"]',
                    '[aria-selected="true"]',
                    '[aria-checked="true"]'
                ]);
                log(LOG_LEVEL.DEBUG, '找到激活状态元素数量:', activeElements.length);

                activeElements.forEach((element, index) => {
                    const text = element.textContent.trim().toLowerCase();
                    log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 激活元素[${index}]:`, text.substring(0, 50));

                    // 检测有效/无效状态
                    if (isValid === null && text.length < 100) {
                        if (text.includes('有效') || text.includes('valid')) {
                            isValid = true;
                            log(LOG_LEVEL.DEBUG, '通过激活状态检测到有效:', text);
                        } else if (text.includes('无效') || text.includes('invalid')) {
                            isValid = false;
                            log(LOG_LEVEL.DEBUG, '通过激活状态检测到无效:', text);
                        }
                    }

                    // 检测编辑轮次数
                    if (editRounds === null) {
                        const roundsMatch = text.match(/(\d+)\s*轮/) || text.match(/round\s*(\d+)/i);
                        if (roundsMatch) {
                            editRounds = parseInt(roundsMatch[1]);
                            log(LOG_LEVEL.DEBUG, '通过激活状态检测到编辑轮次:', editRounds);
                        }
                    }
                });
            }

            // 方法3: 如果仍未找到，使用原有的文本搜索方法作为备用
            if (isValid === null) {
                log(LOG_LEVEL.DEBUG, '使用备用方法检测有效/无效状态');
                const statusContainers = ElementSelector.selectAll([
                    '[class*="status"]',
                    '[data-status]',
                    '.status-container',
                    '.validation',
                    '.feedback',
                    '[role="status"]'
                ]);

                statusContainers.forEach(container => {
                    const text = container.textContent.trim().toLowerCase();
                    if (isValid === null && text.length < 100) {
                        if (text.includes('有效') || text.includes('valid')) {
                            isValid = true;
                            log(LOG_LEVEL.DEBUG, '在状态容器中检测到有效状态:', text.substring(0, 50));
                        } else if (text.includes('无效') || text.includes('invalid')) {
                            isValid = false;
                            log(LOG_LEVEL.DEBUG, '在状态容器中检测到无效状态:', text.substring(0, 50));
                        }
                    }
                });
            }

            // 查找题目数量（如果还没有编辑轮次数，则使用题目数量）
            let topicCount = null;

            // 方法1: 使用已有的 topicNum
            if (collectedData.topicNum !== undefined && collectedData.topicNum > 0) {
                topicCount = collectedData.topicNum;
                log(LOG_LEVEL.DEBUG, '使用已收集的题目数量:', topicCount);
            } else {
                // 方法2: 查找包含"题目"、"任务"、"项"等关键词的计数元素
                const countElements = ElementSelector.selectAll([
                    '[class*="count"]',
                    '[class*="number"]',
                    '[class*="total"]',
                    '.counter',
                    '.progress',
                    '[data-count]'
                ]);

                countElements.forEach(element => {
                    const text = element.textContent.trim();
                    // 查找类似 "5/10" 或 "题目 5/10" 的格式
                    const progressMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
                    if (progressMatch && topicCount === null) {
                        topicCount = parseInt(progressMatch[2]); // 总数
                        log(LOG_LEVEL.DEBUG, '从进度文本中提取题目数量:', text, '总数:', topicCount);
                    }

                    // 查找单独的数字（可能是总数）
                    if (topicCount === null) {
                        const numberMatch = text.match(/(?:^|\D)(\d+)(?:\D|$)/);
                        if (numberMatch && parseInt(numberMatch[1]) > 1 && parseInt(numberMatch[1]) < 1000) {
                            topicCount = parseInt(numberMatch[1]);
                            log(LOG_LEVEL.DEBUG, '从文本中提取题目数量:', text, '数字:', topicCount);
                        }
                    }
                });

                // 如果还没找到，使用之前的方法
                if (topicCount === null) {
                    const topicElements = ElementSelector.selectAll([
                        '.topic',
                        '.question',
                        '.item',
                        '[class*="task"]',
                        '[class*="topic"]',
                        '[data-topic]'
                    ]);
                    topicCount = topicElements.length || 0;
                    log(LOG_LEVEL.DEBUG, '通过元素计数获取题目数量:', topicCount);
                }
            }

            // 确保 topicCount 至少为0
            topicCount = topicCount || 0;

            // 如果没有检测到编辑轮次，但有题目数量，可以将题目数量作为备用值
            if (editRounds === null && topicCount > 0) {
                log(LOG_LEVEL.DEBUG, '未检测到编辑轮次，使用题目数量作为备用:', topicCount);
            }

            // 将结果存储到响应元素中
            responseElements.userSelectionStatus = {
                isValid: isValid,
                editRounds: editRounds,
                topicCount: topicCount,
                timestamp: new Date().toISOString()
            };

            log(LOG_LEVEL.DEBUG, '用户选择状态检测结果:', {
                isValid: isValid,
                editRounds: editRounds,
                topicCount: topicCount
            });

        } catch (error) {
            log(LOG_LEVEL.WARN, '检测用户选择状态时出错:', error);
            responseElements.userSelectionStatus = {
                isValid: null,
                editRounds: null,
                topicCount: collectedData.topicNum || 0,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // 从打开的质检窗口DOM中提取最新驳回理由（专门为两步交互策略优化）
    function extractLatestQARejectFromDOM() {
        try {
            log(LOG_LEVEL.INFO, '   开始从打开的质检窗口DOM中提取...');

            // 检查是否需要应用降级策略
            const shouldDegrade = ErrorHandler.degradationManager.shouldDegrade('extractLatestQARejectFromDOM', 0);
            if (shouldDegrade) {
                log(LOG_LEVEL.INFO, '   检测到高频错误，应用降级策略');
                ErrorHandler.degradationManager.applyDegrade('extractLatestQARejectFromDOM', 'dom');
            }

            // 使用多策略方法查找质检窗口的内容容器
            const popoverStrategies = [
                // 策略1: 原有的选择器
                { type: 'selector', value: '.ant-popover-content' },
                // 策略2: 可见的popover
                { type: 'selector', value: '.ant-popover:not(.ant-popover-hidden)' },
                // 策略3: 通用popover类名
                { type: 'selector', value: '[class*="popover"]:not([class*="hidden"])' },
                // 策略4: 自定义popover类名
                { type: 'selector', value: '.custom-popover-with-lefter-arrow' },
                // 策略5: 通过内容特征定位
                { type: 'content', value: '质检记录' },
                // 策略6: 通过结构定位
                { type: 'structure', parentSelector: 'body', childIndex: -1 } // 最后一个子元素可能是popover
            ];

            const popoverResult = EnhancedElementSelector.findElementByMultipleStrategies(popoverStrategies);
            let popoverContent = null;

            if (popoverResult) {
                popoverContent = popoverResult.element;
                log(LOG_LEVEL.DEBUG, `   ├─ 找到质检窗口 (策略: ${popoverResult.strategy})`);
            }

            if (!popoverContent) {
                // 尝试查找任何可见的popover
                const allPopovers = document.querySelectorAll('.ant-popover, [class*="popover"]');
                for (let i = 0; i < allPopovers.length; i++) {
                    const popover = allPopovers[i];
                    // 检查是否可见（不包含hidden类且在DOM中）
                    if (!popover.classList.contains('ant-popover-hidden') && popover.offsetParent !== null) {
                        popoverContent = popover;
                        log(LOG_LEVEL.DEBUG, '   ├─ 找到可见的质检窗口 (通过可见性检查)');
                        break;
                    }
                }

                if (!popoverContent) {
                    log(LOG_LEVEL.DEBUG, '   ├─ 未找到打开的质检窗口');
                    return null;
                }
            }

            // 使用多策略方法找到ul列表
            const ulStrategies = [
                // 策略1: 直接查找ul
                { type: 'selector', value: 'ul' },
                // 策略2: 在popover内容中查找ul
                { type: 'selector', value: '.ant-popover-content ul, .popover-content ul' },
                // 策略3: 通过结构定位
                { type: 'structure', parentSelector: popoverContent.tagName, childIndex: 0 }
            ];

            const ulResult = EnhancedElementSelector.findElementByMultipleStrategies(ulStrategies);
            let ul = null;

            if (ulResult) {
                ul = ulResult.element;
                log(LOG_LEVEL.DEBUG, `找到质检记录列表 (策略: ${ulResult.strategy})`);
            } else {
                // 回退到原有方法
                ul = popoverContent.querySelector('ul');
                if (!ul) {
                    log(LOG_LEVEL.DEBUG, '未找到质检记录列表');
                    return null;
                }
            }

            // 使用多策略方法获取所有li元素
            const liStrategies = [
                // 策略1: 直接查找li
                { type: 'selector', value: 'li' },
                // 策略2: 在ul中查找li
                { type: 'selector', value: 'ul li' },
                // 策略3: 通过类名特征查找
                { type: 'selector', value: 'li[class*="record"], li[class*="item"]' }
            ];

            const liResult = EnhancedElementSelector.findElementsByMultipleStrategies(liStrategies);
            let liElements = [];

            if (liResult) {
                liElements = liResult.elements;
                log(LOG_LEVEL.DEBUG, `找到质检记录数量: ${liElements.length} (策略: ${liResult.strategy})`);
            } else {
                // 回退到原有方法
                liElements = ul.querySelectorAll('li');
                if (liElements.length === 0) {
                    log(LOG_LEVEL.DEBUG, '质检记录列表为空');
                    return null;
                }
                log(LOG_LEVEL.DEBUG, '找到质检记录数量:', liElements.length);
            }

            // 遍历所有li元素，查找QA REJECTED的记录
            // 记录结构：
            // li > div > div.font-normal.flex > (div:1 = "质检1", div:2 = "已驳回")
            //     > div.flex.text-gray-400 > (div:1 = "操作人", div:2 = "时间")
            //     > div/DraftEditor-root = "驳回理由"

            let latestQARecord = null;
            let latestTime = null;

            for (let i = 0; i < liElements.length; i++) {
                const li = liElements[i];
                const liText = TextExtractor.extractText(li, { maxLength: 1000 });

                // 查找包含"质检"和"已驳回"的记录（支持多种格式）
                if ((liText.includes('质检') && liText.includes('已驳回')) ||
                    liText.includes('QA') && liText.includes('Rejected')) {
                    log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 找到QA驳回记录 ${i}: ${liText.substring(0, 50)}`);

                    // 提取操作人和时间
                    // 使用多策略方法查找时间信息容器
                    const timeDivStrategies = [
                        // 策略1: 原有类名
                        { type: 'selector', value: '.flex.text-gray-400' },
                        // 策略2: 通用flex容器
                        { type: 'selector', value: '.flex.justify-between, .time-info' },
                        // 策略3: 通过内容特征定位
                        { type: 'content', value: '操作人' }
                    ];

                    const timeDivResult = EnhancedElementSelector.findElementByMultipleStrategies(timeDivStrategies);
                    let timeDiv = null;

                    if (timeDivResult) {
                        timeDiv = timeDivResult.element;
                        log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 找到时间信息容器 (策略: ${timeDivResult.strategy})`);
                    } else {
                        // 回退到原有方法
                        timeDiv = li.querySelector('.flex.text-gray-400');
                    }

                    let operator = '';
                    let timeStr = '';

                    if (timeDiv) {
                        // 使用多策略方法查找时间信息div
                        const timeInfoStrategies = [
                            // 策略1: 查找所有div
                            { type: 'selector', value: 'div' },
                            // 策略2: 通过类名特征查找
                            { type: 'selector', value: 'div[class*="info"], div[class*="time"]' }
                        ];

                        const timeInfoResult = EnhancedElementSelector.findElementsByMultipleStrategies(timeInfoStrategies);
                        let divs = [];

                        if (timeInfoResult) {
                            divs = timeInfoResult.elements;
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 找到时间信息divs (策略: ${timeInfoResult.strategy})`);
                        } else {
                            // 回退到原有方法
                            divs = timeDiv.querySelectorAll('div');
                        }

                        if (divs.length >= 2) {
                            operator = TextExtractor.extractText(divs[0]);
                            timeStr = TextExtractor.extractText(divs[1]);
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 操作人: ${operator}, 时间: ${timeStr}`);
                        }
                    }

                    // 如果没有从特定div中提取到信息，尝试从li文本中解析
                    if (!operator || !timeStr) {
                        // 尝试从li的文本内容中提取操作人和时间
                        const timePattern = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/;
                        const match = liText.match(timePattern);
                        if (match) {
                            timeStr = match[1];
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 从文本中提取时间: ${timeStr}`);
                        }

                        // 尝试提取操作人（在时间之前的文本）
                        if (!operator && timeStr) {
                            const timeIndex = liText.indexOf(timeStr);
                            if (timeIndex > 0) {
                                const beforeTime = liText.substring(0, timeIndex).trim();
                                // 查找最后出现的冒号或空格后的文本作为操作人
                                const lastColon = beforeTime.lastIndexOf(':');
                                const lastSpace = beforeTime.lastIndexOf(' ');
                                const startIndex = Math.max(lastColon, lastSpace) + 1;
                                if (startIndex > 0 && startIndex < beforeTime.length) {
                                    operator = beforeTime.substring(startIndex).trim();
                                    log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 从文本中提取操作人: ${operator}`);
                                }
                            }
                        }
                    }

                    // 提取驳回理由
                    let rejectReason = '';

                    // 方法1: 从DraftEditor中提取
                    const draftEditorStrategies = [
                        // 策略1: 原有选择器
                        { type: 'selector', value: '.DraftEditor-root' },
                        // 策略2: 通过类名特征查找
                        { type: 'selector', value: '[class*="editor"], [class*="content"]' }
                    ];

                    const draftEditorResult = EnhancedElementSelector.findElementByMultipleStrategies(draftEditorStrategies);
                    let draftEditor = null;

                    if (draftEditorResult) {
                        draftEditor = draftEditorResult.element;
                        log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 找到DraftEditor (策略: ${draftEditorResult.strategy})`);
                    } else {
                        // 回退到原有方法
                        draftEditor = li.querySelector('.DraftEditor-root');
                    }

                    if (draftEditor) {
                        const spanWithTextStrategies = [
                            // 策略1: 原有选择器
                            { type: 'selector', value: 'span[data-text="true"]' },
                            // 策略2: 通过属性特征查找
                            { type: 'selector', value: 'span[contenteditable]' }
                        ];

                        const spanResult = EnhancedElementSelector.findElementByMultipleStrategies(spanWithTextStrategies);
                        let spanWithText = null;

                        if (spanResult) {
                            spanWithText = spanResult.element;
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 找到文本span (策略: ${spanResult.strategy})`);
                        } else {
                            // 回退到原有方法
                            spanWithText = draftEditor.querySelector('span[data-text="true"]');
                        }

                        if (spanWithText) {
                            rejectReason = TextExtractor.extractText(spanWithText, { maxLength: 2000 });
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 从DraftEditor提取到驳回理由: ${rejectReason}`);
                        }
                    }

                    // 方法2: 如果方法1失败，从第一个含文本的div提取
                    if (!rejectReason) {
                        const divWithTextStrategies = [
                            // 策略1: 原有选择器
                            { type: 'selector', value: 'div.min-h-fit' },
                            // 策略2: 通过类名特征查找
                            { type: 'selector', value: 'div[class*="text"], div[class*="content"]' },
                            // 策略3: 通过内容特征查找
                            { type: 'content', value: '驳回' }
                        ];

                        const divResult = EnhancedElementSelector.findElementByMultipleStrategies(divWithTextStrategies);
                        let divWithText = null;

                        if (divResult) {
                            divWithText = divResult.element;
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 找到文本div (策略: ${divResult.strategy})`);
                        } else {
                            // 回退到原有方法
                            divWithText = li.querySelector('div.min-h-fit');
                        }

                        if (divWithText) {
                            rejectReason = TextExtractor.extractText(divWithText, { maxLength: 2000 });
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 从div.min-h-fit提取到内容: ${rejectReason}`);
                        }
                    }

                    // 方法3: 从其他可能包含文本的div中提取
                    if (!rejectReason) {
                        const allDivsStrategies = [
                            // 策略1: 查找所有div
                            { type: 'selector', value: 'div' },
                            // 策略2: 通过类名特征查找
                            { type: 'selector', value: 'div[class]' }
                        ];

                        const allDivsResult = EnhancedElementSelector.findElementsByMultipleStrategies(allDivsStrategies);
                        let allDivs = [];

                        if (allDivsResult) {
                            allDivs = allDivsResult.elements;
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 找到所有div (策略: ${allDivsResult.strategy})`);
                        } else {
                            // 回退到原有方法
                            allDivs = li.querySelectorAll('div');
                        }

                        for (let j = 0; j < allDivs.length; j++) {
                            const divText = TextExtractor.extractText(allDivs[j]);
                            // 排除操作人、时间和其他已知的标签文本
                            if (divText &&
                                divText !== operator &&
                                divText !== timeStr &&
                                !divText.includes('质检') &&
                                !divText.includes('已驳回') &&
                                !divText.includes('QA') &&
                                !divText.includes('Rejected') &&
                                !timePattern.test(divText)) {
                                rejectReason = divText;
                                log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 从div[${j}]提取到驳回理由: ${rejectReason}`);
                                break;
                            }
                        }
                    }

                    // 方法4: 如果以上都失败，使用li中除已知信息外的其他文本
                    if (!rejectReason) {
                        let remainingText = liText;
                        // 移除已知的信息
                        remainingText = remainingText.replace(operator, '').replace(timeStr, '');
                        remainingText = remainingText.replace(/质检\d*|已驳回|QA|Rejected/g, '');
                        remainingText = remainingText.replace(timePattern, '').trim();

                        if (remainingText && remainingText.length > 5) {
                            rejectReason = remainingText;
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 从剩余文本提取驳回理由: ${rejectReason}`);
                        }
                    }

                    // 比较时间戳，选择最新的记录
                    if (timeStr) {
                        const recordTime = new Date(timeStr).getTime();
                        if (!latestTime || recordTime > latestTime) {
                            latestQARecord = {
                                operator: operator,
                                operateTime: timeStr,
                                comment: rejectReason,
                                timestamp: recordTime
                            };
                            latestTime = recordTime;
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 更新最新QA记录为索引 ${i}`);
                        }
                    } else if (!latestTime) {
                        // 如果没有时间信息，至少返回找到的第一条记录
                        latestQARecord = {
                            operator: operator || 'Unknown',
                            operateTime: 'Unknown',
                            comment: rejectReason,
                            timestamp: Date.now()
                        };
                        latestTime = Date.now();
                        log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 返回无时间信息的QA记录 索引 ${i}`);
                    }
                }
            }

            if (latestQARecord) {
                log(LOG_LEVEL.DEBUG, '成功从DOM提取最新QA驳回记录');
                return latestQARecord;
            } else {
                log(LOG_LEVEL.DEBUG, '未找到QA驳回记录');
                return null;
            }

        } catch (error) {
            return ErrorHandler.handleDOMError(error, '从DOM提取QA驳回理由时出错');
        }
    }
    
    // 移除旧的驳回理由提取函数，只保留基于两步交互模式的实现

    // 监听用户选择状态变化
    function attachUserSelectionListeners() {
        log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始附加用户选择状态监听器');

        // 查找可能的单选按钮或选择元素
        const selectionElements = ElementSelector.selectAll([
            'input[type="radio"]',
            'input[type="checkbox"]',
            '.radio-button',
            '.checkbox',
            '.selection-option',
            '[role="radio"]',
            '[role="checkbox"]',
            '[aria-checked]'
        ]);

        // 查找质检详情显示按钮（向下箭头图标）
        const qualityCheckTriggerElements = ElementSelector.selectAll([
            '.anticon-down',
            '[aria-label="down"]',
            '[data-icon="down"]',
            '.icon-down',
            '[class*="arrow"]'
        ]);

        // 为质检详情触发元素添加点击监听器
        qualityCheckTriggerElements.forEach((element, index) => {
            element.addEventListener('click', function() {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到质检详情触发元素点击:', {
                    element: element.tagName,
                    className: element.className,
                    ariaLabel: element.getAttribute('aria-label'),
                    index: index
                });

                // 延迟执行质检记录提取，等待面板显示
            });
        });

        selectionElements.forEach((element, index) => {
            // 监听点击事件
            element.addEventListener('click', function() {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到选择元素点击:', {
                    element: element.tagName,
                    id: element.id,
                    className: element.className,
                    index: index
                });
                // 延迟执行状态检测，等待页面更新
                setTimeout(() => {
                    if (collectedData.responseElements) {
                        detectUserSelectionStatus(collectedData.responseElements);
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 用户选择后重新检测状态');
                    }
                }, 100);
            });

            // 监听变化事件（对于表单元素）
            if (element.tagName === 'INPUT' && (element.type === 'radio' || element.type === 'checkbox')) {
                element.addEventListener('change', function() {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到选择元素变化:', {
                        element: element.tagName,
                        id: element.id,
                        className: element.className,
                        checked: element.checked,
                        index: index
                    });
                    // 延迟执行状态检测，等待页面更新
                    setTimeout(() => {
                        if (collectedData.responseElements) {
                            detectUserSelectionStatus(collectedData.responseElements);
                            log(LOG_LEVEL.INFO, '[Appen Data Collector] 用户选择变化后重新检测状态');
                        }
                    }, 100);
                });
            }
        });

        // 监听可能影响状态的按钮点击
        const actionButtons = ElementSelector.selectAll([
            'button',
            '.btn',
            '[role="button"]',
            '[type="button"]',
            '.action-btn'
        ]);

        actionButtons.forEach((button, index) => {
            button.addEventListener('click', function() {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到按钮点击:', {
                    buttonText: button.textContent.trim(),
                    id: button.id,
                    className: button.className,
                    index: index
                });
                // 延迟执行状态检测，等待页面更新
                setTimeout(() => {
                    if (collectedData.responseElements) {
                        detectUserSelectionStatus(collectedData.responseElements);
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 按钮点击后重新检测状态');
                    }
                }, 300); // 稍长延迟，因为按钮点击可能触发更多页面变化
            });
        });

        // 使用 MutationObserver 监听 DOM 变化
        const observer = new MutationObserver(function(mutations) {
            let shouldCheckStatus = false;

            mutations.forEach(function(mutation) {
                // 检查是否有文本内容变化
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    // 检查变化的节点是否包含状态相关文本
                    const target = mutation.target;
                    if (target.nodeType === Node.TEXT_NODE) {
                        const text = target.textContent.trim().toLowerCase();
                        if (text.includes('有效') || text.includes('无效') || text.includes('valid') || text.includes('invalid') ||
                            text.includes('轮') || text.includes('round') || text.match(/\d+\s*轮/)) {
                            shouldCheckStatus = true;
                        }
                    } else if (target.nodeType === Node.ELEMENT_NODE) {
                        const text = target.textContent.trim().toLowerCase();
                        if (text.includes('有效') || text.includes('无效') || text.includes('valid') || text.includes('invalid') ||
                            text.includes('轮') || text.includes('round') || text.match(/\d+\s*轮/)) {
                            shouldCheckStatus = true;
                        }
                    }
                }

                // 检查是否有相关的属性变化
                if (mutation.type === 'attributes') {
                    if (mutation.attributeName === 'class' || mutation.attributeName === 'data-status' ||
                        mutation.attributeName === 'checked' || mutation.attributeName === 'aria-checked') {
                        shouldCheckStatus = true;
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到相关属性变化:', mutation.attributeName);
                    }
                }
            });

            if (shouldCheckStatus) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到可能影响状态的DOM变化');
                // 防抖处理，避免频繁检测
                clearTimeout(window._statusCheckTimeout);
                window._statusCheckTimeout = setTimeout(() => {
                    if (collectedData.responseElements) {
                        detectUserSelectionStatus(collectedData.responseElements);
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] DOM变化后重新检测状态');
                    }
                }, 200);
            }
        });

        // 开始观察
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'data-status', 'checked', 'aria-checked']
        });

        log(LOG_LEVEL.INFO, '[Appen Data Collector] 已附加用户选择状态监听器，监听元素数量:', selectionElements.length + actionButtons.length);
    }

    // 停止数据收集
    function stopDataCollection() {
        isCollectorActive = false;
        // 最后推送一次数据
        pushDataOnSubmission();
    }

    // 公共接口
    window.AppenDataCollector = {
        // 手动推送数据
        pushData: pushDataOnSubmission,
        // 停止数据收集
        stop: stopDataCollection,
        // 获取当前收集的数据
        getData: function() {
            return {
                ...collectedData,
                elapsedTime: Math.floor((Date.now() - collectedData.startTime) / 1000)
            };
        },
        // 输出所有质检驳回信息到控制台
        logQualityCheckInfo: logAllQualityCheckInfo,
        // 获取最新的认证cookie
        getLatestAuthCookies: async function() {
            try {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 获取最新的认证cookie');
                const authCookies = await getAuthCookies();
                if (authCookies) {
                    collectedData.authCookies = authCookies;
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 认证cookie已更新:', authCookies);
                }
                return authCookies;
            } catch (error) {
                log(LOG_LEVEL.ERROR, '[Appen Data Collector] 获取最新认证cookie失败:', error);
                return null;
            }
        },
        // 获取详细的Cookie信息用于显示
        getDetailedCookies: async function() {
            try {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 获取详细的Cookie信息');
                const authCookies = await getAuthCookies();
                if (authCookies) {
                    collectedData.authCookies = authCookies;
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 详细的Cookie信息已更新:', authCookies);
                }
                return authCookies;
            } catch (error) {
                log(LOG_LEVEL.ERROR, '[Appen Data Collector] 获取详细Cookie信息失败:', error);
                return null;
            }
        },
        // 重置收集器
        reset: function() {
            collectedData = {
                userId: collectedData.userId,
                taskId: null,
                topicId: null,
                topicUrl: null,
                startTime: Date.now(),
                elapsedTime: 0,
                topicNum: 0
            };

            // 重新收集任务和主题信息
            collectTaskInfo();
            collectTopicInfo();
        },
        // 手动触发标注完成推送
        submitAnnotation: pushDataOnSubmission,
        // 手动提取响应元素
        extractResponseElements: function() {
            // 只在目标页面允许提取响应元素
            if (!isTargetPage()) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 当前不是目标页面，无法提取响应元素');
                return null;
            }
            return extractResponseElements();
        },
        // 检查是否为目标页面
        isTargetPage: isTargetPage,
        // 获取认证cookie
        getAuthCookies: function() {
            // 只在目标页面允许获取cookie
            if (!isTargetPage()) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 当前不是目标页面，无法获取cookie');
                return Promise.resolve(null);
            }
            return getAuthCookies();
        },
        // 同步认证信息到服务端
        syncAuthToServer: function(authCookies) {
            return syncAuthToServer(authCookies);
        },
        // 显示数据模态框
        showModal: showDataModal
    };

    // 定期检查URL变化和页面内容变化
    function watchUrlChanges() {
        log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始监控URL变化和页面内容变化');
        console.log('[Appen Data Collector] watchUrlChanges: 开始监控');
        let lastUrl = location.href;
        let lastCheckTime = Date.now();
        console.log('[Appen Data Collector] watchUrlChanges: 初始URL:', lastUrl);

        new MutationObserver(() => {
            const url = location.href;
            const now = Date.now();

            // 检查 URL 变化
            if (url !== lastUrl) {
                console.log('[Appen Data Collector] watchUrlChanges: URL变化检测到:', { from: lastUrl, to: url });
                log(LOG_LEVEL.INFO, '[Appen Data Collector] URL确实发生变化:', { from: lastUrl, to: url });
                lastUrl = url;
                onUrlChange();
            }
            // 即使 URL 没有变化，也定期检查页面内容（每3秒检查一次）
            else if (now - lastCheckTime > 3000) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] URL未变化，但定期检查页面内容');
                lastCheckTime = now;
                checkPageContentChange();
            }
        }).observe(document, { subtree: true, childList: true });
    }


    // 检查页面内容变化
    function checkPageContentChange() {
        // 只在目标页面上检查
        if (isTargetPage()) {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 定期检查目标页面内容变化');
            
            // 获取当前题目ID
            const currentTopicId = getSpecifiedElementId(true); // 传入 true 表示这是定期检查

            log(LOG_LEVEL.INFO, '[Appen Data Collector] 检查题目ID变化:', {
                lastTopicId: lastTopicId,
                currentTopicId: currentTopicId
            });
            
            // 检测题目ID是否变化（新的标注页）
            if (lastTopicId !== null && lastTopicId !== currentTopicId && currentTopicId !== null && currentTopicId !== 'no-id') {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到新的标注页面，题目ID发生变化:', {
                    oldTopicId: lastTopicId,
                    newTopicId: currentTopicId
                });
                
                // 重置开始时间
                const newStartTime = Date.now();
                collectedData.startTime = newStartTime;

                log(LOG_LEVEL.INFO, '[Appen Data Collector] 重置计时器，新的开始时间:', new Date(newStartTime).toISOString());
                
                // 重新收集题目信息
                collectTopicInfo();
                
                // 提取响应元素
                setTimeout(() => {
                    extractResponseElements();
                    attachUserSelectionListeners();
                }, 500);
            }
            
            // 更新上一个题目ID并保存到缓存
            lastTopicId = currentTopicId;
            if (currentTopicId && currentTopicId !== 'no-id') {
                saveCachedTopicId(currentTopicId);
            }
        }
    }

    // 获取目标 div 的 id
    function getTargetDivId() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始查找目标 div 元素');

            // 尝试多种选择器
            const selectors = [
                'body > div:nth-child(2) form > div > main > div > div > div > div > div > div > div > div > div > div',
                'form main .ant-card-body',
                '.ant-card-body > div',
                '[class*="question"]',
                '[class*="task"]',
                '[data-testid*="question"]',
                '[role="main"] div'
            ];

            let targetDiv = null;

            for (const selector of selectors) {
                targetDiv = document.querySelector(selector);
                if (targetDiv) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 使用选择器找到目标 div:', selector);
                    break;
                }
            }

            // 如果常规选择器都没找到，尝试查找包含特定内容的 div
            if (!targetDiv) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 常规选择器未找到，尝试查找包含题目内容的 div');
                const allDivs = Array.from(ElementSelector.selectAll('div'));
                targetDiv = allDivs.find(div => {
                    const text = div.textContent.trim();
                    // 查找可能包含题目内容的 div（根据常见模式）
                    return text.length > 10 &&
                           (text.includes('题目') || text.includes('问题') || text.includes('Question') ||
                            div.children.length > 0);
                });
                if (targetDiv) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过内容匹配找到目标 div');
                }
            }

            if (!targetDiv) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 未找到目标 div，尝试获取页面上所有主要的 div 元素');
                const mainDivs = ElementSelector.selectAll([
                    'main > div',
                    '.main > div',
                    '[role="main"] > div',
                    'main > *',
                    '.main-content > div'
                ]);
                if (mainDivs.length > 0) {
                    // 选择第二个 div，通常是题目容器
                    targetDiv = mainDivs[Math.min(1, mainDivs.length - 1)];
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过 main 查找找到目标 div，索引:', Math.min(1, mainDivs.length - 1));
                }
            }

            if (!targetDiv) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 未找到目标 div');
                return null;
            }

            const divId = targetDiv.id || targetDiv.getAttribute('data-id') || targetDiv.getAttribute('data-key') || 'no-id';
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 目标 div id:', divId);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 目标 div 类名:', targetDiv.className);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 目标 div 内容预览:', targetDiv.textContent.substring(0, 100));

            return divId;
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 获取目标 div id 失败:', error);
            return null;
        }
    }

    // 获取指定 XPath 元素的 ID
    function getSpecifiedElementId(isPeriodicCheck = false) {
        try {
            const currentUrl = window.location.href;
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始查找指定路径的 div 元素');
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 当前页面 URL:', currentUrl);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 是否为定期检查:', isPeriodicCheck);

            // 检查是否是新页面
            const isNewPage = currentPageUrl !== currentUrl;
            if (isNewPage) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到新页面加载');
                currentPageUrl = currentUrl;
            }

            // 检查页面上是否存在 div 元素
            const allDivs = ElementSelector.selectAll('div');
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 页面上 div 元素总数:', allDivs.length);

            // 尝试多种方法查找目标元素
            let targetDiv = null;
            let methodUsed = '';

            // 方法1: 原始XPath查找
            try {
                targetDiv = document.evaluate(
                    '/html/body/div[2]/form/div/main/div/div/div/div/div/div/div/div/div/div',
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
                if (targetDiv) {
                    methodUsed = 'XPath';
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过XPath找到目标元素');
                }
            } catch (xpathError) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] XPath查找失败:', xpathError.message);
            }

            // 方法2: CSS选择器查找
            if (!targetDiv) {
                try {
                    const cssSelectors = [
                        'body > div:nth-child(2) > form > div > main > div > div > div > div > div > div > div > div > div > div',
                        'form main .ant-card-body > div',
                        '.ant-card-body > div > div',
                        '[class*="question"] > div',
                        '[class*="task"] > div',
                        'main > div > div > div > div > div > div > div > div > div'
                    ];

                    for (const selector of cssSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            targetDiv = element;
                            methodUsed = 'CSS: ' + selector;
                            log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过CSS选择器找到目标元素:', selector);
                            break;
                        }
                    }
                } catch (cssError) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] CSS选择器查找失败:', cssError.message);
                }
            }

            // 方法3: 通过内容特征查找
            if (!targetDiv) {
                try {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 尝试通过内容特征查找目标元素');
                    const allDivsArray = Array.from(ElementSelector.selectAll('div'));
                    targetDiv = allDivsArray.find(div => {
                        // 查找可能包含题目内容的div
                        const text = div.textContent.trim();
                        return text.length > 20 &&
                               (text.includes('题目') || text.includes('问题') || text.includes('Question') ||
                                text.includes('Task') || text.includes('标注')) &&
                               div.children.length > 0;
                    });
                    if (targetDiv) {
                        methodUsed = 'Content Matching';
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过内容匹配找到目标元素');
                    }
                } catch (contentError) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 内容匹配查找失败:', contentError.message);
                }
            }

            // 方法4: 查找具有特定属性的元素
            if (!targetDiv) {
                try {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 尝试通过属性查找目标元素');
                    const attributeSelectors = [
                        '[data-testid*="question"]',
                        '[data-id]',
                        '[id*="question"]',
                        '[id*="task"]'
                    ];

                    for (const selector of attributeSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            targetDiv = element;
                            methodUsed = 'Attribute: ' + selector;
                            log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过属性选择器找到目标元素:', selector);
                            break;
                        }
                    }
                } catch (attrError) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 属性选择器查找失败:', attrError.message);
                }
            }

            log(LOG_LEVEL.INFO, '[Appen Data Collector] 查找结果 - 方法:', methodUsed || 'None', '元素:', targetDiv);

            if (!targetDiv) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 未找到指定路径的 div 元素');

                // 尝试获取页面上主要的div元素作为备选
                try {
                    const mainDivs = ElementSelector.selectAll([
                        'main > div',
                        '.main > div',
                        '[role="main"] > div',
                        'main > *',
                        '.main-content > div'
                    ]);
                    if (mainDivs.length > 0) {
                        // 选择包含内容较多的div
                        let bestDiv = mainDivs[0];
                        let maxContentLength = 0;

                        mainDivs.forEach(div => {
                            const contentLength = div.textContent.length;
                            if (contentLength > maxContentLength) {
                                maxContentLength = contentLength;
                                bestDiv = div;
                            }
                        });

                        targetDiv = bestDiv;
                        methodUsed = 'Main Content Selection';
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 通过主要内容选择找到备选元素');
                    }
                } catch (mainError) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 主内容选择失败:', mainError.message);
                }

                if (!targetDiv) {
                    return null;
                }
            }

            const divId = targetDiv.id || targetDiv.getAttribute('data-id') || targetDiv.getAttribute('data-key') || 'no-id';
            log(LOG_LEVEL.INFO, '[Appen Data Collector] =============== getSpecifiedElementId 返回结果 ===============');
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 找到的 div 元素 id:', divId);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] div.id:', targetDiv.id);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] div[data-id]:', targetDiv.getAttribute('data-id'));
            log(LOG_LEVEL.INFO, '[Appen Data Collector] div[data-key]:', targetDiv.getAttribute('data-key'));
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 使用的方法:', methodUsed);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 元素类名:', targetDiv.className);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 元素内容预览:', targetDiv.textContent.substring(0, 100));
            log(LOG_LEVEL.INFO, '[Appen Data Collector] =============== 返回 divId: ' + divId + ' ===============');

            // 检查是否是新 ID 或定期检查时 ID 发生变化
            if ((isNewPage || isPeriodicCheck) && lastSpecifiedElementId !== null) {
                if (lastSpecifiedElementId !== divId) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到页面内容变化，新旧 ID 不同:', {
                        oldId: lastSpecifiedElementId,
                        newId: divId,
                        isNewPage: isNewPage,
                        isPeriodicCheck: isPeriodicCheck,
                        method: methodUsed
                    });
                } else if (isPeriodicCheck) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 定期检查，ID 未发生变化:', divId);
                } else {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到页面切换，但 ID 相同:', divId);
                }
            }

            // 缓存当前 ID
            lastSpecifiedElementId = divId;

            // 将指定元素 ID 作为题目 ID 存储
            if (divId && divId !== 'no-id') {
                specifiedElementIdAsTopicId = divId;
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 将指定元素 ID 作为题目 ID 存储:', divId);

                // 更新 collectedData 中的 topicId
                if (collectedData) {
                    collectedData.topicId = extractNumericTopicId(divId);
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 更新 collectedData.topicId:', collectedData.topicId);
                }
            }

            return divId;
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 获取指定路径 div 元素 id 失败:', error);
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 错误堆栈:', error.stack);
            return null;
        }
    }

    // URL变化时的处理函数
    async function onUrlChange() {
        log(LOG_LEVEL.INFO, '[Appen Data Collector] URL变化检测:', window.location.href);
        console.log('[Appen Data Collector] onUrlChange: 开始处理URL变化');
        console.log('[Appen Data Collector] onUrlChange: 当前URL:', window.location.href);

        // 先从缓存读取用户ID（如果还没有的话）
        if (!collectedData.userId || collectedData.userId === 'unknown_user') {
            const cachedUserId = await getCachedUserId();
            if (cachedUserId) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] URL变化时从缓存读取用户ID:', cachedUserId);
                collectedData.userId = cachedUserId;
            }
        }

        const isTarget = isTargetPage();
        console.log('[Appen Data Collector] onUrlChange: isTargetPage():', isTarget);
        
        if (isTarget) {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到标注页面URL变化');
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 当前页面 URL:', window.location.href);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] URL 匹配结果:', isTargetPage());
            console.log('[Appen Data Collector] onUrlChange: 进入目标页面处理流程');

            // 获取当前的目标 div id
            const currentDivId = getTargetDivId();
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 当前 div id:', currentDivId);

            // 获取指定路径元素的 ID
            const specifiedElementId = getSpecifiedElementId(false); // 传入 false 表示这不是定期检查
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 指定路径元素 ID:', specifiedElementId);

            // 收集任务信息以获取任务ID
            collectTaskInfo();
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 当前任务ID:', collectedData.taskId);

            // 检查是否是新任务
            const isNewTask = lastTaskId !== collectedData.taskId && collectedData.taskId !== null && collectedData.taskId !== 'unknown_task';
            if (isNewTask) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到新任务，重置计时器');
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 上一个任务ID:', lastTaskId, '当前任务ID:', collectedData.taskId);
                lastTaskId = collectedData.taskId;

                // 重置开始时间
                const newStartTime = Date.now();
                collectedData.startTime = newStartTime;
                await clearCachedStartTime(); // 清除旧的缓存
                await saveCachedStartTime(newStartTime); // 保存新的开始时间
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 新任务的开始时间已保存到缓存:', new Date(newStartTime).toISOString());
            } else {
                // 如果是同一个任务或题目，检查是否已有缓存的开始时间
                const cachedStartTime = await getCachedStartTime();
                if (cachedStartTime) {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 从缓存读取任务开始时间，继续计时，不重置计时器');
                    collectedData.startTime = cachedStartTime;
                } else {
                    // 缓存中没有，说明是第一次进入标注页面或缓存已清除
                    const newStartTime = Date.now();
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 第一次进入标注页面或缓存已清除，记录开始时间');
                    collectedData.startTime = newStartTime;
                    await saveCachedStartTime(newStartTime);
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始时间已保存到缓存:', new Date(newStartTime).toISOString());
                }
            }

            if (!collectedData.responseElements) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始提取响应元素');
                log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 当前页面URL:', window.location.href);

                // 获取认证cookie
                try {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 获取认证cookie');
                    const authCookies = await getAuthCookies();
                    if (authCookies) {
                        log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 成功获取认证cookie');
                        collectedData.authCookies = authCookies;
                        // 同步认证信息到服务端
                        await syncAuthToServer(authCookies);
                    } else {
                        log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 未获取到认证cookie');
                    }
                } catch (error) {
                    log(LOG_LEVEL.WARN, '[Appen Data Collector] 获取认证cookie失败:', error);
                    log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 认证cookie错误详情:', {
                        message: error.message,
                        stack: error.stack
                    });
                }

                // 提取响应元素
                log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 设置1秒后提取响应元素的定时器');
                setTimeout(() => {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始提取响应元素');
                    extractResponseElements();
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 响应元素提取完成');

                    // 使用新的优化工作流处理页面
                    setTimeout(() => {
                        handleAnnotationPage();
                    }, 500); // 等待响应元素提取完成后再处理页面
                }, 1000); // 等待页面加载完成
            } else {
                // 如果已经有响应元素，直接处理页面
                handleAnnotationPage();
            }
        } else {
            // 离开标注页面时清除缓存的开始时间
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 离开标注页面，清除缓存的开始时间');
            await clearCachedStartTime();
            // 重置上一个任务ID
            lastTaskId = null;
        }
    }

    // 页面状态管理对象
    const pageState = {
        isRejected: null,        // 是否为返修页
        rejectReasonCollected: false, // 驳回理由是否已收集
        basicInfoCollected: false,    // 基础信息是否已收集
        lastProcessedUrl: null        // 上次处理的URL
    };

    // 主页面处理函数
    async function handleAnnotationPage() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] ========== 开始处理标注页面 ==========');
            console.log('[Appen Data Collector] ========== 开始处理标注页面 ==========');

            // 检查是否已经处理过当前页面
            const currentUrl = window.location.href;
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 当前URL:', currentUrl);
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 上次处理URL:', pageState.lastProcessedUrl);
            
            if (pageState.lastProcessedUrl === currentUrl) {
                log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 页面已处理过，跳过重复处理');
                console.log('[Appen Data Collector] 页面已处理过，跳过重复处理');
                return;
            }

            // 更新最后处理的URL
            pageState.lastProcessedUrl = currentUrl;

            // 重置页面状态
            pageState.isRejected = null;
            pageState.rejectReasonCollected = false;
            pageState.basicInfoCollected = false;

            // 页面处理开始的日志记录
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始处理页面内容');
            console.log('[Appen Data Collector] 开始处理页面内容');

            // 减少延迟时间，更快响应
            await new Promise(resolve => setTimeout(resolve, 200));

            // 首先判断是否为返修页
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始检查页面是否为返修页...');
            const isRejected = isCurrentPageRejected();
            pageState.isRejected = isRejected;

            log(LOG_LEVEL.INFO, '[Appen Data Collector] 页面返修状态检查完成:', { isRejected });
            console.log('[Appen Data Collector] 页面返修状态:', isRejected);
            console.log('[Appen Data Collector] ========== 返修状态: ' + (isRejected ? '是' : '否') + ' ==========');

            // 根据返修状态显示相应的提示
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 准备显示状态提示...');
            console.log('[Appen Data Collector] 准备显示状态提示...');

            // 如果是返修页，显示返修题提示
            if (isRejected) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] ========== 检测到返修页 ==========');
                console.log('[Appen Data Collector] ========== 检测到返修页 ==========');
                showReworkPageNotification(); // 显示返修题提示

                log(LOG_LEVEL.INFO, '[Appen Data Collector] 优先收集驳回理由...');
                console.log('[Appen Data Collector] 优先收集驳回理由...');
                await collectRejectReason();
                pageState.rejectReasonCollected = true;
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 驳回理由收集完成');
            } else {
                // 新题页显示新题提示
                log(LOG_LEVEL.INFO, '[Appen Data Collector] ========== 当前为新题页 ==========');
                console.log('[Appen Data Collector] ========== 当前为新题页 ==========');
                showNewOldStatusNotification(false);
            }

            // 减少延迟时间，更快收集基础信息
            await new Promise(resolve => setTimeout(resolve, 100));

            // 收集基础信息（所有页面都需要）
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始收集基础信息...');
            await collectBasicInfo();
            pageState.basicInfoCollected = true;
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 基础信息收集完成');

            log(LOG_LEVEL.INFO, '[Appen Data Collector] ========== 页面处理完成 ==========');
            console.log('[Appen Data Collector] ========== 页面处理完成 ==========');
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 处理标注页面时出错:', error);
            console.error('[Appen Data Collector] 处理标注页面时出错:', error);
        }
    }

    // 收集驳回理由函数（返修页专用）
    async function collectRejectReason() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始收集驳回理由');

            // 检查是否需要应用降级策略
            const shouldDegrade = ErrorHandler.degradationManager.shouldDegrade('collectRejectReason', 0);
            if (shouldDegrade) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 检测到高频错误，应用降级策略');
                ErrorHandler.degradationManager.applyDegrade('collectRejectReason', 'dom');
            }

            // 实现两步交互模式：首先关闭通知，然后双击信息图标
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 实施两步交互模式获取驳回详情');

            // 步骤1: 查找并点击关闭通知按钮（使用多策略定位）
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 查找关闭通知按钮...');

            // 定义关闭按钮的多策略定位方案
            const closeButtonStrategies = [
                // 策略1: 原有的ID模式匹配（最精确）
                { type: 'selector', value: '[id$="_244"]' },
                // 策略2: 通过特定类名和属性特征定位（更精确）
                { type: 'selector', value: 'button[aria-label="close"]' },
                // 策略3: 通过结构定位（父容器特征）
                { type: 'structure', parentSelector: '.ant-notification-notice', childIndex: 1 }
            ];

            const closeButtonResult = EnhancedElementSelector.findElementByMultipleStrategies(closeButtonStrategies);
            let closeButtonClicked = false;

            if (closeButtonResult) {
                const closeButton = closeButtonResult.element;
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 找到关闭通知按钮，使用策略:', closeButtonResult.strategy);
                try {
                    log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 点击关闭按钮:', closeButton);
                    const clickEvent = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    closeButton.dispatchEvent(clickEvent);
                    closeButtonClicked = true;
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 成功点击关闭按钮');
                } catch (clickError) {
                    ErrorHandler.handleDOMError(clickError, '[Appen Data Collector] 点击关闭按钮失败');
                }
            } else {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 未找到关闭通知按钮，尝试直接双击信息图标');
            }

            // 如果点击了关闭按钮，减少等待时间让UI更新
            if (closeButtonClicked) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 等待UI更新完成...');
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // 步骤2: 查找并双击信息图标（使用多策略定位）
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 查找信息图标...');

            // 定义信息图标的多策略定位方案
            const infoIconStrategies = [
                // 策略1: 原有的ID模式匹配（最精确）
                { type: 'selector', value: '[id$="_197"]' },
                // 策略2: 通过SVG内容特征定位（基于用户提供的SVG）
                { type: 'svg', value: 'M2.5 2.06301V0L1.5 0L1.5 2.06301C0.637386 2.28503 0 3.06808 0 4C0 4.93192 0.637386 5.71497 1.5 5.93699L1.5 10.063C0.637387 10.285 0 11.0681 0 12C0 12.9319 0.637386 13.715 1.5 13.937V16H2.5V13.937C3.36261 13.715 4 12.9319 4 12C4 11.0681 3.36261 10.285 2.5 10.063L2.5 5.93699C3.36261 5.71497 4 4.93192 4 4C4 3.06808 3.36261 2.28503 2.5 2.06301ZM2 11C1.44772 11 1 11.4477 1 12C1 12.5523 1.44772 13 2 13C2.55228 13 3 12.5523 3 12C3 11.4477 2.55228 11 2 11ZM2 5C2.55228 5 3 4.55228 3 4C3 3.44772 2.55228 3 2 3C1.44772 3 1 3.44772 1 4C1 4.55228 1.44772 5 2 5ZM14 4.5L6 4.5V3.5L14 3.5V4.5ZM6 6.5L11 6.5V5.5L6 5.5V6.5ZM14 11.5H6V10.5H14V11.5ZM6 13.5H11V12.5H6V13.5Z' },
                // 策略3: 通过特定类名和属性特征定位（更精确）
                { type: 'selector', value: '.anticon-info-circle' },
                // 策略4: 通过结构定位（在特定容器内）
                { type: 'structure', parentSelector: '.ant-notification-notice', childIndex: 0 },
                // 策略5: 通过XPath定位（假定结构）
                { type: 'xpath', value: '//span[contains(@class, "anticon") and contains(@aria-label, "info") and not(contains(text(), "标注"))]' }
            ];

            const infoIconResult = EnhancedElementSelector.findElementByMultipleStrategies(infoIconStrategies);
            let infoIconClicked = false;

            if (infoIconResult) {
                const infoIcon = infoIconResult.element;
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 找到信息图标，使用策略:', infoIconResult.strategy);
                try {
                    log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 双击信息图标:', infoIcon);
                    // 双击事件 - 模拟两次点击来实现双击效果
                    const clickEvent1 = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    infoIcon.dispatchEvent(clickEvent1);

                    // 短暂延迟后发送第二次点击事件
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const clickEvent2 = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    infoIcon.dispatchEvent(clickEvent2);

                    infoIconClicked = true;
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 成功双击信息图标');
                } catch (clickError) {
                    ErrorHandler.handleDOMError(clickError, '[Appen Data Collector] 双击信息图标失败');
                }
            } else {
                log(LOG_LEVEL.WARN, '[Appen Data Collector] 未找到信息图标');
            }

            // 如果双击了信息图标，减少等待时间让内容加载
            if (infoIconClicked) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 等待驳回详情内容加载...');
                await new Promise(resolve => setTimeout(resolve, 400));
            }

            // 从DOM中提取最新的驳回理由（基于两步交互策略）
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 使用两步交互策略提取驳回理由...');
            const rejectInfo = extractLatestQARejectFromDOM();

            if (rejectInfo) {
                // 保存驳回信息到全局变量
                if (!collectedData.qualityCheckInfo) {
                    collectedData.qualityCheckInfo = {};
                }

                collectedData.qualityCheckInfo.rejectReason = rejectInfo.comment;
                collectedData.qualityCheckInfo.rejectOperator = rejectInfo.operator;
                collectedData.qualityCheckInfo.rejectTime = rejectInfo.operateTime;

                // 同时设置responseElements.qualityCheckRecord以保持兼容性
                if (collectedData.responseElements) {
                    collectedData.responseElements.qualityCheckRecord = {
                        hasRecord: true,
                        dataSource: 'TWO_STEP_INTERACTION_ENHANCED',
                        timestamp: new Date().toISOString(),
                        latestRecord: {
                            type: 'REJECTED',
                            action: `被 ${rejectInfo.operator || 'QA'} Rejected 请修订`,
                            comment: rejectInfo.comment || '',
                            operator: rejectInfo.operator || 'QA',
                            operateTime: rejectInfo.operateTime || ''
                        }
                    };
                }

                log(LOG_LEVEL.INFO, '[Appen Data Collector] 驳回理由收集成功:', {
                    reason: rejectInfo.comment,
                    operator: rejectInfo.operator,
                    time: rejectInfo.operateTime
                });

                // 显示质检驳回信息提示
                showRejectInfoNotification(rejectInfo);

                // 输出到控制台以便调试
                console.log('[Appen Data Collector] 驳回理由:', TextExtractor.extractText({ textContent: rejectInfo.comment }, { maxLength: 200 }));
                console.log('[Appen Data Collector] 操作人:', TextExtractor.extractText({ textContent: rejectInfo.operator }));
                console.log('[Appen Data Collector] 操作时间:', TextExtractor.extractText({ textContent: rejectInfo.operateTime }));
            } else {
                log(LOG_LEVEL.WARN, '[Appen Data Collector] 两步交互策略未找到驳回理由信息');

                // 优先使用两步交互策略，只有在明确需要时才考虑其他方法
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 两步交互策略是主要方法，不使用其他回退方式');
                // 显示提示
                showRejectInfoNotification(null);
            }

            // 如果之前双击了信息图标，再次双击以关闭面板
            if (infoIconClicked) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 关闭驳回详情面板');
                await new Promise(resolve => setTimeout(resolve, 200));

                // 再次使用多策略定位双击信息图标以关闭面板
                const closePanelResult = EnhancedElementSelector.findElementByMultipleStrategies(infoIconStrategies);
                if (closePanelResult) {
                    const infoIcon = closePanelResult.element;
                    try {
                        log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 双击信息图标关闭面板:', infoIcon);
                        // 双击事件 - 模拟两次点击来实现双击效果
                        const clickEvent1 = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        infoIcon.dispatchEvent(clickEvent1);

                        // 短暂延迟后发送第二次点击事件
                        await new Promise(resolve => setTimeout(resolve, 100));

                        const clickEvent2 = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        infoIcon.dispatchEvent(clickEvent2);

                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 成功双击信息图标关闭面板，使用策略:', closePanelResult.strategy);
                    } catch (clickError) {
                        ErrorHandler.handleDOMError(clickError, '[Appen Data Collector] 双击信息图标关闭面板失败');
                    }
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, '[Appen Data Collector] 收集驳回理由时出错', null, LOG_LEVEL.ERROR, 'dom');
        }
    }

    // 收集基础信息函数
    async function collectBasicInfo() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 开始收集基础信息');

            // 收集用户选择状态（有效/无效，编辑轮数）
            if (collectedData.responseElements) {
                detectUserSelectionStatus(collectedData.responseElements);
                log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 用户选择状态检测完成');
            }

            // 收集题目相关信息
            collectTopicInfo();
            log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 题目信息收集完成');

            // 可以在这里添加其他基础信息收集逻辑

            log(LOG_LEVEL.INFO, '[Appen Data Collector] 基础信息收集完成');
        } catch (error) {
            ErrorHandler.handle(error, '[Appen Data Collector] 收集基础信息时出错', null, LOG_LEVEL.ERROR);
        }
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initializeDataCollector();
            watchUrlChanges();
        });
    } else {
        initializeDataCollector();
        watchUrlChanges();
    }

    // 输出新旧题状态和驳回信息到控制台的调试函数
    function logNewOldStatusInfo(pageKey, hasRework, isSecondaryRework, pageRejectReason) {
        const previousHasRework = completionStats.perPage[pageKey] ? completionStats.perPage[pageKey].hasRework : false;
        console.log('[Appen Data Collector] 新旧题状态判断信息:', {
            pageKey: pageKey,
            hasRework: hasRework,
            previousHasRework: previousHasRework,
            isSecondaryRework: isSecondaryRework,
            newOldStatus: hasRework && previousHasRework ? '旧题(二次返修)' : (hasRework ? '新题(一次返修)' : '新题(无返修)'),
            rejectReason: pageRejectReason || '无驳回理由'
        });
    }

    // 获取新旧题状态对应的颜色
    // 获取新旧题状态对应的颜色
    function getPageNewOldStatusColor(pageData) {
        // 检查当前页面是否被QA驳回
        if (isCurrentPageRejected()) {
            return '#FF9800'; // 橙色（旧题）
        }

        // 默认使用蓝色（新题）
        return '#2196F3'; // 蓝色（新题）
    }

    // 创建系统提示元素
    function createSystemNotification(message, type = 'info', duration = 5000) {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 创建系统提示:', { message, type, duration });

            // 根据类型设置背景色
            let backgroundColor = '#4CAF50'; // 默认绿色
            switch (type) {
                case 'warning':
                    backgroundColor = '#FF9800'; // 橙色
                    break;
                case 'error':
                    backgroundColor = '#F44336'; // 红色
                    break;
                case 'info':
                    backgroundColor = '#2196F3'; // 蓝色
                    break;
                case 'success':
                default:
                    backgroundColor = '#4CAF50'; // 绿色
                    break;
            }

            // 创建通知元素
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${backgroundColor};
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                z-index: 999999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                transition: opacity 0.3s ease;
                max-width: 400px;
                width: max-content;
                min-width: 200px;
                white-space: normal;
                word-wrap: break-word;
                line-height: 1.4;
            `;

            // 添加到页面
            if (document.body) {
                document.body.appendChild(notification);
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 系统提示已添加到页面');
            } else {
                log(LOG_LEVEL.ERROR, '[Appen Data Collector] document.body不存在，无法添加系统提示');
                return null;
            }

            // 自动移除通知
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 系统提示已移除');
                    }
                }, 300);
            }, duration);

            return notification;
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 创建系统提示时出错:', error);
            return null;
        }
    }

    // 显示返修题提示
    function showReworkPageNotification() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 显示返修题提示');
            console.log('[Appen Data Collector] 显示返修题提示');
            const message = '🔄 检测到返修题...';
            console.log('[Appen Data Collector] 显示返修题提示消息:', message);
            notificationManager.add(message, 'warning', 3000);
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 显示返修题提示时出错:', error);
            console.log('[Appen Data Collector] 显示返修题提示时出错:', error);
        }
    }

    // 显示质检驳回信息提示
    function showRejectInfoNotification(rejectInfo) {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 显示质检驳回信息提示:', rejectInfo);
            if (rejectInfo && rejectInfo.comment) {
                // 显示简洁的工作状态信息，而不是完整的驳回内容
                const message = '✅ 质检驳回信息已收集...';
                notificationManager.add(message, 'success', 5000);
            } else {
                const message = '✅ 未找到质检驳回信息';
                notificationManager.add(message, 'info', 3000);
            }
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 显示质检驳回信息提示时出错:', error);
        }
    }

    // 为通知添加详细信息按钮
    function addDetailButtonToNotification(notification, comment) {
        try {
            if (notification) {
                const detailButton = document.createElement('button');
                detailButton.textContent = '查看详情';
                detailButton.style.cssText = `
                    margin-left: 10px;
                    background: transparent;
                    border: 1px solid currentColor;
                    color: inherit;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 12px;
                    cursor: pointer;
                    outline: none;
                `;

                detailButton.onclick = function() {
                    const cleanComment = TextExtractor.extractText({
                        textContent: comment
                    }, { preserveNewlines: true, removeExtraWhitespace: true });
                    // 复制驳回理由到剪贴板并显示通知
                    navigator.clipboard.writeText(`详细驳回理由:\n\n${cleanComment}`).then(() => {
                        showNotification('✅ 驳回理由已复制到剪贴板！', 'success');
                        log(LOG_LEVEL.DEBUG, '驳回理由:', cleanComment);
                    }).catch(err => {
                        showNotification('⚠️ 驳回理由已在控制台显示', 'info');
                        log(LOG_LEVEL.DEBUG, '详细驳回理由:\n\n' + cleanComment);
                    });
                };

                notification.appendChild(detailButton);
            }
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 添加详细信息按钮时出错:', error);
        }
    }

    // 简单的测试提示函数
    function showTestNotification() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 显示测试提示');
            notificationManager.add('🔧 数据收集器已加载', 'success', 3000);
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 显示测试提示时出错:', error);
        }
    }

    // 手动测试系统提示显示功能
    function testSystemNotifications() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 手动测试系统提示显示功能');

            // 显示测试提示
            showTestNotification();

            // 延迟1秒后显示新题提示
            setTimeout(() => {
                const message = '🆕 新题 - 请正常标注';
                notificationManager.add(message, 'info', 3000);
            }, 1000);

            // 延迟2秒后显示返修题提示
            setTimeout(() => {
                const message = '🔄 检测到返修题...';
                notificationManager.add(message, 'warning', 3000);
            }, 2000);

            // 延迟3秒后显示质检信息提示
            setTimeout(() => {
                const message = '✅ 质检驳回信息已收集...';
                notificationManager.add(message, 'success', 3000);
            }, 3000);

        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 测试系统提示显示功能时出错:', error);
        }
    }

    // 手动测试新旧题状态提示
    function testNewOldStatusNotification(isRejected = false) {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 手动测试新旧题状态提示');
            console.log('[Appen Data Collector] 手动测试新旧题状态提示, isRejected:', isRejected);
            showNewOldStatusNotification(isRejected);
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 测试新旧题状态提示时出错:', error);
            console.log('[Appen Data Collector] 测试新旧题状态提示时出错:', error);
        }
    }

    // 手动测试返修题提示
    function testReworkPageNotification() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 手动测试返修题提示');
            console.log('[Appen Data Collector] 手动测试返修题提示');
            showReworkPageNotification();
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 测试返修题提示时出错:', error);
            console.log('[Appen Data Collector] 测试返修题提示时出错:', error);
        }
    }

    // 手动测试质检信息提示
    function testRejectInfoNotification() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 手动测试质检信息提示');
            console.log('[Appen Data Collector] 手动测试质检信息提示');
            const testRejectInfo = {
                comment: '测试质检驳回信息显示功能',
                operator: '测试QA',
                operateTime: new Date().toISOString()
            };
            showRejectInfoNotification(testRejectInfo);
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 测试质检信息提示时出错:', error);
            console.log('[Appen Data Collector] 测试质检信息提示时出错:', error);
        }
    }

    // 验证元素定位策略的测试函数
    function testElementSelectionStrategies() {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 验证元素定位策略');
            console.log('[Appen Data Collector] 验证元素定位策略');

            // 测试信息图标定位策略
            const infoIconStrategies = [
                // 策略1: 原有的ID模式匹配（最精确）
                { type: 'selector', value: '[id$="_197"]' },
                // 策略2: 通过SVG内容特征定位（基于用户提供的SVG）
                { type: 'svg', value: 'M2.5 2.06301V0L1.5 0L1.5 2.06301C0.637386 2.28503 0 3.06808 0 4C0 4.93192 0.637386 5.71497 1.5 5.93699L1.5 10.063C0.637387 10.285 0 11.0681 0 12C0 12.9319 0.637386 13.715 1.5 13.937V16H2.5V13.937C3.36261 13.715 4 12.9319 4 12C4 11.0681 3.36261 10.285 2.5 10.063L2.5 5.93699C3.36261 5.71497 4 4.93192 4 4C4 3.06808 3.36261 2.28503 2.5 2.06301ZM2 11C1.44772 11 1 11.4477 1 12C1 12.5523 1.44772 13 2 13C2.55228 13 3 12.5523 3 12C3 11.4477 2.55228 11 2 11ZM2 5C2.55228 5 3 4.55228 3 4C3 3.44772 2.55228 3 2 3C1.44772 3 1 3.44772 1 4C1 4.55228 1.44772 5 2 5ZM14 4.5L6 4.5V3.5L14 3.5V4.5ZM6 6.5L11 6.5V5.5L6 5.5V6.5ZM14 11.5H6V10.5H14V11.5ZM6 13.5H11V12.5H6V13.5Z' },
                // 策略3: 通过特定类名和属性特征定位（更精确）
                { type: 'selector', value: '.anticon-info-circle' },
                // 策略4: 通过结构定位（在特定容器内）
                { type: 'structure', parentSelector: '.ant-notification-notice', childIndex: 0 },
                // 策略5: 通过XPath定位（假定结构）
                { type: 'xpath', value: '//span[contains(@class, "anticon") and contains(@aria-label, "info") and not(contains(text(), "标注"))]' }
            ];

            const infoIconResult = EnhancedElementSelector.findElementByMultipleStrategies(infoIconStrategies);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 信息图标定位结果:', infoIconResult ? infoIconResult.strategy : '未找到');

            // 测试关闭按钮定位策略
            const closeButtonStrategies = [
                // 策略1: 原有的ID模式匹配（最精确）
                { type: 'selector', value: '[id$="_244"]' },
                // 策略2: 通过特定类名和属性特征定位（更精确）
                { type: 'selector', value: 'button[aria-label="close"]' },
                // 策略3: 通过结构定位（父容器特征）
                { type: 'structure', parentSelector: '.ant-notification-notice', childIndex: 1 }
            ];

            const closeButtonResult = EnhancedElementSelector.findElementByMultipleStrategies(closeButtonStrategies);
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 关闭按钮定位结果:', closeButtonResult ? closeButtonResult.strategy : '未找到');

            console.log('[Appen Data Collector] 元素定位策略验证完成');
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 验证元素定位策略时出错:', error);
            console.log('[Appen Data Collector] 验证元素定位策略时出错:', error);
        }
    }

    // 检查当前页面是否为目标页面
    function checkIsTargetPage() {
        try {
            const currentUrl = window.location.href;
            const isMatch = CONFIG.TARGET_URL_PATTERN.test(currentUrl);
            console.log('[Appen Data Collector] URL检查结果:', {
                currentUrl: currentUrl,
                pattern: CONFIG.TARGET_URL_PATTERN,
                isMatch: isMatch
            });
            return isMatch;
        } catch (error) {
            console.log('[Appen Data Collector] URL检查出错:', error);
            return false;
        }
    }

    // 显示新旧题状态提示
    function showNewOldStatusNotification(isRejected) {
        try {
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 显示新旧题状态提示:', { isRejected });
            console.log('[Appen Data Collector] 显示新旧题状态提示:', { isRejected });
            if (isRejected) {
                // 返修题已经在showReworkPageNotification中处理了，这里不需要重复显示
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 当前为返修题，新旧题状态提示已跳过');
                console.log('[Appen Data Collector] 当前为返修题，新旧题状态提示已跳过');
                return;
            } else {
                const message = '🆕 新题 - 请正常标注';
                console.log('[Appen Data Collector] 显示新题提示:', message);
                notificationManager.add(message, 'info', 3000);
            }
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 显示新旧题状态提示时出错:', error);
            console.log('[Appen Data Collector] 显示新旧题状态提示时出错:', error);
        }
    }
})();
