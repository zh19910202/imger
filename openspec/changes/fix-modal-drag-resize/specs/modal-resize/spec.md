# Modal Resize Functionality Fix

## MODIFIED Requirements

### Requirement: 模态框伸缩计算

模态框伸缩时必须(MUST)正确计算所有方向的新尺寸和位置。当用户从不同方向拖拽伸缩控制点时，系统应根据拖拽方向正确计算新的宽度、高度及位置。

系统必须(SHALL)分别计算宽度和高度的变化。
系统必须(SHALL)正确处理从左/上方向拖拽时的位置更新。
系统必须(SHALL)保持从右/下方向拖拽时的基准点位置。

#### Scenario: 右下角伸缩（扩展）

```gherkin
Given 用户将鼠标放在模态框右下角控制点
When 用户拖拽控制点向右下方移动
Then 模态框宽度应增加 deltaX 像素
And 模态框高度应增加 deltaY 像素
And 模态框左上角位置应保持不变
And 模态框应从右下角扩展
```

#### Scenario: 左上角伸缩（扩展）

```gherkin
Given 用户将鼠标放在模态框左上角控制点
When 用户拖拽控制点向左上方移动 deltaX=50, deltaY=30
Then 模态框宽度应减少 50 像素（从 500 变为 450）
And 模态框高度应减少 30 像素（从 400 变为 370）
And 模态框 left 位置应增加 50 像素（从 100 变为 150）
And 模态框 top 位置应增加 30 像素（从 100 变为 130）
And 模态框应从左上角收缩
```

#### Scenario: 左边伸缩（向外扩展）

```gherkin
Given 用户拖拽模态框左边控制点
When 用户向左拖拽控制点 deltaX=-50（向左移动 50px）
Then 模态框宽度应增加 50 像素
And 模态框 left 位置应减少 50 像素
And 模态框高度应保持不变
And 模态框上边位置应保持不变
```

#### Scenario: 上边伸缩（向外扩展）

```gherkin
Given 用户拖拽模态框上边控制点
When 用户向上拖拽控制点 deltaY=-40（向上移动 40px）
Then 模态框高度应增加 40 像素
And 模态框 top 位置应减少 40 像素
And 模态框宽度应保持不变
And 模态框左边位置应保持不变
```

### Requirement: 伸缩尺寸限制

伸缩时必须(MUST)应用尺寸限制。模态框伸缩时应遵守最小宽度和高度限制，并在到达限制时处理边界情况。

系统必须(SHALL)强制执行最小宽度限制（300px）。
系统必须(SHALL)强制执行最小高度限制（200px）。
系统必须(SHALL)在达到最小尺寸时调整位置以保持视觉一致性。

#### Scenario: 最小宽度限制

```gherkin
Given 模态框当前宽度为 300px（最小宽度）
And 用户从左边控制点拖拽向右
When 用户试图让宽度小于 300px
Then 模态框宽度应保持为 300px
And 模态框 left 位置应调整为 (originalLeft + (originalWidth - 300))
And 模态框不应再向内收缩
```

#### Scenario: 最小高度限制

```gherkin
Given 模态框当前高度为 200px（最小高度）
And 用户从上边控制点拖拽向下
When 用户试图让高度小于 200px
Then 模态框高度应保持为 200px
And 模态框 top 位置应调整为 (originalTop + (originalHeight - 200))
And 模态框不应再向内收缩
```

### Requirement: 伸缩边界检查

伸缩完成后必须(MUST)应用边界检查。伸缩结束后，模态框应检查是否超出屏幕边界，如有超出应调整位置。

系统必须(SHALL)在伸缩后检查模态框是否超出窗口边界。
系统必须(SHALL)自动调整位置确保模态框完全可见。
系统必须(SHALL)保持模态框已设定的尺寸。

#### Scenario: 伸缩后超出右边界

```gherkin
Given 用户伸缩模态框后
When 模态框右边界超出窗口右边界
Then 系统应调整 left 位置使模态框完全在窗口内
And 模态框宽度应保持不变
And 模态框应保持可见
```

## Design Notes

- 伸缩逻辑应分别处理宽度和高度的增减
- 从左/上方向拖拽时，需要同时更新尺寸和位置，保持右/下边界位置不变
- 最小尺寸限制应在计算后立即应用，确保位置计算基于限制后的尺寸
- 整个伸缩过程应使用 `requestAnimationFrame` 以获得流畅的动画效果
- 伸缩操作应与拖动操作相互独立，不应相互干扰
