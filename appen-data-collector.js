// Appen数据收集器 - Content Script
// 专门用于收集https://ui.appen.com.cn/域名下的标注人员作业情况
// 实现即时收集模式，在标注完成时立即推送数据

(function() {
    'use strict';

    // 配置参数
    const CONFIG = {
        // 数据推送的API端点
        API_ENDPOINT: 'http://192.168.31.79:1145/api/Task/add',
        // 最大重试次数
        MAX_RETRY_ATTEMPTS: 3,
        // 重试间隔（毫秒）
        RETRY_DELAY: 5000,
        // 防抖延迟（毫秒），避免短时间内重复推送
        DEBOUNCE_DELAY: 2000
    };

    // 全局变量
    let collectedData = {
        userId: null,
        name: null,
        taskId: null,
        topicId: null,
        topicUrl: null,
        startTime: Date.now(),
        elapsedTime: 0,
        topicNum: 0
    };

    let isCollectorActive = true;
    let lastPushTime = 0;

    // 初始化数据收集器
    function initializeDataCollector() {
        console.log('[Appen Data Collector] 初始化即时数据收集器');

        // 获取用户信息
        collectUserInfo();

        // 获取任务信息
        collectTaskInfo();

        // 获取主题信息
        collectTopicInfo();

        // 开始监听页面活动
        attachEventListeners();

        // 页面卸载时推送数据
        window.addEventListener('beforeunload', pushDataOnSubmission);
    }

    // 收集用户信息
    function collectUserInfo() {
        try {
            // 尝试从页面元素或localStorage中获取用户ID和名称
            // 这需要根据实际页面结构调整选择器
            const userElement = document.querySelector('.user-info, .username, [data-user], #user');
            if (userElement) {
                const userText = userElement.textContent.trim();
                // 尝试从文本中提取用户ID和名称
                const userMatch = userText.match(/(\w+)\s*[-\s]*\s*(.+)/);
                if (userMatch) {
                    collectedData.userId = userMatch[1];
                    collectedData.name = userMatch[2];
                } else {
                    collectedData.userId = userText;
                    collectedData.name = userText;
                }
            }

            // 如果页面上没有找到，尝试从localStorage或其他存储中获取
            if (!collectedData.userId) {
                collectedData.userId = localStorage.getItem('userId') || 'unknown_user';
            }
            if (!collectedData.name) {
                collectedData.name = localStorage.getItem('userName') || '未知用户';
            }
        } catch (error) {
            console.warn('[Appen Data Collector] 无法收集用户信息:', error);
            collectedData.userId = 'unknown_user';
            collectedData.name = '未知用户';
        }
    }

    // 收集任务信息
    function collectTaskInfo() {
        try {
            // 尝试从页面URL或元素中获取任务ID
            const urlParams = new URLSearchParams(window.location.search);
            collectedData.taskId = urlParams.get('task_id') ||
                                 urlParams.get('taskId') ||
                                 extractTaskIdFromURL();

            // 尝试从页面元素获取任务相关信息
            const taskElement = document.querySelector('.task-info, [data-task], #task');
            if (taskElement) {
                const taskText = taskElement.textContent.trim();
                // 如果没有从URL中获取到taskId，则尝试从页面文本中提取
                if (!collectedData.taskId || collectedData.taskId === 'unknown_task') {
                    const taskMatch = taskText.match(/task[_\-]?(\w+)/i);
                    if (taskMatch) {
                        collectedData.taskId = taskMatch[1];
                    }
                }
            }
        } catch (error) {
            console.warn('[Appen Data Collector] 无法收集任务信息:', error);
        }

        // 确保taskId有默认值
        if (!collectedData.taskId) {
            collectedData.taskId = 'unknown_task';
        }
    }

    // 收集主题信息
    function collectTopicInfo() {
        try {
            // 尝试从页面URL获取主题ID和URL
            collectedData.topicUrl = window.location.href;

            // 从URL中提取主题ID
            const url = new URL(collectedData.topicUrl);
            collectedData.topicId = url.searchParams.get('topic_id') ||
                                  url.searchParams.get('topicId') ||
                                  extractTopicIdFromURL() ||
                                  'unknown_topic';

            // 尝试获取主题数量
            const topicElements = document.querySelectorAll('.topic, .question, .item');
            collectedData.topicNum = topicElements.length || 0;
        } catch (error) {
            console.warn('[Appen Data Collector] 无法收集主题信息:', error);
            collectedData.topicId = 'unknown_topic';
            collectedData.topicUrl = window.location.href;
            collectedData.topicNum = 0;
        }
    }

    // 从URL中提取任务ID
    function extractTaskIdFromURL() {
        const url = window.location.href;
        // 根据实际URL结构调整正则表达式
        const taskIdMatch = url.match(/task[_\-]([a-zA-Z0-9]+)/) ||
                           url.match(/id=([a-zA-Z0-9]+)/) ||
                           url.match(/\/([a-zA-Z0-9]+)$/);
        return taskIdMatch ? taskIdMatch[1] : null;
    }

    // 从URL中提取主题ID
    function extractTopicIdFromURL() {
        const url = window.location.href;
        // 根据实际URL结构调整正则表达式
        const topicIdMatch = url.match(/topic[_\-]([a-zA-Z0-9]+)/) ||
                            url.match(/subject[_\-]([a-zA-Z0-9]+)/) ||
                            url.match(/question[_\-]([a-zA-Z0-9]+)/);
        return topicIdMatch ? topicIdMatch[1] : null;
    }

    // 附加事件监听器
    function attachEventListeners() {
        // 监听鼠标点击事件
        document.addEventListener('click', function(event) {
            // 检查是否点击了提交按钮
            checkForSubmission(event.target);
        });

        // 监听表单提交事件
        document.addEventListener('submit', function(event) {
            // 延迟推送数据，确保表单提交完成
            setTimeout(pushDataOnSubmission, 100);
        });

        // 特别监听可能的提交按钮
        observeSubmissionButtons();
    }

    // 检查是否点击了提交按钮
    function checkForSubmission(element) {
        // 检查元素是否为提交按钮
        const submitButtonSelectors = [
            '提交并继续标注', '提交', 'Submit', '继续标注', 'Continue',
            '[type="submit"]', '.submit', '#submit', '.btn-submit'
        ];

        const buttonText = element.textContent || element.value || '';
        const isSubmitButton = submitButtonSelectors.some(selector => {
            if (selector.startsWith('[') || selector.startsWith('.') || selector.startsWith('#')) {
                // CSS选择器
                return element.matches && element.matches(selector);
            } else {
                // 文本匹配
                return buttonText.includes(selector);
            }
        });

        if (isSubmitButton) {
            console.log('[Appen Data Collector] 检测到提交按钮点击');
            // 延迟推送数据，确保提交操作完成
            setTimeout(pushDataOnSubmission, 300);
        }
    }

    // 观察可能的提交按钮
    function observeSubmissionButtons() {
        // 使用MutationObserver观察DOM变化
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 检查新添加的元素是否为提交按钮
                            checkForSubmission(node);

                            // 检查新添加元素的子元素
                            const buttons = node.querySelectorAll && node.querySelectorAll('button, [type="submit"]');
                            if (buttons) {
                                buttons.forEach(checkForSubmission);
                            }
                        }
                    });
                }
            });
        });

        // 开始观察
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 在标注完成时推送数据
    function pushDataOnSubmission() {
        console.log('[Appen Data Collector] 标注完成，准备推送数据');

        // 防抖处理，避免短时间内重复推送
        const now = Date.now();
        if (now - lastPushTime < CONFIG.DEBOUNCE_DELAY) {
            console.log('[Appen Data Collector] 防抖处理，取消本次推送');
            return;
        }

        lastPushTime = now;
        pushData();
    }

    // 推送数据到服务器
    async function pushData() {
        if (!isCollectorActive) return;

        // 更新耗时
        collectedData.elapsedTime = Math.floor((Date.now() - collectedData.startTime) / 1000);

        // 构造符合API要求的数据
        const dataToSend = {
            UserId: collectedData.userId || 'unknown_user',
            Name: collectedData.name || '未知用户',
            TaskId: collectedData.taskId || 'unknown_task',
            TopicId: collectedData.topicId || 'unknown_topic',
            TopicUrl: collectedData.topicUrl || window.location.href,
            IsValid: true,  // 默认为有效
            IsRedo: false,  // 默认为非重做
            ElapsedTime: collectedData.elapsedTime || 0,
            IsReplace: false,  // 默认为非替换
            TopicNum: collectedData.topicNum || 0
        };

        console.log('[Appen Data Collector] 准备推送数据:', dataToSend);

        let attempts = 0;
        while (attempts < CONFIG.MAX_RETRY_ATTEMPTS) {
            try {
                const response = await fetch(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dataToSend)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('[Appen Data Collector] 数据推送成功:', result);
                    return;
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                attempts++;
                console.warn(`[Appen Data Collector] 数据推送失败 (尝试 ${attempts}/${CONFIG.MAX_RETRY_ATTEMPTS}):`, error);

                if (attempts < CONFIG.MAX_RETRY_ATTEMPTS) {
                    // 等待后重试
                    await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
                }
            }
        }

        console.error('[Appen Data Collector] 数据推送最终失败，已达到最大重试次数');
    }

    // 停止数据收集
    function stopDataCollection() {
        isCollectorActive = false;
        // 最后推送一次数据
        pushDataOnSubmission();
    }

    // 公共接口
    window.AppenDataCollector = {
        // 手动推送数据
        pushData: pushDataOnSubmission,
        // 停止数据收集
        stop: stopDataCollection,
        // 获取当前收集的数据
        getData: function() {
            return {
                ...collectedData,
                elapsedTime: Math.floor((Date.now() - collectedData.startTime) / 1000)
            };
        },
        // 重置收集器
        reset: function() {
            collectedData = {
                userId: collectedData.userId,
                name: collectedData.name,
                taskId: null,
                topicId: null,
                topicUrl: null,
                startTime: Date.now(),
                elapsedTime: 0,
                topicNum: 0
            };

            // 重新收集任务和主题信息
            collectTaskInfo();
            collectTopicInfo();
        },
        // 手动触发标注完成推送
        submitAnnotation: pushDataOnSubmission
    };

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDataCollector);
    } else {
        initializeDataCollector();
    }

})();