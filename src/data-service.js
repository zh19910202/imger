/**
 * 数据服务层
 * 负责从服务器 API (GetUserTaskDetails) 获取统计报表数据
 * 实现缓存、错误处理、数据转换等功能
 */

(function() {
    'use strict';

    // 配置
    const DataServiceConfig = {
        API_BASE_URL: 'http://www.skytree.ink',
        GET_USER_TASK_DETAILS_ENDPOINT: '/api/task/user/{userId}/details',
        CACHE_PREFIX: 'appen_report_cache_',
        CACHE_TTL: {
            day: 10 * 60 * 1000,      // 日数据：10分钟
            week: 60 * 60 * 1000,     // 周数据：1小时
            month: 4 * 60 * 60 * 1000 // 月数据：4小时
        },
        REQUEST_TIMEOUT: 30000 // 30秒超时
    };

    // 数据服务对象
    const DataService = {
        /**
         * 获取用户ID（异步，从 localStorage、URL 参数或 chrome.storage）
         * @returns {Promise<string|null>} 用户ID
         */
        getUserIdAsync: async function() {
            try {
                // 1. 从 localStorage
                let userId = localStorage.getItem('appen_user_id');
                if (userId) return userId;

                // 2. 从页面 URL 参数
                const urlParams = new URLSearchParams(window.location.search);
                userId = urlParams.get('userId') || urlParams.get('appleUserId');
                if (userId) {
                    localStorage.setItem('appen_user_id', userId);
                    return userId;
                }

                // 3. 从 chrome.storage（异步）
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    try {
                        const result = await new Promise((resolve, reject) => {
                            chrome.storage.local.get(['appen_user_id'], (result) => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                } else {
                                    resolve(result);
                                }
                            });
                        });
                        if (result && result.appen_user_id) {
                            localStorage.setItem('appen_user_id', result.appen_user_id);
                            return result.appen_user_id;
                        }
                    } catch (error) {
                        console.warn('[DataService] 从 chrome.storage 获取用户ID失败:', error);
                    }
                }

                console.warn('[DataService] 无法获取用户ID');
                return null;
            } catch (error) {
                console.error('[DataService] 获取用户ID失败:', error);
                return null;
            }
        },

        /**
         * 查询报表数据
         * @param {string} timeRange - 时间范围：day、week、month
         * @param {string} timeValue - 具体时间值（可选）
         * @param {boolean} includeDetails - 是否包含详细信息
         * @returns {Promise<object>} 报表数据
         */
        getReportData: async function(timeRange, timeValue = null, includeDetails = false) {
            try {
                const userId = await this.getUserIdAsync();
                if (!userId) {
                    throw new Error('无法获取用户ID');
                }

                // 检查缓存
                const cacheKey = this.getCacheKey(timeRange, timeValue);
                const cached = this.getCache(cacheKey);
                if (cached) {
                    console.log('[DataService] 从缓存返回数据:', cacheKey);
                    return cached;
                }

                // 尝试多种协议和方式获取数据
                let reportData = null;
                let lastError = null;

                // 策略1: 尝试匹配页面协议
                try {
                    const url = this.buildApiUrl(userId, timeRange, timeValue, includeDetails);
                    console.log('[DataService] 请求 API (策略1 - 匹配协议):', url);
                    const response = await this.fetchWithTimeout(url, DataServiceConfig.REQUEST_TIMEOUT);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const result = await response.json();
                    if (!result.success) {
                        throw new Error(result.message || '服务器返回错误');
                    }

                    reportData = this.transformApiResponse(result.data, timeRange);
                    console.log('[DataService] 策略1成功获取数据');
                } catch (error) {
                    lastError = error;
                    console.warn('[DataService] 策略1失败:', error.message);

                    // 策略2: 如果是HTTPS页面，尝试HTTP协议（仅限localhost/local IP）
                    if (window.location.protocol === 'https:' && this.isLocalApi()) {
                        try {
                            const httpUrl = this.buildApiUrlWithProtocol(userId, timeRange, timeValue, includeDetails, 'http');
                            console.log('[DataService] 请求 API (策略2 - HTTP回退):', httpUrl);
                            const response = await this.fetchWithTimeout(httpUrl, DataServiceConfig.REQUEST_TIMEOUT);

                            if (!response.ok) {
                                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                            }

                            const result = await response.json();
                            if (!result.success) {
                                throw new Error(result.message || '服务器返回错误');
                            }

                            reportData = this.transformApiResponse(result.data, timeRange);
                            console.log('[DataService] 策略2成功获取数据');
                        } catch (error2) {
                            console.warn('[DataService] 策略2也失败:', error2.message);
                        }
                    }
                }

                if (reportData) {
                    // 缓存数据
                    this.setCache(cacheKey, reportData);
                    console.log('[DataService] 成功获取报表数据:', reportData);
                    return reportData;
                }

                // 所有策略都失败
                throw lastError || new Error('所有获取数据的策略都失败了');

            } catch (error) {
                console.error('[DataService] 获取报表数据失败:', error);
                // 返回空数据结构而不是抛出错误
                return this.getEmptyReportData(timeRange, timeValue);
            }
        },

        /**
         * 获取今天的报表
         * @returns {Promise<object>} 今天的报表数据
         */
        getTodayReport: function() {
            return this.getReportData('day');
        },

        /**
         * 获取本周的报表
         * @returns {Promise<object>} 本周的报表数据
         */
        getCurrentWeekReport: function() {
            return this.getReportData('week');
        },

        /**
         * 获取本月的报表
         * @returns {Promise<object>} 本月的报表数据
         */
        getCurrentMonthReport: function() {
            return this.getReportData('month');
        },

        /**
         * 获取指定日期的报表
         * @param {string} date - 日期，格式 YYYY-MM-DD
         * @returns {Promise<object>} 报表数据
         */
        getDayReport: function(date) {
            return this.getReportData('day', date);
        },

        /**
         * 获取指定月份的报表
         * @param {string} yearMonth - 月份，格式 YYYY-MM
         * @returns {Promise<object>} 报表数据
         */
        getMonthReport: function(yearMonth) {
            return this.getReportData('month', yearMonth);
        },

        /**
         * 构建 API URL
         * @param {string} userId - 用户ID
         * @param {string} timeRange - 时间范围
         * @param {string} timeValue - 时间值
         * @param {boolean} includeDetails - 是否包含详细信息
         * @returns {string} API URL
         */
        buildApiUrl: function(userId, timeRange, timeValue, includeDetails) {
            let endpoint = DataServiceConfig.GET_USER_TASK_DETAILS_ENDPOINT.replace('{userId}', userId);
            let url = DataServiceConfig.API_BASE_URL + endpoint;

            const params = new URLSearchParams();
            params.append('timeRange', timeRange);

            if (timeValue) {
                params.append('timeValue', timeValue);
            }

            if (includeDetails) {
                params.append('includeDetails', 'true');
            }

            return url + '?' + params.toString();
        },

        /**
         * 使用指定协议构建 API URL
         * @param {string} userId - 用户ID
         * @param {string} timeRange - 时间范围
         * @param {string} timeValue - 时间值
         * @param {boolean} includeDetails - 是否包含详细信息
         * @param {string} protocol - 协议 (http 或 https)
         * @returns {string} API URL
         */
        buildApiUrlWithProtocol: function(userId, timeRange, timeValue, includeDetails, protocol) {
            let endpoint = DataServiceConfig.GET_USER_TASK_DETAILS_ENDPOINT.replace('{userId}', userId);
            let url = `${protocol}://www.skytree.ink` + endpoint;

            const params = new URLSearchParams();
            params.append('timeRange', timeRange);

            if (timeValue) {
                params.append('timeValue', timeValue);
            }

            if (includeDetails) {
                params.append('includeDetails', 'true');
            }

            return url + '?' + params.toString();
        },

        /**
         * 检查API是否指向本地地址
         * @returns {boolean} 是否为本地API
         */
        isLocalApi: function() {
            const apiHost = 'www.skytree.ink';
            return apiHost === 'localhost' ||
                   apiHost === '127.0.0.1' ||
                   apiHost.startsWith('192.168.') ||
                   apiHost.startsWith('10.') ||
                   apiHost.endsWith('.local');
        },

        /**
         * 使用超时的 fetch，并处理 CORS 和混合内容问题
         * @param {string} url - 请求 URL
         * @param {number} timeout - 超时时间（毫秒）
         * @returns {Promise<Response>} 响应
         */
        fetchWithTimeout: function(url, timeout) {
            return Promise.race([
                new Promise(async (resolve, reject) => {
                    try {
                        // 优先使用background代理（避免CORS和混合内容问题）
                        if (this.canUseBackgroundProxy()) {
                            console.log('[DataService] 使用background代理请求:', url);
                            const proxyResponse = await this.fetchViaBackgroundProxy(url);
                            resolve(proxyResponse);
                            return;
                        }

                        // 回退到原生fetch
                        console.log('[DataService] 使用原生fetch请求:', url);
                        const response = await fetch(url);
                        resolve(response);

                    } catch (error) {
                        // 处理各种网络错误
                        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                            // CORS 或混合内容错误
                            reject(new Error(`网络请求被阻止: ${url.split(':')[0]} 协议可能不匹配页面协议 ${window.location.protocol}`));
                        } else if (error.name === 'TypeError' && error.message.includes('Mixed Content')) {
                            // 混合内容错误
                            reject(new Error('混合内容错误：HTTPS 页面无法请求 HTTP 资源'));
                        } else {
                            reject(error);
                        }
                    }
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('请求超时')), timeout)
                )
            ]);
        },

        /**
         * 检查是否可以使用background代理
         * @returns {boolean} 是否可以使用代理
         */
        canUseBackgroundProxy: function() {
            return typeof chrome !== 'undefined' &&
                   chrome.runtime &&
                   chrome.runtime.sendMessage;
        },

        /**
         * 通过background代理发送请求
         * @param {string} url - 请求URL
         * @returns {Promise<Response>} 响应
         */
        fetchViaBackgroundProxy: function(url) {
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'API_PROXY_REQUEST',
                    url: url,
                    options: {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        }
                    }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(`Chrome runtime错误: ${chrome.runtime.lastError.message}`));
                        return;
                    }

                    if (!response.success) {
                        reject(new Error(response.error || '代理请求失败'));
                        return;
                    }

                    // 构建类Response对象
                    const proxyResponse = new Response(response.response.data, {
                        status: response.response.status,
                        statusText: response.response.statusText,
                        headers: response.response.headers
                    });

                    resolve(proxyResponse);
                });
            });
        },

        /**
         * 转换 API 响应为统计引擎格式
         * @param {object} apiData - API 返回的数据
         * @param {string} timeRange - 时间范围
         * @returns {object} 转换后的数据
         */
        transformApiResponse: function(apiData, timeRange) {
            if (!apiData || !apiData.statistics) {
                return this.getEmptyReportData(timeRange, apiData?.timeValue);
            }

            const stats = apiData.statistics;

            // 根据时间范围选择返回格式
            if (timeRange === 'day') {
                return {
                    date: apiData.timeValue || this.formatDate(new Date()),
                    statistics: {
                        totalRecords: stats.totalRecords || 0,
                        validRecords: stats.validRecords || 0,
                        invalidRecords: stats.invalidRecords || 0,
                        validRate: stats.validRecords / (stats.totalRecords || 1),
                        totalTopicNum: stats.totalTopicNum || 0,
                        totalElapsedTime: stats.totalElapsedTime || 0,
                        averageElapsedTime: stats.averageElapsedTime || 0,
                        recordsByState: stats.recordsByState || {},
                        recordsByTask: this.transformTaskDetails(apiData.taskDetails || [])
                    },
                    timestamp: Date.now()
                };
            } else if (timeRange === 'week') {
                return {
                    week: this.calculateWeekNumber(apiData.queryPeriod?.startTime),
                    startDate: apiData.queryPeriod?.startTime?.split('T')[0],
                    endDate: apiData.queryPeriod?.endTime?.split('T')[0],
                    statistics: {
                        totalRecords: stats.totalRecords || 0,
                        validRecords: stats.validRecords || 0,
                        invalidRecords: stats.invalidRecords || 0,
                        validRate: stats.validRecords / (stats.totalRecords || 1),
                        totalTopicNum: stats.totalTopicNum || 0,
                        totalElapsedTime: stats.totalElapsedTime || 0,
                        averageElapsedTime: stats.averageElapsedTime || 0,
                        recordsByState: stats.recordsByState || {},
                        recordsByTask: this.transformTaskDetails(apiData.taskDetails || [])
                    },
                    dailyBreakdown: [],
                    timestamp: Date.now()
                };
            } else if (timeRange === 'month') {
                return {
                    month: apiData.timeValue || this.formatYearMonth(new Date()),
                    startDate: apiData.queryPeriod?.startTime?.split('T')[0],
                    endDate: apiData.queryPeriod?.endTime?.split('T')[0],
                    statistics: {
                        totalRecords: stats.totalRecords || 0,
                        validRecords: stats.validRecords || 0,
                        invalidRecords: stats.invalidRecords || 0,
                        validRate: stats.validRecords / (stats.totalRecords || 1),
                        totalTopicNum: stats.totalTopicNum || 0,
                        totalElapsedTime: stats.totalElapsedTime || 0,
                        averageElapsedTime: stats.averageElapsedTime || 0,
                        recordsByState: stats.recordsByState || {},
                        recordsByTask: this.transformTaskDetails(apiData.taskDetails || [])
                    },
                    weeklyBreakdown: [],
                    timestamp: Date.now()
                };
            }

            return this.getEmptyReportData(timeRange, apiData?.timeValue);
        },

        /**
         * 转换任务详情为按任务分组的格式
         * @param {array} taskDetails - 任务详情数组
         * @returns {object} 按任务分组的统计
         */
        transformTaskDetails: function(taskDetails) {
            const recordsByTask = {};

            if (!Array.isArray(taskDetails)) {
                return recordsByTask;
            }

            for (const task of taskDetails) {
                const taskId = task.taskId || 'unknown';
                if (!recordsByTask[taskId]) {
                    recordsByTask[taskId] = { count: 0, valid: 0 };
                }

                if (Array.isArray(task.records)) {
                    for (const record of task.records) {
                        recordsByTask[taskId].count += 1;
                        if (record.isValid) {
                            recordsByTask[taskId].valid += 1;
                        }
                    }
                }
            }

            return recordsByTask;
        },

        /**
         * 获取缓存键
         * @param {string} timeRange - 时间范围
         * @param {string} timeValue - 时间值
         * @returns {string} 缓存键
         */
        getCacheKey: function(timeRange, timeValue) {
            if (timeValue) {
                return `${DataServiceConfig.CACHE_PREFIX}${timeRange}_${timeValue}`;
            }
            return `${DataServiceConfig.CACHE_PREFIX}${timeRange}_current`;
        },

        /**
         * 从缓存获取数据
         * @param {string} key - 缓存键
         * @returns {object|null} 缓存数据或 null
         */
        getCache: function(key) {
            try {
                const stored = localStorage.getItem(key);
                if (!stored) return null;

                const data = JSON.parse(stored);

                // 检查缓存是否过期
                if (data && data.timestamp) {
                    const timeRange = key.split('_')[3]; // 从键名中提取时间范围
                    const ttl = DataServiceConfig.CACHE_TTL[timeRange] || DataServiceConfig.CACHE_TTL.day;
                    const age = Date.now() - data.timestamp;

                    if (age > ttl) {
                        localStorage.removeItem(key);
                        return null;
                    }
                }

                return data;
            } catch (error) {
                console.error('[DataService] 获取缓存失败:', error);
                return null;
            }
        },

        /**
         * 保存数据到缓存
         * @param {string} key - 缓存键
         * @param {object} data - 数据
         */
        setCache: function(key, data) {
            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (error) {
                console.error('[DataService] 保存缓存失败:', error);
            }
        },

        /**
         * 清空所有缓存
         */
        clearAllCache: function() {
            try {
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith(DataServiceConfig.CACHE_PREFIX)) {
                        keys.push(key);
                    }
                }
                keys.forEach(key => localStorage.removeItem(key));
                console.log('[DataService] 已清空所有缓存');
            } catch (error) {
                console.error('[DataService] 清空缓存失败:', error);
            }
        },

        /**
         * 获取空报表数据
         * @param {string} timeRange - 时间范围
         * @param {string} timeValue - 时间值
         * @returns {object} 空报表数据
         */
        getEmptyReportData: function(timeRange, timeValue) {
            const emptyStats = {
                totalRecords: 0,
                validRecords: 0,
                invalidRecords: 0,
                validRate: 0,
                totalTopicNum: 0,
                totalElapsedTime: 0,
                averageElapsedTime: 0,
                recordsByState: {
                    completed: 0,
                    failed: 0,
                    pending: 0
                },
                recordsByTask: {}
            };

            if (timeRange === 'day') {
                return {
                    date: timeValue || this.formatDate(new Date()),
                    statistics: emptyStats,
                    timestamp: Date.now()
                };
            } else if (timeRange === 'week') {
                return {
                    week: this.calculateWeekNumber(new Date()),
                    startDate: '',
                    endDate: '',
                    statistics: emptyStats,
                    dailyBreakdown: [],
                    timestamp: Date.now()
                };
            } else if (timeRange === 'month') {
                return {
                    month: timeValue || this.formatYearMonth(new Date()),
                    startDate: '',
                    endDate: '',
                    statistics: emptyStats,
                    weeklyBreakdown: [],
                    timestamp: Date.now()
                };
            }

            return { statistics: emptyStats };
        },

        /**
         * 格式化日期：YYYY-MM-DD
         * @param {Date|string} date - 日期对象或字符串
         * @returns {string} 格式化后的日期
         */
        formatDate: function(date) {
            if (typeof date === 'string') {
                return date;
            }
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        /**
         * 格式化年月：YYYY-MM
         * @param {Date|string} date - 日期对象或字符串
         * @returns {string} 格式化后的年月
         */
        formatYearMonth: function(date) {
            if (typeof date === 'string' && date.match(/^\d{4}-\d{2}$/)) {
                return date;
            }
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            return `${year}-${month}`;
        },

        /**
         * 计算周号
         * @param {Date|string} date - 日期对象或字符串
         * @returns {string} 周号，格式 YYYY-Www
         */
        calculateWeekNumber: function(date) {
            const d = new Date(date);
            const dayNum = (d.getDay() + 6) % 7;
            d.setDate(d.getDate() - dayNum + 3);
            const firstThursday = d.valueOf();
            d.setMonth(0, 4);
            d.setHours(0, 0, 0, 0);
            const jan4 = d.valueOf();
            const weekNum = Math.round((firstThursday - jan4) / 604800000) + 1;
            const year = d.getFullYear();
            return `${year}-W${String(weekNum).padStart(2, '0')}`;
        }
    };

    // 导出到全局作用域
    window.DataService = DataService;

    console.log('[DataService] 数据服务层已加载');
})();
