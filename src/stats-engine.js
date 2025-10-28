/**
 * 统计报表引擎
 * 负责从 completionStats 和 localStorage 中生成各种维度的统计报表
 * 支持日、周、月、自定义范围的数据聚合和计算
 */

(function() {
    'use strict';

    // 统计引擎配置
    const StatsConfig = {
        DAILY_STATS_PREFIX: 'appen_daily_stats_',
        WEEKLY_CACHE_PREFIX: 'appen_cache_week_',
        MONTHLY_CACHE_PREFIX: 'appen_cache_month_',
        CACHE_REFRESH_TIMESTAMP_KEY: 'appen_cache_refresh_timestamp',
        CACHE_TTL_WEEK: 7 * 24 * 60 * 60 * 1000,  // 7 天
        CACHE_TTL_MONTH: 30 * 24 * 60 * 60 * 1000, // 30 天
        MAX_RANGE_DAYS: 365
    };

    // 统计引擎对象
    const StatsEngine = {
        /**
         * 获取指定日期的统计数据
         * @param {string} date - 日期，格式 YYYY-MM-DD
         * @returns {object} 日粒度统计数据
         */
        getDailyStats: function(date) {
            try {
                const key = StatsConfig.DAILY_STATS_PREFIX + date;
                const stored = localStorage.getItem(key);
                
                if (stored) {
                    return JSON.parse(stored);
                }
                
                // 返回空统计结构
                return this.getEmptyDailyStats(date);
            } catch (error) {
                console.error('[StatsEngine] 获取日统计数据失败:', error);
                return this.getEmptyDailyStats(date);
            }
        },

        /**
         * 保存日统计数据
         * @param {string} date - 日期，格式 YYYY-MM-DD
         * @param {object} stats - 统计数据
         */
        saveDailyStats: function(date, stats) {
            try {
                const key = StatsConfig.DAILY_STATS_PREFIX + date;
                const dataToSave = {
                    date: date,
                    statistics: stats,
                    timestamp: Date.now()
                };
                localStorage.setItem(key, JSON.stringify(dataToSave));
                
                // 触发缓存更新事件
                window.dispatchEvent(new CustomEvent('statsDataRefreshed', {
                    detail: {
                        timestamp: Date.now(),
                        reason: '日统计数据已保存',
                        date: date
                    }
                }));
            } catch (error) {
                console.error('[StatsEngine] 保存日统计数据失败:', error);
            }
        },

        /**
         * 计算周统计数据
         * @param {string} weekNumber - ISO 8601 周号，格式 YYYY-Www
         * @returns {object} 周粒度统计数据
         */
        calculateWeeklyStats: function(weekNumber) {
            try {
                // 首先尝试从缓存获取
                const cacheKey = StatsConfig.WEEKLY_CACHE_PREFIX + weekNumber;
                const cached = this.getCachedData(cacheKey);
                if (cached) {
                    return cached;
                }

                // 解析周号并计算周一和周日日期
                const [year, week] = this.parseWeekNumber(weekNumber);
                const { startDate, endDate } = this.getWeekDateRange(year, week);

                // 加载该周所有日期的日粒度数据
                const dailyDataArray = this.loadDateRangeData(startDate, endDate);

                // 聚合计算
                const stats = this.aggregateStats(dailyDataArray);

                // 添加日分解数据
                const weeklyReport = {
                    week: weekNumber,
                    startDate: this.formatDate(startDate),
                    endDate: this.formatDate(endDate),
                    statistics: stats,
                    dailyBreakdown: dailyDataArray.map(d => ({
                        date: d.date,
                        records: d.statistics.totalRecords || 0,
                        valid: d.statistics.validRecords || 0,
                        invalid: d.statistics.invalidRecords || 0,
                        topics: d.statistics.totalTopicNum || 0,
                        elapsedTime: d.statistics.totalElapsedTime || 0
                    }))
                };

                // 缓存周数据
                this.cacheData(cacheKey, weeklyReport);

                return weeklyReport;
            } catch (error) {
                console.error('[StatsEngine] 计算周统计失败:', error);
                return this.getEmptyWeeklyStats(weekNumber);
            }
        },

        /**
         * 计算月统计数据
         * @param {string} yearMonth - 月份，格式 YYYY-MM
         * @returns {object} 月粒度统计数据
         */
        calculateMonthlyStats: function(yearMonth) {
            try {
                // 首先尝试从缓存获取
                const cacheKey = StatsConfig.MONTHLY_CACHE_PREFIX + yearMonth;
                const cached = this.getCachedData(cacheKey);
                if (cached) {
                    return cached;
                }

                // 解析月份
                const [year, month] = yearMonth.split('-').map(Number);
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 0);

                // 加载该月所有日期的日粒度数据
                const dailyDataArray = this.loadDateRangeData(startDate, endDate);

                // 聚合计算
                const stats = this.aggregateStats(dailyDataArray);

                // 计算周分解
                const weeklyBreakdown = this.getMonthlyWeeklyBreakdown(year, month, dailyDataArray);

                const monthlyReport = {
                    month: yearMonth,
                    startDate: this.formatDate(startDate),
                    endDate: this.formatDate(endDate),
                    statistics: stats,
                    weeklyBreakdown: weeklyBreakdown
                };

                // 缓存月数据
                this.cacheData(cacheKey, monthlyReport);

                return monthlyReport;
            } catch (error) {
                console.error('[StatsEngine] 计算月统计失败:', error);
                return this.getEmptyMonthlyStats(yearMonth);
            }
        },

        /**
         * 计算自定义日期范围的统计数据
         * @param {string} startDate - 开始日期，格式 YYYY-MM-DD
         * @param {string} endDate - 结束日期，格式 YYYY-MM-DD
         * @returns {object} 范围统计数据
         */
        calculateRangeStats: function(startDate, endDate) {
            try {
                // 验证日期范围
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                if (start > end) {
                    throw new Error('开始日期不能晚于结束日期');
                }

                const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                if (daysDiff > StatsConfig.MAX_RANGE_DAYS) {
                    throw new Error(`日期范围不能超过 ${StatsConfig.MAX_RANGE_DAYS} 天`);
                }

                // 加载范围内所有日期的数据
                const dailyDataArray = this.loadDateRangeData(start, end);

                // 聚合计算
                const stats = this.aggregateStats(dailyDataArray);

                return {
                    startDate: startDate,
                    endDate: endDate,
                    dayCount: daysDiff,
                    statistics: stats,
                    dailyBreakdown: dailyDataArray.map(d => ({
                        date: d.date,
                        records: d.statistics.totalRecords || 0,
                        valid: d.statistics.validRecords || 0,
                        invalid: d.statistics.invalidRecords || 0,
                        validRate: d.statistics.validRate || 0,
                        avgTime: d.statistics.averageElapsedTime || 0,
                        topics: d.statistics.totalTopicNum || 0
                    }))
                };
            } catch (error) {
                console.error('[StatsEngine] 计算范围统计失败:', error);
                return {
                    startDate: startDate,
                    endDate: endDate,
                    error: error.message,
                    statistics: this.getEmptyStatistics()
                };
            }
        },

        /**
         * 从 completionStats 计算日统计数据
         * @param {object} completionStats - 完成统计对象
         * @param {string} date - 日期，格式 YYYY-MM-DD
         * @returns {object} 日统计数据
         */
        calculateDailyStatsFromCompletionStats: function(completionStats, date) {
            try {
                let totalRecords = 0;
                let validRecords = 0;
                let invalidRecords = 0;
                let totalElapsedTime = 0;
                let totalTopicNum = 0;
                const recordsByState = {
                    completed: 0,
                    failed: 0,
                    pending: 0
                };
                const recordsByTask = {};

                // 统计 completionStats 中的数据
                if (completionStats && completionStats.perPage) {
                    for (const [pageKey, pageData] of Object.entries(completionStats.perPage)) {
                        if (!pageData || !pageData.firstCompletionTime) continue;

                        // 检查完成时间是否在指定日期
                        const completionDate = new Date(pageData.firstCompletionTime);
                        const dateStr = this.formatDate(completionDate);
                        
                        if (dateStr === date) {
                            totalRecords += 1;
                            
                            if (pageData.isValid) {
                                validRecords += 1;
                                recordsByState.completed += 1;
                            } else {
                                invalidRecords += 1;
                                recordsByState.failed += 1;
                            }

                            totalElapsedTime += (pageData.elapsedSeconds || 0);
                            totalTopicNum += (pageData.topicCount || 0);

                            // 按任务分组
                            const taskId = pageData.taskId || 'unknown';
                            if (!recordsByTask[taskId]) {
                                recordsByTask[taskId] = { count: 0, valid: 0 };
                            }
                            recordsByTask[taskId].count += 1;
                            if (pageData.isValid) {
                                recordsByTask[taskId].valid += 1;
                            }
                        }
                    }
                }

                // 计算衍生指标
                const validRate = totalRecords > 0 ? validRecords / totalRecords : 0;
                const averageElapsedTime = totalRecords > 0 ? totalElapsedTime / totalRecords : 0;

                return {
                    totalRecords: totalRecords,
                    validRecords: validRecords,
                    invalidRecords: invalidRecords,
                    validRate: validRate,
                    totalTopicNum: totalTopicNum,
                    totalElapsedTime: totalElapsedTime,
                    averageElapsedTime: averageElapsedTime,
                    recordsByState: recordsByState,
                    recordsByTask: recordsByTask
                };
            } catch (error) {
                console.error('[StatsEngine] 从 completionStats 计算日统计失败:', error);
                return this.getEmptyStatistics();
            }
        },

        /**
         * 获取当前日期的统计数据
         * @returns {object} 今天的统计数据
         */
        getTodayStats: function() {
            const today = new Date();
            const dateStr = this.formatDate(today);
            return this.getDailyStats(dateStr);
        },

        /**
         * 获取本周的统计数据
         * @returns {object} 本周的统计数据
         */
        getCurrentWeekStats: function() {
            const weekNumber = this.getISOWeekNumber(new Date());
            return this.calculateWeeklyStats(weekNumber);
        },

        /**
         * 获取本月的统计数据
         * @returns {object} 本月的统计数据
         */
        getCurrentMonthStats: function() {
            const today = new Date();
            const yearMonth = this.formatYearMonth(today);
            return this.calculateMonthlyStats(yearMonth);
        },

        /**
         * 聚合统计数据
         * @param {array} dailyDataArray - 日统计数据数组
         * @returns {object} 聚合后的统计数据
         */
        aggregateStats: function(dailyDataArray) {
            let totalRecords = 0;
            let validRecords = 0;
            let invalidRecords = 0;
            let totalElapsedTime = 0;
            let totalTopicNum = 0;
            const recordsByState = {
                completed: 0,
                failed: 0,
                pending: 0
            };
            const recordsByTask = {};

            // 遍历所有日数据进行求和
            for (const dayData of dailyDataArray) {
                if (!dayData || !dayData.statistics) continue;

                const stats = dayData.statistics;
                totalRecords += stats.totalRecords || 0;
                validRecords += stats.validRecords || 0;
                invalidRecords += stats.invalidRecords || 0;
                totalElapsedTime += stats.totalElapsedTime || 0;
                totalTopicNum += stats.totalTopicNum || 0;

                // 聚合按状态分组的数据
                if (stats.recordsByState) {
                    recordsByState.completed += stats.recordsByState.completed || 0;
                    recordsByState.failed += stats.recordsByState.failed || 0;
                    recordsByState.pending += stats.recordsByState.pending || 0;
                }

                // 聚合按任务分组的数据
                if (stats.recordsByTask) {
                    for (const [taskId, taskData] of Object.entries(stats.recordsByTask)) {
                        if (!recordsByTask[taskId]) {
                            recordsByTask[taskId] = { count: 0, valid: 0 };
                        }
                        recordsByTask[taskId].count += taskData.count || 0;
                        recordsByTask[taskId].valid += taskData.valid || 0;
                    }
                }
            }

            // 计算衍生指标
            const validRate = totalRecords > 0 ? validRecords / totalRecords : 0;
            const averageElapsedTime = totalRecords > 0 ? totalElapsedTime / totalRecords : 0;

            return {
                totalRecords: totalRecords,
                validRecords: validRecords,
                invalidRecords: invalidRecords,
                validRate: validRate,
                totalTopicNum: totalTopicNum,
                totalElapsedTime: totalElapsedTime,
                averageElapsedTime: averageElapsedTime,
                recordsByState: recordsByState,
                recordsByTask: recordsByTask
            };
        },

        /**
         * 加载日期范围内的所有日数据
         * @param {Date} startDate - 开始日期
         * @param {Date} endDate - 结束日期
         * @returns {array} 日数据数组
         */
        loadDateRangeData: function(startDate, endDate) {
            const data = [];
            const current = new Date(startDate);

            while (current <= endDate) {
                const dateStr = this.formatDate(current);
                const dayData = this.getDailyStats(dateStr);
                data.push(dayData);
                
                // 移动到下一天
                current.setDate(current.getDate() + 1);
            }

            return data;
        },

        /**
         * 获取月份的周分解
         * @param {number} year - 年份
         * @param {number} month - 月份 (1-12)
         * @param {array} dailyDataArray - 日数据数组
         * @returns {array} 周分解数据
         */
        getMonthlyWeeklyBreakdown: function(year, month, dailyDataArray) {
            const weeklyMap = {};

            // 按周分组日数据
            for (const dayData of dailyDataArray) {
                const weekNumber = this.getISOWeekNumber(new Date(dayData.date));
                if (!weeklyMap[weekNumber]) {
                    weeklyMap[weekNumber] = [];
                }
                weeklyMap[weekNumber].push(dayData);
            }

            // 为每周聚合数据
            const breakdown = [];
            for (const [weekNumber, weekDays] of Object.entries(weeklyMap)) {
                const stats = this.aggregateStats(weekDays);
                breakdown.push({
                    week: weekNumber,
                    records: stats.totalRecords,
                    valid: stats.validRecords,
                    invalid: stats.invalidRecords,
                    validRate: stats.validRate,
                    avgTime: stats.averageElapsedTime,
                    topics: stats.totalTopicNum
                });
            }

            return breakdown.sort((a, b) => a.week.localeCompare(b.week));
        },

        /**
         * 获取缓存的数据
         * @param {string} key - 缓存键
         * @returns {object|null} 缓存数据或 null
         */
        getCachedData: function(key) {
            try {
                const stored = localStorage.getItem(key);
                if (!stored) return null;

                const data = JSON.parse(stored);
                
                // 检查缓存是否过期
                if (data && data.timestamp) {
                    const age = Date.now() - data.timestamp;
                    const ttl = key.includes('week') ? StatsConfig.CACHE_TTL_WEEK : StatsConfig.CACHE_TTL_MONTH;
                    
                    if (age > ttl) {
                        localStorage.removeItem(key);
                        return null;
                    }
                }

                return data.data || data;
            } catch (error) {
                console.error('[StatsEngine] 获取缓存数据失败:', error);
                return null;
            }
        },

        /**
         * 缓存数据
         * @param {string} key - 缓存键
         * @param {object} data - 要缓存的数据
         */
        cacheData: function(key, data) {
            try {
                const cacheData = {
                    data: data,
                    timestamp: Date.now()
                };
                localStorage.setItem(key, JSON.stringify(cacheData));
            } catch (error) {
                console.error('[StatsEngine] 缓存数据失败:', error);
            }
        },

        /**
         * 获取空的日统计结构
         * @param {string} date - 日期
         * @returns {object} 空日统计对象
         */
        getEmptyDailyStats: function(date) {
            return {
                date: date,
                statistics: this.getEmptyStatistics(),
                timestamp: Date.now()
            };
        },

        /**
         * 获取空的统计数据
         * @returns {object} 空统计对象
         */
        getEmptyStatistics: function() {
            return {
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
        },

        /**
         * 获取空的周统计结构
         * @param {string} weekNumber - 周号
         * @returns {object} 空周统计对象
         */
        getEmptyWeeklyStats: function(weekNumber) {
            const [year, week] = this.parseWeekNumber(weekNumber);
            const { startDate, endDate } = this.getWeekDateRange(year, week);
            
            return {
                week: weekNumber,
                startDate: this.formatDate(startDate),
                endDate: this.formatDate(endDate),
                statistics: this.getEmptyStatistics(),
                dailyBreakdown: []
            };
        },

        /**
         * 获取空的月统计结构
         * @param {string} yearMonth - 月份
         * @returns {object} 空月统计对象
         */
        getEmptyMonthlyStats: function(yearMonth) {
            const [year, month] = yearMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            
            return {
                month: yearMonth,
                startDate: this.formatDate(startDate),
                endDate: this.formatDate(endDate),
                statistics: this.getEmptyStatistics(),
                weeklyBreakdown: []
            };
        },

        /**
         * 日期格式化：YYYY-MM-DD
         * @param {Date} date - 日期对象
         * @returns {string} 格式化后的日期
         */
        formatDate: function(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        /**
         * 年月格式化：YYYY-MM
         * @param {Date} date - 日期对象
         * @returns {string} 格式化后的年月
         */
        formatYearMonth: function(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return `${year}-${month}`;
        },

        /**
         * 获取 ISO 8601 周号
         * @param {Date} date - 日期对象
         * @returns {string} 周号，格式 YYYY-Www
         */
        getISOWeekNumber: function(date) {
            const target = new Date(date);
            const dayNum = (date.getDay() + 6) % 7; // 周一为 0
            target.setDate(target.getDate() - dayNum + 3);
            const firstThursday = target.valueOf();
            target.setMonth(0, 4);
            target.setHours(0, 0, 0, 0);
            const jan4 = target.valueOf();
            const msPerWeek = 604800000;
            const weekNum = Math.round((firstThursday - jan4) / msPerWeek) + 1;
            const year = target.getFullYear();
            return `${year}-W${String(weekNum).padStart(2, '0')}`;
        },

        /**
         * 解析周号
         * @param {string} weekNumber - 周号，格式 YYYY-Www
         * @returns {array} [year, week]
         */
        parseWeekNumber: function(weekNumber) {
            const match = weekNumber.match(/(\d{4})-W(\d{2})/);
            if (!match) {
                throw new Error('无效的周号格式');
            }
            return [parseInt(match[1]), parseInt(match[2])];
        },

        /**
         * 获取周的日期范围
         * @param {number} year - 年份
         * @param {number} week - 周号 (1-53)
         * @returns {object} {startDate, endDate}
         */
        getWeekDateRange: function(year, week) {
            // ISO 8601: 周一为一周的开始
            const jan4 = new Date(year, 0, 4);
            const jan4DayOfWeek = jan4.getDay() || 7; // 周日为 7
            const daysToMonday = (jan4DayOfWeek - 1) % 7;
            const weekOneMonday = new Date(jan4);
            weekOneMonday.setDate(4 - daysToMonday);

            const targetMonday = new Date(weekOneMonday);
            targetMonday.setDate(weekOneMonday.getDate() + (week - 1) * 7);

            const startDate = new Date(targetMonday);
            const endDate = new Date(targetMonday);
            endDate.setDate(startDate.getDate() + 6);

            return { startDate, endDate };
        }
    };

    // 导出到全局作用域
    window.StatsEngine = StatsEngine;

    // 当脚本加载完成时输出日志
    console.log('[StatsEngine] 统计引擎已加载');
})();
