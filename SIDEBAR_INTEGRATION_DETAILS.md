# 侧边栏看板集成实现

## 概述
已成功将数据看板侧边栏集成到扩展 UI 中，用户可以通过浮动按钮或快捷键 (Ctrl+Shift+D) 打开/关闭看板。

## 实现的文件

### 1. 新增文件：`src/dashboard-sidebar.js`
完整的侧边栏看板模块，包含：

**主要功能**：
- 可折叠侧边栏 UI（从右侧滑入/滑出）
- 响应式设计（360px/300px/全屏）
- 时间范围选择器（今天、本周、本月、自定义）
- 统计卡片展示（总标注数、有效率、无效数、平均耗时）
- 数据表格和图表区域
- 导出 CSV 功能（待完整实现）

**核心方法**：
- `init()` - 初始化侧边栏
- `open()` / `close()` / `toggle()` - 打开/关闭
- `selectTimeRange(range)` - 选择时间范围
- `loadData()` - 加载数据
- `updateStats()` - 更新统计卡片
- `updateChart()` - 更新图表（占位符）
- `updateTable()` - 更新数据表
- `refresh()` - 刷新数据

**事件处理**：
- 监听 `statsDataRefreshed` 事件（来自缓存刷新机制）
- 快捷键 Ctrl+Shift+D 打开/关闭看板
- 点击遮罩区域关闭看板

### 2. 修改文件：`src/appen-data-collector.js`

**新增函数**：
- `initializeDashboardSidebar()` - 初始化侧边栏看板脚本加载
- `initializeDashboardToggleButton()` - 创建浮动切换按钮

**集成位置**：
- 在 `initializeDataCollector()` 中调用 `initializeDashboardSidebar()`
- 脚本加载后自动创建浮动按钮

**浮动按钮特性**：
- 位置：右下角 (right: 20px, bottom: 20px)
- 样式：蓝色圆形按钮，显示📊图标
- 交互：点击切换看板，悬停缩放效果
- z-index: 99850（在侧边栏下方）
- 快捷键提示：Ctrl+Shift+D

### 3. 修改文件：`manifest.json`

**更新内容**：
- 在 `content_scripts` 的 `js` 数组中添加 `src/dashboard-sidebar.js`

## 架构设计

### UI 层级
```
浮动按钮 (z-index: 99850)
    ↓ 点击
侧边栏 (z-index: 99900)
遮罩 (z-index: 99899)
页面内容 (z-index: default)
```

### 事件流
```
用户点击按钮
    ↓
window.DashboardSidebar.toggle()
    ↓
open() / close()
    ↓
加载数据 loadData()
    ↓
updateStats() / updateChart() / updateTable()
```

### 缓存同步流
```
appen-data-collector.js (每10分钟)
    ↓ 触发事件
window.dispatchEvent('statsDataRefreshed')
    ↓ 监听事件
dashboard-sidebar.js
    ↓
自动刷新数据 refresh() / loadData()
```

## 功能特性

### 时间范围选择
- **今天** (day): 显示当天数据
- **本周** (week): 显示本周汇总数据
- **本月** (month): 显示本月汇总数据
- **自定义** (range): 日期范围选择（待完整实现）

### 响应式设计
| 屏幕大小 | 宽度 | 布局 |
|---------|------|------|
| >= 800px | 360px | 两列卡片 |
| 600-800px | 300px | 单列卡片 |
| < 600px | 100% | 全屏显示 |

### 动画效果
- 侧边栏从右侧滑入/滑出 (0.3s)
- 遮罩淡入/淡出 (0.3s)
- 浮动按钮悬停缩放 (0.3s)
- 加载旋转动画

## 数据结构

### localStorage 相关键
```
appen_daily_stats_YYYY-MM-DD     - 日粒度统计数据
appen_cache_week_YYYY-Www        - 周粒度缓存数据
appen_cache_month_YYYY-MM        - 月粒度缓存数据
appen_cache_refresh_timestamp    - 上次缓存刷新时间
appen_cache_refresh_enabled      - 缓存刷新是否启用
```

### 统计数据格式（模拟数据）
```javascript
{
  date: "2024-10-28",
  total: 45,              // 总完成数
  valid: 40,              // 有效数
  invalid: 5,             // 无效数
  validRate: 88.89,       // 有效率 (%)
  avgTime: 80,            // 平均耗时 (秒)
  totalChange: "+12%",    // 与上期对比
  validChange: "+5%",
  invalidChange: "-2%",
  timeChange: "-3s"
}
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Shift+D | 打开/关闭数据看板 |
| 点击浮动按钮 | 打开/关闭数据看板 |
| ESC (待实现) | 关闭数据看板 |

## 待完整实现的功能

### 1. 数据加载
- [ ] 从 localStorage 读取实际统计数据
- [ ] 支持 completionStats 数据结构映射
- [ ] 周/月数据聚合计算

### 2. 图表显示
- [ ] 集成 Chart.js 或 ECharts
- [ ] 实现日完成数柱状图
- [ ] 实现有效率趋势折线图
- [ ] 实现响应式图表布局

### 3. 自定义日期范围
- [ ] 日期选择器 UI
- [ ] 日期范围验证
- [ ] 范围数据查询

### 4. CSV 导出
- [ ] 生成 CSV 格式
- [ ] 文件下载
- [ ] 导出进度提示

### 5. 更多功能
- [ ] 数据对比分析
- [ ] 每日推送提醒
- [ ] 自定义看板配置
- [ ] 数据可视化增强

## 测试清单

- [ ] 浮动按钮能否正常显示和点击
- [ ] 侧边栏能否正常打开/关闭
- [ ] 侧边栏响应式布局是否正常
- [ ] Ctrl+Shift+D 快捷键是否有效
- [ ] 时间范围选择是否正常工作
- [ ] 点击遮罩能否关闭侧边栏
- [ ] 缓存刷新事件是否能触发看板刷新
- [ ] 统计卡片数据是否正确显示
- [ ] 是否与现有功能冲突

## 性能优化建议

1. **懒加载**: 仅在侧边栏打开时加载数据
2. **缓存**: 保存最近查询的数据，避免重复计算
3. **防抖**: 快速切换时间范围时使用防抖
4. **虚拟滚动**: 数据表超过 100 行时使用虚拟滚动
5. **事件委托**: 使用事件委托处理多个按钮

## 与现有功能的集成

- **通知系统**: 侧边栏打开/关闭时可显示提示
- **认证同步**: 侧边栏关闭时可暂停缓存刷新（可选）
- **历史记录**: 侧边栏中可显示历史记录统计
- **数据提交**: 侧边栏可显示提交日志的统计摘要

## 文件统计

| 文件 | 行数 | 类型 |
|------|------|------|
| src/dashboard-sidebar.js | ~650 | 新增 |
| src/appen-data-collector.js | +100 | 修改 |
| manifest.json | +1 | 修改 |

## 使用示例

```javascript
// 打开侧边栏
window.DashboardSidebar.open();

// 关闭侧边栏
window.DashboardSidebar.close();

// 切换侧边栏
window.DashboardSidebar.toggle();

// 选择时间范围
window.DashboardSidebar.selectTimeRange('week');

// 刷新数据
window.DashboardSidebar.refresh();

// 监听缓存刷新事件
window.addEventListener('statsDataRefreshed', (event) => {
  console.log('缓存已更新，可刷新看板');
});
```

## 下一步计划

1. **Phase 1**: ✅ 完成（侧边栏 UI 和集成）
2. **Phase 2**: 实现数据加载接口
3. **Phase 3**: 集成图表库和可视化
4. **Phase 4**: 实现 CSV 导出功能
5. **Phase 5**: 性能优化和测试

## 参考文档

- OpenSpec 设计文档: `openspec/changes/annotation-statistics-dashboard/design.md`
- 规范文档: `openspec/changes/annotation-statistics-dashboard/specs/dashboard-ui/spec.md`
