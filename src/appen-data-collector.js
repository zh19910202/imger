// Appen数据收集器 - Content Script
// 专门用于收集https://ui.appen.com.cn/域名下的标注人员作业情况
// 实现即时收集模式，在标注完成时立即推送数据

(function() {
    'use strict';

    // 配置参数
    const CONFIG = {
        // 数据推送的API端点
        API_ENDPOINT: 'http://192.168.31.79:1145/api/Task/add',
        // 认证信息同步的API端点
        AUTH_SYNC_ENDPOINT: 'http://192.168.31.79:1145/api/Task/apple/sync',
        // 最大重试次数
        MAX_RETRY_ATTEMPTS: 3,
        // 重试间隔（毫秒）
        RETRY_DELAY: 5000,
        // 防抖延迟（毫秒），避免短时间内重复推送
        DEBOUNCE_DELAY: 2000,
        // 特定URL模式匹配
        TARGET_URL_PATTERN: /^https:\/\/ui\.appen\.com\.cn\/ssr\/v3\/annotation-task-start\?.*$/,
        // 计时最大时长（毫秒）- 1小时
        MAX_ELAPSED_TIME: 3600000
    };

    const COMPLETION_STORAGE_KEY = 'appen_completion_stats';

    let completionStats = {
        totalValidCompletions: 0,
        perPage: {}
    };

    // 全局变量
    let collectedData = {
        userId: null,
        taskId: null,
        topicId: null,
        topicUrl: null,
        startTime: Date.now(),
        elapsedTime: 0,
        topicNum: 0,
        totalValidCompletions: 0,
        pageCompletionCounts: {}
    };

    // 用于跟踪上一个任务ID以检测任务变化
    let lastTaskId = null;
    // 用于跟踪上一个题目ID以检测标注页面变化
    let lastTopicId = null;

    let isCollectorActive = true;
    let lastPushTime = 0;

    // 添加用于缓存指定元素 ID 的变量
    let lastSpecifiedElementId = null;
    let currentPageUrl = null;
    let specifiedElementIdAsTopicId = null; // 用于存储指定元素 ID 作为题目 ID

    // 从缓存获取任务开始时间
    async function getCachedStartTime() {
        return new Promise((resolve) => {
            try {
                if (!chrome || !chrome.storage) {
                    console.warn('[Appen Data Collector] chrome.storage 不可用');
                    resolve(null);
                    return;
                }
                chrome.storage.local.get(['appen_task_start_time'], (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Appen Data Collector] 获取缓存出错:', chrome.runtime.lastError);
                        resolve(null);
                        return;
                    }
                    if (result && result.appen_task_start_time) {
                        console.log('[Appen Data Collector] 从缓存读取任务开始时间');
                        resolve(result.appen_task_start_time);
                    } else {
                        resolve(null);
                    }
                });
            } catch (error) {
                console.warn('[Appen Data Collector] 从缓存获取开始时间失败:', error);
                resolve(null);
            }
        });
    }

    // 保存任务开始时间到缓存
    async function saveCachedStartTime(startTime) {
        try {
            return new Promise((resolve) => {
                if (!chrome || !chrome.storage) {
                    console.warn('[Appen Data Collector] chrome.storage 不可用');
                    resolve(false);
                    return;
                }
                chrome.storage.local.set({ appen_task_start_time: startTime }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Appen Data Collector] 保存开始时间失败:', chrome.runtime.lastError);
                        resolve(false);
                    } else {
                        console.log('[Appen Data Collector] 任务开始时间已保存:', startTime);
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.warn('[Appen Data Collector] 保存开始时间异常:', error);
            return Promise.resolve(false);
        }
    }

    // 清除缓存的开始时间
    async function clearCachedStartTime() {
        return new Promise((resolve) => {
            try {
                if (!chrome || !chrome.storage) {
                    console.warn('[Appen Data Collector] chrome.storage 不可用');
                    resolve(false);
                    return;
                }
                chrome.storage.local.remove(['appen_task_start_time'], () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Appen Data Collector] 清除缓存出错:', chrome.runtime.lastError);
                        resolve(false);
                    } else {
                        console.log('[Appen Data Collector] 任务开始时间已清除');
                        resolve(true);
                    }
                });
            } catch (error) {
                console.warn('[Appen Data Collector] 清除开始时间失败:', error);
                resolve(false);
            }
        });
    }

    function syncCollectedDataWithCompletionStats() {
        collectedData.totalValidCompletions = completionStats.totalValidCompletions || 0;
        collectedData.pageCompletionCounts = { ...completionStats.perPage };
    }

    async function loadCompletionStats() {
        if (!chrome || !chrome.storage) {
            syncCollectedDataWithCompletionStats();
            return;
        }

        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([COMPLETION_STORAGE_KEY], (result) => {
                    if (chrome.runtime && chrome.runtime.lastError) {
                        console.warn('[Appen Data Collector] 读取标注完成统计失败:', chrome.runtime.lastError);
                        syncCollectedDataWithCompletionStats();
                        resolve(false);
                        return;
                    }

                    const stored = result && result[COMPLETION_STORAGE_KEY];
                    if (stored && typeof stored === 'object') {
                        completionStats = {
                            totalValidCompletions: Number(stored.totalValidCompletions) || 0,
                            perPage: stored.perPage && typeof stored.perPage === 'object' ? stored.perPage : {}
                        };
                    }

                    syncCollectedDataWithCompletionStats();
                    resolve(true);
                });
            } catch (error) {
                console.warn('[Appen Data Collector] 加载标注完成统计异常:', error);
                syncCollectedDataWithCompletionStats();
                resolve(false);
            }
        });
    }

    function saveCompletionStats() {
        syncCollectedDataWithCompletionStats();

        if (!chrome || !chrome.storage) {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({ [COMPLETION_STORAGE_KEY]: completionStats }, () => {
                    if (chrome.runtime && chrome.runtime.lastError) {
                        console.warn('[Appen Data Collector] 保存标注完成统计失败:', chrome.runtime.lastError);
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
            } catch (error) {
                console.warn('[Appen Data Collector] 保存标注完成统计异常:', error);
                resolve(false);
            }
        });
    }

    function getCurrentPageKey() {
        if (collectedData.topicId && collectedData.topicId !== 'unknown_topic') {
            return `${collectedData.taskId || 'unknown_task'}::${collectedData.topicId}`;
        }
        return collectedData.topicUrl || window.location.href || 'unknown_page';
    }

    function getTopicCountForRecording() {
        const statusTopicCount = collectedData.responseElements?.userSelectionStatus?.topicCount;
        if (typeof statusTopicCount === 'number' && !Number.isNaN(statusTopicCount)) {
            return statusTopicCount;
        }
        if (typeof collectedData.topicNum === 'number' && !Number.isNaN(collectedData.topicNum)) {
            return collectedData.topicNum;
        }
        return 0;
    }

    async function recordValidCompletion() {
        try {
            const pageKey = getCurrentPageKey();
            const topicCount = getTopicCountForRecording();

            if (!completionStats.perPage[pageKey]) {
                completionStats.perPage[pageKey] = {
                    completions: 0,
                    topicCount: topicCount
                };
            }

            completionStats.perPage[pageKey].completions += 1;
            completionStats.perPage[pageKey].topicCount = topicCount;
            completionStats.totalValidCompletions += 1;

            syncCollectedDataWithCompletionStats();

            await saveCompletionStats();

            console.log('[Appen Data Collector] 已记录有效标注完成:', {
                pageKey,
                totalValidCompletions: completionStats.totalValidCompletions,
                perPage: completionStats.perPage[pageKey]
            });
        } catch (error) {
            console.warn('[Appen Data Collector] 记录标注完成统计异常:', error);
        }
    }

    // 从缓存获取题目ID
    async function getCachedTopicId() {
        return new Promise((resolve) => {
            try {
                if (!chrome || !chrome.storage) {
                    console.warn('[Appen Data Collector] chrome.storage 不可用');
                    resolve(null);
                    return;
                }
                chrome.storage.local.get(['appen_last_topic_id'], (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Appen Data Collector] 获取缓存出错:', chrome.runtime.lastError);
                        resolve(null);
                        return;
                    }
                    if (result && result.appen_last_topic_id) {
                        console.log('[Appen Data Collector] 从缓存读取题目ID:', result.appen_last_topic_id);
                        resolve(result.appen_last_topic_id);
                    } else {
                        resolve(null);
                    }
                });
            } catch (error) {
                console.warn('[Appen Data Collector] 从缓存获取题目ID失败:', error);
                resolve(null);
            }
        });
    }

    // 保存题目ID到缓存
    async function saveCachedTopicId(topicId) {
        try {
            return new Promise((resolve) => {
                if (!chrome || !chrome.storage) {
                    console.warn('[Appen Data Collector] chrome.storage 不可用');
                    resolve(false);
                    return;
                }
                chrome.storage.local.set({ appen_last_topic_id: topicId }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Appen Data Collector] 保存题目ID失败:', chrome.runtime.lastError);
                        resolve(false);
                    } else {
                        console.log('[Appen Data Collector] 题目ID已保存到缓存:', topicId);
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.warn('[Appen Data Collector] 保存题目ID异常:', error);
            return Promise.resolve(false);
        }
    }

    // 从缓存获取用户ID
    async function getCachedUserId() {
        return new Promise((resolve) => {
            try {
                if (!chrome || !chrome.storage) {
                    console.warn('[Appen Data Collector] chrome.storage 不可用');
                    resolve(null);
                    return;
                }
                chrome.storage.local.get(['appen_user_id'], (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Appen Data Collector] 获取缓存出错:', chrome.runtime.lastError);
                        resolve(null);
                        return;
                    }
                    if (result && result.appen_user_id) {
                        console.log('[Appen Data Collector] 从缓存读取用户ID:', result.appen_user_id);
                        resolve(result.appen_user_id);
                    } else {
                        resolve(null);
                    }
                });
            } catch (error) {
                console.warn('[Appen Data Collector] 从缓存获取用户ID失败:', error);
                resolve(null);
            }
        });
    }

    // 保存用户ID到缓存
    async function saveCachedUserId(userId) {
        try {
            return new Promise((resolve) => {
                if (!chrome || !chrome.storage) {
                    console.warn('[Appen Data Collector] chrome.storage 不可用');
                    resolve(false);
                    return;
                }
                chrome.storage.local.set({ appen_user_id: userId }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Appen Data Collector] 保存用户ID失败:', chrome.runtime.lastError);
                        resolve(false);
                    } else {
                        console.log('[Appen Data Collector] 用户ID已保存到缓存:', userId);
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.warn('[Appen Data Collector] 保存用户ID异常:', error);
            return Promise.resolve(false);
        }
    }

    // 检查是否为欢迎页面（用于提取和保存用户ID）
    function isWelcomePage() {
        const currentUrl = window.location.href;
        return currentUrl.includes('ui.appen.com.cn/welcome');
    }

    // 初始化数据收集器
    async function initializeDataCollector() {
        console.log('[Appen Data Collector] 初始化即时数据收集器');

        await loadCompletionStats();

        // 检查是否为欢迎页面
        if (isWelcomePage()) {
            console.log('[Appen Data Collector] welcome页面，从页面提取用户ID并保存到缓存');
            waitForAccountElement();
        } else {
            // 其他页面，只从缓存读取用户ID
            console.log('[Appen Data Collector] 非welcome页面，从缓存读取用户ID');
            const cachedUserId = await getCachedUserId();
            if (cachedUserId) {
                console.log('[Appen Data Collector] 从缓存读取用户ID:', cachedUserId);
                collectedData.userId = cachedUserId;
            } else {
                console.log('[Appen Data Collector] 缓存中无用户ID');
                collectedData.userId = 'unknown_user';
            }
        }

        // 如果是标注页面，检查题目ID并初始化
        if (isTargetPage()) {
            console.log('[Appen Data Collector] 检测到目标页面，开始初始化');

            // 从缓存恢复上一个题目ID
            const cachedTopicId = await getCachedTopicId();
            console.log('[Appen Data Collector] ========== 初始化 - 从缓存恢复题目ID ==========');
            console.log('[Appen Data Collector] 缓存的题目ID:', cachedTopicId);
            if (cachedTopicId) {
                console.log('[Appen Data Collector] 从缓存恢复题目ID:', cachedTopicId);
                lastTopicId = cachedTopicId;
                console.log('[Appen Data Collector] lastTopicId 已设置为:', lastTopicId);
            } else {
                console.log('[Appen Data Collector] 缓存中无题目ID（首次加载或缓存已清除）');
            }

            // 获取当前题目ID
            setTimeout(async () => {
                const currentTopicId = getSpecifiedElementId(false);
                console.log('[Appen Data Collector] ========== 初始化 - 获取当前题目ID ==========');
                console.log('[Appen Data Collector] 获取当前题目ID:', currentTopicId);
                console.log('[Appen Data Collector] 上一个题目ID(lastTopicId):', lastTopicId);
                
                // 比较题目ID，判断是否进入新的标注页
                if (lastTopicId !== currentTopicId) {
                    console.log('[Appen Data Collector] ⚠️ 题目ID变化，进入新的标注页');
                    console.log('[Appen Data Collector] 旧ID:', lastTopicId, '新ID:', currentTopicId);
                    console.log('[Appen Data Collector] 比较结果: lastTopicId(' + lastTopicId + ') !== currentTopicId(' + currentTopicId + ')');
                    
                    // 重置计时器
                    const newStartTime = Date.now();
                    collectedData.startTime = newStartTime;
                    console.log('[Appen Data Collector] 重置计时器，新的开始时间:', new Date(newStartTime).toISOString());
                    
                    // 保存新的开始时间到缓存
                    await saveCachedStartTime(newStartTime);
                    console.log('[Appen Data Collector] 新的开始时间已保存到缓存');
                } else {
                    console.log('[Appen Data Collector] ✓ 题目ID相同，继续使用当前计时，从缓存读取开始时间');
                    console.log('[Appen Data Collector] 比较结果: lastTopicId(' + lastTopicId + ') === currentTopicId(' + currentTopicId + ')');
                    // 从缓存立即读取开始时间（使用await改为同步）
                    const cachedStartTime = await getCachedStartTime();
                    if (cachedStartTime) {
                        console.log('[Appen Data Collector] 从缓存恢复开始时间:', new Date(cachedStartTime).toISOString());
                        collectedData.startTime = cachedStartTime;
                        console.log('[Appen Data Collector] collectedData.startTime 已更新为缓存时间');
                    } else {
                        console.log('[Appen Data Collector] 缓存中无开始时间，记录当前时间');
                        // 缓存中没有开始时间，说明是第一次标注或缓存被清除，记录当前时间
                        const newStartTime = Date.now();
                        collectedData.startTime = newStartTime;
                        await saveCachedStartTime(newStartTime);
                        console.log('[Appen Data Collector] 已记录并保存当前开始时间:', new Date(newStartTime).toISOString());
                    }
                }
                
                // 更新lastTopicId为当前题目ID并保存到缓存
                lastTopicId = currentTopicId;
                if (currentTopicId && currentTopicId !== 'no-id') {
                    saveCachedTopicId(currentTopicId);
                    console.log('[Appen Data Collector] 已将当前题目ID保存到缓存:', currentTopicId);
                }
                console.log('[Appen Data Collector] 已更新lastTopicId:', lastTopicId);
                console.log('[Appen Data Collector] ========== 初始化完成 ==========');
            }, 1000); // 等待页面加载完成

            // 在目标页面上提取响应元素
            setTimeout(() => {
                extractResponseElements();
                // 附加用户选择状态监听器
                setTimeout(attachUserSelectionListeners, 500);
                // 自动触发质检详情加载
                setTimeout(autoTriggerQualityCheckDetails, 1000);
            }, 2000); // 等待页面加载完成
        }

        // 获取任务信息
        collectTaskInfo();

        // 获取主题信息
        collectTopicInfo();

        // 开始监听页面活动
        attachEventListeners();

        // 页面卸载时推送数据（已禁用，改为手动推送）
        // window.addEventListener('beforeunload', pushDataOnSubmission);
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
                        saveCachedUserId(spanText);
                        return;
                    }
                }
                
                console.log('[Appen Data Collector] ✗ 在span中未找到用户ID');
            } else {
                console.log('[Appen Data Collector] ✗ 未找到账户元素');
            }

            collectedData.userId = 'unknown_user';
            console.warn('[Appen Data Collector] 使用默认值');
            
        } catch (error) {
            console.warn('[Appen Data Collector] 无法收集用户信息:', error);
            console.error(error);
            collectedData.userId = 'unknown_user';
        }
    }

    // 等待账户元素加载完成，然后重新收集用户信息
    function waitForAccountElement() {
        const maxAttempts = 120;  // 最多尝试120次（60秒）
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
                if (attempts % 20 === 0) {
                    console.log(`[Appen Data Collector] 等待账户元素加载... (${attempts}/${maxAttempts})`);
                }
                
                if (attempts >= maxAttempts) {
                    console.warn('[Appen Data Collector] 账户元素加载超时，尝试直接提取');
                    clearInterval(checkInterval);
                    // 即使超时也尝试提取一次
                    collectUserInfo();
                }
            }
        }, 500);  // 每500ms检查一次
    }

    // 收集任务信息
    function collectTaskInfo() {
        try {
            // 尝试从页面URL或元素中获取任务ID
            const urlParams = new URLSearchParams(window.location.search);

            // 记录提取到的URL参数
            const jobId = urlParams.get('jobId');
            const projectId = urlParams.get('projectId');
            const projectDisplayId = urlParams.get('projectDisplayId');

            if (jobId) {
                console.log('[Appen Data Collector] 从URL提取jobId:', jobId);
            }
            if (projectId) {
                console.log('[Appen Data Collector] 从URL提取projectId:', projectId);
            }
            if (projectDisplayId) {
                console.log('[Appen Data Collector] 从URL提取projectDisplayId:', projectDisplayId);
            }

            // 优先使用title参数作为任务ID
            const titleParam = urlParams.get('title');
            if (titleParam) {
                // 解码URL编码的title值
                const decodedTitle = decodeURIComponent(titleParam);
                console.log('[Appen Data Collector] 从URL title参数获取任务ID:', decodedTitle);
                collectedData.taskId = decodedTitle;
            } else {
                // 如果没有title参数，则使用原来的逻辑
                collectedData.taskId = urlParams.get('task_id') ||
                                     urlParams.get('taskId') ||
                                     extractTaskIdFromURL();
            }

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

            // 从URL中提取参数
            const urlParams = new URLSearchParams(window.location.search);
            const jobId = urlParams.get('jobId');
            const projectId = urlParams.get('projectId');
            const projectDisplayId = urlParams.get('projectDisplayId');

            // 记录提取到的URL参数
            if (jobId) {
                console.log('[Appen Data Collector] 从URL提取jobId:', jobId);
            }
            if (projectId) {
                console.log('[Appen Data Collector] 从URL提取projectId:', projectId);
            }
            if (projectDisplayId) {
                console.log('[Appen Data Collector] 从URL提取projectDisplayId:', projectDisplayId);
            }

            // 优先使用指定元素 ID 作为题目 ID
            if (specifiedElementIdAsTopicId && specifiedElementIdAsTopicId !== 'no-id') {
                console.log('[Appen Data Collector] 使用指定元素 ID 作为题目 ID:', specifiedElementIdAsTopicId);
                collectedData.topicId = specifiedElementIdAsTopicId;
            } else {
                // 从URL中提取主题ID
                const url = new URL(collectedData.topicUrl);
                collectedData.topicId = url.searchParams.get('topic_id') ||
                                      url.searchParams.get('topicId') ||
                                      extractTopicIdFromURL() ||
                                      'unknown_topic';
                console.log('[Appen Data Collector] 使用URL或其他方式提取的题目 ID:', collectedData.topicId);
            }

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
            checkForSubmission(event.target, true);
        });

        // 监听表单提交事件（已禁用，改为手动推送）
        /*
        document.addEventListener('submit', function(event) {
            // 延迟推送数据，确保表单提交完成
            setTimeout(pushDataOnSubmission, 100);
        });
        */

        // 监听键盘事件 - i键显示数据 (已禁用，使用content script中的处理)
        /*
        document.addEventListener('keydown', function(event) {
            if (event.key === 'i' || event.key === 'I') {
                try {
                    // 检查当前焦点是否在可编辑元素上
                    const activeElement = document.activeElement;
                    const isEditableElement = activeElement && (
                        activeElement.tagName === 'INPUT' ||
                        activeElement.tagName === 'TEXTAREA' ||
                        activeElement.contentEditable === 'true'
                    );

                    // 只有在不是编辑状态下才触发
                    if (!isEditableElement) {
                        event.preventDefault();
                        showDataModal();
                    }
                } catch (err) {
                    console.error('[Appen Data Collector] i 键处理异常:', err);
                    // 即使有异常也尝试显示模态框
                    try {
                        event.preventDefault();
                        showDataModal();
                    } catch (err2) {
                        console.error('[Appen Data Collector] 显示模态框失败:', err2);
                    }
                }
            }
        });
        */

        // 特别监听可能的提交按钮
        observeSubmissionButtons();
    }

    // 自动触发质检详情加载
    function autoTriggerQualityCheckDetails() {
        try {
            console.log('[Appen Data Collector] 开始自动触发质检详情加载');

            // 查找质检详情显示按钮（向下箭头图标）
            const qualityCheckTriggerElements = document.querySelectorAll('.anticon-down, [aria-label="down"], [data-icon="down"]');

            // 查找包含质检状态信息的元素
            const qualityCheckStatusElements = document.querySelectorAll('.h-10.px-3, [class*="reject"], [class*="驳回"]');

            console.log('[Appen Data Collector] 找到质检触发元素数量:', qualityCheckTriggerElements.length);
            console.log('[Appen Data Collector] 找到质检状态元素数量:', qualityCheckStatusElements.length);

            // 如果找到了质检触发元素，模拟点击第一个
            if (qualityCheckTriggerElements.length > 0) {
                const firstTrigger = qualityCheckTriggerElements[0];
                console.log('[Appen Data Collector] 模拟点击质检详情触发元素:', firstTrigger);

                // 创建并派发点击事件
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                firstTrigger.dispatchEvent(clickEvent);

                // 等待一段时间让内容加载，然后再次点击收起
                setTimeout(() => {
                    console.log('[Appen Data Collector] 模拟再次点击收起质检详情');
                    firstTrigger.dispatchEvent(clickEvent);
                }, 1000);
            } else if (qualityCheckStatusElements.length > 0) {
                // 如果没有找到触发元素但找到了状态元素，说明可能已经展开
                console.log('[Appen Data Collector] 检测到质检状态元素，尝试直接提取信息');
                if (collectedData.responseElements) {
                    extractQualityCheckRecords(collectedData.responseElements);
                }
            } else {
                console.log('[Appen Data Collector] 未找到质检相关信息元素');
            }
        } catch (error) {
            console.warn('[Appen Data Collector] 自动触发质检详情加载时出错:', error);
        }
    }

    // 记录确认完成时的标注信息
    function recordCompletionOnConfirm() {
        try {
            const userStatus = collectedData.responseElements?.userSelectionStatus;
            
            if (!userStatus) {
                console.log('[Appen Data Collector] 无法获取用户选择状态，跳过记录');
                return;
            }

            if (userStatus.isValid !== true) {
                console.log('[Appen Data Collector] 状态不是有效，跳过记录。当前状态:', userStatus.isValid);
                return;
            }

            const pageKey = getCurrentPageKey();
            const topicCount = getTopicCountForRecording();

            console.log('[Appen Data Collector] ========== 确认完成时记录标注信息 ==========');
            console.log('[Appen Data Collector] 页面标识:', pageKey);
            console.log('[Appen Data Collector] 当前页面做题数量:', topicCount);
            console.log('[Appen Data Collector] 用户有效状态:', userStatus.isValid);

            if (!completionStats.perPage[pageKey]) {
                completionStats.perPage[pageKey] = {
                    completions: 0,
                    topicCount: topicCount
                };
            }

            completionStats.perPage[pageKey].completions += 1;
            completionStats.perPage[pageKey].topicCount = topicCount;
            completionStats.totalValidCompletions += 1;

            syncCollectedDataWithCompletionStats();

            console.log('[Appen Data Collector] 已记录确认完成时的标注信息:', {
                pageKey,
                completions: completionStats.perPage[pageKey].completions,
                topicCount: completionStats.perPage[pageKey].topicCount,
                totalValidCompletions: completionStats.totalValidCompletions
            });

            saveCompletionStats();

        } catch (error) {
            console.warn('[Appen Data Collector] 记录确认完成时的标注信息异常:', error);
        }
    }

    // 检查是否点击了提交按钮
    function checkForSubmission(element, triggeredByUserEvent = false) {
        if (!element || !(element instanceof Element)) {
            return;
        }

        const targetElement = element.closest ? (element.closest('button, [role="button"], [type="submit"], .btn, .submit') || element) : element;

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
            console.log('[Appen Data Collector] 检测到提交按钮点击（已禁用自动推送，等待手动推送）');
            // 延迟推送数据，确保提交操作完成（已禁用）
            // setTimeout(pushDataOnSubmission, 300);
        }

        // 检查是否点击了"确认完成"按钮
        const isConfirmCompleteButton = buttonText.includes('确认完成');
        if (isConfirmCompleteButton) {
            console.log('[Appen Data Collector] 检测到"确认完成"按钮点击');
            recordCompletionOnConfirm();
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

        // 更新耗时，并限制最大时长为1小时
        let elapsedTime = Date.now() - collectedData.startTime;
        if (elapsedTime > CONFIG.MAX_ELAPSED_TIME) {
            console.log('[Appen Data Collector] 耗时已超过最大值(1小时)，固定为1小时');
            elapsedTime = CONFIG.MAX_ELAPSED_TIME;
        }
        collectedData.elapsedTime = Math.floor(elapsedTime / 1000);

        // 构造符合API要求的数据（使用camelCase）
        const dataToSend = {
            userId: collectedData.userId || 'unknown_user',
            taskId: collectedData.taskId || 'unknown_task',
            topicId: collectedData.topicId || 'unknown_topic',
            topicUrl: collectedData.topicUrl || window.location.href,
            isValid: collectedData.responseElements?.userSelectionStatus?.isValid !== null ? 
                    collectedData.responseElements.userSelectionStatus.isValid : true,
            editRounds: collectedData.responseElements?.userSelectionStatus?.editRounds || null,
            isRedo: false,
            updateTime: new Date().toISOString(),
            elapsedTime: collectedData.elapsedTime || 0,
            isReplace: false,
            topicNum: collectedData.responseElements?.userSelectionStatus?.topicCount || collectedData.responseElements?.userSelectionStatus?.editRounds || collectedData.topicNum || 0,
            userSelectionStatus: collectedData.responseElements?.userSelectionStatus || null,
            qualityCheckRecord: collectedData.responseElements?.qualityCheckRecord || null
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
                    
                    // 推送成功后清除缓存的开始时间
                    await clearCachedStartTime();
                    
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
        try {
            console.log('[Appen Data Collector] showDataModal 被调用');
            console.log('[Appen Data Collector] 当前 collectedData.userId:', collectedData.userId);
            
            // 如果已有模态窗口则关闭
            const existingModal = document.getElementById('appen-data-modal');
            if (existingModal) {
                console.log('[Appen Data Collector] 模态框已存在，关闭后重新打开');
                existingModal.remove();
            }

            // 尝试从页面实时获取用户ID（如果还没有的话）
            if (!collectedData.userId || collectedData.userId === 'unknown_user') {
                console.log('[Appen Data Collector] 用户ID为空或unknown，尝试从页面提取');
                collectUserInfo();
                console.log('[Appen Data Collector] collectUserInfo 执行后，userId:', collectedData.userId);
            }

            // 立即触发一次状态检测以确保获取最新数据
            if (isTargetPage() && collectedData.responseElements) {
                console.log('[Appen Data Collector] 显示模态框前立即检测最新状态');
                detectUserSelectionStatus(collectedData.responseElements);
                // 直接提取质检记录（现已优化为从初始数据提取，无需触发面板）
                console.log('[Appen Data Collector] 显示模态框前提取质检记录');
                extractQualityCheckRecords(collectedData.responseElements);
            } else if (isTargetPage()) {
                // 如果还没有responseElements，先创建它
                console.log('[Appen Data Collector] 第一次打开模态框，初始化responseElements');
                extractResponseElements();
                setTimeout(() => {
                    extractQualityCheckRecords(collectedData.responseElements);
                }, 500);
            }

            console.log('[Appen Data Collector] 准备创建模态框');
            console.log('[Appen Data Collector] isTargetPage():', isTargetPage());
            console.log('[Appen Data Collector] collectedData.responseElements:', collectedData.responseElements);
            console.log('[Appen Data Collector] qualityCheckRecord:', collectedData.responseElements?.qualityCheckRecord);
            
            // 计算当前耗时，并限制最大值为1小时
            let currentElapsedTime = Math.floor((Date.now() - collectedData.startTime) / 1000);
            if (currentElapsedTime > CONFIG.MAX_ELAPSED_TIME / 1000) {
                console.log('[Appen Data Collector] 当前耗时已超过最大值(1小时)，显示为1小时');
                currentElapsedTime = CONFIG.MAX_ELAPSED_TIME / 1000;
            }

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
                    <div><strong style="color: #333;">任务ID:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.taskId || 'N/A')}</span></div>
                    <div><strong style="color: #333;">题目ID:</strong> <span id="topic-id-display" style="color: #0066cc;">${escapeHtml(collectedData.topicId || 'N/A')}</span></div>
                    <div><strong style="color: #333;">题目数量:</strong> <span id="topic-count-display" style="color: #0066cc;">${collectedData.responseElements?.userSelectionStatus?.topicCount || collectedData.responseElements?.userSelectionStatus?.editRounds || collectedData.topicNum || 0}</span></div>
                    <div><strong style="color: #333;">耗时(秒):</strong> <span id="elapsed-time-display" style="color: #0066cc;">${currentElapsedTime}</span></div>
                    <div><strong style="color: #333;">是否有效:</strong> <span id="valid-status-display" style="color: #0066cc;">${collectedData.responseElements?.userSelectionStatus ? (collectedData.responseElements.userSelectionStatus.isValid === true ? '✓ 有效' : collectedData.responseElements.userSelectionStatus.isValid === false ? '✗ 无效' : '未知') : '未检测到'}</span></div>
                    <div><strong style="color: #333;">认证Cookie:</strong> <span id="cookie-status-display" style="color: #0066cc; font-size: 12px;">${collectedData.authCookies ? (Object.keys(collectedData.authCookies).length > 0 ? '已获取(' + Object.keys(collectedData.authCookies).length + '个)' : '无有效Cookie') : '未获取'}</span></div>
                    <div><strong style="color: #333;">驳回理由:</strong> <span style="color: #0066cc;">${escapeHtml(collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment || '')}</span></div>
                </div>

                <div style="
                    background: #e8f5e9;
                    padding: 15px;
                    border-radius: 4px;
                    margin-top: 15px;
                    margin-bottom: 15px;
                    border-left: 4px solid #4CAF50;
                ">
                    <div style="font-weight: bold; color: #2e7d32; margin-bottom: 10px; font-size: 15px;">✓ 标注完成统计</div>
                    <div><strong style="color: #333;">总有效完成次数:</strong> <span id="total-completions-display" style="color: #0066cc; font-weight: bold; font-size: 16px;">${completionStats.totalValidCompletions || 0}</span></div>
                    <div style="margin-top: 10px; font-size: 13px; color: #555;">
                        <div style="margin-bottom: 5px;"><strong>各页面完成详情:</strong></div>
                        <div id="page-completions-display" style="margin-left: 15px; line-height: 1.6;">
                            ${Object.keys(completionStats.perPage).length > 0 
                                ? Object.entries(completionStats.perPage).map(([pageKey, data]) => 
                                    `<div style="margin-bottom: 5px;">页面: <span style="color: #0066cc;">${escapeHtml(pageKey.substring(0, 50))}</span> - 完成: <span style="color: #f57c00; font-weight: bold;">${data.completions}</span>, 题数: <span style="color: #0066cc;">${data.topicCount}</span></div>`
                                  ).join('')
                                : '<div style="color: #999;">暂无完成记录</div>'}
                        </div>
                    </div>
                </div>

                <div style="
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 4px;
                    margin-top: 15px;
                    margin-bottom: 15px;
                ">
                    <div style="margin-bottom: 10px;">
                        <label style="color: #333; font-weight: bold; display: block; margin-bottom: 5px; font-size: 14px;">设置 lastTopicId:</label>
                        <input type="text" id="lastTopicIdInput" placeholder="输入新的 lastTopicId 值" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ccc;
                            border-radius: 4px;
                            box-sizing: border-box;
                            font-size: 13px;
                        ">
                    </div>
                    <button id="set-lasttopicid-btn" style="
                        background: #FF5722;
                        color: white;
                        border: none;
                        padding: 8px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 13px;
                        width: 100%;
                    ">设置 lastTopicId</button>
                </div>

                <div style="
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                    flex-wrap: wrap;
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
                    <button id="get-cookies-btn" style="
                        background: #FF9800;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">获取Cookie</button>
                    <button id="sync-auth-btn" style="
                        background: #9C27B0;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">同步认证信息</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 更新驳回理由显示（确保显示最新的）
        const updateRejectReasonDisplay = function() {
            const rejectReasonSpans = modal.querySelectorAll('span');
            for (const span of rejectReasonSpans) {
                const parentText = span.parentElement.textContent;
                if (parentText.includes('驳回理由:')) {
                    const latestReason = collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment || '未找到';
                    span.textContent = escapeHtml(latestReason);
                    console.log('[Appen Data Collector] 已更新模态框中的驳回理由显示:', latestReason);
                    break;
                }
            }
        };
        
        // 立即更新一次显示
        updateRejectReasonDisplay();
        
        // 延迟再更新一次，确保最新数据已加载
        setTimeout(updateRejectReasonDisplay, 300);

        // 关闭按钮事件
        document.getElementById('close-modal-btn').addEventListener('click', function() {
            modal.remove();
        });

        // 复制数据按钮事件
        document.getElementById('copy-data-btn').addEventListener('click', function() {
            // 重新计算当前耗时，并限制最大值
            let elapsedTimeForCopy = Math.floor((Date.now() - collectedData.startTime) / 1000);
            if (elapsedTimeForCopy > CONFIG.MAX_ELAPSED_TIME / 1000) {
                elapsedTimeForCopy = CONFIG.MAX_ELAPSED_TIME / 1000;
            }
            
            const dataToSend = {
                userId: collectedData.userId || 'unknown_user',
                taskId: collectedData.taskId || 'unknown_task',
                topicId: collectedData.topicId || 'unknown_topic',
                topicUrl: collectedData.topicUrl || window.location.href,
                isValid: collectedData.responseElements?.userSelectionStatus?.isValid !== null ? 
                        collectedData.responseElements.userSelectionStatus.isValid : true,
                editRounds: collectedData.responseElements?.userSelectionStatus?.editRounds || null,
                isRedo: false,
                updateTime: new Date().toISOString(),
                elapsedTime: elapsedTimeForCopy,
                isReplace: false,
                topicNum: collectedData.responseElements?.userSelectionStatus?.topicCount || collectedData.responseElements?.userSelectionStatus?.editRounds || collectedData.topicNum || 0,
                userSelectionStatus: collectedData.responseElements?.userSelectionStatus || null,
                qualityCheckRecord: collectedData.responseElements?.qualityCheckRecord || null
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

        // 获取cookie按钮事件
        document.getElementById('get-cookies-btn').addEventListener('click', async function() {
            try {
                const cookies = await getAuthCookies();
                if (cookies) {
                    // 更新内存中的cookie数据
                    collectedData.authCookies = cookies;
                    
                    const cookieJson = JSON.stringify(cookies, null, 2);
                    navigator.clipboard.writeText(cookieJson).then(() => {
                        alert('Cookie数据已复制到剪贴板并更新到内存！\n\n' + cookieJson);
                    }).catch(err => {
                        console.error('复制失败:', err);
                        alert('获取成功但复制失败，请查看控制台输出\n\n' + cookieJson);
                    });
                    
                    // 更新显示
                    const modalElement = document.getElementById('appen-data-modal');
                    if (modalElement) {
                        const spans = modalElement.querySelectorAll('span');
                        spans.forEach(span => {
                            const parent = span.parentElement;
                            if (parent && parent.textContent.includes('认证Cookie:')) {
                                span.textContent = Object.keys(cookies).length > 0 ? `已获取(${Object.keys(cookies).length}个)` : '无有效Cookie';
                            }
                        });
                    }
                } else {
                    alert('未能获取到认证cookie，请检查控制台日志');
                }
            } catch (error) {
                console.error('获取cookie失败:', error);
                alert('获取cookie失败: ' + error.message);
            }
        });

        // 同步认证信息按钮事件
        document.getElementById('sync-auth-btn').addEventListener('click', async function() {
            try {
                const cookies = await getAuthCookies();
                if (cookies) {
                    await syncAuthToServer(cookies);
                    alert('认证信息同步请求已发送，请检查控制台日志');
                } else {
                    alert('未能获取到认证cookie，无法同步');
                }
            } catch (error) {
                console.error('同步认证信息失败:', error);
                alert('同步认证信息失败: ' + error.message);
            }
        });

        // 设置 lastTopicId 按钮事件
        document.getElementById('set-lasttopicid-btn').addEventListener('click', function() {
            const input = document.getElementById('lastTopicIdInput');
            const newValue = input.value.trim();
            
            if (!newValue) {
                alert('请输入 lastTopicId 值');
                return;
            }
            
            const oldTopicId = collectedData.topicId;
            
            lastTopicId = newValue;
            collectedData.topicId = newValue;
            specifiedElementIdAsTopicId = newValue;
            
            const topicIdDisplay = document.getElementById('topic-id-display');
            if (topicIdDisplay) {
                topicIdDisplay.textContent = escapeHtml(newValue);
                console.log('[Appen Data Collector] 更新模态框中的题目ID显示:', newValue);
            }
            
            if (oldTopicId !== newValue) {
                const newStartTime = Date.now();
                collectedData.startTime = newStartTime;
                console.log('[Appen Data Collector] 检测到题目ID变化，重置计时器');
                console.log('[Appen Data Collector] 旧题目ID:', oldTopicId, '新题目ID:', newValue);
                console.log('[Appen Data Collector] 新的开始时间:', new Date(newStartTime).toISOString());
                
                const elapsedTimeDisplay = document.getElementById('elapsed-time-display');
                if (elapsedTimeDisplay) {
                    elapsedTimeDisplay.textContent = '0';
                    console.log('[Appen Data Collector] 已重置模态框中的耗时显示为0');
                }
            }
            
            console.log('[Appen Data Collector] lastTopicId 已设置为:', lastTopicId);
            alert('lastTopicId 已设置为: ' + newValue + '\n计时器已重置');
            
            input.value = '';
        });

        console.log('[Appen Data Collector] 数据展示模态窗口已显示，按i键关闭');
        } catch (error) {
            console.error('[Appen Data Collector] 创建模态框异常:', error);
            console.error('[Appen Data Collector] 错误堆栈:', error.stack);
            alert('创建模态框失败: ' + error.message);
        }
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

    // 检查是否为特定目标页面
    function isTargetPage() {
        const currentUrl = window.location.href;
        const isMatch = CONFIG.TARGET_URL_PATTERN.test(currentUrl);
        console.log('[Appen Data Collector] isTargetPage 检查:', { url: currentUrl, pattern: CONFIG.TARGET_URL_PATTERN, isMatch: isMatch });
        return isMatch;
    }

    // 输出所有质检驳回信息到控制台
    function logAllQualityCheckInfo() {
        try {
            console.log('\n========== 【开始输出所有质检驳回信息】 ==========');
            
            if (!collectedData) {
                console.log('错误: collectedData 未初始化');
                return;
            }

            // 基本信息
            console.log('【基本信息】');
            console.log('  用户ID:', collectedData.userId || 'N/A');
            console.log('  任务ID:', collectedData.taskId || 'N/A');
            console.log('  题目ID:', collectedData.topicId || 'N/A');
            console.log('  页面URL:', collectedData.topicUrl || 'N/A');
            
            // 质检记录信息
            if (collectedData.responseElements && collectedData.responseElements.qualityCheckRecord) {
                const qcRecord = collectedData.responseElements.qualityCheckRecord;
                console.log('\n【质检记录信息】');
                console.log('  是否有驳回记录:', qcRecord.hasRecord ? '是' : '否');
                
                if (qcRecord.latestRecord) {
                    console.log('  状态类型:', qcRecord.latestRecord.type || 'N/A');
                    console.log('  状态详情:', qcRecord.latestRecord.action || 'N/A');
                    console.log('  驳回理由:', qcRecord.latestRecord.comment || 'N/A');
                    console.log('  操作人:', qcRecord.latestRecord.operator || 'N/A');
                    console.log('  操作时间:', qcRecord.latestRecord.operateTime || 'N/A');
                }
                
                console.log('  检测时间:', qcRecord.timestamp || 'N/A');
            } else {
                console.log('\n【质检记录信息】');
                console.log('  未检测到质检驳回信息');
            }

            // 用户选择状态
            if (collectedData.responseElements && collectedData.responseElements.userSelectionStatus) {
                const uss = collectedData.responseElements.userSelectionStatus;
                console.log('\n【用户选择状态】');
                console.log('  是否有效:', uss.isValid !== null ? (uss.isValid ? '有效' : '无效') : 'N/A');
                console.log('  编辑轮次:', uss.editRounds || 'N/A');
                console.log('  题目数量:', uss.topicCount || 'N/A');
            }

            // 完整JSON输出
            console.log('\n【完整数据JSON】');
            const fullData = {
                userId: collectedData.userId || 'N/A',
                taskId: collectedData.taskId || 'N/A',
                topicId: collectedData.topicId || 'N/A',
                topicUrl: collectedData.topicUrl || 'N/A',
                qualityCheck: collectedData.responseElements?.qualityCheckRecord || null,
                userSelection: collectedData.responseElements?.userSelectionStatus || null,
                extractTime: new Date().toISOString()
            };
            console.log(JSON.stringify(fullData, null, 2));
            
            console.log('========== 【质检驳回信息输出完成】 ==========\n');
        } catch (error) {
            console.error('[Appen Data Collector] 输出质检信息时出错:', error);
        }
    }


    async function getAuthCookies() {
        try {
            // 检查是否在正确的域名下
            if (!window.location.href.includes('ui.appen.com.cn')) {
                console.log('[Appen Data Collector] 当前不在appen域名下，无法获取cookie');
                return null;
            }

            console.log('[Appen Data Collector] 尝试通过background script获取cookie');

            // 通过background script获取cookie（使用chrome.cookies API）
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: "getAppenCookies",
                    url: window.location.href
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[Appen Data Collector] 与background script通信失败:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    if (response.success) {
                        console.log('[Appen Data Collector] 通过background script获取的cookie:', response.cookies);
                        resolve(response.cookies);
                    } else {
                        console.error('[Appen Data Collector] background script获取cookie失败:', response.error);
                        reject(new Error(response.error));
                    }
                });
            });
        } catch (error) {
            console.warn('[Appen Data Collector] 获取cookie时出错:', error);
            console.error('[Appen Data Collector] 错误详情:', error.stack);
            return null;
        }
    }

    // 同步认证信息到服务端
    async function syncAuthToServer(authCookies) {
        if (!authCookies) {
            console.log('[Appen Data Collector] 没有认证信息可同步');
            return;
        }

        const authPayload = {};

        if (authCookies._appen_auth_session) {
            authPayload._appen_auth_session = authCookies._appen_auth_session;
        }

        if (authCookies.appenAuthSession) {
            authPayload._appen_auth_session = authCookies.appenAuthSession;
        }

        if (authCookies.Authorization) {
            authPayload.Authorization = authCookies.Authorization;
        }

        if (authCookies.authorization) {
            authPayload.Authorization = authCookies.authorization;
        }

        if (Object.keys(authPayload).length === 0) {
            console.log('[Appen Data Collector] 认证信息为空，无需同步');
            console.log('[Appen Data Collector] 接收到的cookie字段:', Object.keys(authCookies));
            return;
        }

        // 通过background script发送HTTP请求以避免Mixed Content问题
        try {
            console.log('[Appen Data Collector] 通过background script同步认证信息到服务端:', authPayload);

            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: "syncAuthToServer",
                    data: authPayload,
                    endpoint: CONFIG.AUTH_SYNC_ENDPOINT.replace('https://', 'http://') // 确保使用HTTP
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[Appen Data Collector] 与background script通信失败:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    if (response.success) {
                        console.log('[Appen Data Collector] 认证信息同步成功:', response.result);
                        resolve(response.result);
                    } else {
                        console.error('[Appen Data Collector] background script同步认证信息失败:', response.error);
                        reject(new Error(response.error));
                    }
                });
            });
        } catch (error) {
            console.error('[Appen Data Collector] 同步认证信息时出错:', error);
            throw error;
        }
    }

    // 从目标页面提取响应元素
    function extractResponseElements() {
        if (!isTargetPage()) {
            console.log('[Appen Data Collector] 当前页面不是目标页面，跳过元素提取');
            return null;
        }

        console.log('[Appen Data Collector] 在目标页面上，开始提取响应元素...');

        // 提取URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('jobId');
        const jobType = urlParams.get('jobType');
        const taskId = urlParams.get('taskId');
        const projectId = urlParams.get('projectId');
        const title = urlParams.get('title');

        // 创建响应元素数据对象
        const responseElements = {
            jobId: jobId || 'unknown',
            jobType: jobType || 'unknown',
            taskId: taskId || 'unknown',
            projectId: projectId || 'unknown',
            title: decodeURIComponent(title || 'unknown'),
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        // 尝试提取页面上的其他元素
        try {
            // 提取页面标题
            const titleElement = document.querySelector('title');
            if (titleElement) {
                responseElements.pageTitle = titleElement.textContent.trim();
            }

            // 检测用户当前的单选是有效还是无效，以及是第几轮
            detectUserSelectionStatus(responseElements);

            // 提取质检记录信息
            extractQualityCheckRecords(responseElements);

            // 提取可能的任务相关信息
            const taskElements = document.querySelectorAll('[class*="task"], [id*="task"], [data-task]');
            taskElements.forEach((element, index) => {
                const key = `taskElement_${index}`;
                responseElements[key] = {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id,
                    textContent: element.textContent.trim().substring(0, 100)
                };
            });

            // 提取可能的响应按钮或操作元素
            const responseButtons = document.querySelectorAll('button, [role="button"]');
            responseButtons.forEach((button, index) => {
                const buttonText = button.textContent.trim() || button.getAttribute('aria-label') || '';
                if (buttonText) {
                    const key = `responseButton_${index}`;
                    responseElements[key] = {
                        text: buttonText,
                        className: button.className,
                        id: button.id
                    };
                }
            });

            // 特别提取标注相关的元素
            const annotationElements = document.querySelectorAll('[class*="annotation"], [class*="label"], [data-annotation]');
            annotationElements.forEach((element, index) => {
                const key = `annotationElement_${index}`;
                responseElements[key] = {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id,
                    textContent: element.textContent.trim().substring(0, 100)
                };
            });

            // 查找提交按钮
            const submitButtons = document.querySelectorAll('button[type="submit"], button[class*="submit"], button[id*="submit"]');
            if (submitButtons.length > 0) {
                responseElements.submitButtons = [];
                submitButtons.forEach((button, index) => {
                    responseElements.submitButtons.push({
                        text: button.textContent.trim(),
                        className: button.className,
                        id: button.id
                    });
                });
            }

            // 查找表单元素
            const forms = document.querySelectorAll('form');
            if (forms.length > 0) {
                responseElements.forms = [];
                forms.forEach((form, index) => {
                    responseElements.forms.push({
                        className: form.className,
                        id: form.id,
                        action: form.action,
                        method: form.method
                    });
                });
            }

        } catch (error) {
            console.warn('[Appen Data Collector] 提取页面元素时出错:', error);
        }

        console.log('[Appen Data Collector] 提取的响应元素:', responseElements);

        // 将提取的数据存储到全局变量中，以便后续使用
        collectedData.responseElements = responseElements;

        return responseElements;
    }

    // 获取输入元素的标签文本
    function getInputLabel(inputElement) {
        try {
            // 方法1: 通过for属性查找label
            if (inputElement.id) {
                const label = document.querySelector(`label[for="${inputElement.id}"]`);
                if (label) {
                    return label.textContent.trim();
                }
            }

            // 方法2: 查找父级label元素
            let parent = inputElement.parentElement;
            while (parent && parent.tagName !== 'BODY') {
                if (parent.tagName === 'LABEL') {
                    return parent.textContent.trim();
                }
                parent = parent.parentElement;
            }

            // 方法3: 查找同级的文本或label元素
            const siblings = Array.from(inputElement.parentElement.children);
            for (const sibling of siblings) {
                if (sibling.tagName === 'LABEL' || sibling.tagName === 'SPAN') {
                    const text = sibling.textContent.trim();
                    if (text && text.length > 0 && text.length < 50) {
                        return text;
                    }
                }
            }

            // 方法4: 查找相邻的文本节点
            const nextSibling = inputElement.nextSibling;
            if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                const text = nextSibling.textContent.trim();
                if (text && text.length > 0 && text.length < 50) {
                    return text;
                }
            }

            // 方法5: 检查父元素的文本内容
            if (inputElement.parentElement) {
                const parentText = inputElement.parentElement.textContent.trim();
                if (parentText && parentText.length < 100) {
                    // 移除子元素的文本，只保留标签文本
                    const inputText = inputElement.value || '';
                    const cleanText = parentText.replace(inputText, '').trim();
                    if (cleanText && cleanText.length > 0) {
                        return cleanText;
                    }
                }
            }

            return null;
        } catch (error) {
            console.warn('[Appen Data Collector] 获取输入元素标签失败:', error);
            return null;
        }
    }

    // 检测用户当前的单选是有效还是无效，以及编辑轮次数
    function detectUserSelectionStatus(responseElements) {
        try {
            console.log('[Appen Data Collector] 开始检测用户选择状态和编辑轮次数');

            // 检测有效/无效状态
            let isValid = null;
            let editRounds = null;

            // 方法1: 查找被选中的单选按钮或复选框
            const checkedInputs = document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
            console.log('[Appen Data Collector] 找到选中的输入元素数量:', checkedInputs.length);

            checkedInputs.forEach((input, index) => {
                const inputValue = input.value ? input.value.toLowerCase() : '';
                const inputLabel = getInputLabel(input);
                const inputText = inputLabel ? inputLabel.toLowerCase() : '';
                
                console.log(`[Appen Data Collector] 选中的输入元素[${index}]:`, {
                    value: input.value,
                    label: inputLabel,
                    name: input.name,
                    id: input.id
                });

                // 检测有效/无效状态
                if (isValid === null) {
                    if (inputValue.includes('有效') || inputValue.includes('valid') || inputValue.includes('true') ||
                        inputText.includes('有效') || inputText.includes('valid')) {
                        isValid = true;
                        console.log('[Appen Data Collector] 通过选中状态检测到有效:', inputLabel);
                    } else if (inputValue.includes('无效') || inputValue.includes('invalid') || inputValue.includes('false') ||
                               inputText.includes('无效') || inputText.includes('invalid')) {
                        isValid = false;
                        console.log('[Appen Data Collector] 通过选中状态检测到无效:', inputLabel);
                    }
                }

                // 检测编辑轮次数
                if (editRounds === null) {
                    const roundsMatch = inputText.match(/(\d+)\s*轮/) || inputValue.match(/(\d+)\s*轮/) || 
                                       inputText.match(/round\s*(\d+)/i) || inputValue.match(/round\s*(\d+)/i);
                    if (roundsMatch) {
                        editRounds = parseInt(roundsMatch[1]);
                        console.log('[Appen Data Collector] 通过选中状态检测到编辑轮次:', editRounds);
                    }
                }
            });

            // 方法2: 查找包含 "active"、"selected"、"checked" 类的元素
            if (isValid === null || editRounds === null) {
                const activeElements = document.querySelectorAll(
                    '.active, .selected, .checked, [class*="active"], [class*="selected"], [class*="checked"]'
                );
                console.log('[Appen Data Collector] 找到激活状态元素数量:', activeElements.length);

                activeElements.forEach((element, index) => {
                    const text = element.textContent.trim().toLowerCase();
                    console.log(`[Appen Data Collector] 激活元素[${index}]:`, text.substring(0, 50));

                    // 检测有效/无效状态
                    if (isValid === null && text.length < 100) {
                        if (text.includes('有效') || text.includes('valid')) {
                            isValid = true;
                            console.log('[Appen Data Collector] 通过激活状态检测到有效:', text);
                        } else if (text.includes('无效') || text.includes('invalid')) {
                            isValid = false;
                            console.log('[Appen Data Collector] 通过激活状态检测到无效:', text);
                        }
                    }

                    // 检测编辑轮次数
                    if (editRounds === null) {
                        const roundsMatch = text.match(/(\d+)\s*轮/) || text.match(/round\s*(\d+)/i);
                        if (roundsMatch) {
                            editRounds = parseInt(roundsMatch[1]);
                            console.log('[Appen Data Collector] 通过激活状态检测到编辑轮次:', editRounds);
                        }
                    }
                });
            }

            // 方法3: 如果仍未找到，使用原有的文本搜索方法作为备用
            if (isValid === null) {
                console.log('[Appen Data Collector] 使用备用方法检测有效/无效状态');
                const statusContainers = document.querySelectorAll(
                    '[class*="status"], [data-status], .status-container, .validation, .feedback'
                );

                statusContainers.forEach(container => {
                    const text = container.textContent.trim().toLowerCase();
                    if (isValid === null && text.length < 100) {
                        if (text.includes('有效') || text.includes('valid')) {
                            isValid = true;
                            console.log('[Appen Data Collector] 在状态容器中检测到有效状态:', text.substring(0, 50));
                        } else if (text.includes('无效') || text.includes('invalid')) {
                            isValid = false;
                            console.log('[Appen Data Collector] 在状态容器中检测到无效状态:', text.substring(0, 50));
                        }
                    }
                });
            }

            // 查找题目数量（如果还没有编辑轮次数，则使用题目数量）
            let topicCount = null;

            // 方法1: 使用已有的 topicNum
            if (collectedData.topicNum !== undefined && collectedData.topicNum > 0) {
                topicCount = collectedData.topicNum;
                console.log('[Appen Data Collector] 使用已收集的题目数量:', topicCount);
            } else {
                // 方法2: 查找包含"题目"、"任务"、"项"等关键词的计数元素
                const countElements = document.querySelectorAll(
                    '[class*="count"], [class*="number"], [class*="total"], .counter, .progress'
                );

                countElements.forEach(element => {
                    const text = element.textContent.trim();
                    // 查找类似 "5/10" 或 "题目 5/10" 的格式
                    const progressMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
                    if (progressMatch && topicCount === null) {
                        topicCount = parseInt(progressMatch[2]); // 总数
                        console.log('[Appen Data Collector] 从进度文本中提取题目数量:', text, '总数:', topicCount);
                    }

                    // 查找单独的数字（可能是总数）
                    if (topicCount === null) {
                        const numberMatch = text.match(/(?:^|\D)(\d+)(?:\D|$)/);
                        if (numberMatch && parseInt(numberMatch[1]) > 1 && parseInt(numberMatch[1]) < 1000) {
                            topicCount = parseInt(numberMatch[1]);
                            console.log('[Appen Data Collector] 从文本中提取题目数量:', text, '数字:', topicCount);
                        }
                    }
                });

                // 如果还没找到，使用之前的方法
                if (topicCount === null) {
                    const topicElements = document.querySelectorAll('.topic, .question, .item, [class*="task"]');
                    topicCount = topicElements.length || 0;
                    console.log('[Appen Data Collector] 通过元素计数获取题目数量:', topicCount);
                }
            }

            // 确保 topicCount 至少为0
            topicCount = topicCount || 0;

            // 如果没有检测到编辑轮次，但有题目数量，可以将题目数量作为备用值
            if (editRounds === null && topicCount > 0) {
                console.log('[Appen Data Collector] 未检测到编辑轮次，使用题目数量作为备用:', topicCount);
            }

            // 将结果存储到响应元素中
            responseElements.userSelectionStatus = {
                isValid: isValid,
                editRounds: editRounds,
                topicCount: topicCount,
                timestamp: new Date().toISOString()
            };

            console.log('[Appen Data Collector] 用户选择状态检测结果:', {
                isValid: isValid,
                editRounds: editRounds,
                topicCount: topicCount
            });

        } catch (error) {
            console.warn('[Appen Data Collector] 检测用户选择状态时出错:', error);
            responseElements.userSelectionStatus = {
                isValid: null,
                editRounds: null,
                topicCount: collectedData.topicNum || 0,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // 从打开的质检窗口DOM中提取最新驳回理由（改进的DOM提取方案）
    function extractLatestQARejectFromDOM() {
        try {
            console.log('[Appen Data Collector] 尝试从打开的质检窗口DOM中提取最新驳回理由');
            
            // 找到质检窗口的内容容器
            const popoverContent = document.querySelector('.ant-popover-content');
            if (!popoverContent) {
                console.log('[Appen Data Collector] 未找到打开的质检窗口');
                return null;
            }
            
            console.log('[Appen Data Collector] 找到质检窗口');
            
            // 找到ul列表
            const ul = popoverContent.querySelector('ul');
            if (!ul) {
                console.log('[Appen Data Collector] 未找到质检记录列表');
                return null;
            }
            
            // 获取所有li元素
            const liElements = ul.querySelectorAll('li');
            if (liElements.length === 0) {
                console.log('[Appen Data Collector] 质检记录列表为空');
                return null;
            }
            
            console.log('[Appen Data Collector] 找到质检记录数量:', liElements.length);
            
            // 遍历所有li元素，查找QA REJECTED的记录
            // 记录结构：
            // li > div > div.font-normal.flex > (div:1 = "质检1", div:2 = "已驳回")
            //     > div.flex.text-gray-400 > (div:1 = "操作人", div:2 = "时间")
            //     > div/DraftEditor-root = "驳回理由"
            
            let latestQARecord = null;
            let latestTime = null;
            
            for (let i = 0; i < liElements.length; i++) {
                const li = liElements[i];
                const liText = li.textContent.trim();
                
                // 查找包含"质检"和"已驳回"的记录
                if (liText.includes('质检') && liText.includes('已驳回')) {
                    console.log(`[Appen Data Collector] 找到QA驳回记录 ${i}: ${liText.substring(0, 50)}`);
                    
                    // 提取操作人和时间
                    const timeDiv = li.querySelector('.flex.text-gray-400');
                    let operatorAndTime = '';
                    let timeStr = '';
                    
                    if (timeDiv) {
                        const divs = timeDiv.querySelectorAll('div');
                        if (divs.length >= 2) {
                            operatorAndTime = divs[0].textContent.trim();
                            timeStr = divs[1].textContent.trim();
                            console.log(`[Appen Data Collector] 操作人: ${operatorAndTime}, 时间: ${timeStr}`);
                        }
                    }
                    
                    // 提取驳回理由
                    // 方法1: 从DraftEditor中提取
                    let rejectReason = '';
                    const draftEditor = li.querySelector('.DraftEditor-root');
                    if (draftEditor) {
                        const spanWithText = draftEditor.querySelector('span[data-text="true"]');
                        if (spanWithText) {
                            rejectReason = spanWithText.textContent.trim();
                            console.log(`[Appen Data Collector] 从DraftEditor提取到驳回理由: ${rejectReason}`);
                        }
                    }
                    
                    // 方法2: 如果方法1失败，从第一个含文本的div提取
                    if (!rejectReason) {
                        const divWithText = li.querySelector('div.min-h-fit');
                        if (divWithText) {
                            rejectReason = divWithText.textContent.trim();
                            console.log(`[Appen Data Collector] 从div.min-h-fit提取到内容: ${rejectReason}`);
                        }
                    }
                    
                    // 比较时间戳，选择最新的记录
                    if (timeStr) {
                        const recordTime = new Date(timeStr).getTime();
                        if (!latestTime || recordTime > latestTime) {
                            latestQARecord = {
                                operator: operatorAndTime,
                                operateTime: timeStr,
                                comment: rejectReason,
                                timestamp: recordTime
                            };
                            latestTime = recordTime;
                            console.log(`[Appen Data Collector] 更新最新QA记录为索引 ${i}`);
                        }
                    }
                }
            }
            
            if (latestQARecord) {
                console.log('[Appen Data Collector] 成功从DOM提取最新QA驳回记录');
                return latestQARecord;
            } else {
                console.log('[Appen Data Collector] 未找到QA驳回记录');
                return null;
            }
            
        } catch (error) {
            console.warn('[Appen Data Collector] 从DOM提取QA驳回理由时出错:', error);
            return null;
        }
    }
    
    // 从初始化数据中直接提取质检驳回理由（最优方案）
    function extractQualityCheckFromInitialData() {
        try {
            console.log('[Appen Data Collector] 尝试从初始数据提取质检驳回理由');
            
            // 获取页面初始化的数据
            if (!window.__INITIAL_DATA__) {
                console.log('[Appen Data Collector] __INITIAL_DATA__ 未找到，可能页面还在加载');
                return null;
            }
            
            const data = window.__INITIAL_DATA__;
            console.log('[Appen Data Collector] __INITIAL_DATA__ 已找到');
            
            // 检查数据结构
            if (!data.taskMessage?.taskRows?.[0]?.records?.[0]) {
                console.log('[Appen Data Collector] 任务数据结构不完整', {
                    hasTaskMessage: !!data.taskMessage,
                    hasTaskRows: !!data.taskMessage?.taskRows,
                    taskRowsLength: data.taskMessage?.taskRows?.length
                });
                return null;
            }
            
            const record = data.taskMessage.taskRows[0].records[0];
            console.log('[Appen Data Collector] 找到任务记录');
            
            // 获取阶段历史
            if (!record.phasesHistory || record.phasesHistory.length === 0) {
                console.log('[Appen Data Collector] phasesHistory 未找到或为空', {
                    hasPhasesHistory: !!record.phasesHistory,
                    phasesHistoryLength: record.phasesHistory?.length
                });
                return null;
            }
            
            console.log('[Appen Data Collector] 阶段历史数据长度:', record.phasesHistory.length);
            console.log('[Appen Data Collector] 阶段历史数据:', record.phasesHistory.map(p => ({
                jobType: p.jobType,
                status: p.status,
                name: p.name,
                submitTime: p.submitTime,
                cycleOrder: p.cycleOrder
            })));
            
            // 根据时间戳获取最新的QA REJECTED记录（而不仅依赖数组顺序）
            let qaRejectRecord = null;
            let latestTime = null;
            
            for (let i = 0; i < record.phasesHistory.length; i++) {
                const phase = record.phasesHistory[i];
                if (phase.jobType === 'QA' && phase.status === 'REJECTED') {
                    // 获取时间戳用于比较
                    const phaseTime = new Date(phase.submitTime || phase.assignedTime).getTime();
                    
                    // 如果还没有选定记录，或者这条记录的时间更新，则更新选定记录
                    if (!latestTime || phaseTime > latestTime) {
                        qaRejectRecord = phase;
                        latestTime = phaseTime;
                        console.log('[Appen Data Collector] 更新最新QA REJECTED记录，时间:', phase.submitTime || phase.assignedTime);
                    }
                }
            }
            
            if (!qaRejectRecord) {
                console.log('[Appen Data Collector] 未找到QA驳回记录');
                return null;
            }
            
            console.log('[Appen Data Collector] 选中的最新QA驳回记录:', {
                name: qaRejectRecord.name,
                status: qaRejectRecord.status,
                jobType: qaRejectRecord.jobType,
                submitTime: qaRejectRecord.submitTime,
                cycleOrder: qaRejectRecord.cycleOrder
            });
            
            // 解析驳回理由
            let rejectReason = '';
            if (qaRejectRecord.comment) {
                try {
                    // 尝试解析JSON格式的comment
                    const commentJson = JSON.parse(qaRejectRecord.comment);
                    if (commentJson.description?.blocks?.[0]?.text) {
                        rejectReason = commentJson.description.blocks[0].text;
                        console.log('[Appen Data Collector] 成功解析JSON格式驳回理由');
                    } else {
                        console.log('[Appen Data Collector] JSON中找不到blocks[0].text');
                    }
                } catch (e) {
                    // 如果不是JSON，直接使用原始值
                    rejectReason = qaRejectRecord.comment;
                    console.log('[Appen Data Collector] comment不是JSON格式，直接使用原始值');
                }
            } else {
                console.log('[Appen Data Collector] comment为空');
            }
            
            console.log('[Appen Data Collector] 从初始数据提取到的最新驳回理由:', rejectReason);
            
            // 构造返回对象
            return {
                hasRecord: true,
                dataSource: 'INITIAL_DATA',
                timestamp: new Date().toISOString(),
                latestRecord: {
                    type: 'REJECTED',
                    action: `被 ${qaRejectRecord.name || 'QA'} Rejected 请修订`,
                    comment: rejectReason,
                    operator: qaRejectRecord.name || 'QA',
                    operateTime: qaRejectRecord.submitTime || qaRejectRecord.assignedTime,
                    jobType: qaRejectRecord.jobType,
                    cycleOrder: qaRejectRecord.cycleOrder
                }
            };
            
        } catch (error) {
            console.warn('[Appen Data Collector] 从初始数据提取质检驳回理由时出错:', error);
            return null;
        }
    }

    // 提取质检记录信息
    function extractQualityCheckRecords(responseElements) {
        try {
            console.log('[Appen Data Collector] 开始提取质检记录信息');
            
            // 步骤1：优先从打开的质检窗口DOM提取（当用户按i键时，窗口已打开）
            const domQARecord = extractLatestQARejectFromDOM();
            if (domQARecord) {
                console.log('[Appen Data Collector] 质检记录提取完成 (来自打开的窗口DOM)');
                
                // 构造质检记录对象
                const qualityCheckRecord = {
                    hasRecord: true,
                    dataSource: 'DOM_POPOVER',
                    timestamp: new Date().toISOString(),
                    latestRecord: {
                        type: 'REJECTED',
                        action: `被 ${domQARecord.operator || 'QA'} Rejected 请修订`,
                        comment: domQARecord.comment || '',
                        operator: domQARecord.operator || 'QA',
                        operateTime: domQARecord.operateTime || '',
                        jobType: 'QA'
                    }
                };
                
                responseElements.qualityCheckRecord = qualityCheckRecord;
                
                // 输出最新的驳回理由信息
                console.log('\n========== 【质检驳回信息 - 从打开窗口提取】 ==========');
                console.log('| 数据来源: 质检窗口DOM (最实时)');
                console.log('| 用户ID:', collectedData.userId || 'N/A');
                console.log('| 任务ID:', collectedData.taskId || 'N/A');
                console.log('| 题目ID:', collectedData.topicId || 'N/A');
                console.log('| 质检状态: REJECTED (驳回)');
                console.log('| 操作人:', domQARecord.operator || 'N/A');
                console.log('| 操作时间:', domQARecord.operateTime || 'N/A');
                console.log('| 驳回理由:', domQARecord.comment || 'N/A');
                console.log('| 检测时间:', new Date().toISOString());
                console.log('================================================\n');
                
                // 输出完整JSON格式
                const latestQAData = {
                    userId: collectedData.userId || 'N/A',
                    taskId: collectedData.taskId || 'N/A',
                    topicId: collectedData.topicId || 'N/A',
                    qualityCheck: {
                        status: 'Rejected',
                        statusDetail: `被 ${domQARecord.operator || 'QA'} Rejected 请修订`,
                        rejectionReason: domQARecord.comment,
                        operator: domQARecord.operator,
                        operateTime: domQARecord.operateTime,
                        dataSource: 'DOM_POPOVER',
                        timestamp: new Date().toISOString()
                    }
                };
                console.log('[Appen Data Collector] 完整QA数据JSON:', JSON.stringify(latestQAData, null, 2));
                
                return;
            }
            
            // 步骤2：备用方案 - 从初始化数据提取
            console.log('[Appen Data Collector] DOM提取失败，尝试从初始数据提取');
            
            const initialDataResult = extractQualityCheckFromInitialData();
            if (initialDataResult) {
                responseElements.qualityCheckRecord = initialDataResult;
                console.log('[Appen Data Collector] 质检记录提取完成 (来自初始数据)');
                
                // 输出最新的驳回理由信息
                console.log('\n========== 【质检驳回信息 - 从初始数据提取】 ==========');
                console.log('| 数据来源: 初始化数据 (备用方案)');
                console.log('| 用户ID:', collectedData.userId || 'N/A');
                console.log('| 任务ID:', collectedData.taskId || 'N/A');
                console.log('| 题目ID:', collectedData.topicId || 'N/A');
                console.log('| 质检状态: REJECTED (驳回)');
                console.log('| 操作人:', initialDataResult.latestRecord.operator || 'N/A');
                console.log('| 操作时间:', initialDataResult.latestRecord.operateTime || 'N/A');
                console.log('| 驳回理由:', initialDataResult.latestRecord.comment || 'N/A');
                console.log('| 检测时间:', new Date().toISOString());
                console.log('================================================\n');
                
                // 输出完整JSON格式
                const latestQAData = {
                    userId: collectedData.userId || 'N/A',
                    taskId: collectedData.taskId || 'N/A',
                    topicId: collectedData.topicId || 'N/A',
                    qualityCheck: {
                        status: 'Rejected',
                        statusDetail: initialDataResult.latestRecord.action,
                        rejectionReason: initialDataResult.latestRecord.comment,
                        operator: initialDataResult.latestRecord.operator,
                        operateTime: initialDataResult.latestRecord.operateTime,
                        dataSource: 'INITIAL_DATA',
                        timestamp: new Date().toISOString()
                    }
                };
                console.log('[Appen Data Collector] 完整QA数据JSON:', JSON.stringify(latestQAData, null, 2));
                
                return;
            }
            
            console.log('[Appen Data Collector] 所有方案都失败，无法提取质检记录');

            // 使用更灵活的方式查找质检弹窗，优先查找可见的，然后查找隐藏的
            const qualityCheckPopover = document.querySelector('.ant-popover.custom-popover-with-lefter-arrow') ||
                                      document.querySelector('.ant-popover:not(.ant-popover-hidden)') ||
                                      document.querySelector('.ant-popover');

            if (!qualityCheckPopover) {
                console.log('[Appen Data Collector] 未找到质检弹窗，尝试查找隐藏的质检详情面板');
                // 如果常规方式没找到，尝试查找隐藏的质检详情面板
                const hiddenQualityCheckPanel = document.querySelector('.ant-popover-hidden.custom-popover-with-lefter-arrow') ||
                                               document.querySelector('.ant-popover-hidden.w-full.md\\:w-96') ||
                                               document.querySelector('.ant-popover-hidden');

                if (hiddenQualityCheckPanel) {
                    console.log('[Appen Data Collector] 找到隐藏的质检详情面板，临时显示以提取信息');
                    // 保存原始状态
                    const originalClasses = Array.from(hiddenQualityCheckPanel.classList);
                    const hadHiddenClass = hiddenQualityCheckPanel.classList.contains('ant-popover-hidden');

                    // 临时显示隐藏的面板
                    if (hadHiddenClass) {
                        hiddenQualityCheckPanel.classList.remove('ant-popover-hidden');
                        console.log('[Appen Data Collector] 已移除 ant-popover-hidden 类，面板显示');
                    }

                    // 等待 DOM 渲染后提取内容
                    setTimeout(() => {
                        try {
                            extractQualityCheckRecordsContent(responseElements);
                        } finally {
                            // 恢复原始状态
                            if (hadHiddenClass) {
                                // 先清空所有class，再恢复原始class
                                hiddenQualityCheckPanel.className = '';
                                originalClasses.forEach(cls => {
                                    hiddenQualityCheckPanel.classList.add(cls);
                                });
                                console.log('[Appen Data Collector] 已恢复面板隐藏状态');
                            }
                        }
                    }, 500); // 等待 DOM 更新
                    return;
                } else {
                    console.log('[Appen Data Collector] 未找到任何质检弹窗或面板');
                    responseElements.qualityCheckRecord = null;
                    return;
                }
            }

            console.log('[Appen Data Collector] 找到质检弹窗');

            // 保存原始状态
            const hadHiddenClass = qualityCheckPopover.classList.contains('ant-popover-hidden');
            console.log('[Appen Data Collector] 弹窗原始状态 - 隐藏:', hadHiddenClass);

            // 如果弹窗隐藏了，移除 ant-popover-hidden 类以显示
            if (hadHiddenClass) {
                qualityCheckPopover.classList.remove('ant-popover-hidden');
                console.log('[Appen Data Collector] 已移除 ant-popover-hidden 类，弹窗显示');
            }

            // 等待 DOM 渲染后提取内容
            setTimeout(() => {
                try {
                    extractQualityCheckRecordsContent(responseElements);
                } finally {
                    // 恢复原始状态
                    if (hadHiddenClass) {
                        qualityCheckPopover.classList.add('ant-popover-hidden');
                        console.log('[Appen Data Collector] 已恢复 ant-popover-hidden 类，弹窗隐藏');
                    }
                }
            }, 500); // 等待 DOM 更新
            
        } catch (error) {
            console.warn('[Appen Data Collector] 提取质检记录时出错:', error);
            responseElements.qualityCheckRecord = {
                hasRecord: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // 显示详细的QA记录面板
    function showDetailedQARecord() {
        try {
            // 尝试多种选择器查找隐藏的详细面板
            const popoverSelectors = [
                '.ant-popover-hidden.w-full.md\\:w-96',
                '.ant-popover-hidden[data-testid*="quality"]',
                '.ant-popover-hidden[class*="quality"]',
                '.ant-popover-hidden[class*="check"]',
                '.ant-popover-hidden'
            ];
            
            let hiddenPopover = null;
            
            // 按优先级查找面板
            for (const selector of popoverSelectors) {
                hiddenPopover = document.querySelector(selector);
                if (hiddenPopover) {
                    console.log('[Appen Data Collector] 使用选择器找到隐藏面板:', selector);
                    break;
                }
            }
            
            if (hiddenPopover) {
                // 保存原始样式
                const originalDisplay = hiddenPopover.style.display;
                const originalVisibility = hiddenPopover.style.visibility;
                const originalLeft = hiddenPopover.style.left;
                const originalTop = hiddenPopover.style.top;
                const originalZIndex = hiddenPopover.style.zIndex;
                const originalPosition = hiddenPopover.style.position;
                const originalClasses = Array.from(hiddenPopover.classList);
                
                // 移除隐藏class
                hiddenPopover.classList.remove('ant-popover-hidden');
                
                // 确保元素可见
                hiddenPopover.style.display = 'block';
                hiddenPopover.style.visibility = 'visible';
                
                // 调整位置到可见区域
                hiddenPopover.style.position = 'fixed';
                hiddenPopover.style.left = '56px';
                hiddenPopover.style.top = '573px';
                hiddenPopover.style.zIndex = '9999'; // 确保在最上层
                
                // 添加临时标识以便识别
                hiddenPopover.setAttribute('data-appen-temp-visible', 'true');
                
                console.log('[Appen Data Collector] 详细质检记录已显示');
                
                // 返回面板引用和恢复函数
                return {
                    element: hiddenPopover,
                    restore: function() {
                        // 恢复原始状态
                        // 先恢复所有原始class
                        hiddenPopover.className = ''; // 清空所有class
                        originalClasses.forEach(cls => {
                            hiddenPopover.classList.add(cls);
                        });
                        
                        // 恢复原始样式
                        hiddenPopover.style.display = originalDisplay;
                        hiddenPopover.style.visibility = originalVisibility;
                        hiddenPopover.style.left = originalLeft;
                        hiddenPopover.style.top = originalTop;
                        hiddenPopover.style.zIndex = originalZIndex;
                        hiddenPopover.style.position = originalPosition;
                        hiddenPopover.removeAttribute('data-appen-temp-visible');
                        console.log('[Appen Data Collector] 详细质检记录面板已恢复隐藏');
                    }
                };
            } else {
                console.log('[Appen Data Collector] 未找到隐藏的质检记录面板');
                return null;
            }
        } catch (error) {
            console.warn('[Appen Data Collector] 显示详细QA记录时出错:', error);
            return null;
        }
    }

    // 提取质检记录内容的具体实现
    function extractQualityCheckRecordsContent(responseElements) {
        try {
            console.log('[Appen Data Collector] 开始提取质检记录内容');

            // 根据用户建议，先尝试显示隐藏的详细面板
            const popoverControl = showDetailedQARecord();
            
            // 延迟提取，给DOM足够的时间渲染
            setTimeout(() => {
                // 尝试优先从打开的质检窗口DOM中提取最新驳回理由
                const domQARecord = extractLatestQARejectFromDOM();
                if (domQARecord) {
                    console.log('[Appen Data Collector] 成功从DOM提取最新QA驳回理由');
                    
                    // 构造质检记录对象
                    const qualityCheckRecord = {
                        hasRecord: true,
                        dataSource: 'DOM_POPOVER',
                        timestamp: new Date().toISOString(),
                        latestRecord: {
                            type: 'REJECTED',
                            action: `被 ${domQARecord.operator || 'QA'} Rejected 请修订`,
                            comment: domQARecord.comment || '',
                            operator: domQARecord.operator || 'QA',
                            operateTime: domQARecord.operateTime || '',
                            jobType: 'QA'
                        }
                    };
                    
                    responseElements.qualityCheckRecord = qualityCheckRecord;
                    
                    // 输出到控制台
                    console.log('\n========== 【从打开窗口提取的最新驳回理由】 ==========');
                    console.log('| 数据来源: 质检窗口DOM (实时)');
                    console.log('| 用户ID:', collectedData.userId || 'N/A');
                    console.log('| 任务ID:', collectedData.taskId || 'N/A');
                    console.log('| 题目ID:', collectedData.topicId || 'N/A');
                    console.log('| 质检状态: REJECTED (驳回)');
                    console.log('| 操作人:', domQARecord.operator || 'N/A');
                    console.log('| 操作时间:', domQARecord.operateTime || 'N/A');
                    console.log('| 驳回理由:', domQARecord.comment || 'N/A');
                    console.log('| 检测时间:', new Date().toISOString());
                    console.log('===============================================\n');
                } else {
                    console.log('[Appen Data Collector] DOM提取失败或窗口未打开，跳过此方案');
                }
                
                // 恢复面板状态
                if (popoverControl && typeof popoverControl.restore === 'function') {
                    setTimeout(() => {
                        popoverControl.restore();
                    }, 300);
                }
            }, 300);
            
        } catch (error) {
            console.warn('[Appen Data Collector] 提取质检记录内容时出错:', error);
            responseElements.qualityCheckRecord = {
                hasRecord: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // 显示详细的QA记录面板
    function showDetailedQARecord() {
        try {
            // 尝试多种选择器查找隐藏的详细面板
            const popoverSelectors = [
                '.ant-popover-hidden.w-full.md\\:w-96',
                '.ant-popover-hidden[data-testid*="quality"]',
                '.ant-popover-hidden[class*="quality"]',
                '.ant-popover-hidden[class*="check"]',
                '.ant-popover-hidden'
            ];
            
            let hiddenPopover = null;
            
            // 按优先级查找面板
            for (const selector of popoverSelectors) {
                hiddenPopover = document.querySelector(selector);
                if (hiddenPopover) {
                    console.log('[Appen Data Collector] 使用选择器找到隐藏面板:', selector);
                    break;
                }
            }
            
            if (hiddenPopover) {
                // 保存原始样式
                const originalDisplay = hiddenPopover.style.display;
                const originalVisibility = hiddenPopover.style.visibility;
                const originalLeft = hiddenPopover.style.left;
                const originalTop = hiddenPopover.style.top;
                const originalZIndex = hiddenPopover.style.zIndex;
                const originalPosition = hiddenPopover.style.position;
                const originalClasses = Array.from(hiddenPopover.classList);
                
                // 移除隐藏class
                hiddenPopover.classList.remove('ant-popover-hidden');
                
                // 确保元素可见
                hiddenPopover.style.display = 'block';
                hiddenPopover.style.visibility = 'visible';
                
                // 调整位置到可见区域
                hiddenPopover.style.position = 'fixed';
                hiddenPopover.style.left = '56px';
                hiddenPopover.style.top = '573px';
                hiddenPopover.style.zIndex = '9999'; // 确保在最上层
                
                // 添加临时标识以便识别
                hiddenPopover.setAttribute('data-appen-temp-visible', 'true');
                
                console.log('[Appen Data Collector] 详细质检记录已显示');
                
                // 返回面板引用和恢复函数
                return {
                    element: hiddenPopover,
                    restore: function() {
                        // 恢复原始状态
                        // 先恢复所有原始class
                        hiddenPopover.className = ''; // 清空所有class
                        originalClasses.forEach(cls => {
                            hiddenPopover.classList.add(cls);
                        });
                        
                        // 恢复原始样式
                        hiddenPopover.style.display = originalDisplay;
                        hiddenPopover.style.visibility = originalVisibility;
                        hiddenPopover.style.left = originalLeft;
                        hiddenPopover.style.top = originalTop;
                        hiddenPopover.style.zIndex = originalZIndex;
                        hiddenPopover.style.position = originalPosition;
                        hiddenPopover.removeAttribute('data-appen-temp-visible');
                        console.log('[Appen Data Collector] 详细质检记录面板已恢复隐藏');
                    }
                };
            } else {
                console.log('[Appen Data Collector] 未找到隐藏的质检记录面板');
                return null;
            }
        } catch (error) {
            console.warn('[Appen Data Collector] 显示详细QA记录时出错:', error);
            return null;
        }
    }

    // 监听用户选择状态变化
    function attachUserSelectionListeners() {
        console.log('[Appen Data Collector] 开始附加用户选择状态监听器');

        // 查找可能的单选按钮或选择元素
        const selectionElements = document.querySelectorAll(
            'input[type="radio"]',
            'input[type="checkbox"]',
            '.radio-button',
            '.checkbox',
            '.selection-option',
            '[role="radio"]',
            '[role="checkbox"]'
        );

        // 查找质检详情显示按钮（向下箭头图标）
        const qualityCheckTriggerElements = document.querySelectorAll(
            '.anticon-down, [aria-label="down"], [data-icon="down"]'
        );

        // 为质检详情触发元素添加点击监听器
        qualityCheckTriggerElements.forEach((element, index) => {
            element.addEventListener('click', function(event) {
                console.log('[Appen Data Collector] 检测到质检详情触发元素点击:', {
                    element: element.tagName,
                    className: element.className,
                    ariaLabel: element.getAttribute('aria-label'),
                    index: index
                });

                // 延迟执行质检记录提取，等待面板显示
                setTimeout(() => {
                    if (collectedData.responseElements) {
                        console.log('[Appen Data Collector] 质检详情触发后重新提取质检记录');
                        extractQualityCheckRecords(collectedData.responseElements);
                    }
                }, 300); // 等待面板动画完成
            });
        });

        selectionElements.forEach((element, index) => {
            // 监听点击事件
            element.addEventListener('click', function(event) {
                console.log('[Appen Data Collector] 检测到选择元素点击:', {
                    element: element.tagName,
                    id: element.id,
                    className: element.className,
                    index: index
                });
                // 延迟执行状态检测，等待页面更新
                setTimeout(() => {
                    if (collectedData.responseElements) {
                        detectUserSelectionStatus(collectedData.responseElements);
                        console.log('[Appen Data Collector] 用户选择后重新检测状态');
                    }
                }, 100);
            });

            // 监听变化事件（对于表单元素）
            if (element.tagName === 'INPUT' && (element.type === 'radio' || element.type === 'checkbox')) {
                element.addEventListener('change', function(event) {
                    console.log('[Appen Data Collector] 检测到选择元素变化:', {
                        element: element.tagName,
                        id: element.id,
                        className: element.className,
                        checked: element.checked,
                        index: index
                    });
                    // 延迟执行状态检测，等待页面更新
                    setTimeout(() => {
                        if (collectedData.responseElements) {
                            detectUserSelectionStatus(collectedData.responseElements);
                            console.log('[Appen Data Collector] 用户选择变化后重新检测状态');
                        }
                    }, 100);
                });
            }
        });

        // 监听可能影响状态的按钮点击
        const actionButtons = document.querySelectorAll(
            'button',
            '.btn',
            '[role="button"]'
        );

        actionButtons.forEach((button, index) => {
            button.addEventListener('click', function(event) {
                console.log('[Appen Data Collector] 检测到按钮点击:', {
                    buttonText: button.textContent.trim(),
                    id: button.id,
                    className: button.className,
                    index: index
                });
                // 延迟执行状态检测，等待页面更新
                setTimeout(() => {
                    if (collectedData.responseElements) {
                        detectUserSelectionStatus(collectedData.responseElements);
                        console.log('[Appen Data Collector] 按钮点击后重新检测状态');
                    }
                }, 300); // 稍长延迟，因为按钮点击可能触发更多页面变化
            });
        });

        // 使用 MutationObserver 监听 DOM 变化
        const observer = new MutationObserver(function(mutations) {
            let shouldCheckStatus = false;

            mutations.forEach(function(mutation) {
                // 检查是否有文本内容变化
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    // 检查变化的节点是否包含状态相关文本
                    const target = mutation.target;
                    if (target.nodeType === Node.TEXT_NODE) {
                        const text = target.textContent.trim().toLowerCase();
                        if (text.includes('有效') || text.includes('无效') || text.includes('valid') || text.includes('invalid') ||
                            text.includes('轮') || text.includes('round') || text.match(/\d+\s*轮/)) {
                            shouldCheckStatus = true;
                        }
                    } else if (target.nodeType === Node.ELEMENT_NODE) {
                        const text = target.textContent.trim().toLowerCase();
                        if (text.includes('有效') || text.includes('无效') || text.includes('valid') || text.includes('invalid') ||
                            text.includes('轮') || text.includes('round') || text.match(/\d+\s*轮/)) {
                            shouldCheckStatus = true;
                        }
                    }
                }

                // 检查是否有相关的属性变化
                if (mutation.type === 'attributes') {
                    if (mutation.attributeName === 'class' || mutation.attributeName === 'data-status' || 
                        mutation.attributeName === 'checked' || mutation.attributeName === 'aria-checked') {
                        shouldCheckStatus = true;
                        console.log('[Appen Data Collector] 检测到相关属性变化:', mutation.attributeName);
                    }
                }
            });

            if (shouldCheckStatus) {
                console.log('[Appen Data Collector] 检测到可能影响状态的DOM变化');
                // 防抖处理，避免频繁检测
                clearTimeout(window._statusCheckTimeout);
                window._statusCheckTimeout = setTimeout(() => {
                    if (collectedData.responseElements) {
                        detectUserSelectionStatus(collectedData.responseElements);
                        console.log('[Appen Data Collector] DOM变化后重新检测状态');
                    }
                }, 200);
            }
        });

        // 开始观察
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'data-status', 'checked', 'aria-checked']
        });

        console.log('[Appen Data Collector] 已附加用户选择状态监听器，监听元素数量:', selectionElements.length + actionButtons.length);
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
        // 输出所有质检驳回信息到控制台
        logQualityCheckInfo: logAllQualityCheckInfo,
        // 获取最新的认证cookie
        getLatestAuthCookies: async function() {
            try {
                console.log('[Appen Data Collector] 获取最新的认证cookie');
                const authCookies = await getAuthCookies();
                if (authCookies) {
                    collectedData.authCookies = authCookies;
                    console.log('[Appen Data Collector] 认证cookie已更新:', authCookies);
                }
                return authCookies;
            } catch (error) {
                console.error('[Appen Data Collector] 获取最新认证cookie失败:', error);
                return null;
            }
        },
        // 获取详细的Cookie信息用于显示
        getDetailedCookies: async function() {
            try {
                console.log('[Appen Data Collector] 获取详细的Cookie信息');
                const authCookies = await getAuthCookies();
                if (authCookies) {
                    collectedData.authCookies = authCookies;
                    console.log('[Appen Data Collector] 详细的Cookie信息已更新:', authCookies);
                }
                return authCookies;
            } catch (error) {
                console.error('[Appen Data Collector] 获取详细Cookie信息失败:', error);
                return null;
            }
        },
        // 重置收集器
        reset: function() {
            collectedData = {
                userId: collectedData.userId,
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
        submitAnnotation: pushDataOnSubmission,
        // 手动提取响应元素
        extractResponseElements: function() {
            // 只在目标页面允许提取响应元素
            if (!isTargetPage()) {
                console.log('[Appen Data Collector] 当前不是目标页面，无法提取响应元素');
                return null;
            }
            return extractResponseElements();
        },
        // 检查是否为目标页面
        isTargetPage: isTargetPage,
        // 获取认证cookie
        getAuthCookies: function() {
            // 只在目标页面允许获取cookie
            if (!isTargetPage()) {
                console.log('[Appen Data Collector] 当前不是目标页面，无法获取cookie');
                return Promise.resolve(null);
            }
            return getAuthCookies();
        },
        // 同步认证信息到服务端
        syncAuthToServer: function(authCookies) {
            return syncAuthToServer(authCookies);
        },
        // 显示数据模态框
        showModal: showDataModal
    };

    // 定期检查URL变化和页面内容变化
    function watchUrlChanges() {
        console.log('[Appen Data Collector] 开始监控URL变化和页面内容变化');
        let lastUrl = location.href;
        let lastCheckTime = Date.now();

        new MutationObserver(() => {
            const url = location.href;
            const now = Date.now();

            // 检查 URL 变化
            if (url !== lastUrl) {
                console.log('[Appen Data Collector] URL确实发生变化:', { from: lastUrl, to: url });
                lastUrl = url;
                onUrlChange();
            }
            // 即使 URL 没有变化，也定期检查页面内容（每3秒检查一次）
            else if (now - lastCheckTime > 3000) {
                console.log('[Appen Data Collector] URL未变化，但定期检查页面内容');
                lastCheckTime = now;
                checkPageContentChange();
            }
        }).observe(document, { subtree: true, childList: true });
    }

    // 自动提取质检记录的函数（无需用户交互）
    function extractQualityCheckRecordsAutomatically() {
        try {
            console.log('[Appen Data Collector] 自动提取质检记录开始');

            // 尝试查找并显示隐藏的质检面板
            const popoverControl = showDetailedQARecord();

            // 查找质检记录弹窗
            const qualityCheckPopover = document.querySelector('.ant-popover.custom-popover-with-lefer-arrow') ||
                                      document.querySelector('.ant-popover:not(.ant-popover-hidden)') ||
                                      document.querySelector('.ant-popover') ||
                                      (popoverControl ? popoverControl.element : null) ||
                                      document.querySelector('.ant-popover-hidden.w-full.md\\:w-96');

            if (!qualityCheckPopover) {
                console.log('[Appen Data Collector] 未找到质检记录弹窗，尝试主动显示');
                // 如果没找到，尝试更积极的查找方式
                const hiddenPopovers = document.querySelectorAll('.ant-popover-hidden');
                if (hiddenPopovers.length > 0) {
                    // 尝试显示第一个隐藏的弹窗
                    const firstHiddenPopover = hiddenPopovers[0];
                    const originalClasses = Array.from(firstHiddenPopover.classList);
                    firstHiddenPopover.classList.remove('ant-popover-hidden');
                    console.log('[Appen Data Collector] 主动显示隐藏弹窗');

                    // 延迟提取内容
                    setTimeout(() => {
                        extractQualityCheckRecordsContent(collectedData.responseElements);

                        // 恢复隐藏状态
                        setTimeout(() => {
                            // 先清空所有class，再恢复原始class
                            firstHiddenPopover.className = '';
                            originalClasses.forEach(cls => {
                                firstHiddenPopover.classList.add(cls);
                            });
                            console.log('[Appen Data Collector] 恢复弹窗隐藏状态');
                        }, 1000);
                    }, 300);
                    return;
                }
            }

            if (qualityCheckPopover) {
                console.log('[Appen Data Collector] 找到质检记录弹窗，开始提取内容');
                // 保存原始状态
                const hadHiddenClass = qualityCheckPopover.classList.contains('ant-popover-hidden');

                // 如果弹窗隐藏了，临时显示
                if (hadHiddenClass) {
                    qualityCheckPopover.classList.remove('ant-popover-hidden');
                    console.log('[Appen Data Collector] 临时显示隐藏的质检弹窗');
                }

                // 延迟提取内容
                setTimeout(() => {
                    extractQualityCheckRecordsContent(collectedData.responseElements);

                    // 恢复原始状态
                    if (hadHiddenClass) {
                        setTimeout(() => {
                            qualityCheckPopover.classList.add('ant-popover-hidden');
                            console.log('[Appen Data Collector] 恢复质检弹窗隐藏状态');
                        }, 500);
                    }

                    // 如果使用了popoverControl，恢复面板状态
                    if (popoverControl && typeof popoverControl.restore === 'function') {
                        setTimeout(() => {
                            popoverControl.restore();
                        }, 500);
                    }
                }, 200);
            } else {
                console.log('[Appen Data Collector] 未找到质检记录弹窗，使用原有方法');
                // 回退到原有方法
                extractQualityCheckRecords(collectedData.responseElements);
            }

        } catch (error) {
            console.warn('[Appen Data Collector] 自动提取质检记录时出错:', error);
        }
    }

    // 检查页面内容变化
    function checkPageContentChange() {
        // 只在目标页面上检查
        if (isTargetPage()) {
            console.log('[Appen Data Collector] 定期检查目标页面内容变化');
            
            // 获取当前题目ID
            const currentTopicId = getSpecifiedElementId(true); // 传入 true 表示这是定期检查
            
            console.log('[Appen Data Collector] 检查题目ID变化:', {
                lastTopicId: lastTopicId,
                currentTopicId: currentTopicId
            });
            
            // 检测题目ID是否变化（新的标注页）
            if (lastTopicId !== null && lastTopicId !== currentTopicId && currentTopicId !== null && currentTopicId !== 'no-id') {
                console.log('[Appen Data Collector] 检测到新的标注页面，题目ID发生变化:', {
                    oldTopicId: lastTopicId,
                    newTopicId: currentTopicId
                });
                
                // 重置开始时间
                const newStartTime = Date.now();
                collectedData.startTime = newStartTime;
                
                console.log('[Appen Data Collector] 重置计时器，新的开始时间:', new Date(newStartTime).toISOString());
                
                // 重新收集题目信息
                collectTopicInfo();
                
                // 提取响应元素
                setTimeout(() => {
                    extractResponseElements();
                    attachUserSelectionListeners();
                }, 500);
            }
            
            // 更新上一个题目ID并保存到缓存
            lastTopicId = currentTopicId;
            if (currentTopicId && currentTopicId !== 'no-id') {
                saveCachedTopicId(currentTopicId);
            }
        }
    }

    // 获取目标 div 的 id
    function getTargetDivId() {
        try {
            console.log('[Appen Data Collector] 开始查找目标 div 元素');

            // 尝试多种选择器
            const selectors = [
                'body > div:nth-child(2) form > div > main > div > div > div > div > div > div > div > div > div > div',
                'form main .ant-card-body',
                '.ant-card-body > div',
                '[class*="question"]',
                '[class*="task"]',
                '[data-testid*="question"]',
                '[role="main"] div'
            ];

            let targetDiv = null;
            let usedSelector = '';

            for (const selector of selectors) {
                targetDiv = document.querySelector(selector);
                if (targetDiv) {
                    usedSelector = selector;
                    console.log('[Appen Data Collector] 使用选择器找到目标 div:', selector);
                    break;
                }
            }

            // 如果常规选择器都没找到，尝试查找包含特定内容的 div
            if (!targetDiv) {
                console.log('[Appen Data Collector] 常规选择器未找到，尝试查找包含题目内容的 div');
                const allDivs = Array.from(document.querySelectorAll('div'));
                targetDiv = allDivs.find(div => {
                    const text = div.textContent.trim();
                    // 查找可能包含题目内容的 div（根据常见模式）
                    return text.length > 10 &&
                           (text.includes('题目') || text.includes('问题') || text.includes('Question') ||
                            div.children.length > 0);
                });
                if (targetDiv) {
                    console.log('[Appen Data Collector] 通过内容匹配找到目标 div');
                }
            }

            if (!targetDiv) {
                console.log('[Appen Data Collector] 未找到目标 div，尝试获取页面上所有主要的 div 元素');
                const mainDivs = document.querySelectorAll('main > div, .main > div, [role="main"] > div');
                if (mainDivs.length > 0) {
                    // 选择第二个 div，通常是题目容器
                    targetDiv = mainDivs[Math.min(1, mainDivs.length - 1)];
                    console.log('[Appen Data Collector] 通过 main 查找找到目标 div，索引:', Math.min(1, mainDivs.length - 1));
                }
            }

            if (!targetDiv) {
                console.log('[Appen Data Collector] 未找到目标 div');
                return null;
            }

            const divId = targetDiv.id || targetDiv.getAttribute('data-id') || targetDiv.getAttribute('data-key') || 'no-id';
            console.log('[Appen Data Collector] 目标 div id:', divId);
            console.log('[Appen Data Collector] 目标 div 类名:', targetDiv.className);
            console.log('[Appen Data Collector] 目标 div 内容预览:', targetDiv.textContent.substring(0, 100));

            return divId;
        } catch (error) {
            console.error('[Appen Data Collector] 获取目标 div id 失败:', error);
            return null;
        }
    }

    // 获取指定 XPath 元素的 ID
    function getSpecifiedElementId(isPeriodicCheck = false) {
        try {
            const currentUrl = window.location.href;
            console.log('[Appen Data Collector] 开始查找指定路径的 div 元素');
            console.log('[Appen Data Collector] 当前页面 URL:', currentUrl);
            console.log('[Appen Data Collector] 是否为定期检查:', isPeriodicCheck);

            // 检查是否是新页面
            const isNewPage = currentPageUrl !== currentUrl;
            if (isNewPage) {
                console.log('[Appen Data Collector] 检测到新页面加载');
                currentPageUrl = currentUrl;
            }

            // 检查页面上是否存在 div 元素
            const allDivs = document.querySelectorAll('div');
            console.log('[Appen Data Collector] 页面上 div 元素总数:', allDivs.length);

            // 尝试多种方法查找目标元素
            let targetDiv = null;
            let methodUsed = '';

            // 方法1: 原始XPath查找
            try {
                targetDiv = document.evaluate(
                    '/html/body/div[2]/form/div/main/div/div/div/div/div/div/div/div/div/div',
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
                if (targetDiv) {
                    methodUsed = 'XPath';
                    console.log('[Appen Data Collector] 通过XPath找到目标元素');
                }
            } catch (xpathError) {
                console.log('[Appen Data Collector] XPath查找失败:', xpathError.message);
            }

            // 方法2: CSS选择器查找
            if (!targetDiv) {
                try {
                    const cssSelectors = [
                        'body > div:nth-child(2) > form > div > main > div > div > div > div > div > div > div > div > div > div',
                        'form main .ant-card-body > div',
                        '.ant-card-body > div > div',
                        '[class*="question"] > div',
                        '[class*="task"] > div',
                        'main > div > div > div > div > div > div > div > div > div'
                    ];

                    for (const selector of cssSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            targetDiv = element;
                            methodUsed = 'CSS: ' + selector;
                            console.log('[Appen Data Collector] 通过CSS选择器找到目标元素:', selector);
                            break;
                        }
                    }
                } catch (cssError) {
                    console.log('[Appen Data Collector] CSS选择器查找失败:', cssError.message);
                }
            }

            // 方法3: 通过内容特征查找
            if (!targetDiv) {
                try {
                    console.log('[Appen Data Collector] 尝试通过内容特征查找目标元素');
                    const allDivsArray = Array.from(document.querySelectorAll('div'));
                    targetDiv = allDivsArray.find(div => {
                        // 查找可能包含题目内容的div
                        const text = div.textContent.trim();
                        return text.length > 20 &&
                               (text.includes('题目') || text.includes('问题') || text.includes('Question') ||
                                text.includes('Task') || text.includes('标注')) &&
                               div.children.length > 0;
                    });
                    if (targetDiv) {
                        methodUsed = 'Content Matching';
                        console.log('[Appen Data Collector] 通过内容匹配找到目标元素');
                    }
                } catch (contentError) {
                    console.log('[Appen Data Collector] 内容匹配查找失败:', contentError.message);
                }
            }

            // 方法4: 查找具有特定属性的元素
            if (!targetDiv) {
                try {
                    console.log('[Appen Data Collector] 尝试通过属性查找目标元素');
                    const attributeSelectors = [
                        '[data-testid*="question"]',
                        '[data-id]',
                        '[id*="question"]',
                        '[id*="task"]'
                    ];

                    for (const selector of attributeSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            targetDiv = element;
                            methodUsed = 'Attribute: ' + selector;
                            console.log('[Appen Data Collector] 通过属性选择器找到目标元素:', selector);
                            break;
                        }
                    }
                } catch (attrError) {
                    console.log('[Appen Data Collector] 属性选择器查找失败:', attrError.message);
                }
            }

            console.log('[Appen Data Collector] 查找结果 - 方法:', methodUsed || 'None', '元素:', targetDiv);

            if (!targetDiv) {
                console.log('[Appen Data Collector] 未找到指定路径的 div 元素');

                // 尝试获取页面上主要的div元素作为备选
                try {
                    const mainDivs = document.querySelectorAll('main > div, .main > div, [role="main"] > div');
                    if (mainDivs.length > 0) {
                        // 选择包含内容较多的div
                        let bestDiv = mainDivs[0];
                        let maxContentLength = 0;

                        mainDivs.forEach(div => {
                            const contentLength = div.textContent.length;
                            if (contentLength > maxContentLength) {
                                maxContentLength = contentLength;
                                bestDiv = div;
                            }
                        });

                        targetDiv = bestDiv;
                        methodUsed = 'Main Content Selection';
                        console.log('[Appen Data Collector] 通过主要内容选择找到备选元素');
                    }
                } catch (mainError) {
                    console.log('[Appen Data Collector] 主内容选择失败:', mainError.message);
                }

                if (!targetDiv) {
                    return null;
                }
            }

            const divId = targetDiv.id || targetDiv.getAttribute('data-id') || targetDiv.getAttribute('data-key') || 'no-id';
            console.log('[Appen Data Collector] =============== getSpecifiedElementId 返回结果 ===============');
            console.log('[Appen Data Collector] 找到的 div 元素 id:', divId);
            console.log('[Appen Data Collector] div.id:', targetDiv.id);
            console.log('[Appen Data Collector] div[data-id]:', targetDiv.getAttribute('data-id'));
            console.log('[Appen Data Collector] div[data-key]:', targetDiv.getAttribute('data-key'));
            console.log('[Appen Data Collector] 使用的方法:', methodUsed);
            console.log('[Appen Data Collector] 元素类名:', targetDiv.className);
            console.log('[Appen Data Collector] 元素内容预览:', targetDiv.textContent.substring(0, 100));
            console.log('[Appen Data Collector] =============== 返回 divId: ' + divId + ' ===============');

            // 检查是否是新 ID 或定期检查时 ID 发生变化
            if ((isNewPage || isPeriodicCheck) && lastSpecifiedElementId !== null) {
                if (lastSpecifiedElementId !== divId) {
                    console.log('[Appen Data Collector] 检测到页面内容变化，新旧 ID 不同:', {
                        oldId: lastSpecifiedElementId,
                        newId: divId,
                        isNewPage: isNewPage,
                        isPeriodicCheck: isPeriodicCheck,
                        method: methodUsed
                    });
                } else if (isPeriodicCheck) {
                    console.log('[Appen Data Collector] 定期检查，ID 未发生变化:', divId);
                } else {
                    console.log('[Appen Data Collector] 检测到页面切换，但 ID 相同:', divId);
                }
            }

            // 缓存当前 ID
            lastSpecifiedElementId = divId;

            // 将指定元素 ID 作为题目 ID 存储
            if (divId && divId !== 'no-id') {
                specifiedElementIdAsTopicId = divId;
                console.log('[Appen Data Collector] 将指定元素 ID 作为题目 ID 存储:', divId);

                // 更新 collectedData 中的 topicId
                if (collectedData) {
                    collectedData.topicId = divId;
                    console.log('[Appen Data Collector] 更新 collectedData.topicId:', divId);
                }
            }

            return divId;
        } catch (error) {
            console.error('[Appen Data Collector] 获取指定路径 div 元素 id 失败:', error);
            console.error('[Appen Data Collector] 错误堆栈:', error.stack);
            return null;
        }
    }

    // URL变化时的处理函数
    async function onUrlChange() {
        console.log('[Appen Data Collector] URL变化检测:', window.location.href);

        // 先从缓存读取用户ID（如果还没有的话）
        if (!collectedData.userId || collectedData.userId === 'unknown_user') {
            const cachedUserId = await getCachedUserId();
            if (cachedUserId) {
                console.log('[Appen Data Collector] URL变化时从缓存读取用户ID:', cachedUserId);
                collectedData.userId = cachedUserId;
            }
        }

        if (isTargetPage()) {
            console.log('[Appen Data Collector] 检测到标注页面URL变化');
            console.log('[Appen Data Collector] 当前页面 URL:', window.location.href);
            console.log('[Appen Data Collector] URL 匹配结果:', isTargetPage());

            // 获取当前的目标 div id
            const currentDivId = getTargetDivId();
            console.log('[Appen Data Collector] 当前 div id:', currentDivId);

            // 获取指定路径元素的 ID
            const specifiedElementId = getSpecifiedElementId(false); // 传入 false 表示这不是定期检查
            console.log('[Appen Data Collector] 指定路径元素 ID:', specifiedElementId);

            // 收集任务信息以获取任务ID
            collectTaskInfo();
            console.log('[Appen Data Collector] 当前任务ID:', collectedData.taskId);

            // 检查是否是新任务
            const isNewTask = lastTaskId !== collectedData.taskId && collectedData.taskId !== null && collectedData.taskId !== 'unknown_task';
            if (isNewTask) {
                console.log('[Appen Data Collector] 检测到新任务，重置计时器');
                console.log('[Appen Data Collector] 上一个任务ID:', lastTaskId, '当前任务ID:', collectedData.taskId);
                lastTaskId = collectedData.taskId;

                // 重置开始时间
                const newStartTime = Date.now();
                collectedData.startTime = newStartTime;
                await clearCachedStartTime(); // 清除旧的缓存
                await saveCachedStartTime(newStartTime); // 保存新的开始时间
                console.log('[Appen Data Collector] 新任务的开始时间已保存到缓存:', new Date(newStartTime).toISOString());
            } else {
                // 如果是同一个任务或题目，检查是否已有缓存的开始时间
                const cachedStartTime = await getCachedStartTime();
                if (cachedStartTime) {
                    console.log('[Appen Data Collector] 从缓存读取任务开始时间，继续计时，不重置计时器');
                    collectedData.startTime = cachedStartTime;
                } else {
                    // 缓存中没有，说明是第一次进入标注页面或缓存已清除
                    const newStartTime = Date.now();
                    console.log('[Appen Data Collector] 第一次进入标注页面或缓存已清除，记录开始时间');
                    collectedData.startTime = newStartTime;
                    await saveCachedStartTime(newStartTime);
                    console.log('[Appen Data Collector] 开始时间已保存到缓存:', new Date(newStartTime).toISOString());
                }
            }

            if (!collectedData.responseElements) {
                console.log('[Appen Data Collector] 开始提取响应元素');

                // 获取认证cookie
                try {
                    console.log('[Appen Data Collector] 获取认证cookie');
                    const authCookies = await getAuthCookies();
                    if (authCookies) {
                        collectedData.authCookies = authCookies;
                        // 同步认证信息到服务端
                        await syncAuthToServer(authCookies);
                    }
                } catch (error) {
                    console.warn('[Appen Data Collector] 获取认证cookie失败:', error);
                }

                // 提取响应元素
                setTimeout(extractResponseElements, 1000); // 等待页面加载完成
            }
        } else {
            // 离开标注页面时清除缓存的开始时间
            console.log('[Appen Data Collector] 离开标注页面，清除缓存的开始时间');
            await clearCachedStartTime();
            // 重置上一个任务ID
            lastTaskId = null;
        }
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initializeDataCollector();
            watchUrlChanges();
        });
    } else {
        initializeDataCollector();
        watchUrlChanges();
    }

})();
