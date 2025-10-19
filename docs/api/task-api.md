# 任务添加接口文档

## 接口概述

用于添加任务记录到系统中。

---

## 接口详情

### 基本信息

- **接口地址**: `http://192.168.31.79:1145/api/Task/add`
- **请求方式**: `POST`
- **Content-Type**: `application/json`

---

### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| userId | string | 是 | 用户ID，最大长度50 | test_user_001 |
| taskId | string | 是 | 任务ID，最大长度50 | task_001 |
| topicId | string | 是 | 题目ID，最大长度50 | topic_001 |
| topicUrl | string | 是 | 题目URL | https://example.com/topic/1 |
| isValid | boolean | 是 | 是否有效 | true |
| isRedo | boolean | 是 | 是否重做 | false |
| updateTime | string | 否 | 完成时间（ISO 8601格式），默认当前UTC时间 | 2024-01-01T00:00:00Z |
| elapsedTime | integer | 是 | 耗时（秒） | 120 |
| isReplace | boolean | 是 | 是否替换 | false |
| topicNum | integer | 是 | 题目数量，范围0-3 | 2 |

---

### 请求示例

```json
{
  "userId": "test_user_001",
  "taskId": "task_001",
  "topicId": "topic_001",
  "topicUrl": "https://example.com/topic/1",
  "isValid": true,
  "isRedo": false,
  "updateTime": "2024-01-01T00:00:00Z",
  "elapsedTime": 120,
  "isReplace": false,
  "topicNum": 2
}
```

---

### 响应参数

| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 请求是否成功 |
| message | string | 响应消息 |
| data | object | 返回数据对象 |
| data.id | integer | 创建的记录ID |
| data.userId | string | 用户ID |
| data.taskId | string | 任务ID |
| data.finishTime | string | 完成时间（ISO 8601格式） |

---

### 响应示例

#### 成功响应

```json
{
  "success": true,
  "message": "任务数据添加成功",
  "data": {
    "id": 1,
    "userId": "test_user_001",
    "taskId": "task_001",
    "finishTime": "2025-01-18T13:52:46.3477253Z"
  }
}
```

#### 失败响应（示例）

```json
{
  "success": false,
  "message": "参数错误或任务添加失败",
  "data": null
}
```

---

### 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

---

### 调用示例

#### JavaScript (Fetch)

```javascript
fetch('http://192.168.31.79:1145/api/Task/add', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: "test_user_001",
    taskId: "task_001",
    topicId: "topic_001",
    topicUrl: "https://example.com/topic/1",
    isValid: true,
    isRedo: false,
    updateTime: "2024-01-01T00:00:00Z",
    elapsedTime: 120,
    isReplace: false,
    topicNum: 2
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

#### cURL

```bash
curl -X POST http://192.168.31.79:1145/api/Task/add \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_001",
    "taskId": "task_001",
    "topicId": "topic_001",
    "topicUrl": "https://example.com/topic/1",
    "isValid": true,
    "isRedo": false,
    "updateTime": "2024-01-01T00:00:00Z",
    "elapsedTime": 120,
    "isReplace": false,
    "topicNum": 2
  }'
```

---

### 注意事项

1. 所有参数除 `updateTime` 外均为必填项，请确保传递完整的参数
2. 所有字符串字段（userId、taskId、topicId）最大长度为50个字符
3. `topicNum` 范围为 0-3
4. `elapsedTime` 单位为秒
5. `updateTime` 为可选参数，采用 ISO 8601 格式，默认使用当前 UTC 时间
6. 请确保网络可以访问该内网地址（192.168.31.79）