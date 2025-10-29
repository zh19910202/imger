# GetUserTaskDetails 接口文档

## 接口概述
用户详细题目数据查询接口，根据Apple用户ID查询指定时间范围内的任务统计数据和详细信息。


## 服务器域名
www.skytree.ink

## 接口信息
- **接口路径**: `/api/task/user/{appleUserId}/details`
- **请求方法**: `GET`
- **接口功能**: 查询指定Apple用户在特定时间范围内的任务数据统计

## 请求参数

### 路径参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| appleUserId | string | 是 | Apple用户ID，用于标识用户身份 |

### 查询参数
| 参数名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| timeRange | string | 是 | 时间范围类型，支持：day、week、month | "month" |
| timeValue | string | 否 | 具体时间值，格式根据timeRange而定 | "2024-10" 或 "2024-10-15" |
| includeDetails | boolean | 否 | 是否包含详细任务列表，默认false | true |

### timeValue 参数说明
- **day**: 支持日期格式 "YYYY-MM-DD"，如 "2024-10-15"，不传则查询今天
- **week**: 不需要传值，自动查询本周（周一到周日）
- **month**: 支持 "YYYY-MM" 或 "MM" 格式，如 "2024-10" 或 "10"，不传则查询当前月份

## 请求示例

### 示例1：查询用户当月数据（不含详情）
```
GET /api/task/user/wxksy1758761683/details?timeRange=month
```

### 示例2：查询用户指定月份数据（含详情）
```
GET /api/task/user/wxksy1758761683/details?timeRange=month&timeValue=2024-10&includeDetails=true
```

### 示例3：查询用户今天数据
```
GET /api/task/user/wxksy1758761683/details?timeRange=day
```

### 示例4：查询用户指定日期数据
```
GET /api/task/user/wxksy1758761683/details?timeRange=day&timeValue=2024-10-15
```

## 响应结果

### 成功响应（不含详情）
```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "appleUserId": "wxksy1758761683",
    "userId": 123,
    "timeRange": "month",
    "timeValue": "2024-10",
    "queryPeriod": {
      "startTime": "2024-10-01T00:00:00",
      "endTime": "2024-11-01T00:00:00"
    },
    "statistics": {
      "totalTasks": 15,
      "totalRecords": 45,
      "validRecords": 40,
      "invalidRecords": 5,
      "totalTopicNum": 120,
      "totalElapsedTime": 3600,
      "averageElapsedTime": 80.0,
      "recordsByState": {
        "completed": 35,
        "failed": 5,
        "pending": 5
      }
    }
  }
}
```

### 成功响应（含详情）
```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "appleUserId": "wxksy1758761683",
    "userId": 123,
    "timeRange": "month",
    "timeValue": "2024-10",
    "queryPeriod": {
      "startTime": "2024-10-01T00:00:00",
      "endTime": "2024-11-01T00:00:00"
    },
    "statistics": {
      "totalTasks": 15,
      "totalRecords": 45,
      "validRecords": 40,
      "invalidRecords": 5,
      "totalTopicNum": 120,
      "totalElapsedTime": 3600,
      "averageElapsedTime": 80.0,
      "recordsByState": {
        "completed": 35,
        "failed": 5,
        "pending": 5
      }
    },
    "taskDetails": [
      {
        "taskId": "08f3f569-1834-4111-8133-52d7f956fead",
        "taskName": "数学练习题",
        "topicId": "topic_001",
        "topicUrl": "https://example.com/topic/001",
        "lastUpdateTime": "2024-10-15T10:30:00",
        "records": [
          {
            "recordId": 1001,
            "recordState": "completed",
            "isValid": true,
            "topicNum": 10,
            "elapsedTime": 120,
            "rejectReason": null,
            "createTime": "2024-10-15T10:00:00"
          }
        ]
      }
    ]
  }
}
```

## 错误响应

### 400 Bad Request - AppleUserId为空
```json
{
  "success": false,
  "message": "AppleUserId不能为空"
}
```

### 400 Bad Request - 用户不存在
```json
{
  "success": false,
  "message": "未找到appleUserId为 nonexistent_user 的用户"
}
```

### 400 Bad Request - 时间范围参数无效
```json
{
  "success": false,
  "message": "时间范围参数无效，支持：day、week、month"
}
```

### 400 Bad Request - 月份格式无效
```json
{
  "success": false,
  "message": "月份格式无效，请使用 YYYY-MM 或 MM 格式"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "服务器内部错误"
}
```

## 响应字段说明

### 基础信息字段
| 字段名 | 类型 | 说明 |
|--------|------|------|
| appleUserId | string | Apple用户ID |
| userId | int | 系统内部用户ID |
| timeRange | string | 查询的时间范围类型 |
| timeValue | string | 查询的具体时间值 |

### queryPeriod 查询时间段
| 字段名 | 类型 | 说明 |
|--------|------|------|
| startTime | datetime | 查询开始时间 |
| endTime | datetime | 查询结束时间 |

### statistics 统计信息
| 字段名 | 类型 | 说明 |
|--------|------|------|
| totalTasks | int | 总任务数 |
| totalRecords | int | 总记录数 |
| validRecords | int | 有效记录数 |
| invalidRecords | int | 无效记录数 |
| totalTopicNum | int | 总做题数量 |
| totalElapsedTime | int | 总耗时（秒） |
| averageElapsedTime | double | 平均耗时（秒） |
| recordsByState | object | 按状态分组的记录数统计 |

### taskDetails 任务详情（仅当includeDetails=true时返回）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| taskId | string | 任务ID |
| taskName | string | 任务名称 |
| topicId | string | 题目ID |
| topicUrl | string | 题目链接 |
| lastUpdateTime | datetime | 最后更新时间 |
| records | array | 记录列表 |

### records 记录详情
| 字段名 | 类型 | 说明 |
|--------|------|------|
| recordId | int | 记录ID |
| recordState | string | 记录状态 |
| isValid | boolean | 是否有效 |
| topicNum | int | 题目数量 |
| elapsedTime | int | 耗时（秒） |
| rejectReason | string | 拒绝原因 |
| createTime | datetime | 创建时间 |

## 业务逻辑说明

1. **用户验证**: 接口首先根据 `appleUserId` 在 `T_Users` 表中查找对应的用户记录，获取系统内部的 `userId`
2. **时间范围计算**: 根据 `timeRange` 和 `timeValue` 参数计算具体的查询时间范围
3. **数据查询**: 查询指定用户在时间范围内的所有任务数据
4. **统计计算**: 计算各种统计指标，包括任务数、记录数、做题数量、耗时等
5. **结果返回**: 根据 `includeDetails` 参数决定是否返回详细的任务列表

## 注意事项

1. **用户隔离**: 接口确保只返回指定用户的数据，不会泄露其他用户信息
2. **时间范围**: week 类型查询固定为本周（周一到周日），不支持指定具体周次
3. **性能考虑**: 当 `includeDetails=false` 时，不会查询和返回详细任务列表，提高响应速度
4. **数据一致性**: 所有统计数据都基于同一次数据库查询结果，确保数据一致性

## 使用场景

- **用户数据统计**: 查看用户在特定时间段的学习统计数据
- **进度跟踪**: 监控用户的学习进度和完成情况
- **数据分析**: 分析用户的学习习惯和效率
- **报表生成**: 为用户生成学习报告和统计图表