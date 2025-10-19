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

        // 等待账户元素加载，然后获取用户信息
        waitForAccountElement();

        // 获取任务信息
        collectTaskInfo();

        // 获取主题信息
        collectTopicInfo();

        // 开始监听页面活动
        attachEventListeners();

        // 页面卸载时推送数据
        window.addEventListener('beforeunload', pushDataOnSubmission);
    }

    // 收集用户信息（完全复制验证过的脚本逻辑）
    function collectUserInfo() {
        try {
            console.log('[Appen Data Collector] 开始收集用户信息...');

            // 找到账户元素
            const accountElement = document.querySelector('.ant-dropdown-trigger.antd-pro-components-global-header-index-action.antd-pro-components-global-header-index-account');

            if (accountElement) {
                console.log('[Appen Data Collector] ✓ 找到账户元素');
                
                // 完全按照验证过的脚本逻辑来
                // 获取完整HTML
                const innerHTML = accountElement.innerHTML;
                const textContent = accountElement.textContent.trim();
                
                console.log('[Appen Data Collector] 完整HTML:', innerHTML.substring(0, 200));
                console.log('[Appen Data Collector] 完整文本:', textContent);
                
                // 获取所有子元素
                const children = accountElement.children;
                console.log('[Appen Data Collector] 子元素数量:', children.length);
                
                Array.from(children).forEach((child, index) => {
                    console.log(`[Appen Data Collector] [${index}] ${child.tagName} - Class: ${child.className}`);
                    console.log(`       文本: ${child.textContent.trim().substring(0, 50)}`);
                });
                
                // 查找所有span元素
                console.log('[Appen Data Collector] 所有span元素:');
                const spans = accountElement.querySelectorAll('span');
                
                for (let i = 0; i < spans.length; i++) {
                    const spanText = spans[i].textContent.trim();
                    console.log(`[Appen Data Collector] span[${i}]: "${spanText}" - Class: ${spans[i].className}`);
                    
                    // 如果这个span看起来像用户ID（不是图标，不是"Appen"，不是"/"）
                    if (spanText && 
                        spanText !== 'Appen' && 
                        spanText !== '/' && 
                        spanText.match(/^[a-zA-Z0-9_-]{5,30}$/) &&
                        !spans[i].className.includes('anticon') &&
                        !spans[i].className.includes('avatar')) {
                        
                        console.log(`[Appen Data Collector] ✓ 找到用户ID: ${spanText}`);
                        collectedData.userId = spanText;
                        collectedData.name = spanText;
                        return;
                    }
                }
                
                console.log('[Appen Data Collector] ✗ 在span中未找到用户ID');
            } else {
                console.log('[Appen Data Collector] ✗ 未找到账户元素');
            }

            // 备选方案：使用默认值
            collectedData.userId = 'unknown_user';
            collectedData.name = '未知用户';
            console.warn('[Appen Data Collector] 使用默认值');
            
        } catch (error) {
            console.warn('[Appen Data Collector] 无法收集用户信息:', error);
            console.error(error);
            collectedData.userId = 'unknown_user';
            collectedData.name = '未知用户';
        }
    }

    // 等待账户元素加载完成，然后重新收集用户信息
    function waitForAccountElement() {
        const maxAttempts = 20;  // 最多尝试20次
        let attempts = 0;

        const checkInterval = setInterval(() => {
            attempts++;
            const accountElement = document.querySelector('.ant-dropdown-trigger.antd-pro-components-global-header-index-action');
            
            if (accountElement && accountElement.textContent.includes('/')) {
                console.log(`[Appen Data Collector] ✓ 账户元素已加载 (第${attempts}次尝试)`);
                clearInterval(checkInterval);
                
                // 重新收集用户信息
                collectUserInfo();
            } else {
                console.log(`[Appen Data Collector] 等待账户元素加载... (${attempts}/${maxAttempts})`);
                
                if (attempts >= maxAttempts) {
                    console.warn('[Appen Data Collector] 账户元素加载超时');
                    clearInterval(checkInterval);
                }
            }
        }, 500);  // 每500ms检查一次
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

        // 监听键盘事件 - i键显示数据
        document.addEventListener('keydown', function(event) {
            if (event.key === 'i' || event.key === 'I') {
                event.preventDefault();
                showDataModal();
            }
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

        // 构造符合API要求的数据（使用camelCase）
        const dataToSend = {
            userId: collectedData.userId || 'unknown_user',
            name: collectedData.name || '未知用户',
            taskId: collectedData.taskId || 'unknown_task',
            topicId: collectedData.topicId || 'unknown_topic',
            topicUrl: collectedData.topicUrl || window.location.href,
            isValid: true,
            isRedo: false,
            updateTime: new Date().toISOString(),
            elapsedTime: collectedData.elapsedTime || 0,
            isReplace: false,
            topicNum: collectedData.topicNum || 0
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

    // 创建并显示数据展示模态窗口
    function showDataModal() {
        // 如果已有模态窗口则关闭
        const existingModal = document.getElementById('appen-data-modal');
        if (existingModal) {
            existingModal.remove();
            return;
        }

        // 计算当前耗时
        const currentElapsedTime = Math.floor((Date.now() - collectedData.startTime) / 1000);

        // 创建模态容器
        const modal = document.createElement('div');
        modal.id = 'appen-data-modal';
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #333;
                border-radius: 8px;
                padding: 20px;
                z-index: 99999;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                font-family: Arial, sans-serif;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #ddd;
                    padding-bottom: 10px;
                ">
                    <h2 style="margin: 0; font-size: 18px; color: #333;">Appen数据收集信息</h2>
                    <button id="close-modal-btn" style="
                        background: #ff4444;
                        color: white;
                        border: none;
                        padding: 8px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">关闭</button>
                </div>
                
                <div style="
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 4px;
                    line-height: 1.8;
                    font-size: 14px;
                ">
                    <div><strong style="color: #333;">用户ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.userId || 'N/A')}</span></div>
                    <div><strong style="color: #333;">用户名:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.name || 'N/A')}</span></div>
                    <div><strong style="color: #333;">任务ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.taskId || 'N/A')}</span></div>
                    <div><strong style="color: #333;">题目ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.topicId || 'N/A')}</span></div>
                    <div><strong style="color: #333;">题目URL:</strong> <span style="color: #0066cc; word-break: break-all;">${escapeHtml(collectedData.topicUrl || 'N/A')}</span></div>
                    <div><strong style="color: #333;">题目数量:</strong> <span style="color: #0066cc;">${collectedData.topicNum || 0}</span></div>
                    <div><strong style="color: #333;">耗时(秒):</strong> <span style="color: #0066cc;">${currentElapsedTime}</span></div>
                </div>

                <div style="
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                ">
                    <button id="copy-data-btn" style="
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">复制数据</button>
                    <button id="push-data-btn" style="
                        background: #2196F3;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">推送数据</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 关闭按钮事件
        document.getElementById('close-modal-btn').addEventListener('click', function() {
            modal.remove();
        });

        // 复制数据按钮事件
        document.getElementById('copy-data-btn').addEventListener('click', function() {
            const dataToSend = {
                userId: collectedData.userId || 'unknown_user',
                name: collectedData.name || '未知用户',
                taskId: collectedData.taskId || 'unknown_task',
                topicId: collectedData.topicId || 'unknown_topic',
                topicUrl: collectedData.topicUrl || window.location.href,
                isValid: true,
                isRedo: false,
                updateTime: new Date().toISOString(),
                elapsedTime: currentElapsedTime,
                isReplace: false,
                topicNum: collectedData.topicNum || 0
            };

            const jsonString = JSON.stringify(dataToSend, null, 2);
            navigator.clipboard.writeText(jsonString).then(() => {
                alert('数据已复制到剪贴板！');
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动复制');
            });
        });

        // 推送数据按钮事件
        document.getElementById('push-data-btn').addEventListener('click', function() {
            pushDataOnSubmission();
            alert('数据推送请求已发送，请检查控制台日志');
        });

        console.log('[Appen Data Collector] 数据展示模态窗口已显示，按i键关闭');
    }

    // HTML转义函数，防止XSS
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.toString().replace(/[&<>"']/g, m => map[m]);
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