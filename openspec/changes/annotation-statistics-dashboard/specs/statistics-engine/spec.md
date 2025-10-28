# 统计报表引擎规范

## 概述
统计报表引擎负责从本地存储的标注数据中生成各种维度的统计报表，支持日、周、月、自定义范围的数据聚合和计算。

## ADDED Requirements

### Requirement: Daily Statistics Calculation
#### Scenario:
用户完成标注后，系统自动计算并保存当日的统计数据。
- **输入**: 新增的标注记录 (recordState, isValid, topicNum, elapsedTime)
- **输出**: 更新 localStorage 中的日粒度统计数据
- **副作用**: 触发统计数据更新事件

**实现方式**:
```javascript
function saveDailyStats(date, stats) {
  // 保存到 localStorage: appen_daily_stats_YYYY-MM-DD
  const key = `appen_daily_stats_${formatDate(date)}`;
  const existing = loadDailyStats(date) || getEmptyDailyStats();
  const merged = mergeDailyStats(existing, stats);
  localStorage.setItem(key, JSON.stringify(merged));
  triggerStatsUpdateEvent(date);
}
```

### Requirement: Weekly Report Generation
#### Scenario:
用户查询本周或指定周的统计报表，系统聚合该周所有日期的数据。
- **输入**: 周号 (YYYY-Www 格式或 week number)
- **输出**: 周粒度的聚合统计数据
- **边界情况**: 跨月的周、不完整的周（周一未开始工作）

**数据结构**:
```javascript
{
  week: "2024-W44",
  startDate: "2024-10-28",
  endDate: "2024-11-03",
  statistics: {
    totalRecords: 315,        // 本周所有记录总数
    validRecords: 280,        // 有效记录数
    invalidRecords: 35,       // 无效记录数
    validRate: 0.8889,        // 有效率百分比 (0-1)
    totalTopicNum: 840,       // 做题总数
    totalElapsedTime: 25200,  // 总耗时 (秒)
    averageElapsedTime: 80.0, // 平均耗时 (秒)
    recordsByState: {
      completed: 280,
      failed: 30,
      pending: 5
    },
    dailyBreakdown: [
      { date: "2024-10-28", records: 45, valid: 40, topics: 120, elapsedTime: 3600 },
      // ... 其他 6 天
    ]
  }
}
```

### Requirement: Monthly Report Generation
#### Scenario:
用户查询当月或指定月份的统计报表，系统聚合该月所有周的数据。
- **输入**: 月份 (YYYY-MM 格式)
- **输出**: 月粒度的聚合统计数据
- **计算**: 自动按周分解

**数据结构**:
```javascript
{
  month: "2024-10",
  startDate: "2024-10-01",
  endDate: "2024-10-31",
  statistics: {
    totalRecords: 1350,
    validRecords: 1200,
    invalidRecords: 150,
    validRate: 0.8889,
    totalTopicNum: 3600,
    totalElapsedTime: 108000,
    averageElapsedTime: 80.0,
    weeklyBreakdown: [
      { week: "2024-W40", records: 280, valid: 250, ... },
      // ... 4-5 周
    ]
  }
}
```

### Requirement: Custom Date Range Report
#### Scenario:
用户选择自定义日期范围，系统生成该范围内的聚合报表。
- **输入**: startDate, endDate (ISO 8601 格式或时间戳)
- **输出**: 范围粒度的聚合统计数据
- **验证**: startDate <= endDate，范围不超过 1 年

**实现约束**:
- 最大范围 365 天
- 返回日粒度的详细数据（支持 30+ 个数据点）
- 计算趋势数据供图表使用

### Requirement: Data Aggregation Functions
#### Scenario:
统计引擎提供多个聚合函数，用于计算各种统计指标。

**核心聚合函数**:
- `sumRecords(dailyStats[])`: 求和记录数
- `calculateValidRate(valid, total)`: 计算有效率
- `calculateAverageTime(totalTime, count)`: 计算平均耗时
- `groupByTask(records)`: 按任务分组
- `groupByState(records)`: 按状态分组
- `calculateTrend(timeSeriesData)`: 计算趋势

### Requirement: Data Caching
#### Scenario:
频繁查询同一时间范围的报表时，使用缓存避免重复计算。同时支持 10 分钟自动刷新机制以保持数据与服务器同步。
- **缓存策略**: 
  - 日粒度: 实时数据，每 10 分钟刷新一次
  - 周粒度: 缓存 7 天，每 10 分钟检查更新
  - 月粒度: 缓存 30 天，每 10 分钟检查更新
- **缓存失效**: 当有新数据写入时，清除相关缓存
- **自动刷新**: 每 10 分钟检查是否需要更新缓存数据

**缓存键格式**:
```
appen_cache_week_YYYY-Www
appen_cache_month_YYYY-MM
appen_cache_range_YYYYMMDD_YYYYMMDD
appen_cache_refresh_timestamp  // 记录上次刷新时间
```

**10 分钟自动刷新实现**:
```javascript
// 在应用启动时初始化
const CACHE_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 分钟

let cacheRefreshTimer = null;

function initializeCacheRefresh() {
  // 应用启动时立即加载一次
  refreshAllCaches();
  
  // 每 10 分钟自动刷新一次
  cacheRefreshTimer = setInterval(() => {
    refreshAllCaches();
  }, CACHE_REFRESH_INTERVAL);
}

function refreshAllCaches() {
  const now = Date.now();
  const lastRefresh = localStorage.getItem('appen_cache_refresh_timestamp');
  
  // 检查是否需要刷新（10 分钟间隔）
  if (lastRefresh && now - lastRefresh < CACHE_REFRESH_INTERVAL) {
    return;
  }
  
  // 重新计算所有缓存数据
  updateDailyCaches();
  updateWeeklyCaches();
  updateMonthlyCaches();
  
  // 更新最后刷新时间
  localStorage.setItem('appen_cache_refresh_timestamp', now.toString());
  
  // 触发缓存更新事件（UI 监听并刷新显示）
  window.dispatchEvent(new CustomEvent('statsDataRefreshed', { detail: { timestamp: now } }));
}
```

### Requirement: Data Cleanup
#### Scenario:
系统自动清理超过保留期（90 天）的日粒度数据。
- **触发时机**: 
  - 应用启动时
  - 每日定时检查（如凌晨 1 点）
- **清理规则**: 删除 90 天前的所有日数据
- **备份**: 清理前可选地导出用于备份

**实现细节**:
```javascript
function cleanupOldData() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  
  // 遍历 localStorage
  // 删除所有 appen_daily_stats_YYYY-MM-DD 其中日期 < cutoffDate
}
```

## MODIFIED Requirements

### Requirement: Completion Stats Integration
现有的 completionStats 需要扩展以支持统计报表:
- **新增字段**: 
  - 按日期组织的数据结构（补充按页面分组的方式）
  - 按任务维度的统计（补充现有的总体统计）
- **兼容性**: 保持现有的数据格式，添加新的存储方式
- **迁移**: 首次加载时自动将现有数据转换为新格式

## 接口定义

### getReportData(options)
```javascript
/**
 * 获取统计报表数据
 * @param {Object} options
 * @param {string} options.timeRange - 'day' | 'week' | 'month' | 'range'
 * @param {string} options.timeValue - 具体时间值 (可选)
 * @param {string} options.startDate - 范围开始日期 (range 模式必填)
 * @param {string} options.endDate - 范围结束日期 (range 模式必填)
 * @param {boolean} options.includeDetails - 是否包含详细的日粒度数据
 * @returns {Promise<ReportData>}
 */
async function getReportData(options) {
  // 验证参数
  // 从 localStorage 加载数据
  // 执行聚合计算
  // 返回报表数据
}
```

### calculateWeeklyStats(weekNumber)
```javascript
/**
 * 计算周粒度统计
 * @param {string} weekNumber - ISO 8601 周号 (YYYY-Www)
 * @returns {Promise<WeeklyStats>}
 */
async function calculateWeeklyStats(weekNumber) {
  // 解析周号
  // 获取周一到周日
  // 加载各日数据
  // 聚合计算
  // 返回周粒度统计
}
```

### calculateMonthlyStats(yearMonth)
```javascript
/**
 * 计算月粒度统计
 * @param {string} yearMonth - 月份 (YYYY-MM)
 * @returns {Promise<MonthlyStats>}
 */
async function calculateMonthlyStats(yearMonth) {
  // 确定月份起止日期
  // 计算包含的周数
  // 加载各日数据
  // 按周分组聚合
  // 返回月粒度统计
}
```

## 错误处理

### Scenario: 数据缺失或损坏
- 返回空的统计数据结构
- 记录错误日志
- 提示用户数据可能不完整

### Scenario: 日期格式错误
- 抛出 ValidationError
- 提供格式建议
- 使用当前日期作为默认值

## 性能要求

- 日粒度查询: < 100ms
- 周粒度查询: < 200ms
- 月粒度查询: < 300ms
- 自定义范围 (30 天): < 500ms
- 缓存命中: < 10ms
