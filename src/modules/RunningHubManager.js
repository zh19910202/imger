/**
 * RunningHub 管理器模块
 * 负责 AI 图片处理相关的所有功能，包括任务管理、状态轮询、结果缓存等
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    // 如果 debugLog 不可用，使用 console.log 作为备选
    window.debugLog = function(message, data) {
        console.log('[RunningHub]', message, data || '');
    };
}

class RunningHubManager {
    constructor() {
        this.initialized = false;
        this.stateManager = new RunningHubStateManager();
        this.cacheManager = new RunningHubCacheManager();
        this.taskManager = new RunningHubTaskManager();
        this.config = null;
    }

    isInitialized() {
        return this.initialized;
    }

    getStateManager() {
        return this.stateManager;
    }

    getCacheManager() {
        return this.cacheManager;
    }

    getTaskManager() {
        return this.taskManager;
    }

    async initialize() {
        try {
            debugLog('初始化 RunningHubManager');
            this.config = await this.loadRunningHubConfig();
            this.initialized = true;
            debugLog('RunningHubManager 初始化完成');
        } catch (error) {
            debugLog('RunningHubManager 初始化失败:', error);
            throw error;
        }
    }

    // 加载 RunningHub 配置
    async loadRunningHubConfig() {
        try {
            const configUrl = chrome.runtime.getURL('runninghub-config.json');
            const response = await fetch(configUrl);
            if (!response.ok) {
                throw new Error('配置文件加载失败');
            }
            const config = await response.json();
            debugLog('RunningHub配置加载成功', config);
            return config;
        } catch (error) {
            debugLog('加载RunningHub配置失败:', error);
            throw error;
        }
    }

    // 创建工作流任务
    async createWorkflowTask(apiKey, prompt, imageFileName = null, workflowName = 'defaultWorkflow') {
        try {
            const config = this.config || await this.loadRunningHubConfig();

            // 兼容旧的配置格式
            let workflowConfig;
            if (workflowName === 'defaultWorkflow' && config.defaultWorkflow) {
                // 旧格式：直接在 config.defaultWorkflow
                workflowConfig = config.defaultWorkflow;
            } else if (config.webapps && config.webapps[workflowName]) {
                // 新格式：在 config.webapps[workflowName]
                workflowConfig = config.webapps[workflowName];
            } else {
                throw new Error(`工作流 "${workflowName}" 配置不存在`);
            }

            // 适配不同的配置格式
            let webappId, nodeMapping = {};
            if (workflowConfig.webappId) {
                // 新格式
                webappId = workflowConfig.webappId;
                nodeMapping = workflowConfig.nodeMapping || {};
            } else if (workflowConfig.nodeInfoList) {
                // 旧格式：从 nodeInfoList 中提取信息
                webappId = workflowConfig.webappId;
                // 需要将 nodeInfoList 转换为新格式的 inputs
                debugLog('使用旧配置格式，转换为新格式', { workflowConfig });
            }

            debugLog('创建工作流任务', {
                workflowName,
                webappId,
                prompt,
                imageFileName,
                configFormat: workflowConfig.nodeInfoList ? 'old' : 'new'
            });

            // 如果是旧格式，使用不同的处理方式
            if (workflowConfig.nodeInfoList) {
                return await this.createWorkflowTaskOldFormat(apiKey, prompt, imageFileName, workflowConfig);
            }

            const requestBody = {
                apiKey: apiKey,
                webappId: webappId,
                inputs: [
                    {
                        nodeId: nodeMapping.promptNode || "1",
                        fieldName: "text",
                        fieldValue: prompt
                    }
                ]
            };

            // 如果有图片文件名，添加图片输入
            if (imageFileName && nodeMapping.imageNode) {
                requestBody.inputs.push({
                    nodeId: nodeMapping.imageNode,
                    fieldName: "image",
                    fieldValue: imageFileName
                });
            }

            const requestOptions = {
                method: "POST",
                headers: {
                    "Host": "www.runninghub.cn",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            };

            debugLog('发送工作流任务请求', requestOptions);

            const response = await fetch("https://www.runninghub.cn/task/openapi/ai-app/run", requestOptions);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            debugLog('工作流任务创建响应', data);

            if (data.code !== 0) {
                throw new Error(data.msg || '创建任务失败');
            }

            return {
                success: true,
                taskId: data.data.taskId,
                message: data.msg || '任务创建成功'
            };

        } catch (error) {
            debugLog('创建工作流任务失败:', error);
            throw error;
        }
    }

    // 处理旧格式配置的工作流任务创建
    async createWorkflowTaskOldFormat(apiKey, prompt, imageFileName, workflowConfig) {
        try {
            debugLog('使用旧格式创建工作流任务', { workflowConfig });

            // 深拷贝配置并替换占位符（兼容旧逻辑）
            const nodeInfoList = JSON.parse(JSON.stringify(workflowConfig.nodeInfoList));
            nodeInfoList.forEach(node => {
                if (node.fieldValue === "{PROMPT}") {
                    node.fieldValue = prompt;
                } else if (node.fieldValue === "{IMAGE_FILE}" && imageFileName) {
                    node.fieldValue = imageFileName;
                }
            });

            const requestBody = {
                "webappId": workflowConfig.webappId,
                "apiKey": apiKey,
                "nodeInfoList": nodeInfoList
            };

            const requestOptions = {
                method: "POST",
                headers: {
                    "Host": "www.runninghub.cn",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            };

            debugLog('发送旧格式工作流任务请求', requestOptions);

            const response = await fetch("https://www.runninghub.cn/task/openapi/ai-app/run", requestOptions);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            debugLog('旧格式工作流任务创建响应', data);

            if (data.code !== 0) {
                throw new Error(data.msg || '创建任务失败');
            }

            return {
                success: true,
                taskId: data.data.taskId,
                message: data.msg || '任务创建成功'
            };

        } catch (error) {
            debugLog('旧格式工作流任务创建失败:', error);
            throw error;
        }
    }

    // 上传图片到 RunningHub
    async uploadToRunningHub(imageFile, apiKey, comment) {
        try {
            debugLog('开始上传图片到RunningHub', {
                fileName: imageFile.name,
                size: imageFile.size,
                type: imageFile.type,
                comment
            });

            const formData = new FormData();
            formData.append('file', imageFile);
            formData.append('apiKey', apiKey);

            const requestOptions = {
                method: "POST",
                headers: {
                    "Host": "www.runninghub.cn"
                },
                body: formData
            };

            const response = await fetch("https://www.runninghub.cn/task/openapi/upload", requestOptions);

            if (!response.ok) {
                throw new Error(`上传失败: HTTP ${response.status}`);
            }

            const data = await response.json();
            debugLog('图片上传响应', data);

            if (data.code !== 0) {
                throw new Error(data.msg || '上传失败');
            }

            return {
                success: true,
                fileName: data.data.fileName,
                message: data.msg || '上传成功'
            };

        } catch (error) {
            debugLog('上传图片失败:', error);
            throw error;
        }
    }

    // 轮询任务状态
    async pollRunningHubTaskStatus(apiKey, taskId, onTick) {
        const statusUrl = 'https://www.runninghub.cn/task/openapi/status';
        // 保存到全局，供取消按钮使用
        window._rhTaskIdForCancel = taskId;
        window._rhApiKeyForCancel = apiKey;
        window._rhCancelRequested = window._rhCancelRequested || false;
        const headers = { 'Host': 'www.runninghub.cn', 'Content-Type': 'application/json' };
        const body = JSON.stringify({ apiKey, taskId });
        const intervalMs = 3000;
        const maxWaitMs = 210000;
        const start = Date.now();

        debugLog('开始轮询任务状态', { taskId, intervalMs, maxWaitMs });
        window._rhPollingActive = true;
        window._rhLastStatus = 'QUEUED';

        // 打印轮询开始信息
        console.log(`\n🚀 ======== RunningHub 轮询开始 ========`);
        console.log(`🕐 开始时间: ${new Date().toLocaleTimeString()}`);
        console.log(`🆔 任务ID: ${taskId}`);
        console.log(`⏱️ 轮询间隔: ${intervalMs}ms`);
        console.log(`⏰ 超时时间: ${Math.round(maxWaitMs / 1000)}秒`);
        console.log(`🔄 预计最大轮询次数: ${Math.round(maxWaitMs / intervalMs)}`);
        console.log(`==========================================\n`);

        let pollCount = 0;

        while (true) {
            pollCount++;
            debugLog(`轮询第${pollCount}次`, { elapsed: Date.now() - start });

            if (window._rhCancelRequested) {
                debugLog('检测到取消请求，停止轮询');
                // 重要：通过新模块和兼容模式双重重置轮询状态（取消情况）
                window._rhPollingActive = false;
                if (window.runningHubManager && window.runningHubManager.isInitialized()) {
                    window.runningHubManager.getStateManager().set('isPollingActive', false);
                    debugLog('取消时通过新模块重置轮询状态为false');
                }
                throw new Error('任务已取消');
            }

            const resp = await fetch(statusUrl, { method: 'POST', headers, body });
            if (!resp.ok) {
                debugLog('状态查询HTTP错误', { status: resp.status });
                throw new Error('查询状态失败: HTTP ' + resp.status);
            }

            const data = await resp.json().catch(() => ({}));
            const code = data?.code;
            const status = data?.data?.taskStatus || data?.taskStatus || data?.data;
            const msg = data?.msg || data?.message;

            window._rhLastStatus = status;
            window._rhLastMsg = msg;
            window._rhLastPollCount = pollCount;

            debugLog(`第${pollCount}次轮询结果`, { code, status, msg, rawData: data });

            // 详细打印轮询状态到控制台
            const elapsedMs = Date.now() - start; // 毫秒
            const elapsedSec = Math.round(elapsedMs / 1000); // 秒
            console.log(`📊 第${pollCount}次轮询 | ⏱️ ${elapsedSec}s | 状态: ${status || '未知'} | 消息: ${msg || '无'}`);

            // 通知回调函数更新状态
            if (onTick) {
                try {
                    // 保持与旧版本的兼容性，传递对象格式
                    onTick({
                        pollCount,
                        status,
                        msg,
                        elapsed: elapsedMs // 传递毫秒数，保持与旧代码一致
                    });
                } catch (callbackError) {
                    debugLog('onTick回调执行失败:', callbackError);
                }
            }

            // 检查是否成功
            if (code === 0 && (status === 'SUCCESS' || status === 'COMPLETED')) {
                debugLog('任务成功完成');
                console.log(`\n✅ ======== 任务完成 ========`);
                console.log(`🕐 完成时间: ${new Date().toLocaleTimeString()}`);
                console.log(`⏱️ 总耗时: ${elapsedSec}秒`);
                console.log(`🔄 总轮询次数: ${pollCount}`);
                console.log(`=============================\n`);

                // 重要：通过新模块和兼容模式双重重置轮询状态（成功情况）
                window._rhPollingActive = false;
                if (window.runningHubManager && window.runningHubManager.isInitialized()) {
                    window.runningHubManager.getStateManager().set('isPollingActive', false);
                    debugLog('成功时通过新模块重置轮询状态为false');
                }

                return {
                    final: 'SUCCESS',
                    data,
                    pollCount,
                    elapsed: elapsedMs, // 毫秒数
                    totalTime: elapsedMs // 兼容性：旧代码期望毫秒数，会自己除以1000
                };
            }

            // 检查是否失败
            if (code !== 0 || status === 'FAILED' || status === 'ERROR') {
                debugLog('任务失败', { code, status, msg });
                console.log(`\n❌ ======== 任务失败 ========`);
                console.log(`🕐 失败时间: ${new Date().toLocaleTimeString()}`);
                console.log(`⏱️ 总耗时: ${elapsedSec}秒`);
                console.log(`🔄 总轮询次数: ${pollCount}`);
                console.log(`❌ 失败原因: ${msg || '未知错误'}`);
                console.log(`=============================\n`);

                // 重要：通过新模块和兼容模式双重重置轮询状态（失败情况）
                window._rhPollingActive = false;
                if (window.runningHubManager && window.runningHubManager.isInitialized()) {
                    window.runningHubManager.getStateManager().set('isPollingActive', false);
                    debugLog('失败时通过新模块重置轮询状态为false');
                }

                throw new Error(msg || '任务执行失败');
            }

            // 检查超时
            if (Date.now() - start > maxWaitMs) {
                debugLog('轮询超时');
                console.log(`\n⏰ ======== 轮询超时 ========`);
                console.log(`🕐 超时时间: ${new Date().toLocaleTimeString()}`);
                console.log(`⏱️ 总耗时: ${elapsedSec}秒`);
                console.log(`🔄 总轮询次数: ${pollCount}`);
                console.log(`⏰ 超时原因: 超过${Math.round(maxWaitMs / 1000)}秒限制`);
                console.log(`=============================\n`);

                // 重要：通过新模块和兼容模式双重重置轮询状态（超时情况）
                window._rhPollingActive = false;
                if (window.runningHubManager && window.runningHubManager.isInitialized()) {
                    window.runningHubManager.getStateManager().set('isPollingActive', false);
                    debugLog('超时时通过新模块重置轮询状态为false');
                }

                throw new Error(`任务超时：等待时间超过 ${Math.round(maxWaitMs / 1000)} 秒`);
            }

            // 等待下次轮询
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }

    // 获取任务输出结果
    async fetchRunningHubTaskOutputs(apiKey, taskId) {
        try {
            const url = 'https://www.runninghub.cn/task/openapi/outputs';
            const headers = { 'Host': 'www.runninghub.cn', 'Content-Type': 'application/json' };
            const body = JSON.stringify({ apiKey, taskId });

            debugLog('获取任务输出', { taskId });

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            debugLog('任务输出响应', data);

            // 完全按照原有逻辑：返回完整的响应对象，不做任何处理
            return data;

        } catch (error) {
            debugLog('获取任务输出失败:', error);
            throw error;
        }
    }

    // 取消任务
    async cancelRunningHubTask(apiKey, taskId) {
        try {
            const url = 'https://www.runninghub.cn/task/openapi/cancel';
            const headers = { 'Host': 'www.runninghub.cn', 'Content-Type': 'application/json' };
            const body = JSON.stringify({ apiKey, taskId });

            debugLog('取消任务', { taskId });

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            debugLog('取消任务响应', data);

            return {
                success: data.code === 0,
                message: data.msg || (data.code === 0 ? '取消成功' : '取消失败')
            };

        } catch (error) {
            debugLog('取消任务失败:', error);
            throw error;
        }
    }
}

// 状态管理器
class RunningHubStateManager {
    constructor() {
        this.state = new Map();
    }

    set(key, value) {
        this.state.set(key, value);
        debugLog(`设置状态: ${key} = ${value}`);
    }

    get(key) {
        return this.state.get(key);
    }

    has(key) {
        return this.state.has(key);
    }

    delete(key) {
        return this.state.delete(key);
    }

    clear() {
        this.state.clear();
    }
}

// 缓存管理器
class RunningHubCacheManager {
    constructor() {
        this.cachedResults = null;
        this.currentTaskInfo = null;
        this.lastSuccessfulTaskId = null;
    }

    // 缓存 RunningHub 结果
    cacheResults(taskId, resultsData, taskInfo) {
        try {
            debugLog('缓存RunningHub结果', {
                taskId,
                hasResults: !!resultsData,
                taskInfo
            });

            this.cachedResults = {
                ...resultsData,
                cachedAt: Date.now(),
                pageUrl: window.location.href
            };

            this.currentTaskInfo = {
                taskId,
                ...taskInfo,
                cachedAt: Date.now(),
                pageUrl: window.location.href
            };

            this.lastSuccessfulTaskId = taskId;

            // 更新全局变量以保持兼容性
            window.cachedRunningHubResults = this.cachedResults;
            window.currentPageTaskInfo = this.currentTaskInfo;
            window.lastSuccessfulTaskId = this.lastSuccessfulTaskId;

            debugLog('RunningHub结果已缓存', {
                cachedResultsExists: !!this.cachedResults,
                taskInfo: this.currentTaskInfo
            });

            return true;

        } catch (error) {
            debugLog('缓存RunningHub结果失败:', error);
            return false;
        }
    }

    // 清除缓存
    clearCache() {
        debugLog('清除RunningHub缓存');
        this.cachedResults = null;
        this.currentTaskInfo = null;
        this.lastSuccessfulTaskId = null;

        // 同时清除全局变量
        window.cachedRunningHubResults = null;
        window.currentPageTaskInfo = null;
        window.lastSuccessfulTaskId = null;
    }

    // 获取缓存的结果
    getCachedResults() {
        return this.cachedResults;
    }

    // 获取当前任务信息
    getCurrentTaskInfo() {
        return this.currentTaskInfo;
    }

    // 获取最后成功的任务ID
    getLastSuccessfulTaskId() {
        return this.lastSuccessfulTaskId;
    }

    // 检查是否有有效缓存
    hasValidCache() {
        return !!(this.cachedResults && this.currentTaskInfo);
    }
}

// 任务管理器
class RunningHubTaskManager {
    constructor() {
        this.activeTask = null;
    }

    // 重置轮询状态
    resetPollingState() {
        debugLog('重置RunningHub轮询状态');

        // 重置全局轮询状态变量
        window._rhPollingActive = false;
        window._rhTaskIdForCancel = null;
        window._rhApiKeyForCancel = null;
        window._rhCancelRequested = false;
        window._rhLastStatus = null;
        window._rhLastMsg = null;
        window._rhLastPollCount = 0;

        // 重置活动任务
        this.activeTask = null;

        debugLog('RunningHub轮询状态已重置');
    }

    // 设置活动任务
    setActiveTask(taskInfo) {
        this.activeTask = taskInfo;
        debugLog('设置活动任务', taskInfo);
    }

    // 获取活动任务
    getActiveTask() {
        return this.activeTask;
    }

    // 清除活动任务
    clearActiveTask() {
        this.activeTask = null;
        debugLog('清除活动任务');
    }
}

// 全局实例
let runningHubManagerInstance = null;

// 获取全局实例
function getRunningHubManager() {
    if (!runningHubManagerInstance) {
        runningHubManagerInstance = new RunningHubManager();
        // 设置到全局变量以保持兼容性
        window.runningHubManager = runningHubManagerInstance;
    }
    return runningHubManagerInstance;
}

// 兼容性函数 - 保持向后兼容
function cacheRunningHubResults(taskId, resultsData, taskInfo) {
    const manager = getRunningHubManager();
    return manager.getCacheManager().cacheResults(taskId, resultsData, taskInfo);
}

function clearRunningHubCache() {
    const manager = getRunningHubManager();
    return manager.getCacheManager().clearCache();
}

function resetRunningHubPollingState() {
    const manager = getRunningHubManager();
    return manager.getTaskManager().resetPollingState();
}

async function uploadToRunningHub(imageFile, apiKey, comment) {
    const manager = getRunningHubManager();
    // 确保 manager 已初始化
    if (!manager.isInitialized()) {
        await manager.initialize();
    }
    return await manager.uploadToRunningHub(imageFile, apiKey, comment);
}

async function pollRunningHubTaskStatus(apiKey, taskId, onTick) {
    const manager = getRunningHubManager();
    // 确保 manager 已初始化
    if (!manager.isInitialized()) {
        await manager.initialize();
    }
    return await manager.pollRunningHubTaskStatus(apiKey, taskId, onTick);
}

async function fetchRunningHubTaskOutputs(apiKey, taskId) {
    const manager = getRunningHubManager();
    // 确保 manager 已初始化
    if (!manager.isInitialized()) {
        await manager.initialize();
    }
    return await manager.fetchRunningHubTaskOutputs(apiKey, taskId);
}

async function cancelRunningHubTask(apiKey, taskId) {
    const manager = getRunningHubManager();
    // 确保 manager 已初始化
    if (!manager.isInitialized()) {
        await manager.initialize();
    }
    return await manager.cancelRunningHubTask(apiKey, taskId);
}

async function loadRunningHubConfig() {
    const manager = getRunningHubManager();
    // 确保 manager 已初始化
    if (!manager.isInitialized()) {
        await manager.initialize();
    }
    return await manager.loadRunningHubConfig();
}

async function createWorkflowTask(apiKey, prompt, imageFileName = null, workflowName = 'defaultWorkflow') {
    const manager = getRunningHubManager();
    // 确保 manager 已初始化
    if (!manager.isInitialized()) {
        await manager.initialize();
    }
    return await manager.createWorkflowTask(apiKey, prompt, imageFileName, workflowName);
}

// 初始化函数
async function initializeRunningHubManager() {
    try {
        const manager = getRunningHubManager();
        await manager.initialize();
        debugLog('RunningHubManager 全局初始化完成');
        return manager;
    } catch (error) {
        debugLog('RunningHubManager 全局初始化失败:', error);
        throw error;
    }
}

// 导出到全局作用域
window.RunningHubManager = RunningHubManager;
window.getRunningHubManager = getRunningHubManager;
window.initializeRunningHubManager = initializeRunningHubManager;

// 兼容性函数导出
window.cacheRunningHubResults = cacheRunningHubResults;
window.clearRunningHubCache = clearRunningHubCache;
window.resetRunningHubPollingState = resetRunningHubPollingState;
window.uploadToRunningHub = uploadToRunningHub;
window.pollRunningHubTaskStatus = pollRunningHubTaskStatus;
window.fetchRunningHubTaskOutputs = fetchRunningHubTaskOutputs;
window.cancelRunningHubTask = cancelRunningHubTask;
window.loadRunningHubConfig = loadRunningHubConfig;
window.createWorkflowTask = createWorkflowTask;

debugLog('RunningHubManager 模块加载完成');