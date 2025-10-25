# 添加总耗时和平均耗时统计 - 设计文档

## 技术方案

### 数据来源

基于现有的`completionStats.perPage`数据结构，其中每个页面记录包含：
```javascript
{
    completions: number,           // 完成次数
    topicId: string,              // 题目ID
    topicCount: number,           // 题目数量
    elapsedSeconds: number,       // 耗时（秒）
    isValid: boolean,             // 是否有效
    // ... 其他字段
}
```

### 计算逻辑

#### 总耗时计算
```javascript
let totalElapsedSeconds = 0;
for (const [pageKey, pageData] of Object.entries(completionStats.perPage)) {
    if (pageData.isValid !== false) {  // 只计算有效完成
        totalElapsedSeconds += pageData.elapsedSeconds || 0;
    }
}
```

#### 平均耗时计算
```javascript
const totalQuestions = completionStats.totalQuestions || 0;
let averageElapsedSeconds = 0;

if (totalQuestions > 0) {
    averageElapsedSeconds = totalElapsedSeconds / totalQuestions;
}
```

### UI设计

#### 显示位置
在历史统计标签页的现有统计区域下方添加新的统计行：

```
总有效完成次数: X | 无效完成次数: Y          题目总数: Z
总耗时: A秒B分钟 | 平均耗时: C秒/题
返修统计: 返修完成次数: D | 返修题目数: E
```

#### 样式设计
- **总耗时**：使用绿色（#4CAF50）突出显示
- **平均耗时**：使用蓝色（#2196F3）突出显示
- 保持与现有统计信息的字体大小和权重一致
- 时间格式化：超过60秒显示为"X分Y秒"

#### 时间格式化函数
```javascript
function formatElapsedTime(seconds) {
    if (!seconds || seconds < 60) {
        return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
}
```

### 实现细节

#### 1. 模态框HTML模板更新

在`src/appen-data-collector.js`的历史统计标签页HTML中添加：

```html
<!-- 新增的耗时统计行 -->
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
            ${formatElapsedTime(calculateAverageElapsedTime())}
        </span>
    </span>
</div>
```

#### 2. 计算函数实现

```javascript
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
```

#### 3. 数据更新机制

现有的模态框已经具备实时更新能力，新增的统计会在以下情况自动更新：
- 模态框首次打开时
- 新的完成记录产生时
- 清除统计数据时

### 错误处理

#### 除零保护
```javascript
function calculateAverageElapsedTime() {
    const totalElapsedSeconds = calculateTotalElapsedTime();
    const totalQuestions = completionStats.totalQuestions || 0;

    // 防止除零错误
    if (totalQuestions <= 0) {
        return 0;
    }

    return Math.round(totalElapsedSeconds / totalQuestions);
}
```

#### 数据验证
- 确保`elapsedSeconds`是有效数字
- 确保只计算有效完成的记录
- 处理数据缺失或异常值的情况

### 性能考虑

- 计算复杂度：O(n)，其中n是页面数量
- 计算在模态框显示时进行，对页面性能影响最小
- 避免在每次完成记录时都重新计算，只在需要显示时计算

### 测试策略

#### 单元测试
1. 测试`calculateTotalElapsedTime()`函数
2. 测试`calculateAverageElapsedTime()`函数
3. 测试`formatElapsedTime()`函数
4. 测试除零保护机制

#### 集成测试
1. 验证统计数据在模态框中正确显示
2. 验证数据实时更新功能
3. 验证清除统计数据后的显示

#### 边界测试
1. 无完成记录时的显示
2. 只有无效完成记录时的显示
3. 大量数据的性能测试

### 兼容性

- 与现有的统计功能完全兼容
- 不影响现有的数据结构
- 不改变现有的API接口