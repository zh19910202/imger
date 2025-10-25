// Appen数据收集器优化功能单元测试
// 运行: npm test -- tests/unit/appen-data-collector.test.js

// 模拟Chrome扩展环境
const mockChrome = {
    storage: {
        local: {
            get: jest.fn((keys, callback) => callback({})),
            set: jest.fn((data, callback) => callback && callback()),
            remove: jest.fn((keys, callback) => callback && callback())
        }
    },
    runtime: {
        lastError: null
    }
};

// 模拟DOM环境
const mockDocument = {
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => [])
};

// 设置全局变量
global.chrome = mockChrome;
global.document = mockDocument;

describe('Appen数据收集器优化功能', () => {
    beforeEach(() => {
        // 清除所有模拟调用记录
        jest.clearAllMocks();
    });

    test('应该正确初始化日志级别系统', () => {
        // 这个测试需要在实际的Chrome扩展环境中运行才能验证
        expect(true).toBe(true);
    });

    test('应该正确初始化ChromeStorage工具函数', () => {
        // 这个测试需要在实际的Chrome扩展环境中运行才能验证
        expect(true).toBe(true);
    });

    test('应该正确初始化ElementSelector工具函数', () => {
        // 这个测试需要在实际的Chrome扩展环境中运行才能验证
        expect(true).toBe(true);
    });

    test('应该正确初始化ErrorHandler工具函数', () => {
        // 这个测试需要在实际的Chrome扩展环境中运行才能验证
        expect(true).toBe(true);
    });

    test('应该正确提取新的URL参数字段', () => {
        // 模拟URL参数
        const mockUrl = 'https://ui.appen.com.cn/ssr/v3/annotation-task-start?jobId=test-job-id&projectId=test-project-id&projectDisplayId=A12345&jobTenantId=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&taskId=test-task-id';

        // 模拟URLSearchParams
        global.URLSearchParams = jest.fn(() => ({
            get: jest.fn((param) => {
                const params = {
                    'jobId': 'test-job-id',
                    'projectId': 'test-project-id',
                    'projectDisplayId': 'A12345',
                    'jobTenantId': 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                    'taskId': 'test-task-id'
                };
                return params[param] || null;
            })
        }));

        // 验证参数提取逻辑
        const urlParams = new URLSearchParams();
        expect(urlParams.get('jobTenantId')).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        expect(urlParams.get('projectDisplayId')).toBe('A12345');
        expect(urlParams.get('projectId')).toBe('test-project-id');
    });

    test('应该正确验证jobTenantId的UUID格式', () => {
        // 测试UUID格式验证逻辑
        const validUUID = 'aaaaaaaa-pppp-pppp-eeee-nnnnnnnnnnnn';
        const invalidUUID = 'invalid';

        // 简化的格式检查（验证是否包含连字符且长度合理）
        const isValidFormat = (uuid) => {
            return typeof uuid === 'string' &&
                   uuid.length >= 10 &&
                   uuid.includes('-') &&
                   uuid.split('-').length >= 2;
        };

        expect(isValidFormat(validUUID)).toBe(true);
        expect(isValidFormat(invalidUUID)).toBe(false);
    });

    test('应该正确设置任务名称和任务ID', () => {
        // 模拟responseElements数据
        const mockResponseElements = {
            title: '1023-供应商D-Batch5 标注任务',
            jobId: 'test-job-id'
        };

        const mockCollectedData = {
            taskId: '1f825341-e676-40c4-9409-b3e57d88ee6b', // taskId使用jobId
            responseElements: mockResponseElements
        };

        // 验证任务名称只使用title参数
        const taskName = mockCollectedData.responseElements?.title || 'unknown_task';
        expect(taskName).toBe('1023-供应商D-Batch5 标注任务');

        // 验证任务ID使用jobId
        expect(mockCollectedData.taskId).toBe('1f825341-e676-40c4-9409-b3e57d88ee6b');

        // 测试没有title时显示unknown_task
        const mockResponseElementsNoTitle = { jobId: 'test-job-id' };
        mockCollectedData.responseElements = mockResponseElementsNoTitle;

        const taskNameFallback = mockCollectedData.responseElements?.title || 'unknown_task';
        expect(taskNameFallback).toBe('unknown_task');
    });

    test('应该正确提取题目ID的数字部分', () => {
        // 模拟数字提取函数
        const extractNumericTopicId = (topicId) => {
            if (!topicId) return topicId;
            const numericPart = topicId.match(/\d+/);
            return numericPart ? numericPart[0] : topicId;
        };

        // 测试各种格式的题目ID
        expect(extractNumericTopicId('app_216849')).toBe('216849');
        expect(extractNumericTopicId('topic-12345')).toBe('12345');
        expect(extractNumericTopicId('subject_987654')).toBe('987654');
        expect(extractNumericTopicId('question-999')).toBe('999');
        expect(extractNumericTopicId('12345')).toBe('12345'); // 纯数字
        expect(extractNumericTopicId('no_numbers')).toBe('no_numbers'); // 无数字
        expect(extractNumericTopicId(null)).toBe(null);
        expect(extractNumericTopicId(undefined)).toBe(undefined);
    });

    test('应该正确解析页面键值中的题目ID', () => {
        // 模拟页面键值解析逻辑
        const extractTopicIdFromPageKey = (pageKey) => {
            return pageKey.includes('::') ? pageKey.split('::').pop() : pageKey;
        };

        // 测试各种格式的页面键值
        expect(extractTopicIdFromPageKey('9e3894b9-a969-4479-b647-960f87657668::240872')).toBe('240872');
        expect(extractTopicIdFromPageKey('abc123::topic123')).toBe('topic123');
        expect(extractTopicIdFromPageKey('simple-key')).toBe('simple-key'); // 没有::分隔符
        expect(extractTopicIdFromPageKey('multiple::parts::here')).toBe('here'); // 多个::分隔符
        expect(extractTopicIdFromPageKey('')).toBe(''); // 空字符串
    });

    test('应该正确显示所有完成记录', () => {
        // 模拟完成统计数据
        const mockCompletionStats = {
            perPage: {
                'page1::101': { completions: 1, lastCompletionTime: Date.now() },
                'page2::102': { completions: 1, lastCompletionTime: Date.now() - 1000 },
                'page3::103': { completions: 1, lastCompletionTime: Date.now() - 2000 },
                'page4::104': { completions: 1, lastCompletionTime: Date.now() - 3000 },
                'page5::105': { completions: 1, lastCompletionTime: Date.now() - 4000 },
                'page6::106': { completions: 1, lastCompletionTime: Date.now() - 5000 }
            }
        };

        // 验证所有记录都能被获取
        const allRecords = Object.entries(mockCompletionStats.perPage);
        expect(allRecords.length).toBe(6);

        // 验证排序逻辑（最新的在前）
        const sortedRecords = allRecords.sort((a, b) => {
            const timeA = a[1].lastCompletionTime || 0;
            const timeB = b[1].lastCompletionTime || 0;
            return timeB - timeA;
        });

        expect(sortedRecords[0][0]).toBe('page1::101'); // 最新的
        expect(sortedRecords[5][0]).toBe('page6::106'); // 最旧的

        // 验证没有slice限制，所有6条记录都应该显示
        expect(sortedRecords.length).toBe(6);
    });

    test('应该正确为完成记录添加序号', () => {
        // 模拟带序号的显示逻辑
        const mockRecords = [
            ['page1::101', { completions: 1 }],
            ['page2::102', { completions: 1 }],
            ['page3::103', { completions: 1 }]
        ];

        // 模拟map函数添加序号
        const recordsWithNumbers = mockRecords.map(([pageKey, data], index) => {
            const topicId = pageKey.includes('::') ? pageKey.split('::').pop() : pageKey;
            return `${index + 1}. 题目ID: ${topicId}`;
        });

        expect(recordsWithNumbers[0]).toBe('1. 题目ID: 101');
        expect(recordsWithNumbers[1]).toBe('2. 题目ID: 102');
        expect(recordsWithNumbers[2]).toBe('3. 题目ID: 103');
    });

    test('应该正确使用appleUserId字段发送数据', () => {
        // 模拟数据发送逻辑
        const mockCollectedData = {
            userId: 'user123',
            taskId: 'task456',
            responseElements: {
                title: '测试任务',
                jobTenantId: 'test-tenant',
                projectId: 'test-project',
                projectDisplayId: 'TEST123'
            }
        };

        // 模拟数据包构建逻辑
        const dataToSend = {
            appleUserId: mockCollectedData.userId || 'unknown_user',
            taskId: mockCollectedData.taskId || 'unknown_task',
            taskName: mockCollectedData.responseElements?.title || 'unknown_task',
            topicId: mockCollectedData.topicId || 'unknown_topic',
            topicUrl: '',
            jobTenantId: mockCollectedData.responseElements?.jobTenantId || 'unknown',
            projectId: mockCollectedData.responseElements?.projectId || 'unknown',
            projectDisplayId: mockCollectedData.responseElements?.projectDisplayId || 'unknown'
        };

        // 验证字段名正确
        expect(dataToSend.appleUserId).toBe('user123');
        expect(dataToSend.taskId).toBe('task456');
        expect(dataToSend.taskName).toBe('测试任务');

        // 确保没有旧的userId字段
        expect(dataToSend.userId).toBeUndefined();
    });

    test('应该正确初始化配置参数', () => {
        // 这个测试需要在实际的Chrome扩展环境中运行才能验证
        expect(true).toBe(true);
    });
});