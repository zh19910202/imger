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
        API_ENDPOINT: 'http://192.168.31.79:1145/api/Task/add',
        // 认证信息同步的API端点
        AUTH_SYNC_ENDPOINT: 'http://192.168.31.79:1145/api/Task/apple/sync',
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

    // Unified Error Handler Utility Functions
    const ErrorHandler = {
        // Handle errors with consistent logging and optional fallback
        handle: function(error, context, fallbackValue = null, logLevel = LOG_LEVEL.WARN) {
            log(logLevel, `${context}:`, error);

            // Log additional error details if available
            if (error && error.stack) {
                log(LOG_LEVEL.DEBUG, `${context} - 错误堆栈:`, error.stack);
            }

            return fallbackValue;
        },

        // Handle async errors with consistent logging and optional fallback
        handleAsync: async function(asyncFunction, context, fallbackValue = null, logLevel = LOG_LEVEL.WARN) {
            try {
                return await asyncFunction();
            } catch (error) {
                return this.handle(error, context, fallbackValue, logLevel);
            }
        },

        // Handle errors that should be re-thrown
        handleAndRethrow: function(error, context) {
            log(LOG_LEVEL.ERROR, `${context}:`, error);

            // Log additional error details if available
            if (error && error.stack) {
                log(LOG_LEVEL.DEBUG, `${context} - 错误堆栈:`, error.stack);
            }

            throw error;
        },

        // Handle DOM-related errors
        handleDOMError: function(error, context, fallbackValue = null) {
            return this.handle(error, `${context} (DOM操作错误)`, fallbackValue, LOG_LEVEL.WARN);
        },

        // Handle network-related errors
        handleNetworkError: function(error, context, fallbackValue = null) {
            return this.handle(error, `${context} (网络错误)`, fallbackValue, LOG_LEVEL.WARN);
        },

        // Handle storage-related errors
        handleStorageError: function(error, context, fallbackValue = null) {
            return this.handle(error, `${context} (存储错误)`, fallbackValue, LOG_LEVEL.WARN);
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
            }, 2000); // 等待页面加载完成
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

            if (jobId) {
                log(LOG_LEVEL.DEBUG, '从URL提取jobId:', jobId);
            }
            if (projectId) {
                log(LOG_LEVEL.DEBUG, '从URL提取projectId:', projectId);
            }
            if (projectDisplayId) {
                log(LOG_LEVEL.DEBUG, '从URL提取projectDisplayId:', projectDisplayId);
            }

            // 优先使用title参数作为任务ID
            const titleParam = urlParams.get('title');
            if (titleParam) {
                // 解码URL编码的title值
                const decodedTitle = decodeURIComponent(titleParam);
                log(LOG_LEVEL.DEBUG, '从URL title参数获取任务ID:', decodedTitle);
                collectedData.taskId = decodedTitle;
            } else {
                // 如果没有title参数，则使用原来的逻辑
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

            // 优先使用指定元素 ID 作为题目 ID
            if (specifiedElementIdAsTopicId && specifiedElementIdAsTopicId !== 'no-id') {
                log(LOG_LEVEL.DEBUG, '使用指定元素 ID 作为题目 ID:', specifiedElementIdAsTopicId);
                collectedData.topicId = specifiedElementIdAsTopicId;
            } else {
                // 从URL中提取主题ID
                const url = new URL(collectedData.topicUrl);
                collectedData.topicId = url.searchParams.get('topic_id') ||
                                      url.searchParams.get('topicId') ||
                                      extractTopicIdFromURL() ||
                                      'unknown_topic';
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

    // 从URL中提取主题ID
    function extractTopicIdFromURL() {
        const url = window.location.href;
        // 根据实际URL结构调整正则表达式
        const topicIdMatch = url.match(/topic[_\-]([a-zA-Z0-9]+)/) ||
                            url.match(/subject[_\-]([a-zA-Z0-9]+)/) ||
                            url.match(/question[_\-]([a-zA-Z0-9]+)/);
        return topicIdMatch ? topicIdMatch[1] : null;
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

        // 更新耗时，并限制最大时长为1小时
        let elapsedTime = Date.now() - collectedData.startTime;
        if (elapsedTime > CONFIG.MAX_ELAPSED_TIME) {
            log(LOG_LEVEL.DEBUG, '耗时已超过最大值(1小时)，固定为1小时');
            elapsedTime = CONFIG.MAX_ELAPSED_TIME;
        }
        collectedData.elapsedTime = Math.floor(elapsedTime / 1000);

        // 构造符合API要求的数据（使用camelCase）
        const dataToSend = {
            userId: collectedData.userId || 'unknown_user',
            taskId: collectedData.taskId || 'unknown_task',
            topicId: collectedData.topicId || 'unknown_topic',
            topicUrl: collectedData.topicUrl || window.location.href,
            isValid: collectedData.responseElements?.userSelectionStatus?.isValid !== null ?
                    collectedData.responseElements.userSelectionStatus.isValid : true,
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
                const response = await fetch(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dataToSend)
                });

                if (response.ok) {
                    const result = await response.json();
                    log(LOG_LEVEL.DEBUG, '数据推送成功:', result);

                    // 推送成功后清除缓存的开始时间
                    await clearCachedStartTime();

                    return;
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
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
    }

    // 创建并显示数据展示模态窗口
    function showDataModal() {
        try {
            log(LOG_LEVEL.DEBUG, 'showDataModal 被调用');
            log(LOG_LEVEL.DEBUG, '当前 collectedData.userId:', collectedData.userId);

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

            // 创建模态容器
            const modal = document.createElement('div');
            modal.id = 'appen-data-modal';
            modal.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #333;
                border-radius: 8px;
                padding: 20px;
                z-index: 99999;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                font-family: Arial, sans-serif;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #ddd;
                    padding-bottom: 10px;
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
                
                <div style="
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 4px;
                    line-height: 1.8;
                    font-size: 14px;
                ">
                    <div><strong style="color: #333;">用户ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.userId || 'N/A')}</span></div>
                    <div><strong style="color: #333;">任务ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.taskId || 'N/A')}</span></div>
                    <div><strong style="color: #333;">题目ID:</strong> <span id="topic-id-display" style="color: #0066cc;">${escapeHtml(collectedData.topicId || 'N/A')}</span></div>
                    <div><strong style="color: #333;">题目数量:</strong> <span id="topic-count-display" style="color: #0066cc;">${collectedData.responseElements?.userSelectionStatus?.topicCount || collectedData.responseElements?.userSelectionStatus?.editRounds || collectedData.topicNum || 0}</span></div>
                    <div><strong style="color: #333;">耗时(秒):</strong> <span id="elapsed-time-display" style="color: #0066cc;">${currentElapsedTime}</span></div>
                    <div><strong style="color: #333;">是否有效:</strong> <span id="valid-status-display" style="color: #0066cc;">${collectedData.responseElements?.userSelectionStatus ? (collectedData.responseElements.userSelectionStatus.isValid === true ? '✓ 有效' : collectedData.responseElements.userSelectionStatus.isValid === false ? '✗ 无效' : '未知') : '未检测到'}</span></div>
                    <div><strong style="color: #333;">认证Cookie:</strong> <span id="cookie-status-display" style="color: #0066cc; font-size: 12px;">${collectedData.authCookies ? (Object.keys(collectedData.authCookies).length > 0 ? '已获取(' + Object.keys(collectedData.authCookies).length + '个)' : '无有效Cookie') : '未获取'}</span></div>
                    <div><strong style="color: #333;">新旧题状态:</strong> <span style="color: ${(() => {
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
                    <div><strong style="color: #333;">驳回理由:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment || '')}</span></div>
                </div>

                <div style="
                    background: #e8f5e9;
                    padding: 15px;
                    border-radius: 4px;
                    margin-top: 15px;
                    margin-bottom: 15px;
                    border-left: 4px solid #4CAF50;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-weight: bold; color: #2e7d32; font-size: 15px;">✓ 标注完成统计</div>
                        <button id="clear-completion-stats-btn" style="
                            background: #f44336;
                            color: white;
                            border: none;
                            padding: 5px 10px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                            font-size: 12px;
                        ">清0</button>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #333;">总有效完成次数:</strong> <span id="total-completions-display" style="color: #0066cc; font-weight: bold; font-size: 16px;">${completionStats.totalValidCompletions || 0}</span> |
                            <strong style="color: #333;">无效完成次数:</strong> <span id="total-invalid-completions-display" style="color: #f44336; font-weight: bold; font-size: 16px;">${completionStats.totalInvalidCompletions || 0}</span>
                        </div>
                        <div>
                            <strong style="color: #333;">题目总数:</strong> <span id="total-questions-display" style="color: #0066cc; font-weight: bold; font-size: 16px;">${completionStats.totalQuestions || 0}</span>
                        </div>
                    </div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                        <strong style="color: #333;">返修统计:</strong>
                        <span style="margin-left: 10px;">
                            <strong style="color: #FF9800;">返修完成次数:</strong>
                            <span id="total-rework-completions-display" style="color: #FF9800; font-weight: bold; font-size: 16px;">${completionStats.totalReworkCompletions || 0}</span>
                        </span>
                        <span style="margin-left: 15px;">
                            <strong style="color: #333;">返修题目数:</strong>
                            <span id="rework-questions-display" style="color: #FF9800; font-weight: bold; font-size: 16px;">${completionStats.reworkQuestions || 0}</span>
                        </span>
                    </div>
                    <div style="margin-top: 10px; font-size: 13px; color: #555;">
                        <div style="margin-bottom: 5px;"><strong>各页面完成详情:</strong></div>
                        <div id="page-completions-display" style="margin-left: 15px; line-height: 1.6; max-height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 5px; border-radius: 3px;">
                            ${Object.keys(completionStats.perPage).length > 0
                                ? Object.entries(completionStats.perPage)
                                    .sort((a, b) => {
                                        // 按最后完成时间降序排列（最新的在前）
                                        const timeA = a[1].lastCompletionTime || 0;
                                        const timeB = b[1].lastCompletionTime || 0;
                                        return timeB - timeA;
                                    })
                                    .slice(0, 5) // 只显示前5条记录
                                    .map(([pageKey, data]) => {
                                        // 获取驳回理由（使用每个页面自己的驳回理由）
                                        const rejectReason = data.rejectReason || '无驳回';
                                        // 格式化时间戳
                                        const lastCompletionTime = data.lastCompletionTime
                                            ? new Date(data.lastCompletionTime).toLocaleString('zh-CN')
                                            : '未知';

                                        return `<div style="margin-bottom: 8px; padding: 5px; border-bottom: 1px solid #eee;">
                                            <div><strong>页面:</strong> <span style="color: #0066cc;">${escapeHtml(pageKey.substring(0, 50))}${pageKey.length > 50 ? '...' : ''}</span></div>
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
                        ${Object.keys(completionStats.perPage).length > 5
                            ? `<div style="margin-top: 5px; font-size: 12px; color: #777;">显示最近5条记录，共${Object.keys(completionStats.perPage).length}条记录。滚动查看全部。</div>`
                            : ''}
                    </div>
                </div>

                <div style="
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 4px;
                    margin-top: 15px;
                    margin-bottom: 15px;
                ">
                    <div style="margin-bottom: 10px;">
                        <label style="color: #333; font-weight: bold; display: block; margin-bottom: 5px; font-size: 14px;">设置 lastTopicId:</label>
                        <input type="text" id="lastTopicIdInput" placeholder="输入新的 lastTopicId 值" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ccc;
                            border-radius: 4px;
                            box-sizing: border-box;
                            font-size: 13px;
                        ">
                    </div>
                    <button id="set-lasttopicid-btn" style="
                        background: #FF5722;
                        color: white;
                        border: none;
                        padding: 8px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 13px;
                        width: 100%;
                    ">设置 lastTopicId</button>
                </div>

                <div style="
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                    flex-wrap: wrap;
                ">
                    <button id="copy-data-btn" style="
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">复制数据</button>
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

        document.body.appendChild(modal);

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
            modal.remove();
        });

        // 复制数据按钮事件
        document.getElementById('copy-data-btn').addEventListener('click', function() {
            // 重新计算当前耗时，并限制最大值
            let elapsedTimeForCopy = Math.floor((Date.now() - collectedData.startTime) / 1000);
            if (elapsedTimeForCopy > CONFIG.MAX_ELAPSED_TIME / 1000) {
                elapsedTimeForCopy = CONFIG.MAX_ELAPSED_TIME / 1000;
            }
            
            const dataToSend = {
                userId: collectedData.userId || 'unknown_user',
                taskId: collectedData.taskId || 'unknown_task',
                topicId: collectedData.topicId || 'unknown_topic',
                topicUrl: collectedData.topicUrl || window.location.href,
                isValid: collectedData.responseElements?.userSelectionStatus?.isValid !== null ? 
                        collectedData.responseElements.userSelectionStatus.isValid : true,
                editRounds: collectedData.responseElements?.userSelectionStatus?.editRounds || null,
                isRedo: false,
                updateTime: new Date().toISOString(),
                elapsedTime: elapsedTimeForCopy,
                isReplace: false,
                topicNum: collectedData.responseElements?.userSelectionStatus?.topicCount || collectedData.responseElements?.userSelectionStatus?.editRounds || collectedData.topicNum || 0,
                userSelectionStatus: collectedData.responseElements?.userSelectionStatus || null,
                qualityCheckRecord: collectedData.responseElements?.qualityCheckRecord || null
            };

            const jsonString = JSON.stringify(dataToSend, null, 2);
            navigator.clipboard.writeText(jsonString).then(() => {
                alert('数据已复制到剪贴板！');
            }).catch(err => {
                log(LOG_LEVEL.ERROR, '复制失败:', err);
                alert('复制失败，请手动复制');
            });
        });

        // 推送数据按钮事件
        document.getElementById('push-data-btn').addEventListener('click', function() {
            pushDataOnSubmission();
            alert('数据推送请求已发送，请检查控制台日志');
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
                        alert('Cookie数据已复制到剪贴板并更新到内存！\n\n' + cookieJson);
                    }).catch(err => {
                        log(LOG_LEVEL.ERROR, '复制失败:', err);
                        alert('获取成功但复制失败，请查看控制台输出\n\n' + cookieJson);
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
                    alert('未能获取到认证cookie，请检查控制台日志');
                }
            } catch (error) {
                ErrorHandler.handleNetworkError(error, '获取cookie失败');
                alert('获取cookie失败: ' + error.message);
            }
        });

        // 同步认证信息按钮事件
        document.getElementById('sync-auth-btn').addEventListener('click', async function() {
            try {
                const cookies = await getAuthCookies();
                if (cookies) {
                    await syncAuthToServer(cookies);
                    alert('认证信息同步请求已发送，请检查控制台日志');
                } else {
                    alert('未能获取到认证cookie，无法同步');
                }
            } catch (error) {
                ErrorHandler.handleNetworkError(error, '同步认证信息失败');
                alert('同步认证信息失败: ' + error.message);
            }
        });

        // 设置 lastTopicId 按钮事件
        document.getElementById('set-lasttopicid-btn').addEventListener('click', function() {
            const input = document.getElementById('lastTopicIdInput');
            const newValue = input.value.trim();
            
            if (!newValue) {
                alert('请输入 lastTopicId 值');
                return;
            }
            
            const oldTopicId = collectedData.topicId;
            
            lastTopicId = newValue;
            collectedData.topicId = newValue;
            specifiedElementIdAsTopicId = newValue;
            
            const topicIdDisplay = document.getElementById('topic-id-display');
            if (topicIdDisplay) {
                topicIdDisplay.textContent = escapeHtml(newValue);
                log(LOG_LEVEL.DEBUG, '更新模态框中的题目ID显示:', newValue);
            }

            if (oldTopicId !== newValue) {
                const newStartTime = Date.now();
                collectedData.startTime = newStartTime;
                log(LOG_LEVEL.DEBUG, '检测到题目ID变化，重置计时器');
                log(LOG_LEVEL.DEBUG, '旧题目ID:', oldTopicId, '新题目ID:', newValue);
                log(LOG_LEVEL.DEBUG, '新的开始时间:', new Date(newStartTime).toISOString());

                const elapsedTimeDisplay = document.getElementById('elapsed-time-display');
                if (elapsedTimeDisplay) {
                    elapsedTimeDisplay.textContent = '0';
                    log(LOG_LEVEL.DEBUG, '已重置模态框中的耗时显示为0');
                }
            }

            log(LOG_LEVEL.DEBUG, 'lastTopicId 已设置为:', lastTopicId);
            alert('lastTopicId 已设置为: ' + newValue + '\n计时器已重置');
            
            input.value = '';
        });

        // 清除标注完成统计按钮事件
        document.getElementById('clear-completion-stats-btn').addEventListener('click', async function() {
            if (confirm('确定要清除所有标注完成统计吗？')) {
                await clearCompletionStats();
                alert('标注完成统计已清除！');
                // 重新显示模态框以更新显示
                showDataModal();
            }
        });

        log(LOG_LEVEL.DEBUG, '数据展示模态窗口已显示，按i键关闭');
        } catch (error) {
            ErrorHandler.handle(error, '创建模态框异常', null, LOG_LEVEL.ERROR);
            log(LOG_LEVEL.ERROR, '错误堆栈:', error.stack);
            alert('创建模态框失败: ' + error.message);
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
        const title = urlParams.get('title');

        // 创建响应元素数据对象
        const responseElements = {
            jobId: jobId || 'unknown',
            jobType: jobType || 'unknown',
            taskId: taskId || 'unknown',
            projectId: projectId || 'unknown',
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
            log(LOG_LEVEL.INFO, '预期结果: 通过关闭通知和点击信息图标获取最新驳回详情');

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

    // 从打开的质检窗口DOM中提取最新驳回理由（改进的DOM提取方案）
    function extractLatestQARejectFromDOM() {
        try {
            log(LOG_LEVEL.INFO, '   开始从打开的质检窗口DOM中提取...');

            // 查找质检窗口的内容容器（支持多种可能的选择器）
            const popoverSelectors = [
                '.ant-popover-content',
                '.ant-popover:not(.ant-popover-hidden)',
                '[class*="popover"]:not([class*="hidden"])',
                '.custom-popover-with-lefter-arrow'
            ];

            let popoverContent = null;
            for (const selector of popoverSelectors) {
                popoverContent = document.querySelector(selector);
                if (popoverContent) {
                    log(LOG_LEVEL.DEBUG, `   ├─ 找到质检窗口 (${selector})`);
                    break;
                }
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

            // 找到ul列表
            const ul = popoverContent.querySelector('ul');
            if (!ul) {
                log(LOG_LEVEL.DEBUG, '未找到质检记录列表');
                return null;
            }

            // 获取所有li元素
            const liElements = ul.querySelectorAll('li');
            if (liElements.length === 0) {
                log(LOG_LEVEL.DEBUG, '质检记录列表为空');
                return null;
            }

            log(LOG_LEVEL.DEBUG, '找到质检记录数量:', liElements.length);

            // 遍历所有li元素，查找QA REJECTED的记录
            // 记录结构：
            // li > div > div.font-normal.flex > (div:1 = "质检1", div:2 = "已驳回")
            //     > div.flex.text-gray-400 > (div:1 = "操作人", div:2 = "时间")
            //     > div/DraftEditor-root = "驳回理由"

            let latestQARecord = null;
            let latestTime = null;

            for (let i = 0; i < liElements.length; i++) {
                const li = liElements[i];
                const liText = li.textContent.trim();

                // 查找包含"质检"和"已驳回"的记录（支持多种格式）
                if ((liText.includes('质检') && liText.includes('已驳回')) ||
                    liText.includes('QA') && liText.includes('Rejected')) {
                    log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 找到QA驳回记录 ${i}: ${liText.substring(0, 50)}`);

                    // 提取操作人和时间
                    const timeDiv = li.querySelector('.flex.text-gray-400');
                    let operator = '';
                    let timeStr = '';

                    if (timeDiv) {
                        const divs = timeDiv.querySelectorAll('div');
                        if (divs.length >= 2) {
                            operator = divs[0].textContent.trim();
                            timeStr = divs[1].textContent.trim();
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
                    const draftEditor = li.querySelector('.DraftEditor-root');
                    if (draftEditor) {
                        const spanWithText = draftEditor.querySelector('span[data-text="true"]');
                        if (spanWithText) {
                            rejectReason = spanWithText.textContent.trim();
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 从DraftEditor提取到驳回理由: ${rejectReason}`);
                        }
                    }

                    // 方法2: 如果方法1失败，从第一个含文本的div提取
                    if (!rejectReason) {
                        const divWithText = li.querySelector('div.min-h-fit');
                        if (divWithText) {
                            rejectReason = divWithText.textContent.trim();
                            log(LOG_LEVEL.DEBUG, `[Appen Data Collector] 从div.min-h-fit提取到内容: ${rejectReason}`);
                        }
                    }

                    // 方法3: 从其他可能包含文本的div中提取
                    if (!rejectReason) {
                        const allDivs = li.querySelectorAll('div');
                        for (let j = 0; j < allDivs.length; j++) {
                            const divText = allDivs[j].textContent.trim();
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
            log(LOG_LEVEL.WARN, '从DOM提取QA驳回理由时出错:', error);
            return null;
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
                    collectedData.topicId = divId;
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 更新 collectedData.topicId:', divId);
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

            // 显示测试提示，确认页面处理已开始
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 显示页面处理测试提示');
            console.log('[Appen Data Collector] 显示页面处理测试提示');
            showTestNotification();

            // 延迟一段时间，让测试提示显示后再继续
            await new Promise(resolve => setTimeout(resolve, 500));

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

            // 延迟后再收集基础信息
            await new Promise(resolve => setTimeout(resolve, 300));

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

            // 实现两步交互模式：首先关闭通知，然后点击信息图标
            log(LOG_LEVEL.INFO, '[Appen Data Collector] 实施两步交互模式获取驳回详情');

            // 步骤1: 查找并点击关闭通知按钮（UID模式：*_244）
            const closeButtons = document.querySelectorAll('[id$="_244"]');
            let closeButtonClicked = false;

            if (closeButtons.length > 0) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 找到关闭通知按钮，数量:', closeButtons.length);
                for (let i = 0; i < closeButtons.length; i++) {
                    const button = closeButtons[i];
                    try {
                        log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 点击关闭按钮:', button.id);
                        const clickEvent = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        button.dispatchEvent(clickEvent);
                        closeButtonClicked = true;
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 成功点击关闭按钮:', button.id);
                        break; // 只点击第一个找到的按钮
                    } catch (clickError) {
                        log(LOG_LEVEL.WARN, '[Appen Data Collector] 点击关闭按钮失败:', button.id, clickError);
                    }
                }
            } else {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 未找到关闭通知按钮，尝试直接点击信息图标');
            }

            // 如果点击了关闭按钮，等待一段时间让UI更新
            if (closeButtonClicked) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 等待UI更新完成...');
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 步骤2: 查找并点击信息图标（UID模式：*_197）
            const infoIcons = document.querySelectorAll('[id$="_197"]');
            let infoIconClicked = false;

            if (infoIcons.length > 0) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 找到信息图标，数量:', infoIcons.length);
                for (let i = 0; i < infoIcons.length; i++) {
                    const icon = infoIcons[i];
                    try {
                        log(LOG_LEVEL.DEBUG, '[Appen Data Collector] 点击信息图标:', icon.id);
                        const clickEvent = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        icon.dispatchEvent(clickEvent);
                        infoIconClicked = true;
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 成功点击信息图标:', icon.id);
                        break; // 只点击第一个找到的图标
                    } catch (clickError) {
                        log(LOG_LEVEL.WARN, '[Appen Data Collector] 点击信息图标失败:', icon.id, clickError);
                    }
                }
            } else {
                log(LOG_LEVEL.WARN, '[Appen Data Collector] 未找到信息图标');
            }

            // 如果点击了信息图标，等待一段时间让内容加载
            if (infoIconClicked) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 等待驳回详情内容加载...');
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // 从DOM中提取最新的驳回理由
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
                        dataSource: 'TWO_STEP_INTERACTION',
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
                console.log('[Appen Data Collector] 驳回理由:', rejectInfo.comment);
                console.log('[Appen Data Collector] 操作人:', rejectInfo.operator);
                console.log('[Appen Data Collector] 操作时间:', rejectInfo.operateTime);
            } else {
                log(LOG_LEVEL.WARN, '[Appen Data Collector] 未找到驳回理由信息');

                // 如果两步交互模式失败，回退到原来的直接提取方式
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 回退到直接提取方式');
                const fallbackRejectInfo = extractLatestQARejectFromDOM();
                if (fallbackRejectInfo) {
                    if (!collectedData.qualityCheckInfo) {
                        collectedData.qualityCheckInfo = {};
                    }
                    collectedData.qualityCheckInfo.rejectReason = fallbackRejectInfo.comment;
                    collectedData.qualityCheckInfo.rejectOperator = fallbackRejectInfo.operator;
                    collectedData.qualityCheckInfo.rejectTime = fallbackRejectInfo.operateTime;

                    // 同时设置responseElements.qualityCheckRecord以保持兼容性
                    if (collectedData.responseElements) {
                        collectedData.responseElements.qualityCheckRecord = {
                            hasRecord: true,
                            dataSource: 'FALLBACK_DIRECT_EXTRACTION',
                            timestamp: new Date().toISOString(),
                            latestRecord: {
                                type: 'REJECTED',
                                action: `被 ${fallbackRejectInfo.operator || 'QA'} Rejected 请修订`,
                                comment: fallbackRejectInfo.comment || '',
                                operator: fallbackRejectInfo.operator || 'QA',
                                operateTime: fallbackRejectInfo.operateTime || ''
                            }
                        };
                    }

                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 回退方式成功提取驳回理由');

                    // 显示质检驳回信息提示
                    showRejectInfoNotification(fallbackRejectInfo);
                } else {
                    // 如果都没有找到驳回信息，显示提示
                    showRejectInfoNotification(null);
                }
            }

            // 如果之前点击了信息图标，再次点击以关闭面板
            if (infoIconClicked) {
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 关闭驳回详情面板');
                await new Promise(resolve => setTimeout(resolve, 500));
                for (let i = 0; i < infoIcons.length; i++) {
                    const icon = infoIcons[i];
                    try {
                        const clickEvent = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        icon.dispatchEvent(clickEvent);
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 成功关闭信息面板:', icon.id);
                        break;
                    } catch (clickError) {
                        log(LOG_LEVEL.WARN, '[Appen Data Collector] 关闭信息面板失败:', icon.id, clickError);
                    }
                }
            }
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 收集驳回理由时出错:', error);
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
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 收集基础信息时出错:', error);
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
            const message = '🔄 检测到返修题 - 正在自动获取质检驳回信息...';
            console.log('[Appen Data Collector] 显示返修题提示消息:', message);
            const result = createSystemNotification(message, 'warning', 3000);
            if (result && typeof result.then === 'function') {
                result.then(notification => {
                    log(LOG_LEVEL.INFO, '[Appen Data Collector] 返修题提示创建完成');
                    console.log('[Appen Data Collector] 返修题提示创建完成');
                });
            }
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
                const message = `📢 质检驳回信息: ${rejectInfo.comment.substring(0, 100)}${rejectInfo.comment.length > 100 ? '...' : ''}`;
                const result = createSystemNotification(message, 'error', 8000);

                // 处理Promise返回值
                if (result && typeof result.then === 'function') {
                    result.then(notification => {
                        if (notification && rejectInfo.comment.length > 100) {
                            addDetailButtonToNotification(notification, rejectInfo.comment);
                        }
                    });
                } else if (result && rejectInfo.comment.length > 100) {
                    addDetailButtonToNotification(result, rejectInfo.comment);
                }
            } else {
                const message = '✅ 未找到质检驳回信息';
                const result = createSystemNotification(message, 'info', 3000);
                if (result && typeof result.then === 'function') {
                    result.then(notification => {
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 未找到质检信息提示创建完成');
                    });
                }
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
                    alert(`详细驳回理由:\n\n${comment}`);
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

            // 创建简单的提示元素
            const notification = document.createElement('div');
            notification.textContent = '🔧 Appen数据收集器已加载';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                z-index: 999999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                transition: opacity 0.3s ease;
            `;

            // 添加到页面
            if (document.body) {
                document.body.appendChild(notification);
                log(LOG_LEVEL.INFO, '[Appen Data Collector] 测试提示已添加到页面');

                // 3秒后自动移除
                setTimeout(() => {
                    notification.style.opacity = '0';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                            log(LOG_LEVEL.INFO, '[Appen Data Collector] 测试提示已移除');
                        }
                    }, 300);
                }, 3000);
            } else {
                log(LOG_LEVEL.ERROR, '[Appen Data Collector] 无法添加测试提示：document.body不存在');
            }
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
                const message = '🆕 新题 - 请正常完成标注任务';
                createSystemNotification(message, 'info', 3000);
            }, 1000);

            // 延迟2秒后显示返修题提示
            setTimeout(() => {
                const message = '🔄 检测到返修题 - 正在自动获取质检驳回信息...';
                createSystemNotification(message, 'warning', 3000);
            }, 2000);

            // 延迟3秒后显示质检信息提示
            setTimeout(() => {
                const message = '📢 质检驳回信息: 测试驳回理由';
                createSystemNotification(message, 'error', 3000);
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
                const message = '🆕 新题 - 请正常完成标注任务';
                console.log('[Appen Data Collector] 显示新题提示:', message);
                const result = createSystemNotification(message, 'info', 3000);
                if (result && typeof result.then === 'function') {
                    result.then(notification => {
                        log(LOG_LEVEL.INFO, '[Appen Data Collector] 新题提示创建完成');
                        console.log('[Appen Data Collector] 新题提示创建完成');
                    });
                }
            }
        } catch (error) {
            log(LOG_LEVEL.ERROR, '[Appen Data Collector] 显示新旧题状态提示时出错:', error);
            console.log('[Appen Data Collector] 显示新旧题状态提示时出错:', error);
        }
    }
})();
