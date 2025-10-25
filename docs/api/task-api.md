{
    "userId": "user123",           // 平台用户编号 (必填, 最大长度50)
    "taskId": "task456",           // 任务id (必填, 最大长度50)
    "taskName": "苹果任务测试",     // 任务名称 (必填, 最大长度50)
    "jobTenantId":"aaaaaaaa-pppp-pppp-eeee-nnnnnnnnnnnn",
    "topicUrl":"https://ui.appen.com.cn/ssr/v3/qa-report?jobId=1f825341-e676-40c4-9409-b3e57d88ee6b&isPublic=false&finalDocId=None&originDocId=1f825341-e676-40c4-9409-b3e57d88ee6b%40215936-1-0&recordId=215936&projectId=a0bf5bb6-2218-4362-b708-78327f98d4e6&projectDisplayId=A12605&jobTenantId=aaaaaaaa-pppp-pppp-eeee-nnnnnnnnnnnn&locale=zh-CN", //标注访问页（可选参数）
    "projectId":"a0bf5bb6-2218-4362-b708-78327f98d4e6",
    "projectDisplayId":"A12605",
    "topicId": "topic789",         // 题Id (必填, 最大长度50)
    "recordState": "UNCHECKED",     // 状态 (必填, 可选值: UNCHECKED, MODIFYED)
    "isValid": true,               // 是否有效 (必填)
    "topicNum": 2,                 // 做题数量 (必填, 范围: 0-3)
    "elapsedTime": 300,            // 耗时（秒）(必填)
    "rejectReason": null,          // 被打回理由 (可选)
    "updateTime": "2025-10-24T20:45:59"  // 更新时间 (可选, 默认为当前时间)
}



{
	"success": true,
	"message": "苹果任务数据添加成功",
	"data": {
		"taskAppleId": 2,
		"recordId": 2,
		"userId": "user123",
		"taskId": "task456",
		"updateTime": "2025-10-24T20:45:59"
	}
}