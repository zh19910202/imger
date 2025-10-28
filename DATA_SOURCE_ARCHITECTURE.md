# 数据看板数据源架构 - 服务器数据版本

## 数据源说明（已纠正）

### ❌ 之前的错误设计
- ~~从本地 completionStats 生成日粒度统计~~
- ~~本地 localStorage 缓存日数据~~
- ~~周月数据从日数据聚合~~

**问题**：
- completionStats 只是实时记录，不是完整的历史统计
- 无法跨会话访问历史数据
- 无法与服务端数据对账

### ✅ 正确的设计

报表数据来自**服务器 API: `GetUserTaskDetails`**

```
用户浏览器
    ↓
DataService 数据服务层
    ├─ 构建请求参数（userId, timeRange, timeValue）
    ├─ 调用服务器 API
    └─ 缓存响应数据
    ↓
服务器 API: /api/task/user/{userId}/details
    ├─ 接收请求参数
    ├─ 从数据库查询用户数据
    ├─ 计算统计指标
    └─ 返回 JSON 响应
    ↓
DashboardSidebar UI 层
    ├─ 调用 DataService
    ├─ 显示统计卡片
    ├─ 显示图表
    └─ 显示数据表
```

## API 接口规范

### GetUserTaskDetails API

**路径**: `/api/task/user/{appleUserId}/details`

**请求参数**:
```javascript
{
  timeRange: 'day' | 'week' | 'month',    // 时间范围
  timeValue: '2024-10-15' | '2024-10',    // 具体时间（可选）
  includeDetails: true | false            // 是否包含详细信息
}
```

**响应格式**:
```javascript
{
  success: true,
  message: "查询成功",
  data: {
    appleUserId: "wxksy1758761683",
    userId: 123,
    timeRange: "month",
    timeValue: "2024-10",
    queryPeriod: {
      startTime: "2024-10-01T00:00:00",
      endTime: "2024-11-01T00:00:00"
    },
    statistics: {
      totalTasks: 15,
      totalRecords: 45,
      validRecords: 40,
      invalidRecords: 5,
      totalTopicNum: 120,
      totalElapsedTime: 3600,
      averageElapsedTime: 80.0,
      recordsByState: {
        completed: 35,
        failed: 5,
        pending: 5
      }
    },
    taskDetails: [...]  // 仅当 includeDetails=true 时返回
  }
}
```

## 模块层级设计

### 第1层：DataService（数据获取层）
**职责**:
- 从服务器 API 获取报表数据
- 实现缓存机制（减少 API 调用）
- 错误处理和重试
- 数据格式转换

**关键方法**:
```javascript
DataService.getReportData(timeRange, timeValue, includeDetails)
DataService.getTodayReport()
DataService.getCurrentWeekReport()
DataService.getCurrentMonthReport()
DataService.getDayReport(date)
DataService.getMonthReport(yearMonth)
```

**缓存策略**:
- 日数据：10分钟 TTL
- 周数据：1小时 TTL
- 月数据：4小时 TTL

### 第2层：StatsEngine（统计计算层）
**职责**:
- 数据格式化和标准化
- 本地数据聚合（如需要）
- 日期计算和范围处理

**注意**: 这层现在主要用于**本地日粒度数据缓存**和**周月聚合**（如果需要离线支持）

### 第3层：DashboardSidebar（UI展示层）
**职责**:
- 调用 DataService 获取数据
- 渲染统计卡片
- 显示图表和表格
- 处理用户交互

## 数据流时序图

```
T0: 用户打开看板
    ↓
DashboardSidebar.open()
    ↓
DashboardSidebar.loadData()
    ├─ 判断 currentTimeRange
    ├─ 调用对应的 DataService 方法
    │   如：DataService.getTodayReport()
    └─ 获取返回数据
    ↓
检查缓存
    ├─ 如果缓存有效 → 直接返回
    └─ 如果缓存过期 → 发送 HTTP 请求到服务器
    ↓
服务器处理请求
    ├─ 数据库查询
    ├─ 统计计算
    └─ 返回 JSON
    ↓
DataService 处理响应
    ├─ 校验数据
    ├─ 格式转换
    ├─ 保存缓存
    └─ 返回标准化数据
    ↓
DashboardSidebar 渲染UI
    ├─ updateStats() - 更新统计卡片
    ├─ updateChart() - 更新图表
    └─ updateTable() - 更新数据表
    ↓
用户看到报表数据
```

## 具体实现步骤

### 1. DataService 已完成 ✅
- 实现了从服务器 API 获取数据
- 实现了缓存机制
- 实现了数据格式转换

### 2. 修改 DashboardSidebar
需要修改 `updateStats()` 方法，改为调用 DataService 而不是 StatsEngine：

```javascript
// 旧的实现（错误）
const statsData = window.StatsEngine.getTodayStats();

// 新的实现（正确）
const statsData = await window.DataService.getTodayReport();
```

### 3. 修改 dashboard-sidebar.js 的 updateStats 函数

```javascript
updateStats: async function() {
    try {
        if (typeof window.DataService === 'undefined') {
            console.warn('[Dashboard] 数据服务未加载');
            return;
        }

        let reportData = null;
        let previousReportData = null;

        // 根据时间范围调用相应的方法
        switch (this.state.currentTimeRange) {
            case 'day':
                reportData = await window.DataService.getTodayReport();
                // 获取昨天数据用于对比
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                previousReportData = await window.DataService.getDayReport(
                    window.DataService.formatDate(yesterday)
                );
                break;
            case 'week':
                reportData = await window.DataService.getCurrentWeekReport();
                // 获取上周数据用于对比
                // ...
                break;
            case 'month':
                reportData = await window.DataService.getCurrentMonthReport();
                // 获取上月数据用于对比
                // ...
                break;
            default:
                reportData = await window.DataService.getTodayReport();
        }

        // 提取统计数据
        const stats = reportData.statistics || {};
        const previousStats = (previousReportData && previousReportData.statistics) || {};

        // 更新 UI...
        document.getElementById('stat-total').textContent = stats.totalRecords || 0;
        // ... 其他更新
    } catch (error) {
        console.error('[Dashboard] 更新统计卡片失败:', error);
    }
}
```

## 删除错误的代码

### 移除：stats-engine.js 中的日粒度统计计算

❌ 以下代码在服务器数据架构中不需要：
```javascript
calculateDailyStatsFromCompletionStats()  // 不需要
saveDailyStats()                          // 不需要（这些应该由服务器保存）
getDailyStats()                           // 不需要
```

✅ 保留：
```javascript
getISOWeekNumber()       // 日期计算函数（UI需要）
formatDate()             // 日期格式化（UI需要）
getWeekDateRange()       // 周范围计算（UI需要）
```

### 移除：appen-data-collector.js 中的日数据保存代码

❌ 删除以下代码（第 3447-3454 行）：
```javascript
// 使用统计引擎保存日粒度统计数据
if (typeof window.StatsEngine !== 'undefined') {
    const today = new Date();
    const dateStr = window.StatsEngine.formatDate(today);
    const dailyStats = window.StatsEngine.calculateDailyStatsFromCompletionStats(completionStats, dateStr);
    window.StatsEngine.saveDailyStats(dateStr, dailyStats);
    log(LOG_LEVEL.DEBUG, '已保存今日统计数据:', dateStr, dailyStats);
}
```

**原因**: 数据应该由服务器统计和保存，不应该由客户端生成

## 总结

### 数据源修正
| 原来 | 现在 |
|------|------|
| 本地 completionStats | ✅ 服务器 API |
| localStorage 日粒度存储 | ❌ 删除 |
| 本地周月聚合 | ⚠️ 可选（离线支持）|
| 完全本地处理 | ✅ 服务器计算 |

### 好处
1. **数据准确性**: 服务器有完整的历史数据
2. **跨会话**: 用户关闭浏览器后仍能查看历史数据
3. **实时性**: 服务器数据是最新的统计结果
4. **减少客户端计算**: 服务器已做好统计，客户端只需展示
5. **数据一致性**: 与服务端后台系统数据同步

### 后续 API 端点设计建议
- 保持 GetUserTaskDetails 接口作为主要数据源
- 考虑添加支持自定义日期范围的接口参数
- 考虑添加数据导出接口（CSV/Excel）
- 考虑添加对标分析接口（与其他用户对比）

