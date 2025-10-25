# Modal Drag Functionality Fix

## MODIFIED Requirements

### Requirement: 模态框拖动时坐标计算

模态框拖动时必须(MUST)使用样式坐标而非视口相对坐标。当模态框使用 `position: fixed` 时，拖动操作应该直接读写 `style.left` 和 `style.top` 来保持位置的一致性，避免使用 `getBoundingClientRect()` 导致的坐标转换错误。

系统必须(SHALL)在拖动时记录鼠标相对于模态框左上角的偏移量。
系统必须(SHALL)直接更新样式坐标而非使用视口相对坐标。
系统必须(SHALL)确保拖动过程中模态框平滑跟随鼠标，无抖动现象。

#### Scenario: 初始化拖动

```gherkin
Given 用户打开模态框
When 用户在模态框标题栏按下鼠标
Then 系统应记录鼠标的客户端坐标
And 系统应记录模态框当前的 style.left 和 style.top 值
And 系统应计算鼠标相对于模态框左上角的偏移量
```

#### Scenario: 执行拖动

```gherkin
Given 用户正在拖动模态框
When 用户移动鼠标到新位置
Then 系统应计算新的鼠标位置与起始位置的差值
And 系统应将差值加到模态框的初始位置上
And 系统应直接更新 style.left 和 style.top
And 模态框应平滑跟随鼠标移动，不应抖动
```

#### Scenario: 完成拖动

```gherkin
Given 用户正在拖动模态框
When 用户释放鼠标
Then 系统应立即停止拖动操作
And 模态框应保持在当前位置
And 模态框的 style.left 和 style.top 应被正确保存
```

### Requirement: 拖动边界检查

拖动时必须(MUST)应用边界检查，模态框在拖动时应始终保持在屏幕可视范围内。

系统必须(SHALL)检查模态框左边界不应小于 0。
系统必须(SHALL)检查模态框上边界不应小于 0。
系统必须(SHALL)检查模态框右边界不应超过窗口宽度。
系统必须(SHALL)检查模态框下边界不应超过窗口高度。

#### Scenario: 边界限制

```gherkin
Given 用户拖动模态框向屏幕左边移动
When 模态框即将移出左边界
Then 系统应限制 left 值最小为 0
And 模态框应保持在屏幕左边界内

Given 用户拖动模态框向屏幕下方移动
When 模态框即将移出下边界
Then 系统应限制 top 值使模态框底部不超出窗口
And 模态框应保持完全可见
```

## Design Notes

- 使用 `position: fixed` 时，`left` 和 `top` 值直接对应视口坐标
- 不应使用 `getBoundingClientRect()` 进行拖动计算，因为它返回的是视口相对坐标
- 应在整个拖动过程中使用 `requestAnimationFrame` 优化性能
- 边界计算应考虑模态框当前的宽度和高度
