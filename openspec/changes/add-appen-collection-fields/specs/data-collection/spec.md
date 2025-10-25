## ADDED Requirements

### Requirement: Appen数据收集字段扩展
系统必须(SHALL)能够从Appen标注页面收集并传输扩展的字段信息。

系统必须(SHALL)从页面URL参数中提取`jobTenantId`、`projectId`、`projectDisplayId`字段。
系统必须(SHALL)将当前任务ID作为`taskName`字段的值。
系统应该(SHOULD)为`topicUrl`字段设置空值作为默认值。
系统必须(SHALL)确保新增字段与现有数据结构兼容。

#### Scenario: URL参数字段提取
Given 用户在Appen标注页面
When 系统收集数据时
Then 系统应从URL中正确提取jobTenantId、projectId、projectDisplayId字段

#### Scenario: 任务名称字段设置
Given 当前页面包含任务ID信息
When 系统构建数据包时
Then 系统应将任务ID值作为taskName字段的内容

#### Scenario: topicUrl字段默认值设置
Given 系统构建数据包时
When 设置topicUrl字段时
Then 系统应将空值作为该字段的默认值

#### Scenario: 数据结构兼容性
Given 系统添加新字段后
When 发送数据到API端点时
Then 系统应确保所有字段符合API文档要求且不影响现有功能

### Requirement: URL参数解析增强
系统必须(SHALL)能够可靠地从Appen页面URL中解析所需参数。

系统必须(SHALL)支持标准URLSearchParams解析方式。
系统必须(SHALL)处理URL参数缺失的情况并提供默认值。
系统必须(SHALL)验证提取参数的有效性。

#### Scenario: 标准URL参数解析
Given Appen页面URL包含所需参数
When 系统执行URL解析
Then 系统应正确提取所有目标参数值

#### Scenario: 参数缺失处理
Given URL中缺少某些参数
When 系统执行参数提取
Then 系统应为缺失参数设置合理的默认值或标记为unknown

#### Scenario: 参数有效性验证
Given 系统提取到URL参数
When 验证参数有效性时
Then 系统应确保参数格式符合API要求