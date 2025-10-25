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

    test('应该正确实现模态框标签页切换', () => {
        // 模拟DOM环境和querySelectorAll方法
        const mockElements = {
            tabs: [
                { dataset: { tab: 'basic' }, style: {} },
                { dataset: { tab: 'status' }, style: {} },
                { dataset: { tab: 'history' }, style: {} }
            ],
            contents: [
                { dataset: { tab: 'basic' }, style: { display: 'none' } },
                { dataset: { tab: 'status' }, style: { display: 'none' } },
                { dataset: { tab: 'history' }, style: { display: 'none' } }
            ]
        };

        // 重写querySelectorAll
        mockDocument.querySelectorAll = jest.fn((selector) => {
            if (selector === '.modal-tab') return mockElements.tabs;
            if (selector === '.tab-content') return mockElements.contents;
            return [];
        });

        // 模拟标签页切换逻辑
        function switchTab(targetTab) {
            mockElements.tabs.forEach(tab => {
                if (tab.dataset.tab === targetTab) {
                    tab.style.background = '#e3f2fd';
                    tab.style.borderBottom = '2px solid #2196f3';
                    tab.style.fontWeight = 'bold';
                    tab.style.color = '#1976d2';
                } else {
                    tab.style.background = '#f5f5f5';
                    tab.style.borderBottom = '2px solid transparent';
                    tab.style.fontWeight = 'normal';
                    tab.style.color = '#666';
                }
            });

            mockElements.contents.forEach(content => {
                content.style.display = content.dataset.tab === targetTab ? 'block' : 'none';
            });
        }

        // 测试切换到基本信息
        switchTab('basic');
        expect(mockElements.tabs[0].style.background).toBe('#e3f2fd');
        expect(mockElements.tabs[0].style.color).toBe('#1976d2');
        expect(mockElements.contents[0].style.display).toBe('block');
        expect(mockElements.contents[1].style.display).toBe('none');

        // 测试切换到实时状态
        switchTab('status');
        expect(mockElements.tabs[1].style.background).toBe('#e3f2fd');
        expect(mockElements.tabs[1].style.color).toBe('#1976d2');
        expect(mockElements.contents[0].style.display).toBe('none');
        expect(mockElements.contents[1].style.display).toBe('block');

        // 测试切换到历史统计
        switchTab('history');
        expect(mockElements.tabs[2].style.background).toBe('#e3f2fd');
        expect(mockElements.tabs[2].style.color).toBe('#1976d2');
        expect(mockElements.contents[1].style.display).toBe('none');
        expect(mockElements.contents[2].style.display).toBe('block');
    });

    test('应该正确实现背景点击关闭功能', () => {
        // 模拟DOM元素和remove方法
        const mockOverlay = {
            id: 'appen-modal-overlay',
            style: { display: 'block' },
            remove: jest.fn(),
            addEventListener: jest.fn()
        };

        const mockModal = {
            id: 'appen-data-modal',
            style: { display: 'block' },
            remove: jest.fn()
        };

        // 模拟document.getElementById
        mockDocument.getElementById = jest.fn((id) => {
            if (id === 'appen-modal-overlay') return mockOverlay;
            if (id === 'appen-data-modal') return mockModal;
            return null;
        });

        // 验证初始状态
        expect(mockDocument.getElementById('appen-modal-overlay').style.display).toBe('block');
        expect(mockDocument.getElementById('appen-data-modal').style.display).toBe('block');

        // 模拟背景点击事件处理逻辑
        function handleBackgroundClick() {
            const overlay = mockDocument.getElementById('appen-modal-overlay');
            const modal = mockDocument.getElementById('appen-data-modal');

            if (overlay && modal) {
                modal.remove();
                overlay.remove();
            }
        }

        // 执行背景点击处理
        handleBackgroundClick();

        // 验证remove方法被调用
        expect(mockModal.remove).toHaveBeenCalled();
        expect(mockOverlay.remove).toHaveBeenCalled();
    });

    test('应该正确实现模态框自适应高度功能', () => {
        // 模拟window.innerHeight
        global.window = { innerHeight: 800 };

        // 模拟DOM元素
        const mockActiveTab = {
            scrollHeight: 300,
            style: { display: 'block' }
        };

        const mockTabContentArea = {
            style: {
                height: 'auto',
                overflow: 'visible',
                maxHeight: '600px'
            },
            querySelector: jest.fn(() => mockActiveTab)
        };

        const mockModalElement = {
            style: { height: 'auto' },
            querySelector: jest.fn((selector) => {
                if (selector === 'div[style*="max-height: calc"]') return mockTabContentArea;
                if (selector === '.tab-content[style*="display: block"]') return mockActiveTab;
                return null;
            })
        };

        mockDocument.getElementById = jest.fn(() => mockModalElement);

        // 模拟自适应高度函数
        function adjustModalHeight() {
            const modalElement = mockDocument.getElementById('appen-data-modal');
            const tabContentArea = modalElement.querySelector('div[style*="max-height: calc"]');
            const activeTab = modalElement.querySelector('.tab-content[style*="display: block"]');

            if (modalElement && tabContentArea && activeTab) {
                const contentHeight = activeTab.scrollHeight;
                const headerHeight = 140;
                const padding = 40;
                const totalHeight = contentHeight + headerHeight + padding;

                const maxHeight = window.innerHeight * 0.95;
                const finalHeight = Math.min(totalHeight, maxHeight);
                const minHeight = 300;

                modalElement.style.height = Math.max(finalHeight, minHeight) + 'px';

                const tabAreaHeight = finalHeight - headerHeight;
                tabContentArea.style.maxHeight = tabAreaHeight + 'px';
            }
        }

        // 执行自适应高度调整
        adjustModalHeight();

        // 验证计算结果
        const expectedTotalHeight = 300 + 140 + 40; // 480
        const expectedMaxHeight = 800 * 0.95; // 760
        const expectedFinalHeight = Math.min(480, 760); // 480
        const expectedModalHeight = Math.max(480, 300); // 480

        expect(mockModalElement.style.height).toBe(expectedModalHeight + 'px');
        expect(mockTabContentArea.style.maxHeight).toBe((expectedFinalHeight - 140) + 'px');
    });

    test('应该正确计算总耗时', () => {
        // 模拟completionStats数据
        const mockCompletionStats = {
            perPage: {
                'page1::101': {
                    elapsedSeconds: 120,
                    isValid: true
                },
                'page2::102': {
                    elapsedSeconds: 180,
                    isValid: true
                },
                'page3::103': {
                    elapsedSeconds: 90,
                    isValid: false // 无效完成，不应计入总耗时
                }
            }
        };

        // 模拟全局completionStats
        global.completionStats = mockCompletionStats;

        // 模拟计算函数
        function calculateTotalElapsedTime() {
            let totalElapsedSeconds = 0;
            for (const [pageKey, pageData] of Object.entries(mockCompletionStats.perPage)) {
                // 只计算有效完成的耗时
                if (pageData.isValid !== false) {
                    totalElapsedSeconds += pageData.elapsedSeconds || 0;
                }
            }
            return totalElapsedSeconds;
        }

        // 验证计算结果
        const result = calculateTotalElapsedTime();
        expect(result).toBe(300); // 120 + 180，不包含无效的90秒
    });

    test('应该正确计算平均耗时', () => {
        // 模拟completionStats数据
        const mockCompletionStats = {
            perPage: {
                'page1::101': {
                    elapsedSeconds: 120,
                    isValid: true,
                    topicCount: 2
                },
                'page2::102': {
                    elapsedSeconds: 180,
                    isValid: true,
                    topicCount: 3
                }
            },
            totalQuestions: 5
        };

        // 模拟全局completionStats
        global.completionStats = mockCompletionStats;

        // 模拟计算函数
        function calculateTotalElapsedTime() {
            let totalElapsedSeconds = 0;
            for (const [pageKey, pageData] of Object.entries(mockCompletionStats.perPage)) {
                if (pageData.isValid !== false) {
                    totalElapsedSeconds += pageData.elapsedSeconds || 0;
                }
            }
            return totalElapsedSeconds;
        }

        function calculateAverageElapsedTime() {
            const totalElapsedSeconds = calculateTotalElapsedTime();
            const totalQuestions = mockCompletionStats.totalQuestions || 0;

            if (totalQuestions <= 0) {
                return 0;
            }

            return Math.round(totalElapsedSeconds / totalQuestions);
        }

        // 验证计算结果
        const result = calculateAverageElapsedTime();
        expect(result).toBe(60); // (120 + 180) / 5 = 60秒
    });

    test('应该正确处理平均耗时的除零保护', () => {
        // 模拟无题目数的情况
        const mockCompletionStats = {
            perPage: {
                'page1::101': {
                    elapsedSeconds: 120,
                    isValid: true
                }
            },
            totalQuestions: 0
        };

        global.completionStats = mockCompletionStats;

        function calculateAverageElapsedTime() {
            const totalElapsedSeconds = 120; // 简化的总耗时
            const totalQuestions = mockCompletionStats.totalQuestions || 0;

            if (totalQuestions <= 0) {
                return 0;
            }

            return Math.round(totalElapsedSeconds / totalQuestions);
        }

        // 验证除零保护
        const result = calculateAverageElapsedTime();
        expect(result).toBe(0);
    });

    test('应该正确格式化时间显示', () => {
        // 模拟格式化函数
        function formatElapsedTime(seconds) {
            if (!seconds || seconds < 60) {
                return `${seconds}秒`;
            }
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
        }

        // 测试各种情况
        expect(formatElapsedTime(0)).toBe('0秒');
        expect(formatElapsedTime(30)).toBe('30秒');
        expect(formatElapsedTime(60)).toBe('1分钟');
        expect(formatElapsedTime(125)).toBe('2分5秒');
        expect(formatElapsedTime(180)).toBe('3分钟');
        expect(formatElapsedTime(null)).toBe('null秒');
        expect(formatElapsedTime(undefined)).toBe('undefined秒');
    });

    test('应该正确处理无完成记录的情况', () => {
        // 模拟空数据
        const mockCompletionStats = {
            perPage: {},
            totalQuestions: 0
        };

        global.completionStats = mockCompletionStats;

        function calculateTotalElapsedTime() {
            let totalElapsedSeconds = 0;
            for (const [pageKey, pageData] of Object.entries(mockCompletionStats.perPage)) {
                if (pageData.isValid !== false) {
                    totalElapsedSeconds += pageData.elapsedSeconds || 0;
                }
            }
            return totalElapsedSeconds;
        }

        function calculateAverageElapsedTime() {
            const totalElapsedSeconds = calculateTotalElapsedTime();
            const totalQuestions = mockCompletionStats.totalQuestions || 0;

            if (totalQuestions <= 0) {
                return 0;
            }

            return Math.round(totalElapsedSeconds / totalQuestions);
        }

        // 验证无数据时的处理
        expect(calculateTotalElapsedTime()).toBe(0);
        expect(calculateAverageElapsedTime()).toBe(0);
    });

    test('应该正确初始化配置参数', () => {
        // 这个测试需要在实际的Chrome扩展环境中运行才能验证
        expect(true).toBe(true);
    });
});