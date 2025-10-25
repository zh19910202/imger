# 历史记录日历查看增强 - 设计文档

## 技术方案

### 数据来源

基于现有的`completionStats.perPage`数据结构，利用时间戳字段进行日期分组：

```javascript
{
    "pageKey": {
        completions: number,
        topicId: string,
        topicCount: number,
        elapsedSeconds: number,
        isValid: boolean,
        lastCompletionTime: timestamp, // 用于日期分组
        firstCompletionTime: timestamp,
        // ... 其他字段
    }
}
```

### 核心算法

#### 日期分组算法
```javascript
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
                    totalTopics: 0,
                    totalElapsedSeconds: 0
                };
            }

            groupedData[dateKey].records.push(pageData);
            groupedData[dateKey].totalCompletions += pageData.completions;
            groupedData[dateKey].totalTopics += pageData.topicCount;
            groupedData[dateKey].totalElapsedSeconds += pageData.elapsedSeconds || 0;

            if (pageData.isValid === true) {
                groupedData[dateKey].validCompletions += pageData.completions;
            } else if (pageData.isValid === false) {
                groupedData[dateKey].invalidCompletions += pageData.completions;
            }
        }
    }

    return groupedData;
}
```

#### 工作量等级分类
```javascript
function getWorkloadLevel(dateData) {
    const totalTopics = dateData.totalTopics;

    if (totalTopics === 0) return 'none';        // 无工作
    if (totalTopics <= 5) return 'light';        // 轻量工作
    if (totalTopics <= 15) return 'medium';      // 中等工作
    if (totalTopics <= 30) return 'heavy';       // 重度工作
    return 'intensive';                          // 密集工作
}
```

### UI设计

#### 布局结构
```
历史统计标签页
├── 标题栏 (✓ 标注完成统计 + Clear按钮)
├── 视图切换按钮组
│   ├── [列表视图] [日历视图]
├── 列表视图内容 (现有的完成详情)
└── 日历视图内容
    ├── 月份导航栏 (← 2024年10月 →)
    ├── 星期标题行 (日 一 二 三 四 五 六)
    ├── 日历网格 (6行 × 7列)
    └── 选中日期的详情面板
```

#### 视图切换按钮
```html
<div style="margin-bottom: 15px; text-align: center;">
    <button id="list-view-btn" class="view-toggle active" data-view="list">
        列表视图
    </button>
    <button id="calendar-view-btn" class="view-toggle" data-view="calendar">
        日历视图
    </button>
</div>
```

#### 日历网格样式
- **无工作日期**：浅灰色背景，无边框
- **轻量工作**：浅绿色背景 (#e8f5e9)
- **中等工作**：中度绿色背景 (#c8e6c9)
- **重度工作**：深绿色背景 (#a5d6a7)
- **密集工作**：最深绿色背景 (#81c784)
- **今天**：蓝色边框高亮
- **选中日期**：橙色边框高亮

#### 日期单元格内容
```html
<div class="calendar-day" data-date="2024-10-25">
    <div class="day-number">25</div>
    <div class="day-indicator">
        <span class="topic-count">12题</span>
        <div class="validity-indicators">
            <span class="valid-count">10✓</span>
            <span class="invalid-count">2✗</span>
        </div>
    </div>
</div>
```

### 实现细节

#### 1. 模态框HTML模板更新

在历史统计标签页添加视图切换和日历容器：

```html
<!-- 视图切换按钮 -->
<div style="margin-bottom: 15px; text-align: center;">
    <button id="list-view-btn" class="view-toggle active" data-view="list" style="
        padding: 8px 16px;
        border: 1px solid #ddd;
        background: #e3f2fd;
        color: #1976d2;
        cursor: pointer;
        margin-right: 5px;
    ">列表视图</button>
    <button id="calendar-view-btn" class="view-toggle" data-view="calendar" style="
        padding: 8px 16px;
        border: 1px solid #ddd;
        background: #f5f5f5;
        color: #666;
        cursor: pointer;
    ">日历视图</button>
</div>

<!-- 列表视图容器 -->
<div id="list-view-container" style="display: block;">
    <!-- 现有的统计和详情内容 -->
</div>

<!-- 日历视图容器 -->
<div id="calendar-view-container" style="display: none;">
    <!-- 日历组件内容 -->
</div>
```

#### 2. 核心功能函数

```javascript
// 生成日历HTML
function generateCalendarHTML(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const groupedData = groupRecordsByDate();

    let html = `
        <div class="calendar-header">
            <button id="prev-month">←</button>
            <span class="current-month">${year}年${month + 1}月</span>
            <button id="next-month">→</button>
        </div>
        <div class="calendar-grid">
            <div class="weekday-headers">
                <div>日</div><div>一</div><div>二</div><div>三</div>
                <div>四</div><div>五</div><div>六</div>
            </div>
            <div class="calendar-days">
    `;

    // 添加空白日期
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
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
    `;

    return html;
}

// 生成单个日期HTML
function generateDayHTML(dateKey, dayNumber, dayData, workloadLevel, isToday) {
    const className = `calendar-day ${workloadLevel} ${isToday ? 'today' : ''}`;

    if (!dayData) {
        return `<div class="${className}" data-date="${dateKey}">
            <div class="day-number">${dayNumber}</div>
        </div>`;
    }

    return `<div class="${className}" data-date="${dateKey}" style="cursor: pointer;">
        <div class="day-number">${dayNumber}</div>
        <div class="day-stats">
            <div class="topic-count">${dayData.totalTopics}题</div>
            <div class="validity-breakdown">
                <span class="valid-count">${dayData.validCompletions}✓</span>
                ${dayData.invalidCompletions > 0 ?
                    `<span class="invalid-count">${dayData.invalidCompletions}✗</span>` : ''}
            </div>
        </div>
    </div>`;
}

// 显示选中日期的详情
function showDateDetails(dateKey) {
    const groupedData = groupRecordsByDate();
    const dayData = groupedData[dateKey];

    if (!dayData) {
        showEmptyDateDetails(dateKey);
        return;
    }

    const detailsHTML = `
        <div class="date-details" style="
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 4px solid #ff9800;
        ">
            <h4 style="margin: 0 0 10px 0; color: #e65100;">
                ${dateKey} 工作详情
            </h4>
            <div class="summary-stats" style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <div>完成题目: <strong>${dayData.totalTopics}题</strong></div>
                <div>总耗时: <strong>${formatElapsedTime(dayData.totalElapsedSeconds)}</strong></div>
                <div>平均耗时: <strong>${formatElapsedTime(Math.round(dayData.totalElapsedSeconds / dayData.totalTopics))}/题</strong></div>
            </div>
            <div class="records-list">
                ${dayData.records.map((record, index) => generateRecordHTML(record, index)).join('')}
            </div>
        </div>
    `;

    document.getElementById('date-details-container').innerHTML = detailsHTML;
}
```

#### 3. 交互处理

```javascript
// 视图切换
function switchView(viewType) {
    const listView = document.getElementById('list-view-container');
    const calendarView = document.getElementById('calendar-view-container');
    const listBtn = document.getElementById('list-view-btn');
    const calendarBtn = document.getElementById('calendar-view-btn');

    if (viewType === 'list') {
        listView.style.display = 'block';
        calendarView.style.display = 'none';
        listBtn.style.background = '#e3f2fd';
        listBtn.style.color = '#1976d2';
        calendarBtn.style.background = '#f5f5f5';
        calendarBtn.style.color = '#666';
    } else {
        listView.style.display = 'none';
        calendarView.style.display = 'block';
        listBtn.style.background = '#f5f5f5';
        listBtn.style.color = '#666';
        calendarBtn.style.background = '#e3f2fd';
        calendarBtn.style.color = '#1976d2';

        // 初始化日历
        initializeCalendar();
    }
}

// 月份导航
function navigateMonth(direction) {
    if (direction === 'prev') {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
    } else {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
    }

    updateCalendar();
}
```

### 性能优化

#### 数据缓存
- 缓存分组后的日期数据，避免重复计算
- 只在数据更新时重新计算

#### 渲染优化
- 使用虚拟滚动处理大量记录
- 延迟加载非当前月份的详情数据

#### 内存管理
- 清理不需要的DOM事件监听器
- 避免内存泄漏

### 兼容性考虑

#### 浏览器兼容性
- 使用标准DOM API，确保跨浏览器兼容
- 避免使用最新的ES特性

#### 响应式设计
- 日历网格在不同屏幕尺寸下的适配
- 移动设备上的触摸交互优化

### 测试策略

#### 单元测试
1. 日期分组算法测试
2. 工作量等级分类测试
3. 日历HTML生成测试
4. 视图切换逻辑测试

#### 集成测试
1. 日历组件与现有模态框的集成
2. 数据更新时的日历刷新
3. 用户交互的完整流程

#### 用户体验测试
1. 不同数据量下的性能表现
2. 移动设备上的操作体验
3. 边界情况的处理（无数据、大量数据等）