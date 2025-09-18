---
title: 默认模块
language_tabs:
  - shell: Shell
  - http: HTTP
  - javascript: JavaScript
  - ruby: Ruby
  - python: Python
  - php: PHP
  - java: Java
  - go: Go
toc_footers: []
includes: []
search: true
code_clipboard: true
highlight_theme: darkula
headingLevel: 2
generator: "@tarslib/widdershins v4.0.30"

---

# 默认模块

Base URLs:

* <a href="https://www.runninghub.cn">runninghub.cn: https://www.runninghub.cn</a>

# Authentication

# Default

## POST 发起ComfyUI任务2-高级

POST /task/openapi/create

# 发起 ComfyUI 任务（高级）

该接口用于基于已有的工作流模板（workflow）自定义节点参数，发起 ComfyUI 图像生成任务。

适用于修改任意节点参数的场景，例如修改图生图中的采样器、步数、提示词、种子值等。  
通过传入 `nodeInfoList` 实现动态参数替换，使得任务运行灵活可控。

---

## 请求地址

```
POST https://www.runninghub.cn/task/openapi/create
```

---

## 请求方式

`POST`，请求体格式为 `application/json`

---

## 请求头部

| Header          | 是否必填 | 示例值                 | 说明                       |
|-----------------|----------|------------------------|----------------------------|
| `Host`          | 是       | `www.runninghub.cn`    | API 域名，必须精确填写     |
| `Content-Type`  | 是       | `application/json`     | 请求体类型                 |

> ⚠️ 注意：某些 HTTP 客户端可能会自动添加 `Host` 头，但建议在接口测试或 SDK 实现时手动确认。

---

## 请求参数

### 基础参数（必填）

| 参数名         | 类型     | 是否必填 | 说明 |
|----------------|----------|----------|------|
| `apiKey`       | string   | 是       | 用户的 API 密钥，用于身份认证 |
| `workflowId`   | string   | 是       | 工作流模板 ID，可通过平台导出获得 |
| `nodeInfoList` | array    | 否       | 节点参数修改列表，用于在执行前替换默认参数 |

#### nodeInfoList 结构说明

每项表示一个节点参数的修改：

| 字段         | 类型     | 说明 |
|--------------|----------|------|
| `nodeId`     | string   | 节点的唯一编号，来源于工作流 JSON 文件 |
| `fieldName`  | string   | 要修改的字段名，例如 `text`、`seed`、`steps` |
| `fieldValue` | any      | 替换后的新值，需与原字段类型一致 |

#### 示例请求体

```json
{
  "apiKey": "your-api-key",
  "workflowId": "1904136902449209346",
  "nodeInfoList": [
    {
      "nodeId": "6",
      "fieldName": "text",
      "fieldValue": "1 girl in classroom"
    },
    {
      "nodeId": "3",
      "fieldName": "seed",
      "fieldValue": "1231231"
    }
  ]
}
```

---

## 附加参数（可选）

| 参数名         | 类型     | 默认值 | 说明 |
|----------------|----------|--------|------|
| `addMetadata`  | boolean  | true   | 是否在图片中写入元信息（如提示词） |
| `webhookUrl`   | string   | 无     | 任务完成后回调的 URL，平台会主动向该地址发送任务结果 |
| `workflow`     | string   | 无     | 自定义完整工作流（JSON 字符串），如指定则忽略 `workflowId` |
| `instanceType`     | string   | 无     | 发起任务指定实例类型|
| `usePersonalQueue`     | boolean   | false     | 独占类型任务是否入队|

---
### usePersonalQueue 使用说明

此参数只对独占类型的apiKey生效，若不想自己控制排队，可设置此参数为true，任务会自动进入排队状态，当用户持有的独占机器空闲时会自动执行；
注意：单用户排队的数量限制为1000，超过会返回错误码(814, "PERSONAL_QUEUE_COUNT_LIMIT")

```json
"usePersonalQueue": "true"
```
---
### instanceType 使用说明

若希望发起plus任务到48G显存机器上执行，可设置 `instanceType` 参数。例如：

```json
"instanceType": "plus"
```
---
### webhookUrl 使用说明（高级）

若希望任务执行完成后平台自动通知结果，可设置 `webhookUrl` 参数。例如：

```json
"webhookUrl": "https://your-webhook-url"
```

> ⚠️ **推荐仅开发人员使用此参数**

任务完成后，RunningHub 会向该地址发送如下 `POST` 请求：

```json
{
  "event": "TASK_END",
  "taskId": "1904163390028185602",
  "eventData": "{\"code\":0,\"msg\":\"success\",\"data\":[{\"fileUrl\":\"https://rh-images.xiaoyaoyou.com/de0db6f2564c8697b07df55a77f07be9/output/ComfyUI_00033_hpgko_1742822929.png\",\"fileType\":\"png\",\"taskCostTime\":0,\"nodeId\":\"9\"}]}"
}
```

- `event`：固定为 `TASK_END`
- `taskId`：对应任务 ID
- `eventData`：与“查询任务生成结果”接口返回结构一致

> ⚠️ **特别注意**：接收 webhook 回调的接口**必须异步处理**，否则平台请求超时可能会触发**多次重试**。

---

## 返回结果

### 成功响应示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "netWssUrl": null,
    "taskId": "1910246754753896450",
    "clientId": "e825290b08ca2015b8f62f0bbdb5f5f6",
    "taskStatus": "QUEUED",
    "promptTips": "{\"result\": true, \"error\": null, \"outputs_to_execute\": [\"9\"], \"node_errors\": {}}"
  }
}
```

### 返回字段说明

| 字段名       | 类型     | 说明 |
|--------------|----------|------|
| `code`       | int      | 状态码，0 表示成功 |
| `msg`        | string   | 提示信息 |
| `data`       | object   | 返回数据对象，见下表 |

#### data 子字段说明

| 字段名        | 类型     | 说明 |
|---------------|----------|------|
| `taskId`      | string   | 创建的任务 ID，可用于查询状态或获取结果 |
| `taskStatus`  | string   | 初始状态，可能为：`QUEUED`、`RUNNING`、`FAILED` |
| `clientId`    | string   | 平台内部标识，用于排错，无需关注 |
| `netWssUrl`   | string   | WebSocket 地址（当前不稳定，**不推荐使用**） |
| `promptTips`  | string   | ComfyUI 校验信息（字符串格式的 JSON），可用于识别配置异常节点 |

---

## 使用建议

- ✅ 在调用前请确认 `nodeId` 和 `fieldName` 的准确性
- ✅ 可通过导出 workflow JSON 结构查看可配置字段
- ⚠️ 如果返回 `promptTips` 含有错误信息，请根据 `nodeId` 精确排查问题
- ✅ 推荐通过 `webhookUrl` 接收结果通知，或轮询状态与结果接口
- ❌ 不建议使用 `netWssUrl` 监听实时状态（当前版本不稳定）

---

## 相关接口

- [查询任务状态](https://www.runninghub.cn/runninghub-api-doc/api-276613252)
- [查询任务生成结果](https://www.runninghub.cn/runninghub-api-doc/api-276613253)
- [上传资源接口](https://www.runninghub.cn/runninghub-api-doc/api-276613256)
- [获取上传 Lora 链接接口](https://www.runninghub.cn/runninghub-api-doc/api-276613257)

> Body 请求参数

```json
{
  "apiKey": "{{apiKey}}",
  "workflowId": "1904136902449209346",
  "nodeInfoList": [
    {
      "nodeId": "6",
      "fieldName": "text",
      "fieldValue": "1 girl in classroom"
    }
  ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|[发起ComfyUI任务 Request 2](#schema发起comfyui任务 request 2)| 否 |none|

> 返回示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "netWssUrl": null,
    "taskId": "1910246754753896450",
    "clientId": "e825290b08ca2015b8f62f0bbdb5f5f6",
    "taskStatus": "QUEUED",
    "promptTips": "{\"result\": true, \"error\": null, \"outputs_to_execute\": [\"9\"], \"node_errors\": {}}"
  }
}
```

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "netWssUrl": "websocket-url",
    "taskId": "1910246754753896450",
    "clientId": "e825290b08ca2015b8f62f0bbdb5f5f6",
    "taskStatus": "RUNNING",
    "promptTips": "{\"result\": true, \"error\": null, \"outputs_to_execute\": [\"9\"], \"node_errors\": {}}"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[发起ComfyUI任务 Response](#schema发起comfyui任务 response)|

## POST 发起AI应用任务

POST /task/openapi/ai-app/run

在AI应用详情页中可查看示例nodeInfoList

> Body 请求参数

```json
{
  "webappId": 1877265245566922800,
  "apiKey": "{{apiKey}}",
  "nodeInfoList": [
    {
      "nodeId": "122",
      "fieldName": "prompt",
      "fieldValue": "一个在教室里的金发女孩"
    }
  ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|[TaskRunWebappByKeyRequest](#schemataskrunwebappbykeyrequest)| 否 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "netWssUrl": "wss://www.runninghub.cn:443/ws/c_instance?c_host=222.186.161.123&c_port=85&clientId=14caa1db2110a81629c101b9bb4cb0ce&workflowId=1876205853438365698&Rh-Comfy-Auth=eyJ1c2VySWQiOiJkZTBkYjZmMjU2NGM4Njk3YjA3ZGY1NWE3N2YwN2JlOSIsInNpZ25FeHBpcmUiOjE3NDQxMTI1MjEyMzYsInRzIjoxNzQzNTA3NzIxMjM2LCJzaWduIjoiZDExOTE0MzkwMjJlNjViMjQ5MjU2YzU2ZmQxYTUwZjUifQ%3D%3D",
    "taskId": "1907035719658053634",
    "clientId": "14caa1db2110a81629c101b9bb4cb0ce",
    "taskStatus": "RUNNING",
    "promptTips": "{\"result\": true, \"error\": null, \"outputs_to_execute\": [\"115\", \"129\", \"124\"], \"node_errors\": {}}"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[RTaskCreateResponse](#schemartaskcreateresponse)|

## POST 获取工作流Json

POST /api/openapi/getJsonApiFormat

> Body 请求参数

```json
{
  "apiKey": "{{apiKey}}",
  "workflowId": "1904136902449209346"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|[获取工作流Json Request](#schema获取工作流json request)| 否 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "SUCCESS",
  "data": {
    "prompt": "{\"3\":{\"class_type\":\"KSampler\",\"inputs\":{\"scheduler\":\"karras\",\"negative\":[\"7\",0],\"denoise\":1,\"latent_image\":[\"5\",0],\"seed\":669816362794144,\"cfg\":8,\"sampler_name\":\"dpmpp_2m\",\"model\":[\"4\",0],\"positive\":[\"6\",0],\"steps\":20},\"_meta\":{\"title\":\"KSampler\"}},\"4\":{\"class_type\":\"CheckpointLoaderSimple\",\"inputs\":{\"ckpt_name\":\"MR 3DQ _SDXL V0.2.safetensors\"},\"_meta\":{\"title\":\"Load Checkpoint\"}},\"37\":{\"class_type\":\"VAEDecode\",\"inputs\":{\"vae\":[\"4\",2],\"samples\":[\"3\",0]},\"_meta\":{\"title\":\"VAE Decode\"}},\"5\":{\"class_type\":\"EmptyLatentImage\",\"inputs\":{\"batch_size\":1,\"width\":512,\"height\":512},\"_meta\":{\"title\":\"Empty Latent Image\"}},\"6\":{\"class_type\":\"CLIPTextEncode\",\"inputs\":{\"speak_and_recognation\":{\"__value__\":[false,true]},\"text\":\"DreamWork 3D Style, a cute panda holding a bamboo in hands at sunset, highly detailed, ultra-high resolutions, 32K UHD, best quality, masterpiece, \",\"clip\":[\"4\",1]},\"_meta\":{\"title\":\"CLIP Text Encode (Prompt)\"}},\"7\":{\"class_type\":\"CLIPTextEncode\",\"inputs\":{\"speak_and_recognation\":{\"__value__\":[false,true]},\"text\":\"\",\"clip\":[\"4\",1]},\"_meta\":{\"title\":\"CLIP Text Encode (Prompt)\"}},\"9\":{\"class_type\":\"SaveImage\",\"inputs\":{\"filename_prefix\":\"ComfyUI\",\"images\":[\"37\",0]},\"_meta\":{\"title\":\"Save Image\"}}}"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[获取工作流Json Response](#schema获取工作流json response)|

## POST 查询任务状态

POST /task/openapi/status

> Body 请求参数

```json
{
  "apiKey": "{{apiKey}}",
  "taskId": "1904152026220003329"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|[查询任务状态 Request](#schema查询任务状态 request)| 否 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "",
  "data": ""
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||返回标记：成功标记=0，非0失败，或者是功能码|
|» msg|string|false|none||返回信息|
|» data|string|false|none||["QUEUED","RUNNING","FAILED","SUCCESS"]|

## POST 查询任务生成结果

POST /task/openapi/outputs

> Body 请求参数

```json
{
  "apiKey": "{{apiKey}}",
  "taskId": "1904152026220003329"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|[查询任务状态 Request](#schema查询任务状态 request)| 否 |none|

> 返回示例

```json
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "fileUrl": "https://rh-images.xiaoyaoyou.com/de0db6f2564c8697b07df55a77f07be9/output/ComfyUI_00033_hpgko_1742822929.png",
      "fileType": "png",
      "taskCostTime": "0",
      "nodeId": "9"
    }
  ]
}
```

```json
{
  "code": 805,
  "msg": "APIKEY_TASK_STATUS_ERROR",
  "data": {
    "failedReason": {
      "current_outputs": "{}",
      "exception_type": "TypeError",
      "node_name": "SONIC_PreData",
      "current_inputs": "{}",
      "traceback": "[\"  File \\\"/workspace/ComfyUI/execution.py\\\", line 1208, in execute\\n    output_data, output_ui, has_subgraph, has_pending_tasks = await get_output_data(prompt_id, unique_id, obj, input_data_all, execution_block_cb=execution_block_cb, pre_execute_cb=pre_execute_cb, hidden_inputs=hidden_inputs)\\n\",\"  File \\\"/workspace/ComfyUI/execution.py\\\", line 366, in get_output_data\\n    return_values = await _async_map_node_over_list(prompt_id, unique_id, obj, input_data_all, obj.FUNCTION, allow_interrupt=True, execution_block_cb=execution_block_cb, pre_execute_cb=pre_execute_cb, hidden_inputs=hidden_inputs)\\n\",\"  File \\\"/workspace/ComfyUI/execution.py\\\", line 340, in _async_map_node_over_list\\n    await process_inputs(input_dict, i)\\n\",\"  File \\\"/workspace/ComfyUI/execution.py\\\", line 328, in process_inputs\\n    result = f(**inputs)\\n\"]",
      "node_id": "276",
      "exception_message": "SONIC_PreData.sampler_main() missing 2 required positional arguments: 'clip_vision' and 'vae'"
    }
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[R?](#schemar?)|

## POST 取消ComfyUI任务

POST /task/openapi/cancel

> Body 请求参数

```json
{
  "apiKey": "{{apiKey}}",
  "taskId": "1904152026220003329"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|[查询任务状态 Request](#schema查询任务状态 request)| 否 |none|

> 返回示例

```json
{
  "code": 0,
  "msg": "success",
  "data": null
}
```

```json
{
  "code": 807,
  "msg": "APIKEY_TASK_NOT_FOUND",
  "data": null
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[R?](#schemar?)|

## POST 获取账户信息

POST /uc/openapi/accountStatus

> Body 请求参数

```json
{
  "apikey": "{{apiKey}}"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|[获取账户信息 Request](#schema获取账户信息 request)| 否 |none|

> 返回示例

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "remainCoins": 0,
    "currentTaskCounts": 0
  }
}
```

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "remainCoins": "177814",
    "currentTaskCounts": "0",
    "remainMoney": null,
    "currency": null,
    "apiType": "NORMAL"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[RAccountStatusResponse](#schemaraccountstatusresponse)|

## POST 上传资源（图片、视频、音频、压缩包）

POST /task/openapi/upload

# RunningHub 资源上传说明（图片、音视、视频、压缩包）

## 📌 场景简介

本接口用于资源上传，支持上传图片、音频、视频、ZIP 压缩包（图片压缩包）至 RunningHub 服务器。上传后的文件将被对应加载节点（如 `LoadImage`，`LoadImages(zip)`，`LoadAudio`和`LoadVideo` ）加载，作为工作流的输入资源使用。

⚠️ **注意事项：**

*   **非图床 / 文件存储服务**：上传后的图片、音频、视频、压缩包**均无法通过 URL 直接访问**。

*   返回的 `fileName` 字段为文件在服务器上的相对路径，请勿随意拼接为外链访问。

## 📤 上传要求

### 1. 支持文件类型汇总

|  文件类别  | 支持格式             |
| :--------: | :------------------- |
|    图片    | JPG、PNG、JPEG、WEBP |
| 图片压缩包 | ZIP                  |
|    音频    | MP3、WAV、FLAC       |
|    视频    | MP4、AVI、MOV、MKV   |

### 2. 单文件大小限制

所有类型文件**单文件大小上限为 30MB**

> ✅ **推荐做法**：
>
> *   若文件超过 30MB，**请上传到云存储（如 OSS、COS、S3 等）**，并将文件的 **公开直链 URL** 传入工作流对应加载节点。
>
> *   云图像路径支持外链访问，但请确保链接可访问，且稳定可靠。
>
> *   压缩包文件大小需限制带**30MB**以内。

## 🧾 上传响应示例

上传成功后，服务端返回 JSON 响应，`fileName` 为核心加载路径。

### 1. 图片上传响应

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "fileName": "api/9d77b8530f8b3591edc5c4e8f3f55b2cf0960bb2ca35c04e32c1677687866576.png",
    "fileType": "input"
  }
}
```

### 2. 图像（ZIP 压缩包）上传响应

```json
{
    "code": 0,
    "msg": "success",
    "data": {
        "fileName": "6c8e54223d1a46185917429fbb0be83e6d5063e6016d0673ebad5da35753ecd0",
        "fileType": "input"
    }
}
```

### 3. 音频上传响应

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "fileName": "api/7a2f4c8d1e5b9g3h6j0k2l7m4n8p1q3r5s9t0u2v4w6x8y0z1.mp3",
    "fileType": "input"
  }
```

### 4. 视频上传响应

```json
{
    "code": 0,
    "msg": "success",
    "data": {
        "fileName": "api/14c585a56d8f7c3b9c1ad3c4f8edc93a9fd9f79e21b4d10afd811322bf65f3c2.mp4",
        "fileType": "input"
    }
}
```

> 🔑 关键字段说明：
>
> `fileName`为文件加载的唯一路径，需准确传入对应节点。

## 📥 如何将文件用于对应加载节点？

获取上传返回的 `fileName` 后，需在工作流配置中按文件类型匹配节点，示例如下：

### 1. 图片 → `LoadImage` 节点

```json
"nodeInfoList": [
  {
    "nodeId": "10",
    "fieldName": "image",
    "fieldValue": "api/9d77b8530f8b3591edc5c4e8f3f55b2cf0960bb2ca35c04e32c1677687866576.png"
  }
]
```

### 2. 图像（ZIP 压缩包） → `LoadImages(zip)` 节点

```json
"nodeInfoList": [
  {
    "nodeId": "6",
    "fieldName": "upload",
    "fieldValue": "6c8e54223d1a46185917429fbb0be83e6d5063e6016d0673ebad5da35753ecd0"
  }
]
```

### 3. 音频 → `LoadAudio` 节点

```json
"nodeInfoList": [
  {
    "nodeId": "2",
    "fieldName": "audio",
    "fieldValue": "api/7a2f4c8d1e5b9g3h6j0k2l7m4n8p1q3r5s9t0u2v4w6x8y0z1.mp3"
  }
]
```

### 4. 视频 → `LoadVideo` 节点

```json
"nodeInfoList": [
  {
    "nodeId": "7",
    "fieldName": "video",
    "fieldValue": "api/14c585a56d8f7c3b9c1ad3c4f8edc93a9fd9f79e21b4d10afd811322bf65f3c2.mp4"
  }
]
```

> * `nodeId`：工作流节点的编号
> * `fieldName`：字段名，例如图像输入请使用 `"image"`
> * `fieldValue`：上传返回的 `fileName` 字段值

## 📝 文件上传后使用流程（以图像压缩包为例）
### 1. 新建工作流（ZIP批量上传图片）

<img src="https://api.apifox.com/api/v1/projects/6103976/resources/570186/image-preview" alt="image-20250904172450259" width="500" />
### 2.在对应位置填入响应信息
找到指定位置
<img src="https://api.apifox.com/api/v1/projects/6103976/resources/570187/image-preview" alt="image-20250904172450259" width="500" />
填写信息
<img src="https://api.apifox.com/api/v1/projects/6103976/resources/570188/image-preview" alt="image-20250904172450259" width="300" />
------
如需进一步支持，请联系技术团队。

> Body 请求参数

```yaml
apiKey: "{{apiKey}}"
file: file://D:\temp\ComfyUI_00743_uiqpt_1742470204.png
fileType: image

```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|object| 否 |none|
|» apiKey|body|string| 是 |none|
|» file|body|string(binary)| 否 |none|
|» fileType|body|string| 否 |none|

> 返回示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "fileName": "api/9d77b8530f8b3591edc5c4e8f3f55b2cf0960bb2ca35c04e32c1677687866576.png",
    "fileType": "image"
  }
}
```

```json
{
  "code": 809,
  "msg": "APIKEY_FILE_SIZE_EXCEEDED",
  "data": null
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[RTaskUploadResponse](#schemartaskuploadresponse)|

## POST 上传Lora-获取Lora上传地址

POST /api/openapi/getLoraUploadUrl

# RHLoraLoader 专用 LoRA 上传接口说明

⚠️ **注意事项**

* 此接口上传的 **LoRA 模型文件** 与平台常规上传方式不同，仅限通过 `RHLoraLoader` 节点调用，**其他节点无法识别和使用**。
* 上传的 LoRA 会以 `md5Hex` 为唯一标识进行缓存，请务必**准确计算并使用正确的 `md5Hex` 值**进行上传。

---

## 上传接口响应示例

成功调用上传接口后，返回如下 JSON 数据：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "fileName": "api-lora-cn/f8d958506e6c8044f79ccd7c814c6179.safetensors",
    "url": "https://rh-models-1252422369.cos.ap-beijing.myqcloud.com/api-lora-cn/f8d958506e6c8044f79ccd7c814c6179.safetensors?q-sign-algorithm=sha1&q-ak=YOUR_ACCESS_KEY&q-sign-time=1742960296%3B1742963896&q-key-time=1742960296%3B1742963896&q-header-list=host&q-url-param-list=&q-signature=YOUR_SIGNATURE"
  }
}
```

---

## 上传 LoRA 模型文件至云服务

请使用获取到的 `url` 地址，通过 **PUT 请求** 将本地 `.safetensors` 文件上传至云服务：

```bash
curl --location --request PUT 'https://rh-models-1252422369.cos.ap-beijing.myqcloud.com/api-lora-cn/f8d958506e6c8044f79ccd7c814c6179.safetensors?q-sign-algorithm=sha1&q-ak=YOUR_ACCESS_KEY&q-sign-time=1742821197%3B1742824797&q-key-time=1742821197%3B1742824797&q-header-list=host&q-url-param-list=&q-signature=YOUR_SIGNATURE' \
--header 'Content-Type: application/octet-stream' \
--data-binary '@D:\temp\my-lora-name.safetensors'
```

---

## 使用说明

上传完成后 **立即可用**，无需等待同步。

将响应中的 `fileName` 值：

```
api-lora-cn/f8d958506e6c8044f79ccd7c814c6179.safetensors
```

填入 `RHLoraLoader` 节点对应参数即可调用该 LoRA 模型。

> Body 请求参数

```json
{
  "apiKey": "{{apiKey}}",
  "loraName": "my-lora-name",
  "md5Hex": "f8d958506e6c8044f79ccd7c814c6179"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 否 |none|
|body|body|[ApiUploadLoraRequest](#schemaapiuploadlorarequest)| 否 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "fileName": "api-lora-cn/f8d958506e6c8044f79ccd7c814c6179.safetensors",
    "url": "https://rh-models-1252422369.cos.ap-beijing.myqcloud.com/api-lora-cn/f8d958506e6c8044f79ccd7c814c6179.safetensors?q-sign-algorithm=sha1&q-ak=YOUR_ACCESS_KEY&q-sign-time=1742889838%3B1742893438&q-key-time=1742889838%3B1742893438&q-header-list=host&q-url-param-list=&q-signature=YOUR_SIGNATURE"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[R?](#schemar?)|

## POST 获取webhook事件详情

POST /task/openapi/getWebhookDetail

此接口旨在帮助调试用户的webhook，通过taskId查询到当前webhook事件的详细状态，拿到事件的id后可以发起重试

> Body 请求参数

```json
{
  "apiKey": "{{apiKey}}",
  "taskId": "1904154698679771137"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|[获取webhook事件详情Request](#schema获取webhook事件详情request)| 否 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "1904444422778503169",
    "userApiKey": "******************",
    "taskId": "1904444422770114561",
    "webhookUrl": "https://your-webhook-url",
    "eventData": "{\"code\":0,\"msg\":\"success\",\"data\":[{\"fileUrl\":\"https://rh-images.xiaoyaoyou.com/de0db6f2564c8697b07df55a77f07be9/output/ComfyUI_00059_hnona_1742889987.png\",\"fileType\":\"png\",\"taskCostTime\":78,\"nodeId\":\"9\"}]}",
    "callbackStatus": "FAILED",
    "callbackResponse": "I/O error on POST request for \"https://your-webhook-url\": Remote host terminated the handshake",
    "retryCount": 3,
    "createTime": "2025-03-25T16:05:07",
    "updateTime": "2025-03-25T16:08:10"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[R?](#schemar?)|

## POST 重新发送指定webhook事件

POST /task/openapi/retryWebhook

webhookId 为 获取webhook事件详情中返回的id

> Body 请求参数

```json
{
  "apiKey": "{{apiKey}}",
  "webhookId": "1904154698688159745",
  "webhookUrl": "https://your-webhook-url"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|Host|header|string| 是 |none|
|body|body|[重新发送指定webhook Request](#schema重新发送指定webhook request)| 否 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "",
  "data": null
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[R?](#schemar?)|

## GET 获取AI应用API调用示例

GET /api/webapp/apiCallDemo

提供AI应用接口请求调用示例demo，可以参考示例快速发起接口调用

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|apiKey|query|string| 是 |none|
|webappId|query|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "url": "curl --location --request POST 'https://rh-test-cn.haimacloud.com:6443/task/openapi/ai-app/run' \\\n--header 'Host: rh-test-cn.haimacloud.com:6443' \\\n--header 'Content-Type: application/json' \\\n--data-raw '{\n    \"webappId\": \"1871041656585822210\",\n    \"apiKey\": \"36faed4218be4738b886a6c909452618\",\n    \"quickCreateCode\": \"null\",\n    \"nodeInfoList\": [\n        {\n            \"nodeId\": \"3\",\n            \"fieldName\": \"seed\",\n            \"fieldValue\": \"238517498756825\"\n            \"description\": \"seed\"\n        },\n        {\n            \"nodeId\": \"6\",\n            \"fieldName\": \"text\",\n            \"fieldValue\": \"Depth of field, blurry street background,photo of a cyberpunk barbarian Battlecore woman with glowing opalescent third eye,bust, highly detailed glowing Elvish runes tattooed to the irises, glowing Elvish, Stealth Skin, runes on cheeks, runes on jaw line, runes on ears, runes on forehead,\"\n            \"description\": \"text\"\n        },\n        {\n            \"nodeId\": \"4\",\n            \"fieldName\": \"ckpt_name\",\n            \"fieldValue\": \"maximumEffort_maximumEffortXLV10.safetensors\"\n            \"description\": \"ckpt_name\"\n        }\n    ]\n}'"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|object|true|none||none|
|»» url|string|true|none||none|

# 快捷创作

## POST 获取快捷创作-模型库风格参数数据

POST /api/fast/creation/model/params

该接口用于快捷创作菜单下的文生图模块，目的是获取模型库风格数据，用于调用快捷创作API接口时候的参数填充

> Body 请求参数

```json
{
  "type": 2,
  "webappId": "1957344152277151746"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|
|» type|body|integer| 是 |none|
|» webappId|body|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "id": "1",
      "type": 2,
      "webappId": "1948570729172996097",
      "modelCategory": 1,
      "modelName": "【游戏】美漫画风",
      "modelKey": "input1",
      "modelPreviewUrl": "https://rh-images.xiaoyaoyou.com/system/1.png",
      "content": "粉色头发，黑色裙子，白色袜子，粉色运动鞋，彩色补丁，粉色夹克，黑色颈链，各种带子，多个扣环自信站立，白色背景",
      "modelTrigger": "Character concept design，hand painting style",
      "modelLoar1FileName": "F.1_陌no_美漫画风_V1.0.safetensors",
      "modelLoar1Weight": 0.7,
      "modelLoar2FileName": "F.1_陌no_美漫画风_V1.0.safetensors",
      "modelLoar2Weight": 0
    },
    {
      "id": "2",
      "type": 2,
      "webappId": "1948570729172996097",
      "modelCategory": 1,
      "modelName": "【游戏】Q版卡通角色",
      "modelKey": "input2",
      "modelPreviewUrl": "https://rh-images.xiaoyaoyou.com/system/2.png",
      "content": "紫色衣服，蓝色眼睛，手拿手枪，白色背景，自信站立",
      "modelTrigger": "sf，a chibi-style character ,chibi，",
      "modelLoar1FileName": "chibiflux-v1 lora-000008.TA_trained.safetensors",
      "modelLoar1Weight": 0.75,
      "modelLoar2FileName": null,
      "modelLoar2Weight": null
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|[object]|true|none||none|
|»» id|string|true|none||none|
|»» type|integer|true|none||none|
|»» webappId|string|true|none||none|
|»» modelCategory|integer|true|none||none|
|»» modelName|string|true|none||none|
|»» modelKey|string|true|none||none|
|»» modelPreviewUrl|string|true|none||none|
|»» content|string|true|none||none|
|»» modelTrigger|string|true|none||none|
|»» modelLoar1FileName|string|true|none||none|
|»» modelLoar1Weight|number|true|none||none|
|»» modelLoar2FileName|string¦null|true|none||none|
|»» modelLoar2Weight|integer¦null|true|none||none|

## POST 发起快捷创作任务-参考生图-P图

POST /task/openapi/quick-ai-app/run

在快捷创作菜单下选择参考生图-P图模块页中点击调用API可查看示例，详细请看“关于快捷创作调用”说明

> Body 请求参数

```json
{
  "webappId": "1957346252562296834",
  "apiKey": "*****************",
  "quickCreateCode": "002",
  "nodeInfoList": [
    {
      "nodeId": "39",
      "nodeName": "LoadImage",
      "fieldName": "image",
      "fieldType": "IMAGE",
      "fieldValue": "d33bbf204a742c3a0c209327a3fe9731ab618d682ee2ed47cca87bc48cc2bd8c.jpg",
      "description": "上传图像"
    },
    {
      "nodeId": "159",
      "nodeName": "ImpactSwitch",
      "fieldName": "select",
      "fieldType": "SWITCH",
      "fieldValue": "2",
      "description": "设置比例"
    },
    {
      "nodeId": "142",
      "nodeName": "EmptyLatentImage",
      "fieldName": "batch_size",
      "fieldType": "INT",
      "fieldValue": "1",
      "description": "生成张数"
    },
    {
      "nodeId": "52",
      "nodeName": "RH_Translator",
      "fieldName": "prompt",
      "fieldType": "STRING",
      "fieldValue": "给这个图像的风格变成皮克斯3D卡通风格",
      "description": "图像编辑文本输入框"
    }
  ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|
|» webappId|body|string| 是 |none|
|» apiKey|body|string| 是 |none|
|» quickCreateCode|body|string| 是 |none|
|» nodeInfoList|body|[object]| 是 |none|
|»» nodeId|body|string| 是 |none|
|»» nodeName|body|string| 是 |none|
|»» fieldName|body|string| 是 |none|
|»» fieldType|body|string| 是 |none|
|»» fieldValue|body|string| 是 |none|
|»» description|body|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "netWssUrl": "wss://www.runninghub.cn:443/ws/c_instance?c_host=222.186.161.123&c_port=85&clientId=14caa1db2110a81629c101b9bb4cb0ce&workflowId=1876205853438365698&Rh-Comfy-Auth=eyJ1c2VySWQiOiJkZTBkYjZmMjU2NGM4Njk3YjA3ZGY1NWE3N2YwN2JlOSIsInNpZ25FeHBpcmUiOjE3NDQxMTI1MjEyMzYsInRzIjoxNzQzNTA3NzIxMjM2LCJzaWduIjoiZDExOTE0MzkwMjJlNjViMjQ5MjU2YzU2ZmQxYTUwZjUifQ%3D%3D",
    "taskId": "1907035719658053634",
    "clientId": "14caa1db2110a81629c101b9bb4cb0ce",
    "taskStatus": "RUNNING",
    "promptTips": "{\"result\": true, \"error\": null, \"outputs_to_execute\": [\"115\", \"129\", \"124\"], \"node_errors\": {}}"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|object|true|none||none|
|»» netWssUrl|string|true|none||none|
|»» taskId|string|true|none||none|
|»» clientId|string|true|none||none|
|»» taskStatus|string|true|none||none|
|»» promptTips|string|true|none||none|

# 数据模型

<h2 id="tocS_获取工作流Json Request">获取工作流Json Request</h2>

<a id="schema获取工作流json request"></a>
<a id="schema_获取工作流Json Request"></a>
<a id="tocS获取工作流json request"></a>
<a id="tocs获取工作流json request"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "workflowId": "1904136902449209346"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|true|none||none|
|workflowId|string|true|none||none|

<h2 id="tocS_RTaskCreateResponse">RTaskCreateResponse</h2>

<a id="schemartaskcreateresponse"></a>
<a id="schema_RTaskCreateResponse"></a>
<a id="tocSrtaskcreateresponse"></a>
<a id="tocsrtaskcreateresponse"></a>

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "netWssUrl": "string",
    "taskId": 0,
    "clientId": "string",
    "taskStatus": "string",
    "promptTips": "string"
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|code|integer|false|none||返回标记：成功标记=0，非0失败，或者是功能码|
|msg|string|false|none||返回信息|
|data|[TaskCreateResponse](#schemataskcreateresponse)|false|none||数据|

<h2 id="tocS_获取工作流Json Response">获取工作流Json Response</h2>

<a id="schema获取工作流json response"></a>
<a id="schema_获取工作流Json Response"></a>
<a id="tocS获取工作流json response"></a>
<a id="tocs获取工作流json response"></a>

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "prompt": "{\\\"3\\\":{\\\"class_type\\\":\\\"KSampler\\\",\\\"inputs\\\":{\\\"scheduler\\\":\\\"karras\\\",\\\"negative\\\":[\\\"7\\\",0],\\\"denoise\\\":1,\\\"latent_image\\\":[\\\"5\\\",0],\\\"seed\\\":669816362794144,\\\"cfg\\\":8,\\\"sampler_name\\\":\\\"dpmpp_2m\\\",\\\"model\\\":[\\\"4\\\",0],\\\"positive\\\":[\\\"6\\\",0],\\\"steps\\\":20},\\\"_meta\\\":{\\\"title\\\":\\\"KSampler\\\"}},\\\"4\\\":{\\\"class_type\\\":\\\"CheckpointLoaderSimple\\\",\\\"inputs\\\":{\\\"ckpt_name\\\":\\\"MR 3DQ _SDXL V0.2.safetensors\\\"},\\\"_meta\\\":{\\\"title\\\":\\\"Load Checkpoint\\\"}},\\\"37\\\":{\\\"class_type\\\":\\\"VAEDecode\\\",\\\"inputs\\\":{\\\"vae\\\":[\\\"4\\\",2],\\\"samples\\\":[\\\"3\\\",0]},\\\"_meta\\\":{\\\"title\\\":\\\"VAE Decode\\\"}},\\\"5\\\":{\\\"class_type\\\":\\\"EmptyLatentImage\\\",\\\"inputs\\\":{\\\"batch_size\\\":1,\\\"width\\\":512,\\\"height\\\":512},\\\"_meta\\\":{\\\"title\\\":\\\"Empty Latent Image\\\"}},\\\"6\\\":{\\\"class_type\\\":\\\"CLIPTextEncode\\\",\\\"inputs\\\":{\\\"speak_and_recognation\\\":{\\\"__value__\\\":[false,true]},\\\"text\\\":\\\"DreamWork 3D Style, a cute panda holding a bamboo in hands at sunset, highly detailed, ultra-high resolutions, 32K UHD, best quality, masterpiece, \\\",\\\"clip\\\":[\\\"4\\\",1]},\\\"_meta\\\":{\\\"title\\\":\\\"CLIP Text Encode (Prompt)\\\"}},\\\"7\\\":{\\\"class_type\\\":\\\"CLIPTextEncode\\\",\\\"inputs\\\":{\\\"speak_and_recognation\\\":{\\\"__value__\\\":[false,true]},\\\"text\\\":\\\"\\\",\\\"clip\\\":[\\\"4\\\",1]},\\\"_meta\\\":{\\\"title\\\":\\\"CLIP Text Encode (Prompt)\\\"}},\\\"9\\\":{\\\"class_type\\\":\\\"SaveImage\\\",\\\"inputs\\\":{\\\"filename_prefix\\\":\\\"ComfyUI\\\",\\\"images\\\":[\\\"37\\\",0]},\\\"_meta\\\":{\\\"title\\\":\\\"Save Image\\\"}}}"
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|code|integer|true|none||返回标记：成功标记=0，非0失败，或者是功能码|
|msg|string|true|none||返回信息|
|data|object|false|none||数据|
|» prompt|string|false|none||none|

<h2 id="tocS_发起ComfyUI任务 Request 1">发起ComfyUI任务 Request 1</h2>

<a id="schema发起comfyui任务 request 1"></a>
<a id="schema_发起ComfyUI任务 Request 1"></a>
<a id="tocS发起comfyui任务 request 1"></a>
<a id="tocs发起comfyui任务 request 1"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "workflowId": "1904136902449209346",
  "addMetadata": true
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|true|none||none|
|workflowId|string|true|none||none|
|addMetadata|boolean|false|none||none|

<h2 id="tocS_TaskRunWebappByKeyRequest">TaskRunWebappByKeyRequest</h2>

<a id="schemataskrunwebappbykeyrequest"></a>
<a id="schema_TaskRunWebappByKeyRequest"></a>
<a id="tocStaskrunwebappbykeyrequest"></a>
<a id="tocstaskrunwebappbykeyrequest"></a>

```json
{
  "apiKey": "string",
  "webappId": 0,
  "nodeInfoList": [
    {
      "nodeId": "string",
      "nodeName": "string",
      "fieldName": "string",
      "fieldValue": "string",
      "fieldData": "string",
      "description": "string",
      "descriptionEn": "string"
    }
  ],
  "webhookUrl": "string",
  "instanceType": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|true|none||none|
|webappId|integer(int64)|true|none||none|
|nodeInfoList|[[NodeInfo](#schemanodeinfo)]|true|none||none|
|webhookUrl|string|false|none||none|
|instanceType|string|false|none||非必须，默认'default'调用24g显存机器，传'plus' 调用48g显存机器|

<h2 id="tocS_发起ComfyUI任务 Request 2">发起ComfyUI任务 Request 2</h2>

<a id="schema发起comfyui任务 request 2"></a>
<a id="schema_发起ComfyUI任务 Request 2"></a>
<a id="tocS发起comfyui任务 request 2"></a>
<a id="tocs发起comfyui任务 request 2"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "workflowId": "1904136902449209346",
  "nodeInfoList": [
    {
      "nodeId": "6",
      "fieldName": "text",
      "fieldValue": "1 girl in classroom"
    }
  ],
  "workflow": "{\"3\":{\"class_type\":\"KSampler\",\"inputs\":{\"scheduler\":\"karras\",\"negative\":[\"7\",0],\"denoise\":1,\"latent_image\":[\"5\",0],\"seed\":669816362794144,\"cfg\":8,\"sampler_name\":\"dpmpp_2m\",\"model\":[\"4\",0],\"positive\":[\"6\",0],\"steps\":20},\"_meta\":{\"title\":\"KSampler\"}},\"4\":{\"class_type\":\"CheckpointLoaderSimple\",\"inputs\":{\"ckpt_name\":\"MR 3DQ _SDXL V0.2.safetensors\"},\"_meta\":{\"title\":\"Load Checkpoint\"}},\"37\":{\"class_type\":\"VAEDecode\",\"inputs\":{\"vae\":[\"4\",2],\"samples\":[\"3\",0]},\"_meta\":{\"title\":\"VAE Decode\"}},\"5\":{\"class_type\":\"EmptyLatentImage\",\"inputs\":{\"batch_size\":1,\"width\":512,\"height\":512},\"_meta\":{\"title\":\"Empty Latent Image\"}},\"6\":{\"class_type\":\"CLIPTextEncode\",\"inputs\":{\"speak_and_recognation\":{\"__value__\":[false,true]},\"text\":\"DreamWork 3D Style, a cute panda holding a bamboo in hands at sunset, highly detailed, ultra-high resolutions, 32K UHD, best quality, masterpiece, \",\"clip\":[\"4\",1]},\"_meta\":{\"title\":\"CLIP Text Encode (Prompt)\"}},\"7\":{\"class_type\":\"CLIPTextEncode\",\"inputs\":{\"speak_and_recognation\":{\"__value__\":[false,true]},\"text\":\"\",\"clip\":[\"4\",1]},\"_meta\":{\"title\":\"CLIP Text Encode (Prompt)\"}},\"9\":{\"class_type\":\"SaveImage\",\"inputs\":{\"filename_prefix\":\"ComfyUI\",\"images\":[\"37\",0]},\"_meta\":{\"title\":\"Save Image\"}}}",
  "addMetadata": true
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|true|none||none|
|workflowId|string|true|none||none|
|nodeInfoList|[[节点输入信息](#schema节点输入信息)]|false|none||none|
|workflow|string|false|none||none|
|addMetadata|boolean|false|none||none|

<h2 id="tocS_NodeInfo">NodeInfo</h2>

<a id="schemanodeinfo"></a>
<a id="schema_NodeInfo"></a>
<a id="tocSnodeinfo"></a>
<a id="tocsnodeinfo"></a>

```json
{
  "nodeId": "string",
  "nodeName": "string",
  "fieldName": "string",
  "fieldValue": "string",
  "fieldData": "string",
  "description": "string",
  "descriptionEn": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|nodeId|string|false|none||none|
|nodeName|string|false|none||none|
|fieldName|string|false|none||none|
|fieldValue|string|false|none||none|
|fieldData|string|false|none||none|
|description|string|false|none||none|
|descriptionEn|string|false|none||none|

<h2 id="tocS_发起ComfyUI任务 Request-webhook">发起ComfyUI任务 Request-webhook</h2>

<a id="schema发起comfyui任务 request-webhook"></a>
<a id="schema_发起ComfyUI任务 Request-webhook"></a>
<a id="tocS发起comfyui任务 request-webhook"></a>
<a id="tocs发起comfyui任务 request-webhook"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "workflowId": "1904136902449209346",
  "webhookUrl": "https://your-webhook-url"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|true|none||none|
|workflowId|string|true|none||none|
|webhookUrl|string|false|none||none|

<h2 id="tocS_发起ComfyUI任务 Response">发起ComfyUI任务 Response</h2>

<a id="schema发起comfyui任务 response"></a>
<a id="schema_发起ComfyUI任务 Response"></a>
<a id="tocS发起comfyui任务 response"></a>
<a id="tocs发起comfyui任务 response"></a>

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "netWssUrl": "string",
    "taskId": 0,
    "clientId": "string",
    "taskStatus": "string",
    "promptTips": "string"
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|code|integer|false|none||返回标记：成功标记=0，非0失败，或者是功能码|
|msg|string|false|none||返回信息|
|data|[TaskCreateResponse](#schemataskcreateresponse)|false|none||数据|

<h2 id="tocS_TaskCreateResponse">TaskCreateResponse</h2>

<a id="schemataskcreateresponse"></a>
<a id="schema_TaskCreateResponse"></a>
<a id="tocStaskcreateresponse"></a>
<a id="tocstaskcreateresponse"></a>

```json
{
  "netWssUrl": "string",
  "taskId": 0,
  "clientId": "string",
  "taskStatus": "string",
  "promptTips": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|netWssUrl|string|false|none||Wss服务地址|
|taskId|integer(int64)|false|none||任务Id|
|clientId|string|false|none||客户端ID，当客户端首次接收clientId时，需要保存到本地，以便页面刷新重连或者二次运行任务传参使用|
|taskStatus|string|false|none||任务状态: CREATE, SUCCESS, FAILED, RUNNING, QUEUED;|
|promptTips|string|false|none||工作流验证结果提示,当不为空是UI需要展示节点错误信息|

<h2 id="tocS_查询任务状态 Request">查询任务状态 Request</h2>

<a id="schema查询任务状态 request"></a>
<a id="schema_查询任务状态 Request"></a>
<a id="tocS查询任务状态 request"></a>
<a id="tocs查询任务状态 request"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "taskId": "1904152026220003329"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|true|none||none|
|taskId|string|false|none||none|

<h2 id="tocS_节点输入信息">节点输入信息</h2>

<a id="schema节点输入信息"></a>
<a id="schema_节点输入信息"></a>
<a id="tocS节点输入信息"></a>
<a id="tocs节点输入信息"></a>

```json
{
  "nodeId": "6",
  "fieldName": "text",
  "fieldValue": "1 girl in classroom"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|nodeId|string|false|none||none|
|fieldName|string|false|none||none|
|fieldValue|string|false|none||none|

<h2 id="tocS_获取账户信息 Request">获取账户信息 Request</h2>

<a id="schema获取账户信息 request"></a>
<a id="schema_获取账户信息 Request"></a>
<a id="tocS获取账户信息 request"></a>
<a id="tocs获取账户信息 request"></a>

```json
{
  "apikey": "{{apiKey}}"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apikey|string|false|none||none|

<h2 id="tocS_上传资源Request">上传资源Request</h2>

<a id="schema上传资源request"></a>
<a id="schema_上传资源Request"></a>
<a id="tocS上传资源request"></a>
<a id="tocs上传资源request"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "file": "string",
  "fileType": "image"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|true|none||none|
|file|string|false|none||none|
|fileType|string|false|none||none|

<h2 id="tocS_获取webhook事件详情Request">获取webhook事件详情Request</h2>

<a id="schema获取webhook事件详情request"></a>
<a id="schema_获取webhook事件详情Request"></a>
<a id="tocS获取webhook事件详情request"></a>
<a id="tocs获取webhook事件详情request"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "taskId": "1904154698679771137"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|false|none||none|
|taskId|string|false|none||none|

<h2 id="tocS_重新发送指定webhook Request">重新发送指定webhook Request</h2>

<a id="schema重新发送指定webhook request"></a>
<a id="schema_重新发送指定webhook Request"></a>
<a id="tocS重新发送指定webhook request"></a>
<a id="tocs重新发送指定webhook request"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "webhookId": "1904154698688159745",
  "webhookUrl": "https://your-webhook-url"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|false|none||none|
|webhookId|string|false|none||none|
|webhookUrl|string|false|none||none|

<h2 id="tocS_R?">R?</h2>

<a id="schemar?"></a>
<a id="schema_R?"></a>
<a id="tocSr?"></a>
<a id="tocsr?"></a>

```json
{
  "code": 0,
  "msg": "string",
  "data": null
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|code|integer|false|none||返回标记：成功标记=0，非0失败，或者是功能码|
|msg|string|false|none||返回信息|
|data|null|false|none||数据|

<h2 id="tocS_RWorkflowDuplicateResponse">RWorkflowDuplicateResponse</h2>

<a id="schemarworkflowduplicateresponse"></a>
<a id="schema_RWorkflowDuplicateResponse"></a>
<a id="tocSrworkflowduplicateresponse"></a>
<a id="tocsrworkflowduplicateresponse"></a>

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "newWorkflowId": "string"
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|code|integer|false|none||返回标记：成功标记=0，非0失败，或者是功能码|
|msg|string|false|none||返回信息|
|data|[WorkflowDuplicateResponse](#schemaworkflowduplicateresponse)|false|none||数据|

<h2 id="tocS_RAccountStatusResponse">RAccountStatusResponse</h2>

<a id="schemaraccountstatusresponse"></a>
<a id="schema_RAccountStatusResponse"></a>
<a id="tocSraccountstatusresponse"></a>
<a id="tocsraccountstatusresponse"></a>

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "remainCoins": 0,
    "currentTaskCounts": 0
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|code|integer|false|none||返回标记：成功标记=0，非0失败，或者是功能码|
|msg|string|false|none||返回信息|
|data|[AccountStatusResponse](#schemaaccountstatusresponse)|false|none||数据|

<h2 id="tocS_WorkflowDuplicateResponse">WorkflowDuplicateResponse</h2>

<a id="schemaworkflowduplicateresponse"></a>
<a id="schema_WorkflowDuplicateResponse"></a>
<a id="tocSworkflowduplicateresponse"></a>
<a id="tocsworkflowduplicateresponse"></a>

```json
{
  "newWorkflowId": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|newWorkflowId|string|false|none||none|

<h2 id="tocS_AccountStatusResponse">AccountStatusResponse</h2>

<a id="schemaaccountstatusresponse"></a>
<a id="schema_AccountStatusResponse"></a>
<a id="tocSaccountstatusresponse"></a>
<a id="tocsaccountstatusresponse"></a>

```json
{
  "remainCoins": 0,
  "currentTaskCounts": 0
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|remainCoins|integer|false|none||none|
|currentTaskCounts|integer|false|none||none|

<h2 id="tocS_WorkflowDuplicateRequest">WorkflowDuplicateRequest</h2>

<a id="schemaworkflowduplicaterequest"></a>
<a id="schema_WorkflowDuplicateRequest"></a>
<a id="tocSworkflowduplicaterequest"></a>
<a id="tocsworkflowduplicaterequest"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "workflowId": "1904136902449209346"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|false|none||none|
|workflowId|string|false|none||none|

<h2 id="tocS_ApiUploadLoraRequest">ApiUploadLoraRequest</h2>

<a id="schemaapiuploadlorarequest"></a>
<a id="schema_ApiUploadLoraRequest"></a>
<a id="tocSapiuploadlorarequest"></a>
<a id="tocsapiuploadlorarequest"></a>

```json
{
  "apiKey": "{{apiKey}}",
  "loraName": "my-lora-name",
  "md5Hex": "f8d958506e6c8044f79ccd7c814c6179"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|apiKey|string|true|none||apiKey, cannot be blank|
|loraName|string|true|none||lora name, cannot be blank|
|md5Hex|string|true|none||file MD5, cannot be blank|

<h2 id="tocS_RString">RString</h2>

<a id="schemarstring"></a>
<a id="schema_RString"></a>
<a id="tocSrstring"></a>
<a id="tocsrstring"></a>

```json
{
  "code": 0,
  "msg": "string",
  "data": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|code|integer|false|none||返回标记：成功标记=0，非0失败，或者是功能码|
|msg|string|false|none||返回信息|
|data|string|false|none||数据|

<h2 id="tocS_RTaskUploadResponse">RTaskUploadResponse</h2>

<a id="schemartaskuploadresponse"></a>
<a id="schema_RTaskUploadResponse"></a>
<a id="tocSrtaskuploadresponse"></a>
<a id="tocsrtaskuploadresponse"></a>

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "fileName": "string",
    "fileType": "string"
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|code|integer|false|none||返回标记：成功标记=0，非0失败，或者是功能码|
|msg|string|false|none||返回信息|
|data|[TaskUploadResponse](#schemataskuploadresponse)|false|none||数据|

<h2 id="tocS_TaskUploadResponse">TaskUploadResponse</h2>

<a id="schemataskuploadresponse"></a>
<a id="schema_TaskUploadResponse"></a>
<a id="tocStaskuploadresponse"></a>
<a id="tocstaskuploadresponse"></a>

```json
{
  "fileName": "string",
  "fileType": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|fileName|string|false|none||none|
|fileType|string|false|none||none|

