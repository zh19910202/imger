# 数据看板数据来源和流向分析

## 核心数据结构

### 1. completionStats（内存中的实时统计）
位置：`src/appen-data-collector.js` 第 878-887 行

```javascript
completionStats = {
  // 总体统计
  totalValidCompletions: 0,      // 有效完成总数
  totalInvalidCompletions: 0,    // 无效完成总数
  totalReworkCompletions: 0,     // 返修完成总数
  totalTopicsCompleted: 0,       // 完成的题目总数
  totalReworkTopics: 0,          // 返修的题目总数
  totalQuestions: 0,             // 总题目数
  reworkQuestions: 0,            // 返修题目数
  
  // 按页面分组的详细数据
  perPage: {
    [pageKey]: {
      completions: 0,            // 该页面完成次数
      topicId: 'xxx',            // 题目 ID
      topicCount: 0,             // 该页面的题目数
      elapsedSeconds: 0,         // 耗时（秒）
      isValid: true,             // 是否有效
      hasRework: false,          // 是否有返修
      isSecondaryRework: false,  // 是否二次返修
      rejectReason: '',          // 驳回原因
      firstCompletionTime: 123,  // 首次完成时间戳
      lastCompletionTime: 456    // 最后完成时间戳
    }
  }
}
```

## 数据流向分析

### Phase 1: 数据采集和记录

```
用户完成标注
    ↓
recordCompletionOnConfirm() 
  (src/appen-data-collector.js:3314)
    ↓
更新 completionStats.perPage[pageKey]
  - 记录完成时间：firstCompletionTime / lastCompletionTime
  - 记录耗时：elapsedSeconds
  - 记录有效性：isValid
  - 记录题目数：topicCount
    ↓
更新全局计数器
  - totalValidCompletions / totalInvalidCompletions
  - totalTopicsCompleted
  - totalReworkCompletions
    ↓
saveCompletionStats()
  - 保存到 chrome.storage.local (后端存储)
    ↓
推送数据到服务器
  pushDataOnSubmission()
```

### Phase 2: 日粒度数据的生成（我现在添加的）

```
recordCompletionOnConfirm() 完成
    ↓
调用 StatsEngine.calculateDailyStatsFromCompletionStats()
    ↓
遍历 completionStats.perPage
  - 检查每条记录的 firstCompletionTime 是否在指定日期
  - 统计该日期的：
    * totalRecords: 完成总数
    * validRecords: 有效完成数
    * invalidRecords: 无效完成数
    * totalElapsedTime: 总耗时
    * totalTopicNum: 总题目数
    * recordsByState: 按状态分组
    * recordsByTask: 按任务分组
    ↓
StatsEngine.saveDailyStats(date, stats)
  - 保存到 localStorage
  - 键名：appen_daily_stats_YYYY-MM-DD
    ↓
触发 statsDataRefreshed 事件
  - UI 层监听此事件并刷新显示
```

### Phase 3: 周/月数据的聚合

```
用户打开看板或缓存刷新
    ↓
DashboardSidebar.loadData()
    ↓
根据 currentTimeRange 调用相应的统计函数
  case 'day':  StatsEngine.getTodayStats()
  case 'week': StatsEngine.getCurrentWeekStats()
  case 'month': StatsEngine.getCurrentMonthStats()
    ↓
StatsEngine.calculateWeeklyStats(weekNumber) 
或 StatsEngine.calculateMonthlyStats(yearMonth)
    ↓
1. 计算日期范围
2. loadDateRangeData() - 从 localStorage 加载范围内的所有日数据
3. aggregateStats() - 求和聚合
   - 求和所有 totalRecords、validRecords、invalidRecords
   - 求和 totalElapsedTime、totalTopicNum
   - 计算衍生指标：validRate、averageElapsedTime
4. 返回聚合后的统计对象
    ↓
缓存周/月数据（7天/30天TTL）
    ↓
更新 UI 显示
```

## 数据来源总结

| 数据类型 | 来源 | 存储位置 | 更新时机 | 查询方式 |
|---------|------|---------|---------|---------|
| **实时统计** | 标注完成时采集 | 内存（completionStats） + chrome.storage.local | 每个标注完成 | 直接读取内存 |
| **日粒度统计** | 从 completionStats 计算 | localStorage (appen_daily_stats_YYYY-MM-DD) | 标注完成时或缓存刷新时 | StatsEngine.getDailyStats() |
| **周粒度统计** | 聚合日粒度数据 | localStorage 缓存 (appen_cache_week_YYYY-Www) | 首次查询或缓存过期 | StatsEngine.calculateWeeklyStats() |
| **月粒度统计** | 聚合日粒度数据 | localStorage 缓存 (appen_cache_month_YYYY-MM) | 首次查询或缓存过期 | StatsEngine.calculateMonthlyStats() |

## 关键时间戳字段说明

在 `completionStats.perPage[pageKey]` 中：

- **firstCompletionTime**: 这条页面首次完成的时间戳（毫秒）
  - 用途：判断完成记录属于哪一天
  - 时区：浏览器本地时区

- **lastCompletionTime**: 这条页面最后一次完成的时间戳（毫秒）
  - 用途：追踪最新的操作时间

- **elapsedSeconds**: 这条页面的完成耗时（秒）
  - 精确到秒，从 startTime 到完成时间
  - 用于计算平均耗时

## 实现中的重要考虑

### 1. 时区问题
```javascript
// 当前实现使用本地时区
const dateStr = window.StatsEngine.formatDate(new Date());
// 结果：YYYY-MM-DD（本地时区）

// 示例：
// 用户在 2024-10-28 23:50 完成标注，第二天 00:10 看板显示
// 该标注被记录到 2024-10-28（完成时的本地日期）
```

### 2. 跨日期处理
```javascript
// 获取日期范围内的所有日数据
const dailyDataArray = this.loadDateRangeData(startDate, endDate);

// 这会加载每一天的数据，即使该天的数据为空
// 空数据通过 getEmptyDailyStats() 返回
```

### 3. 数据聚合的准确性
```javascript
// 日粒度统计通过遍历 completionStats.perPage 生成
// 每条记录都有明确的时间戳，确保分类准确

// 周/月粒度统计通过聚合日粒度数据
// 不会重复计算或遗漏数据
```

## 现有问题和改进方向

### 当前问题
1. **首次启动时无数据**：应用刚安装时，completionStats 为空，看板显示无数据
   - 解决方案：从 chrome.storage 加载历史数据

2. **跨浏览器会话**：用户关闭浏览器后重新打开，内存中的 completionStats 会被重新加载
   - 当前实现：通过 chrome.storage 持久化，启动时恢复

3. **多标签页同步**：如果用户在多个标签页进行标注，数据需要同步
   - 当前实现：通过 chrome.storage 的事件监听实现

### 改进建议
1. 实现实时数据同步机制（跨标签页）
2. 添加数据恢复机制（从服务端同步）
3. 定期清理过期数据（90天数据清理）
4. 提供数据导入/导出功能

## 完整数据流时序图

```
时间轴 ↓

T0: 用户完成标注
    ↓
T0+: recordCompletionOnConfirm() 
    ├→ 更新 completionStats 内存
    ├→ 保存到 chrome.storage
    └→ 触发后续处理

T0++: 保存日粒度统计
    ├→ StatsEngine.calculateDailyStatsFromCompletionStats()
    ├→ 保存到 localStorage (appen_daily_stats_YYYY-MM-DD)
    └→ 触发 statsDataRefreshed 事件

T0+++: UI 层响应事件（如果看板打开）
    ├→ DashboardSidebar.refresh()
    ├→ 重新调用 StatsEngine 获取数据
    └→ 更新统计卡片显示

T1: 用户打开看板（10分钟后）
    ├→ DashboardSidebar.open()
    ├→ 调用 StatsEngine 获取指定时间范围的数据
    ├→ 如无缓存，从 localStorage 加载日粒度数据并聚合
    ├→ 如有缓存，直接返回缓存数据
    └→ 更新 UI 显示

T2: 定时刷新（每10分钟）
    ├→ scheduleCacheRefresh()
    ├→ 重新计算所有日期的统计
    ├→ 更新 localStorage 中的缓存
    └→ 触发 statsDataRefreshed 事件
```

## 小结

**数据来源全链路：**
```
标注动作 → completionStats 更新 → 日粒度数据计算 → 
  保存到 localStorage → 周/月聚合（可缓存） → UI 显示
```

**关键点：**
1. 所有统计都基于 completionStats 中的 perPage 数据
2. 使用 firstCompletionTime 来确定记录所属的日期
3. 日粒度是原子单位，周月都是从日聚合而来
4. 缓存只用于性能优化，源数据始终来自 completionStats
