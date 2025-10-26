# 将操作按钮移到模态框底部

## Why

当前Appen数据收集模态框的结构存在以下问题：

1. **按钮位置混乱**：三个全局操作按钮（"推送数据"、"获取Cookie"、"同步认证信息"）放在tab的内容区，与具体的tab内容混在一起，降低了UI的清晰度。

2. **UI结构不合理**：这些操作是独立的全局功能，不属于任何特定tab，放在tab内容区违反了信息架构原则。

3. **用户体验差**：用户需要切换tab才能看到不同的操作按钮，而这些操作应该始终可见和易于访问。

## What Changes

### 模态框布局重构

1. **按钮位置调整**
   - 将"推送数据"、"获取Cookie"、"同步认证信息"按钮从tab内容区移出
   - 将它们放在模态框底部（footer），作为全局操作栏
   - 按钮顺序保持为：推送数据 -> 获取Cookie -> 同步认证信息

2. **样式更新**
   - 在模态框底部创建footer区域
   - 按钮采用水平排列，居中对齐
   - 保持现有的颜色方案（蓝色、橙色、紫色）
   - 添加footer与tab内容的视觉分割线

3. **布局结构**
   - modal-container
     - modal-header （已有）
     - modal-content
       - tabs-container （已有）
       - tab-contents （已有）
     - **modal-footer （新增）** <- 放置三个操作按钮

## Summary

通过将全局操作按钮从tab内容区移到模态框底部footer，实现更清晰的UI结构和更好的用户体验。这样用户无需切换tab就能快速访问这些全局操作。

## Related Specs

- [modal-footer-layout](./specs/modal-footer-layout/spec.md) - 模态框底部footer布局和样式定义
- [action-buttons-repositioning](./specs/action-buttons-repositioning/spec.md) - 操作按钮从tab内容区移到footer
