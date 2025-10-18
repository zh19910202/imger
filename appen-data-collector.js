// Appen数据收集器 - Content Script
// 专门用于收集https://ui.appen.com.cn/域名下的标注人员作业情况
// 实现即时收集模式，在标注完成时立即推送数据

(function() {
    'use strict';

    // 配置参数
    const CONFIG = {
        // 数据推送的API端点（需要替换为实际的API地址）
        API_ENDPOINT: 'https://your-api-endpoint.com/annotation-data',
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
        taskId: null,
        projectName: null,
        currentPage: window.location.href,
        startTime: Date.now(),
        lastActivityTime: Date.now(),
        actions: [],
        sessionDuration: 0
    };

    let isCollectorActive = true;
    let lastPushTime = 0;
    let pushTimeoutId = null;

    // 初始化数据收集器
    function initializeDataCollector() {
        console.log('[Appen Data Collector] 初始化即时数据收集器');

        // 获取用户ID
        collectUserId();

        // 获取任务ID和项目名称
        collectTaskInfo();

        // 开始监听页面活动
        attachEventListeners();

        // 页面卸载时推送数据
        window.addEventListener('beforeunload', pushData);
    }

    // 收集用户ID
    function collectUserId() {
        try {
            // 尝试从页面元素或localStorage中获取用户ID
            // 这需要根据实际页面结构调整选择器
            const userElement = document.querySelector('.user-id, [data-user-id], #user-id');
            if (userElement) {
                collectedData.userId = userElement.textContent.trim() ||
                                     userElement.dataset.userId ||
                                     userElement.id;
            }

            // 如果页面上没有找到，尝试从localStorage或其他存储中获取
            if (!collectedData.userId) {
                collectedData.userId = localStorage.getItem('userId') ||
                                     sessionStorage.getItem('userId') ||
                                     'unknown_user';
            }
        } catch (error) {
            console.warn('[Appen Data Collector] 无法收集用户ID:', error);
            collectedData.userId = 'unknown_user';
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

            // 尝试获取项目名称
            const projectElement = document.querySelector('.project-name, [data-project], #project');
            if (projectElement) {
                collectedData.projectName = projectElement.textContent.trim() ||
                                          projectElement.dataset.project ||
                                          projectElement.id;
            }
        } catch (error) {
            console.warn('[Appen Data Collector] 无法收集任务信息:', error);
        }
    }

    // 从URL中提取任务ID
    function extractTaskIdFromURL() {
        const url = window.location.href;
        // 根据实际URL结构调整正则表达式
        const taskIdMatch = url.match(/task[_\-]([a-zA-Z0-9]+)/) ||
                           url.match(/id=([a-zA-Z0-9]+)/) ||
                           url.match(/\/([a-zA-Z0-9]+)$/);
        return taskIdMatch ? taskIdMatch[1] : 'unknown_task';
    }

    // 附加事件监听器
    function attachEventListeners() {
        // 监听键盘事件
        document.addEventListener('keydown', function(event) {
            recordAction('keydown', {
                key: event.key,
                keyCode: event.keyCode,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                shiftKey: event.shiftKey
            });
        });

        // 监听鼠标点击事件
        document.addEventListener('click', function(event) {
            recordAction('click', {
                target: event.target.tagName,
                className: event.target.className,
                id: event.target.id,
                x: event.clientX,
                y: event.clientY
            });

            // 检查是否点击了提交按钮
            checkForSubmission(event.target);
        });

        // 监听表单提交事件
        document.addEventListener('submit', function(event) {
            recordAction('submit', {
                formId: event.target.id,
                formClass: event.target.className
            });

            // 延迟推送数据，确保表单提交完成
            setTimeout(pushDataOnSubmission, 100);
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', function() {
            recordAction('visibilityChange', {
                hidden: document.hidden
            });
        });

        // 定期更新会话时长
        setInterval(updateSessionDuration, 1000);

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

    // 记录用户操作
    function recordAction(actionType, details) {
        if (!isCollectorActive) return;

        const action = {
            type: actionType,
            timestamp: Date.now(),
            details: details
        };

        collectedData.actions.push(action);
        collectedData.lastActivityTime = Date.now();

        // 限制操作记录数量，避免内存占用过大
        if (collectedData.actions.length > 1000) {
            collectedData.actions = collectedData.actions.slice(-500);
        }
    }

    // 更新会话时长
    function updateSessionDuration() {
        collectedData.sessionDuration = Date.now() - collectedData.startTime;
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

        // 检查是否有需要推送的数据
        if (collectedData.actions.length === 0) {
            console.log('[Appen Data Collector] 没有操作数据需要推送');
            return;
        }

        updateSessionDuration();

        const dataToSend = {
            ...collectedData,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            screenSize: {
                width: screen.width,
                height: screen.height
            }
        };

        // 添加标注完成标记
        dataToSend.annotationCompleted = true;

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
                    console.log('[Appen Data Collector] 数据推送成功');
                    // 清空已推送的操作记录
                    collectedData.actions = [];
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
        pushData();
    }

    // 公共接口
    window.AppenDataCollector = {
        // 手动推送数据
        pushData: pushData,
        // 停止数据收集
        stop: stopDataCollection,
        // 获取当前收集的数据
        getData: function() {
            return {...collectedData, sessionDuration: Date.now() - collectedData.startTime};
        },
        // 重置收集器
        reset: function() {
            collectedData = {
                userId: collectedData.userId,
                taskId: collectedData.taskId,
                projectName: collectedData.projectName,
                currentPage: window.location.href,
                startTime: Date.now(),
                lastActivityTime: Date.now(),
                actions: [],
                sessionDuration: 0
            };
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