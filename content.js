// 图片快捷下载器 + 按钮快捷键 - Content Script
// 实现功能:
// 1. D键 - 快捷下载图片
// 2. 空格键 - 点击"跳过"按钮
// 3. S键 - 点击"提交并继续标注"按钮
// 4. T键 - 测试设备指纹读取并验证卡密 (需要cardkey-validator.js)
// 5. K键 - 发送POST测试请求到Native Host

// 全局变量
let lastHoveredImage = null;
let selectedImage = null;
let autoCompareEnabled = true; // 自动对比开关状态
let dimensionTooltip = null; // 尺寸提示框元素
let originalImage = null; // 存储原图引用用于对比（在单个页面生命周期内不可变更）
let originalImageLocked = false; // 原图锁定状态，防止在同一页面被覆盖
let currentPageUrl = ''; // 记录当前页面URL，用于检测页面跳转
let pendingComparisonTimeouts = []; // 记录待执行的对比任务
let shouldAutoCompare = false; // 标记是否应该自动触发对比（只有上传图片时为true）
let uploadedImage = null; // 存储上传图片引用
let comparisonModal = null; // 图片对比弹窗元素
let isComparisonModalOpen = false; // 对比页面开启状态
let debugMode = false; // 调试模式开关（默认关闭）
let debugPanel = null; // 调试面板元素
let debugLogs = []; // 调试日志数组
// F1 连续无效化相关
let f1AutoInvalidating = false;
let f1IntervalMs = 800; // 可调整的执行间隔（毫秒）
let f1MaxRuns = 0; // 最大连续执行次数，0表示无限制
let f1TimerId = null;
let f1RunCount = 0;
// COS图片拦截相关变量
let capturedOriginalImage = null; // 捕获的原图URL
let capturedModifiedImage = null; // 捕获的修改图URL
let cosImageCache = new Map(); // COS图片缓存
let capturedImageRequests = new Map(); // 存储捕获的图片请求
let originalImageFromNetwork = null; // 从网络请求中获取的原图
// 兼容性变量（逐步清理中）
let serverReturnedModifiedImage = null;
let userUploadedImage = null;
// RunningHub结果缓存相关
let cachedRunningHubResults = null; // 缓存的RunningHub结果
// 自动发送相关变量
let autoSendEnabled = true; // 自动发送开关
let sentImageHashes = new Set(); // 已发送图片的哈希值，避免重复发送
let lastAutoSendTime = 0; // 上次自动发送时间，防止过于频繁发送
let currentPageTaskInfo = null; // 当前页面的任务信息
let lastSuccessfulTaskId = null; // 最后成功的任务ID 
// 已移除：模式相关变量
// let isRevisionMode = false;
// let modeStatusIndicator = null;
// let isDragging = false;
// let dragOffset = { x: 0, y: 0 }
// 测试设备指纹读取功能
function testDeviceFingerprint() {
    showNotification('正在测试设备指纹读取...', 2000);
    debugLog('开始测试设备指纹读取功能');

    const message = {
        action: 'read_device_fingerprint',
        read_id: 'test_' + Date.now()
    };

    // 发送消息到 Native Host
    chrome.runtime.sendMessage({
        action: 'send_native_message',
        nativeMessage: message
    }, (response) => {
        if (chrome.runtime.lastError) {
            const errorMsg = `Native Messaging 错误: ${chrome.runtime.lastError.message}`;
            console.error(errorMsg);
            debugLog(errorMsg);
            showNotification('❌ Native Host 连接失败', 3000);
            return;
        }

        if (response && response.success) {
            const successMsg = `✅ 设备指纹读取成功！内容: ${response.content}`;
            console.log('设备指纹读取成功:', response);
            debugLog(`设备指纹读取成功: ${JSON.stringify(response, null, 2)}`);
            showNotification(successMsg, 5000);

            // 显示详细信息
            setTimeout(() => {
                showNotification(`📁 文件路径: ${response.file_path}`, 3000);
            }, 1000);
            setTimeout(() => {
                showNotification(`📊 文件大小: ${response.file_size} 字节`, 3000);
            }, 2000);

            // 验证卡密
            validateCardKey(response.content);
        } else {
            const errorMsg = `❌ 设备指纹读取失败: ${response ? response.error : '未知错误'}`;
            console.error('设备指纹读取失败:', response);
            debugLog(`设备指纹读取失败: ${JSON.stringify(response, null, 2)}`);
            showNotification(errorMsg, 5000);
        }
    });
}

// 获取Native Host缓存信息
function getNativeHostCacheInfo() {
    showNotification('正在获取Native Host缓存信息...', 2000);
    debugLog('开始获取Native Host缓存信息');

    const message = {
        action: 'get_cache_info',
        info_id: 'cache_info_' + Date.now()
    };

    // 发送消息到 Native Host
    chrome.runtime.sendMessage({
        action: 'send_native_message',
        nativeMessage: message
    }, (response) => {
        if (chrome.runtime.lastError) {
            const errorMsg = `Native Messaging 错误: ${chrome.runtime.lastError.message}`;
            console.error(errorMsg);
            debugLog(errorMsg);
            showNotification('❌ Native Host 连接失败', 3000);
            return;
        }

        if (response && response.success) {
            console.log('Native Host缓存信息获取成功:', response);
            debugLog(`Native Host缓存信息获取成功: ${JSON.stringify(response, null, 2)}`);

            // 显示缓存信息摘要
            const cacheInfo = response.cache_info;
            const chromeExtData = cacheInfo.image_data_store.chrome_extension;
            const extAppData = cacheInfo.image_data_store.external_application;

            showNotification('✅ 缓存信息获取成功！正在显示详情...', 3000);

            // 显示详细的缓存信息
            setTimeout(() => {
                showNotification(`📊 Chrome扩展数据: 原图${chromeExtData.has_original_image ? '✓' : '✗'}, 标注图${chromeExtData.has_annotated_image ? '✓' : '✗'}`, 5000);
            }, 1000);

            setTimeout(() => {
                showNotification(`📊 外部应用数据: 修改图${extAppData.has_modified_image ? '✓' : '✗'}, 蒙版图${extAppData.has_mask_image ? '✓' : '✗'}`, 5000);
            }, 2000);

            setTimeout(() => {
                showNotification(`🔄 当前数据源: ${cacheInfo.image_data_store.current_source}`, 3000);
            }, 3000);

            setTimeout(() => {
                showNotification(`🕒 待处理请求数: ${cacheInfo.pending_requests_count}`, 3000);
            }, 4000);

            // 可选：在控制台显示完整的缓存信息
            console.log('完整的缓存信息:', cacheInfo);
        } else {
            const errorMsg = response ? response.error : '未知错误';
            console.error('缓存信息获取失败:', errorMsg);
            debugLog(`缓存信息获取失败: ${errorMsg}`);
            showNotification(`❌ 获取失败: ${errorMsg}`, 5000);
        }
    });
}

// 验证卡密
async function validateCardKey(figId) {
    try {
        showNotification('正在验证卡密...', 2000);
        debugLog('开始验证卡密:', figId);
        
        // 检查cardKeyValidator是否存在
        if (typeof cardKeyValidator === 'undefined') {
            console.error('CardKeyValidator未定义');
            showNotification('❌ 验证器未加载', 3000);
            return;
        }
        
        // 调用验证函数
        const result = await cardKeyValidator.validateCardKey(figId);
        
        if (result.KeyStatus) {
            // 验证成功
            const successMsg = `✅ 卡密验证成功！${result.Message}`;
            console.log('卡密验证成功:', result);
            debugLog(`卡密验证成功: ${JSON.stringify(result, null, 2)}`);
            showNotification(successMsg, 5000);
            
            // 显示剩余天数（如果有的话）
            if (result.RemainingDays !== undefined) {
                setTimeout(() => {
                    showNotification(`📅 剩余天数: ${result.RemainingDays}天`, 3000);
                }, 1000);
            }
        } else {
            // 验证失败
            const errorMsg = `❌ 卡密验证失败: ${result.Message}`;
            console.error('卡密验证失败:', result);
            debugLog(`卡密验证失败: ${JSON.stringify(result, null, 2)}`);
            showNotification(errorMsg, 5000);
        }
    } catch (error) {
        console.error('卡密验证过程中发生错误:', error);
        debugLog(`卡密验证错误: ${error.message}`);
        showNotification(`❌ 验证过程出错: ${error.message}`, 5000);
    }
}

// 通用：隐藏取消按钮
function hideRhCancelBtn() {
    try {
        const btn = document.querySelector('#rh-cancel-btn');
        if (btn) btn.style.display = 'none';
    } catch (_) {}
}

function showRhCancelBtn() {
    try {
        const btn = document.querySelector('#rh-cancel-btn');
        if (btn) {
            btn.style.display = '';
            btn.disabled = false;
            btn.textContent = '取消任务';
            btn.style.opacity = '1';
        }
    } catch (_) {}
}

// 已移除：模式状态管理函数
// function loadModeState() { ... }
// function saveModeState() { ... }

// 检查并关闭模态框的辅助函数
function checkAndCloseModalIfOpen(keyName) {
    const modal = document.querySelector('.dimension-check-modal');
    if (modal) {
        console.log(`[${keyName.toUpperCase()}键] 检测到尺寸检查模态框已打开，先关闭模态框`);
        modal.remove();
        return true; // 返回true表示关闭了模态框
    }
    return false; // 返回false表示没有模态框需要关闭
}

// 确保模态框被关闭的函数
function ensureModalClosed() {
    const modal = document.querySelector('.dimension-check-modal');
    if (modal) {
        modal.remove();
        console.log('[模态框管理] 强制关闭尺寸检查模态框');
    }
}

// 检查并关闭模态框的辅助函数
function checkAndCloseModalIfOpen(keyName) {
    const modal = document.querySelector('.dimension-check-modal');
    if (modal) {
        console.log(`[${keyName.toUpperCase()}键] 检测到尺寸检查模态框已打开，先关闭模态框`);
        modal.remove();
        return true; // 返回true表示关闭了模态框
    }
    return false; // 返回false表示没有模态框需要关闭
}

// 确保模态框被关闭的函数
function ensureModalClosed() {
    const modal = document.querySelector('.dimension-check-modal');
    if (modal) {
        modal.remove();
        console.log('[模态框管理] 强制关闭尺寸检查模态框');
    }
}
function checkAndCloseModalIfOpen(currentKey) {
    // 如果尺寸检查模态框打开，且不是ESC键和R键，先关闭模态框
    if (isDimensionCheckModalOpen && currentKey !== 'escape' && currentKey !== 'r') {
        debugLog('检测到模态框打开，先关闭模态框', { key: currentKey });
        closeDimensionCheckModal();
        showNotification('模态框已关闭，请重新按键执行操作', 1500);
        return true; // 返回true表示已关闭模态框
    }
    return false; // 返回false表示没有模态框需要关闭
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeScript);

// 如果页面已经加载完成，直接初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScript);
} else {
    initializeScript();
}

function initializeScript() {
    console.log('=== AnnotateFlow Assistant v2.0 已加载 ===');
    console.log('专为腾讯QLabel标注平台设计');
    console.log('支持功能: D键下载图片, 空格键跳过, S键提交标注, A键上传图片, F键查看历史, W键智能图片对比, Z键调试模式, I键检查文件输入, B键重新检测原图, N键重新检测原图, P键/F2键智能尺寸检查, R键手动检查尺寸是否为8的倍数, T键测试设备指纹并验证卡密, J键同时上传修改图和蒙版图');
    console.log('🎯 原图检测: 支持多种格式的COS原图 (.jpg/.jpeg/.png/.webp/.gif/.bmp)');
    console.log('Chrome对象:', typeof chrome);
    console.log('Chrome.runtime:', typeof chrome?.runtime);
    console.log('扩展ID:', chrome?.runtime?.id);
    
    // 检测页面是否发生变化（用于重置原图锁定）
    checkPageChange();
    
    // 检查Chrome扩展API是否可用
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('Chrome扩展API不可用，插件可能未正确加载');
        console.error('Chrome:', chrome);
        console.error('Chrome.runtime:', chrome?.runtime);
        setTimeout(() => {
            showNotification('插件未正确加载，请刷新页面或重新安装插件', 5000);
        }, 1000);
        return;
    }
    
    // 加载F1设置
    loadF1Settings();
    
    // 加载自动对比设置
    loadAutoCompareSettings();
    
    // 初始化音效
    // 添加键盘事件监听器
    document.addEventListener('keydown', handleKeydown);
    
    // 监听存储变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            if (changes.f1Interval) {
                f1IntervalMs = changes.f1Interval.newValue;
                console.log('F1间隔设置已更新:', f1IntervalMs);
            }
            if (changes.f1MaxRuns) {
                f1MaxRuns = changes.f1MaxRuns.newValue;
                console.log('F1最大执行次数设置已更新:', f1MaxRuns);
            }
            if (changes.autoCompareEnabled) {
                autoCompareEnabled = changes.autoCompareEnabled.newValue;
                console.log('自动对比设置已更新:', autoCompareEnabled);
            }
        }
    });
    
    // 为所有图片添加鼠标事件监听器
    addImageEventListeners();
    
    // 使用 MutationObserver 监听动态添加的图片
    observeImageChanges();
    
    // 初始化图片上传监听
    initializeUploadMonitoring();
    
    // 添加图片加载监听器
    addImageLoadListeners();
    
    // 初始化DOM内容变化监听（用于检测页面内容更新）
    initializeDOMContentObserver();
    
    // 立即开始检测原图
    debugLog('页面加载完成，开始检测原图');
    recordOriginalImages();
    
    // 初始化调试功能（默认关闭）
    if (debugMode) {
        initializeDebugPanel();
    }
    
    // 已移除：模式状态加载
    // loadModeState();
    
    // 初始化COS图片拦截监听
    initializeCOSImageListener();
    
    console.log('AnnotateFlow Assistant 初始化完成，调试模式:', debugMode ? '已启用' : '已禁用');
}

// 简单的字符串哈希函数，用于创建图片的唯一标识
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
}

// 根据图片信息创建唯一标识符
function getImageIdentifier(imageInfo) {
    if (!imageInfo || !imageInfo.src) return null;
    // 使用图片URL和尺寸信息创建标识符
    const identifier = `${imageInfo.src}_${imageInfo.width || 0}x${imageInfo.height || 0}`;
    return simpleHash(identifier);
}

// 自动发送图片数据到Native Host
async function autoSendImageData(forceSend = false) {
    // 检查是否应该发送
    // 如果自动发送禁用且不是强制发送，则不发送
    if (!autoSendEnabled && !forceSend) {
        debugLog("自动发送已禁用");
        return;
    }

    // 检查是否有原图
    if (!originalImage || !originalImage.src) {
        debugLog("没有可发送的原图数据");
        return;
    }

    // 等待原图加载完成的机制
    try {
        debugLog("自动发送图片数据到Native Host", {
            mode: forceSend ? "强制发送" : "自动发送",
            hasOriginalImage: !!originalImage,
            originalImageLocked: !!originalImageLocked
        });

        // 对于自动模式，等待原图加载完成
        if (!forceSend) {
            // 等待原图锁定（处理完成）
            if (!originalImageLocked) {
                debugLog("原图未锁定，等待处理完成...");

                // 等待原图锁定，最多等待5秒
                let waitTime = 0;
                while (!originalImageLocked && waitTime < 5000) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    waitTime += 100;
                }

                if (!originalImageLocked) {
                    debugLog("原图加载超时，取消发送");
                    showNotification("⚠️ 原图加载超时，取消自动发送", 2000);
                    return;
                }

                debugLog("原图已锁定，继续发送");
            }

            // 确保图片完全加载完成（额外等待200ms）
            await new Promise(resolve => setTimeout(resolve, 200));

            // 频率限制
            const now = Date.now();
            if (now - lastAutoSendTime < 1000) {
                debugLog("发送过于频繁，跳过本次发送");
                return;
            }

            // 创建图片标识符以避免重复发送
            const imageId = getImageIdentifier(originalImage);
            if (imageId && sentImageHashes.has(imageId)) {
                debugLog("图片已发送过，跳过重复发送", imageId);
                return;
            }

            lastAutoSendTime = now;
        }

        // 直接调用与K键相同的发送函数
        await sendPostRequestToNativeHost();

        // 记录已发送的图片（仅在自动模式下）
        if (!forceSend) {
            const imageId = getImageIdentifier(originalImage);
            if (imageId) {
                sentImageHashes.add(imageId);
                debugLog("图片数据发送成功并已记录", imageId);
            }
        }

        debugLog("自动发送完成");
    } catch (error) {
        console.error("自动发送图片数据失败:", error);
        showNotification("❌ 自动发送失败: " + error.message, 3000);

        // 自动模式下失败时重置时间记录和哈希记录以便重试
        if (!forceSend) {
            lastAutoSendTime = 0;
            // 移除哈希记录以便重试
            const imageId = getImageIdentifier(originalImage);
            if (imageId && sentImageHashes.has(imageId)) {
                sentImageHashes.delete(imageId);
            }
        }
    }
}

// 检查页面是否发生变化，如果是新页面则重置原图锁定
function checkPageChange() {
    const newUrl = window.location.href;

    if (currentPageUrl && currentPageUrl !== newUrl) {
        debugLog('检测到页面跳转，重置原图锁定状态', {
            oldUrl: currentPageUrl.substring(0, 100) + '...',
            newUrl: newUrl.substring(0, 100) + '...'
        });

        // 重置原图相关状态
        originalImageLocked = false;
        originalImage = null;
        shouldAutoCompare = false; // 重置自动对比标记

        // 取消所有待执行的对比任务
        debugLog('取消待执行的对比任务', { count: pendingComparisonTimeouts.length });
        pendingComparisonTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        pendingComparisonTimeouts = [];

        // 关闭已存在的对比弹窗
        if (comparisonModal && comparisonModal.parentNode) {
            debugLog('关闭已存在的对比弹窗');
            comparisonModal.parentNode.removeChild(comparisonModal);
            comparisonModal = null;
        }

        // 清空上传的对比图，避免内存泄漏和页面间的状态污染
        uploadedImage = null;
        isComparisonModalOpen = false;

        // 清除RunningHub结果缓存
        debugLog('清除RunningHub结果缓存');
        cachedRunningHubResults = null;
        currentPageTaskInfo = null;
        lastSuccessfulTaskId = null;

        debugLog('页面跳转重置状态', {
            'originalImageLocked': originalImageLocked,
            'originalImage': originalImage ? '有' : '无',
            'uploadedImage': '已清空',
            'canceledTimeouts': pendingComparisonTimeouts.length
        });

        showNotification('页面切换，正在重新检测原图...', 2000);

        // 立即开始检测原图
        setTimeout(() => {
            recordOriginalImages();
        }, 100);
        
        // 延迟多次重试检测原图，因为新页面内容可能需要时间加载
        const retryIntervals = [500, 1000, 2000, 3000, 5000];
        retryIntervals.forEach((delay, index) => {
            const retryTimeoutId = setTimeout(() => {
                debugLog(`页面跳转后第${index + 1}次尝试检测原图 (延迟${delay}ms)`);
                if (!originalImageLocked) { // 只有在还没检测到原图时才继续尝试
                    recordOriginalImages();
                }
                
                // 从待执行列表中移除
                const timeoutIndex = pendingComparisonTimeouts.indexOf(retryTimeoutId);
                if (timeoutIndex > -1) {
                    pendingComparisonTimeouts.splice(timeoutIndex, 1);
                }
            }, delay);
            
            // 将重试任务也加入管理队列
            pendingComparisonTimeouts.push(retryTimeoutId);
        });
    }
    
    currentPageUrl = newUrl;
    debugLog('当前页面URL已更新', currentPageUrl.substring(0, 100) + '...');
    
    // 监听后续的URL变化
    if (!window._pageChangeObserverStarted) {
        window._pageChangeObserverStarted = true;
        
        // 使用pushstate/popstate监听单页应用的路由变化
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function() {
            originalPushState.apply(history, arguments);
            setTimeout(() => checkPageChange(), 100);
        };
        
        history.replaceState = function() {
            originalReplaceState.apply(history, arguments);
            setTimeout(() => checkPageChange(), 100);
        };
        
        window.addEventListener('popstate', () => {
            setTimeout(() => checkPageChange(), 100);
        });
        
        // 更频繁地检查URL变化（每200ms一次，持续10秒，然后降低频率）
        let checkCount = 0;
        const fastCheckInterval = setInterval(() => {
            if (window.location.href !== currentPageUrl) {
                checkPageChange();
            }
            checkCount++;
            // 10秒后改为每秒检查一次
            if (checkCount >= 50) { // 50 * 200ms = 10秒
                clearInterval(fastCheckInterval);
                // 改为每秒检查一次
                setInterval(() => {
                    if (window.location.href !== currentPageUrl) {
                        checkPageChange();
                    }
                }, 1000);
            }
        }, 200);
        
        debugLog('页面变化监听已启动（快速检测模式）');
    }
}

// 关闭图片对比弹窗
function closeComparisonModal() {
    if (comparisonModal && comparisonModal.parentNode) {
        comparisonModal.parentNode.removeChild(comparisonModal);
        comparisonModal = null;
        isComparisonModalOpen = false;
        debugLog('对比弹窗已关闭，状态已更新');
        
        // 移除ESC键监听器（如果存在）
        if (typeof window.currentHandleEscKey === 'function') {
            document.removeEventListener('keydown', window.currentHandleEscKey);
            window.currentHandleEscKey = null;
        }
    }
    
    // 清理右侧工具栏 - 更新选择器以匹配当前的right值
    const toolbar = document.querySelector('div[style*="position: fixed"][style*="right: 5px"]');
    if (toolbar && toolbar.parentNode) {
        toolbar.parentNode.removeChild(toolbar);
        debugLog('右侧工具栏已清理');
    }
    
    // 备用清理方法：通过其他特征查找工具栏
    const toolbars = document.querySelectorAll('div[style*="position: fixed"][style*="transform: translateY(-50%)"][style*="width: 80px"]');
    toolbars.forEach(tb => {
        if (tb && tb.parentNode) {
            tb.parentNode.removeChild(tb);
            debugLog('通过备用方法清理了工具栏');
        }
    });
}

// 处理键盘事件
function handleKeydown(event) {
    // 检查是否在输入框中
    if (isInInputField(event.target)) {
        return; // 在输入框中，不处理快捷键
    }

    // 添加测试按键：按K键发送POST请求
    if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        sendPostRequestToNativeHost();
        return;
    }

    
    // 处理F1键 - 连续执行“标记无效”(X键逻辑)并自动确认弹窗（再次按F1停止）
    else if (event.key === 'F1') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('f1')) {
            return; // 如果关闭了模态框，停止执行
        }
        
        event.preventDefault();
        if (!f1AutoInvalidating) {
            f1AutoInvalidating = true;
            f1RunCount = 0;
            showNotification(`F1 连续无效化启动（间隔 ${f1IntervalMs}ms）`);

            const runOnce = () => {
                if (!f1AutoInvalidating) return;
                // 检查是否有次数限制且已达到限制
                if (f1MaxRuns > 0 && f1RunCount >= f1MaxRuns) {
                    f1AutoInvalidating = false;
                    showNotification('F1 连续无效化已达最大次数，自动停止');
                    return;
                }
                f1RunCount++;

                // 复用 X 键逻辑：查找“标记无效”并点击，随后自动确认
                const invalidButton = findButtonByText(['标记无效', '无效', 'Invalid', '标记为无效', 'Mark Invalid', '标记不合格']);
                if (invalidButton) {
                    clickButton(invalidButton, `标记无效 (#${f1RunCount})`);
                    autoConfirmModalAfterAction();
                }

                // 安排下一次
                if (f1AutoInvalidating) {
                    f1TimerId = setTimeout(runOnce, f1IntervalMs);
                }
            };

            runOnce();
        } else {
            // 停止
            f1AutoInvalidating = false;
            if (f1TimerId) {
                clearTimeout(f1TimerId);
                f1TimerId = null;
            }
            showNotification('F1 连续无效化已停止');
        }
    }
    
    const key = event.key.toLowerCase();
    
    // 处理D键 - 下载图片
    if (key === 'd') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen(key)) {
            return; // 如果关闭了模态框，停止执行
        }
        
        // 阻止默认行为
        event.preventDefault();
        
        // 获取要下载的图片
        const imageToDownload = getImageToDownload();
        
        if (imageToDownload) {
            downloadImage(imageToDownload);
        } else {
            console.log('没有找到可下载的图片');
            showNotification('请先鼠标悬停在图片上，然后按D键下载');
        }
    }
    // 处理空格键 - 点击"跳过"按钮
    else if (event.code === 'Space') {
        // 检查并关闭模态框（但不停止执行，继续执行跳过功能）
        checkAndCloseModalIfOpen('space');
        
        // 如果对比页面打开，先关闭对比
        if (isComparisonModalOpen) {
            closeComparisonModal();
            // 延迟执行跳过功能，确保对比页面完全关闭
            setTimeout(() => {
                const skipButton = findButtonByText(['跳过', 'Skip', '跳過']);
                if (skipButton) {
                    event.preventDefault(); // 阻止空格键的默认滚动行为
                    clickButton(skipButton, '跳过');
                }
            }, 100);
        } else {
            const skipButton = findButtonByText(['跳过', 'Skip', '跳過']);
            if (skipButton) {
                event.preventDefault(); // 阻止空格键的默认滚动行为
                clickButton(skipButton, '跳过');
            }
        }
    }
    // 处理S键 - 点击"提交并继续标注"按钮
    else if (key === 's') {
        // 检查并关闭模态框（但不停止执行，继续执行提交功能）
        checkAndCloseModalIfOpen('s');
        
        // 如果对比页面打开，先关闭对比
        if (isComparisonModalOpen) {
            closeComparisonModal();
            // 延迟执行提交功能，确保对比页面完全关闭
            setTimeout(() => {
                const submitButton = findButtonByText(['提交并继续标注', '提交', 'Submit', '继续标注', 'Continue']);
                if (submitButton) {
                    event.preventDefault();
                    clickButton(submitButton, '提交并继续标注');
                }
            }, 100);
        } else {
            const submitButton = findButtonByText(['提交并继续标注', '提交', 'Submit', '继续标注', 'Continue']);
            if (submitButton) {
                event.preventDefault();
                clickButton(submitButton, '提交并继续标注');
            }
        }
    }
    // 处理A键 - 点击"上传图片"按钮
    else if (key === 'a') {
        // 检查并关闭模态框（但不停止执行，继续执行上传功能）
        checkAndCloseModalIfOpen('a');
        
        const uploadButton = findButtonByText(['上传图片', '上传', 'Upload', '选择图片', '选择文件']);
        if (uploadButton) {
            event.preventDefault();
            clickButton(uploadButton, '上传图片');
        } else {
            showNotification('未找到上传图片按钮');
        }
    }
    // 处理F键 - 点击"查看历史"链接
    else if (key === 'f') {
        // 检查并关闭模态框（但不停止执行，继续执行查看历史功能）
        checkAndCloseModalIfOpen('f');
        
        const historyLink = findLinkByText(['点击查看历史', '查看历史', '历史', 'History', '历史记录', '查看记录']);
        if (historyLink) {
            event.preventDefault();
            clickLink(historyLink, '查看历史');
        } else {
            showNotification('未找到查看历史链接');
        }
    }
    // 处理J键 - 上传Native Host图片数据到标注平台
    // J键默认同时上传修改图和蒙版图
    else if (key === 'j') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('j')) {
            return; // 如果关闭了模态框，停止执行
        }

        event.preventDefault();
        // J键默认同时上传修改图和蒙版图
        uploadNativeHostImageToAnnotationPlatform();
    } 
    
    // 处理X键 - 点击"标记无效"按钮
    else if (key === 'x') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('x')) {
            return; // 如果关闭了模态框，停止执行
        }

        // 如果对比页面打开，先关闭对比
        if (isComparisonModalOpen) {
            closeComparisonModal();
            // 延迟执行标记无效功能，确保对比页面完全关闭
            setTimeout(() => {
                const invalidButton = findButtonByText(['标记无效', '无效', 'Invalid', '标记为无效', 'Mark Invalid', '标记不合格']);
                if (invalidButton) {
                    event.preventDefault();
                    clickButton(invalidButton, '标记无效');
                    // 尝试自动确认可能弹出的模态框
                    autoConfirmModalAfterAction();
                } else {
                    showNotification('未找到标记无效按钮');
                }
            }, 100);
        } else {
            const invalidButton = findButtonByText(['标记无效', '无效', 'Invalid', '标记为无效', 'Mark Invalid', '标记不合格']);
            if (invalidButton) {
                event.preventDefault();
                clickButton(invalidButton, '标记无效');
                // 尝试自动确认可能弹出的模态框
                autoConfirmModalAfterAction();
            } else {
                showNotification('未找到标记无效按钮');
            }
        }
    }
    // 处理W键 - 智能图片对比
    else if (key === 'w') {
        // 检查并关闭模态框（但不停止执行，继续执行智能对比功能）
        checkAndCloseModalIfOpen('w');
        
        event.preventDefault();
        debugLog('手动触发智能图片对比 (W键)');
        showNotification('启动智能图片对比...', 1000);
        triggerSmartComparisonWithFallback();
    }
    // 处理Z键 - 切换调试模式
    else if (key === 'z') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('z')) {
            return; // 如果关闭了模态框，停止执行
        }
        
        event.preventDefault();
        toggleDebugMode();
    }
    // 处理I键 - 手动检查所有文件输入状态
    else if (key === 'i') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('i')) {
            return; // 如果关闭了模态框，停止执行
        }
        
        event.preventDefault();
        debugLog('手动触发文件输入状态检查');
        checkForFileInputChanges();
        showNotification('已手动检查文件输入状态，查看调试面板', 2000);
    }
    // 处理B键 - 手动重新检测原图
    else if (key === 'b') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('b')) {
            return; // 如果关闭了模态框，停止执行
        }
        
        event.preventDefault();
        debugLog('手动重新检测原图');
        // 解锁原图并重新检测
        originalImageLocked = false;
        originalImage = null;
        recordOriginalImages();
        showNotification('已重新检测原图，查看调试面板', 2000);
    }
    // 移除：R键模式切换逻辑
    // 处理M键 - 手动打印图片状态
    else if (key === 'm') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('m')) {
            return; // 如果关闭了模态框，停止执行
        }
        
        event.preventDefault();
        // 已移除：revisionLog调用
        // 已移除：printRevisionModeStatus();
        showNotification('已打印图片状态，请查看调试面板', 2000);
    }
    // 处理T键 - 测试设备指纹读取
    else if (key === 't') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('t')) {
            return; // 如果关闭了模态框，停止执行
        }

        event.preventDefault();
        testDeviceFingerprint();
    }
    // 处理I键 - 获取Native Host缓存信息
    else if (key === 'i') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('i')) {
            return; // 如果关闭了模态框，停止执行
        }

        event.preventDefault();
        getNativeHostCacheInfo();
    }
    // 处理F2键 - 检查图片尺寸并显示标注界面
    else if (event.key === 'F2') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('f2')) {
            return; // 如果关闭了模态框，停止执行
        }
        
        event.preventDefault();
        debugLog('F2键触发 - 检查图片尺寸');
        checkImageDimensionsAndShowModal();
    }
    // 处理R键 - 手动触发图片尺寸检查
    else if (key === 'r') {
        event.preventDefault();
        debugLog('R键触发 - 手动检查图片尺寸是否为8的倍数');
        manualDimensionCheck();
    }
}

// 检查目标元素是否是输入框
function isInInputField(target) {
    const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT'];
    return inputTypes.includes(target.tagName) || target.contentEditable === 'true';
}

// 获取要下载的图片
function getImageToDownload() {
    // 优先级：选中的图片 > 鼠标悬停的图片
    return selectedImage || lastHoveredImage;
}

// 为所有图片添加事件监听器
function addImageEventListeners() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        addImageListeners(img);
    });
}

// 为单个图片添加事件监听器
function addImageListeners(img) {
    // 鼠标悬停事件
    img.addEventListener('mouseenter', (event) => {
        lastHoveredImage = event.target;
        highlightImage(event.target, true);
        showImageDimensions(event.target, event);
    });
    
    img.addEventListener('mouseleave', (event) => {
        if (lastHoveredImage === event.target) {
            highlightImage(event.target, false);
        }
        hideImageDimensions();
    });
    
    // 鼠标移动事件 - 更新提示框位置
    img.addEventListener('mousemove', (event) => {
        updateTooltipPosition(event);
    });
    
    // 点击选择事件
    img.addEventListener('click', (event) => {
        // 如果按住Ctrl键点击，选择图片
        if (event.ctrlKey) {
            event.preventDefault();
            selectImage(event.target);
        }
    });
}

// 高亮显示图片
function highlightImage(img, highlight) {
    if (highlight) {
        img.style.outline = '3px solid #4CAF50';
        img.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
    } else {
        if (selectedImage !== img) {
            img.style.outline = '';
            img.style.boxShadow = '';
        }
    }
}

// 选择图片
function selectImage(img) {
    // 清除之前选中的图片样式
    if (selectedImage) {
        selectedImage.style.outline = '';
        selectedImage.style.boxShadow = '';
    }
    
    // 设置新选中的图片
    selectedImage = img;
    img.style.outline = '3px solid #2196F3';
    img.style.boxShadow = '0 0 15px rgba(33, 150, 243, 0.7)';
    
    showNotification('图片已选中，按D键下载');
}

// 监听动态添加的图片
function observeImageChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查新添加的元素是否是图片
                    if (node.tagName === 'IMG') {
                        addImageListeners(node);
                    }
                    // 检查新添加的元素内部是否有图片
                    const images = node.querySelectorAll && node.querySelectorAll('img');
                    if (images) {
                        images.forEach(img => addImageListeners(img));
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 下载图片
function downloadImage(img) {
    try {
        // 获取图片URL
        let imageUrl = img.src;
        
        // 检查URL是否有效
        if (!imageUrl || imageUrl === '') {
            console.error('图片URL无效:', imageUrl);
            showNotification('图片URL无效，无法下载');
            return;
        }
        
        // 转换相对URL为绝对URL
        if (imageUrl.startsWith('//')) {
            imageUrl = window.location.protocol + imageUrl;
        } else if (imageUrl.startsWith('/')) {
            imageUrl = window.location.origin + imageUrl;
        }
        
        console.log('准备下载图片:', imageUrl);
        console.log('当前Chrome对象状态:', {
            chrome: typeof chrome,
            runtime: typeof chrome?.runtime,
            sendMessage: typeof chrome?.runtime?.sendMessage,
            extensionId: chrome?.runtime?.id
        });
        
        // 检查Chrome扩展API是否可用
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.error('Chrome扩展API不可用');
            console.error('详细信息:', {
                chrome: chrome,
                runtime: chrome?.runtime,
                sendMessage: chrome?.runtime?.sendMessage
            });
            showNotification('下载失败：Chrome扩展API不可用');
            return;
        }
        
        // 发送消息到background script
        try {
            // 使用安全的调用方式
            const chromeRuntime = chrome && chrome.runtime;
            if (!chromeRuntime || !chromeRuntime.sendMessage) {
                throw new Error('Chrome runtime API不可用');
            }
            
            chromeRuntime.sendMessage({
                action: 'downloadImage',
                imageUrl: imageUrl,
                pageUrl: window.location.href
            }, (response) => {
                if (chromeRuntime.lastError) {
                    console.error('发送消息失败:', chromeRuntime.lastError);
                    showNotification('下载失败：无法连接到扩展后台');
                } else if (response && response.success) {
                    console.log('下载请求已发送');
                    showNotification('开始下载图片...');
                    // 添加下载效果
                    addDownloadEffect(img);
                    // 下载发起成功后，按你的需求将当前悬停图片标记为原图（不限制JPEG）
                    try {
                        recordImageAsOriginalFlexible(img);
                    } catch (e) {
                        console.warn('标记原图失败（宽松模式）:', e);
                    }
                } else {
                    console.error('下载请求失败');
                    showNotification('下载失败');
                }
            });
        } catch (apiError) {
            console.error('Chrome API调用异常:', apiError);
            showNotification('下载失败：' + apiError.message);
        }
        
    } catch (error) {
        console.error('下载图片时发生错误:', error);
        showNotification('下载失败：' + error.message);
    }
}

// 添加下载视觉效果
function addDownloadEffect(img) {
    // 创建下载动画效果
    const originalTransform = img.style.transform;
    img.style.transition = 'transform 0.3s ease';
    img.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        img.style.transform = originalTransform;
    }, 300);
}

// 显示通知
function showNotification(message, duration = 3000) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // 自动移除通知
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// 根据文本内容查找按钮
function findButtonByText(textOptions) {
    // 查找所有可能的按钮元素
    const buttonSelectors = [
        'button',
        'input[type="button"]',
        'input[type="submit"]',
        '[role="button"]',
        '.btn',
        '.button',
        'a[href="#"]',
        'a[onclick]',
        'div[onclick]',
        'span[onclick]'
    ];
    
    const allElements = document.querySelectorAll(buttonSelectors.join(','));
    
    // 遍历所有元素，查找匹配的文本
    for (const element of allElements) {
        const text = (element.textContent || element.value || element.innerText || '').trim();
        
        // 检查是否匹配任一文本选项
        if (textOptions.some(option => 
            text.includes(option) || 
            text.toLowerCase().includes(option.toLowerCase())
        )) {
            return element;
        }
    }
    
    return null;
}

// 点击按钮并显示反馈
function clickButton(button, actionName) {
    try {
        console.log(`点击${actionName}按钮:`, button);
        
        // 添加视觉反馈
        addButtonClickEffect(button);
        
        // 模拟点击事件
        button.click();
        
        // 显示通知
        showNotification(`已执行: ${actionName}`);
        
    } catch (error) {
        console.error(`点击${actionName}按钮时发生错误:`, error);
        showNotification(`执行${actionName}失败: ${error.message}`);
    }
}

// 在执行可能触发确认弹窗的操作后，尝试自动点击“确定/确认/OK”按钮
function autoConfirmModalAfterAction() {
    try {
        // 等待短时间让弹窗渲染
        const tryClick = () => {
            // 1) 优先使用提供的 XPath 精确定位
            const confirmXPath = '/html/body/div[1]/div/div[2]/div/div[2]/div/div/div[3]/p/button[2]/span';
            try {
                const node = document.evaluate(confirmXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (node) {
                    const button = node.closest('button') || node.parentElement;
                    if (button) {
                        button.click();
                        showNotification('已自动确认弹窗');
                        return;
                    }
                }
            } catch (e) {
                // 忽略 XPath 执行错误，继续尝试其它方式
            }

            // 常见弹窗容器选择器（尽量宽松，避免依赖具体站点UI库）
            const modalSelectors = [
                '.modal', '.ant-modal', '.ant-modal-root', '.ant-modal-confirm', '.dialog', '.el-message-box', '.el-dialog', '[role="dialog"]', '.q-dialog', '.t-dialog'
            ];
            const confirmTextOptions = ['确定', '确认', 'OK', 'Ok', 'ok', 'Yes'];
            const primaryButtonSelectors = [
                'button.ant-btn-primary', 'button.el-button--primary', 'button.primary', 'button[type="submit"]', '.btn-primary', '.primary'
            ];

            // 先在可能的弹窗内找“确定/确认/OK”按钮
            for (const modalSel of modalSelectors) {
                const modal = document.querySelector(modalSel);
                if (!modal || modal.getAttribute('aria-hidden') === 'true' || modal.style.display === 'none') continue;

                // 1) 文本匹配
                const buttons = modal.querySelectorAll('button, [role="button"], .btn, .button, a');
                for (const btn of buttons) {
                    const text = (btn.textContent || btn.innerText || '').trim();
                    if (confirmTextOptions.some(t => text === t || text.toLowerCase() === t.toLowerCase())) {
                        btn.click();
                        showNotification('已自动确认弹窗');
                        return;
                    }
                }

                // 2) 主按钮样式选择器
                for (const sel of primaryButtonSelectors) {
                    const primaryBtn = modal.querySelector(sel);
                    if (primaryBtn) {
                        primaryBtn.click();
                        showNotification('已自动确认弹窗');
                        return;
                    }
                }
            }

            // 若未匹配到，尝试全局查找“确定/确认/OK”按钮（兜底）
            const globalConfirm = findButtonByText(confirmTextOptions);
            if (globalConfirm) {
                globalConfirm.click();
                showNotification('已自动确认弹窗');
                return;
            }
        };

        // 多次尝试，覆盖弹窗渲染延迟的情况
        const attempts = [120, 260, 500, 800];
        attempts.forEach(delay => setTimeout(tryClick, delay));
    } catch (e) {
        console.error('自动确认弹窗失败:', e);
    }
}

// 为按钮添加点击视觉效果
function addButtonClickEffect(button) {
    const originalStyle = {
        backgroundColor: button.style.backgroundColor,
        transform: button.style.transform,
        transition: button.style.transition
    };
    
    // 添加点击效果
    button.style.transition = 'all 0.2s ease';
    button.style.transform = 'scale(0.95)';
    button.style.backgroundColor = '#e3f2fd';
    
    // 恢复原始样式
    setTimeout(() => {
        button.style.backgroundColor = originalStyle.backgroundColor;
        button.style.transform = originalStyle.transform;
        button.style.transition = originalStyle.transition;
    }, 200);
}

// 清理函数
function cleanup() {
    debugLog('执行清理函数');
    
    document.removeEventListener('keydown', handleKeydown);
    // 移除所有图片的事件监听器和样式
    document.querySelectorAll('img').forEach(img => {
        img.style.outline = '';
        img.style.boxShadow = '';
    });
    // 清理尺寸提示框
    if (dimensionTooltip && dimensionTooltip.parentNode) {
        dimensionTooltip.parentNode.removeChild(dimensionTooltip);
        dimensionTooltip = null;
    }
    // 清理图片对比弹窗
    if (comparisonModal && comparisonModal.parentNode) {
        comparisonModal.parentNode.removeChild(comparisonModal);
        comparisonModal = null;
    }
    // 清理右侧工具栏 - 更新选择器以匹配当前的right值
    const toolbar = document.querySelector('div[style*="position: fixed"][style*="right: 5px"]');
    if (toolbar && toolbar.parentNode) {
        toolbar.parentNode.removeChild(toolbar);
    }
    
    // 备用清理方法：通过其他特征查找工具栏
    const toolbars = document.querySelectorAll('div[style*="position: fixed"][style*="transform: translateY(-50%)"][style*="width: 80px"]');
    toolbars.forEach(tb => {
        if (tb && tb.parentNode) {
            tb.parentNode.removeChild(tb);
        }
    });
    // 重置对比页面状态
    isComparisonModalOpen = false;
    // 清理调试面板
    if (debugPanel && debugPanel.parentNode) {
        debugPanel.parentNode.removeChild(debugPanel);
        debugPanel = null;
    }
    // 清理图片引用
    originalImage = null;
    originalImageLocked = false; // 重置锁定状态
    uploadedImage = null;
    shouldAutoCompare = false; // 重置自动对比标记
    
    // 取消所有待执行的对比任务
    debugLog('清理时取消待执行的对比任务', { count: pendingComparisonTimeouts.length });
    pendingComparisonTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
    });
    pendingComparisonTimeouts = [];
    
    // 清理调试日志
    debugLogs = [];

    // 清理RunningHub缓存
    debugLog('清理时清除RunningHub缓存');
    clearRunningHubCache();
}


// 加载F1设置
function loadF1Settings() {
    try {
        chrome.storage.sync.get({ f1Interval: 800, f1MaxRuns: 0 }, (items) => {
            f1IntervalMs = items.f1Interval;
            f1MaxRuns = items.f1MaxRuns;
            console.log('F1设置已加载:', { f1IntervalMs, f1MaxRuns });
        });
    } catch (error) {
        console.error('加载F1设置失败:', error);
        f1IntervalMs = 800; // 默认间隔
        f1MaxRuns = 0; // 默认无限制
    }
}

// 加载自动对比设置
function loadAutoCompareSettings() {
    try {
        chrome.storage.sync.get({ autoCompareEnabled: true }, (items) => {
            autoCompareEnabled = items.autoCompareEnabled;
            console.log('自动对比设置已加载:', autoCompareEnabled);
        });
    } catch (error) {
        console.error('加载自动对比设置失败:', error);
        autoCompareEnabled = true; // 默认开启
    }
}


// 根据文本内容查找链接
function findLinkByText(textOptions) {
    // 查找所有可能的链接元素，包括更广泛的选择器
    const linkSelectors = [
        'a[href]',
        'a[onclick]',
        '[role="link"]',
        '.link',
        '.history-link',
        '.nav-link',
        'span[onclick]',
        'div[onclick]',
        'span[style*="cursor: pointer"]',
        'div[style*="cursor: pointer"]',
        'span[class*="link"]',
        'div[class*="link"]',
        'span[class*="history"]',
        'div[class*="history"]',
        'span[class*="click"]',
        'div[class*="click"]'
    ];
    
    const allElements = document.querySelectorAll(linkSelectors.join(','));
    
    // 遍历所有元素，查找匹配的文本
    for (const element of allElements) {
        const text = (element.textContent || element.innerText || element.title || '').trim();
        
        // 检查是否匹配任一文本选项
        if (textOptions.some(option => 
            text.includes(option) || 
            text.toLowerCase().includes(option.toLowerCase())
        )) {
            return element;
        }
    }
    
    // 如果上面的方法没找到，尝试在整个页面中搜索包含目标文本的元素
    const allTextElements = document.querySelectorAll('*');
    for (const element of allTextElements) {
        const text = (element.textContent || element.innerText || '').trim();
        
        // 检查是否包含目标文本
        if (textOptions.some(option => 
            text.includes(option) || 
            text.toLowerCase().includes(option.toLowerCase())
        )) {
            // 检查这个元素是否可点击（有onclick、cursor:pointer等）
            const style = window.getComputedStyle(element);
            const hasClickHandler = element.onclick || 
                                  element.getAttribute('onclick') ||
                                  style.cursor === 'pointer' ||
                                  element.tagName === 'A' ||
                                  element.getAttribute('role') === 'link';
            
            if (hasClickHandler) {
                return element;
            }
        }
    }
    
    return null;
}

// 点击链接并显示反馈
function clickLink(link, actionName) {
    try {
        console.log(`点击${actionName}链接:`, link);
        
        // 添加视觉反馈
        addLinkClickEffect(link);
        
        // 模拟点击事件
        link.click();
        
        // 显示通知
        showNotification(`已执行: ${actionName}`);
        
    } catch (error) {
        console.error(`点击${actionName}链接时发生错误:`, error);
        showNotification(`执行${actionName}失败: ${error.message}`);
    }
}

// 为链接添加点击视觉效果
function addLinkClickEffect(link) {
    const originalStyle = {
        backgroundColor: link.style.backgroundColor,
        transform: link.style.transform,
        transition: link.style.transition,
        color: link.style.color
    };
    
    // 添加点击效果
    link.style.transition = 'all 0.2s ease';
    link.style.transform = 'scale(0.95)';
    link.style.backgroundColor = '#e3f2fd';
    link.style.color = '#1976d2';
    
    // 恢复原始样式
    setTimeout(() => {
        link.style.backgroundColor = originalStyle.backgroundColor;
        link.style.transform = originalStyle.transform;
        link.style.transition = originalStyle.transition;
        link.style.color = originalStyle.color;
    }, 200);
}

// 显示图片尺寸提示框
function showImageDimensions(img, event) {
    try {
        // 获取图片的真实尺寸
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        
        // 如果尺寸无效，不显示提示框
        if (!width || !height) {
            return;
        }
        
        // 创建或更新提示框
        if (!dimensionTooltip) {
            createDimensionTooltip();
        }
        
        // 设置提示框内容
        dimensionTooltip.textContent = `${width} × ${height}`;
        
        // 显示提示框
        dimensionTooltip.style.display = 'block';
        
        // 更新位置
        updateTooltipPosition(event);
        
    } catch (error) {
        console.error('显示图片尺寸时发生错误:', error);
    }
}

// 隐藏图片尺寸提示框
function hideImageDimensions() {
    if (dimensionTooltip) {
        dimensionTooltip.style.display = 'none';
    }
}

// 创建尺寸提示框元素
function createDimensionTooltip() {
    dimensionTooltip = document.createElement('div');
    dimensionTooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        font-weight: 500;
        z-index: 999999;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        transition: opacity 0.2s ease;
        white-space: nowrap;
        display: none;
    `;
    
    document.body.appendChild(dimensionTooltip);
}

// 更新提示框位置
function updateTooltipPosition(event) {
    if (!dimensionTooltip || dimensionTooltip.style.display === 'none') {
        return;
    }
    
    const offsetX = 15;
    const offsetY = -30;
    
    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;
    
    // 防止提示框超出屏幕边界
    const tooltipRect = dimensionTooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 右边界检查
    if (x + tooltipRect.width > viewportWidth) {
        x = event.clientX - tooltipRect.width - offsetX;
    }
    
    // 上边界检查
    if (y < 0) {
        y = event.clientY + Math.abs(offsetY);
    }
    
    dimensionTooltip.style.left = x + 'px';
    dimensionTooltip.style.top = y + 'px';
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup);

// 图片上传监听和对比功能
function initializeUploadMonitoring() {
    console.log('初始化图片上传监听功能');
    
    // 监听文件输入元素的变化
    observeFileInputs();
    
    // 监听网络请求中的图片上传
    observeNetworkUploads();
    
    // 记录当前页面的原图
    recordOriginalImages();
}

// 监听文件输入元素
function observeFileInputs() {
    // 查找所有现有的文件输入元素
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => addUploadListener(input));
    
    // 使用 MutationObserver 监听动态添加的文件输入元素
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查新添加的元素是否是文件输入
                    if (node.tagName === 'INPUT' && node.type === 'file') {
                        addUploadListener(node);
                    }
                    // 检查新添加的元素内部是否有文件输入
                    const inputs = node.querySelectorAll && node.querySelectorAll('input[type="file"]');
                    if (inputs) {
                        inputs.forEach(input => addUploadListener(input));
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 为文件输入添加上传监听器
function addUploadListener(input) {
    if (input._uploadListenerAdded) return; // 防止重复添加
    input._uploadListenerAdded = true;
    
    input.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                console.log('检测到图片上传:', file.name, file.type, file.size);
                handleImageUpload(file, input);
            }
        }
    });
}

// 处理图片上传
function handleImageUpload(file, inputElement) {
    debugLog('开始处理图片上传', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        hasInputElement: !!inputElement
    });
    
    // 创建FileReader读取上传的图片
    const reader = new FileReader();
    reader.onload = (e) => {
        debugLog('FileReader读取完成');
        
        uploadedImage = {
            src: e.target.result,
            name: file.name,
            size: file.size,
            type: file.type,
            element: inputElement
        };
        
        // 设置自动对比标记，表明这是用户主动上传的图片
        shouldAutoCompare = true;
        
        // 在上传图片时执行B键逻辑，重新检测原图，防止找不到原图
        debugLog('上传图片时自动重新检测原图（执行B键逻辑）');
        originalImageLocked = false;
        originalImage = null;
        recordOriginalImages();
        
        showNotification(`图片上传完成: ${file.name}`, 2000);
        
        // 更新调试面板信息
        if (debugMode && debugPanel) {
            updateDebugInfo();
        }
        
        // 等待一段时间后进行对比（给页面时间处理上传）
        debugLog('设置延迟对比任务');
        const timeoutId = setTimeout(() => {
            debugLog('延迟执行图片对比', {
                currentUrl: window.location.href.substring(0, 50) + '...',
                hasOriginal: !!originalImage,
                hasUploaded: !!uploadedImage,
                shouldAutoCompare: shouldAutoCompare
            });
            
            // 从待执行列表中移除
            const index = pendingComparisonTimeouts.indexOf(timeoutId);
            if (index > -1) {
                pendingComparisonTimeouts.splice(index, 1);
            }
            
            // 只有在应该自动对比且开关开启时才执行（即用户刚上传了图片）
            if (shouldAutoCompare && autoCompareEnabled) {
                debugLog('用户上传图片触发的自动对比');
                shouldAutoCompare = false; // 重置标记，避免重复触发
                performImageComparison();
            } else if (shouldAutoCompare && !autoCompareEnabled) {
                debugLog('跳过自动对比 - 自动对比功能已关闭');
                shouldAutoCompare = false; // 重置标记
            } else {
                debugLog('跳过自动对比 - 非用户上传触发');
            }
        }, 1000);
        
        // 记录待执行的任务
        pendingComparisonTimeouts.push(timeoutId);
        debugLog('已添加延迟对比任务', { 
            timeoutId: timeoutId,
            totalPending: pendingComparisonTimeouts.length 
        });
    };
    
    reader.onerror = (error) => {
        debugLog('FileReader读取失败', error);
        showNotification('图片读取失败', 2000);
    };
    
    debugLog('开始FileReader.readAsDataURL');
    reader.readAsDataURL(file);
}

// 记录页面原始图片 - 增强后端图片检测
function recordOriginalImages() {
    debugLog('开始记录页面原始图片（并行模式）');

    // 使用并行化策略替代串行策略
    parallelOriginalImageDetection();
}

// 检查图片是否为支持的格式（JPEG, PNG, WebP, GIF, BMP）
function isSupportedImageFormat(url) {
    if (!url) return false;

    const lowerUrl = url.toLowerCase();

    // 检查文件扩展名
    const hasSupportedExt = /\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(url);

    // 检查URL中是否包含支持的格式关键词
    const hasSupportedKeyword = /(jpeg|jpg|png|webp|gif|bmp)/.test(lowerUrl);

    const result = hasSupportedExt || hasSupportedKeyword;

    if (!result) {
        debugLog('不支持的图片格式', {
            url: url.substring(0, 100) + '...',
            hasSupportedExt,
            hasSupportedKeyword
        });
    }

    return result;
}

// 从URL中提取文件名
function extractFileNameFromUrl(url) {
    if (!url) return '未知';
    
    try {
        // 从URL中提取文件名部分
        const urlParts = url.split('/');
        let fileName = urlParts[urlParts.length - 1];
        
        // 去除查询参数
        if (fileName.includes('?')) {
            fileName = fileName.split('?')[0];
        }
        
        // 如果没有文件名或者只是数字/ID，使用默认名称
        if (!fileName || fileName.length < 3 || /^\d+$/.test(fileName)) {
            return '原图';
        }
        
        // 如果文件名过长，截断显示
        if (fileName.length > 30) {
            const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
            const baseName = fileName.substring(0, 25);
            return extension ? `${baseName}...${extension}` : `${baseName}...`;
        }
        
        return fileName;
    } catch (error) {
        return '原图';
    }
}

// 并行化原图查找策略 - 多种方法并行执行，采用第一个成功的结果（优化版）
async function parallelOriginalImageDetection(maxRetries = 3) {
    if (originalImageLocked && originalImage) {
        debugLog('原图已锁定，跳过并行获取');
        return;
    }

    // 优化1: 先检查是否已有结果(来自COS拦截或网络监听)
    if (originalImageFromNetwork) {
        debugLog('🔧 使用网络监听结果作为原图', originalImageFromNetwork.src.substring(0, 50) + '...');
        originalImage = originalImageFromNetwork;
        originalImageLocked = true;
        showNotification(`使用网络监听原图: ${originalImage.width}×${originalImage.height}`, 2000);


        return;
    }

    if (capturedOriginalImage) {
        debugLog('🔧 使用COS拦截结果作为原图', capturedOriginalImage.substring(0, 50) + '...');
        // 创建Image对象获取实际尺寸
        const img = new Image();
        img.onload = () => {
            originalImage = {
                src: capturedOriginalImage,
                width: img.naturalWidth,
                height: img.naturalHeight,
                name: extractFileNameFromUrl(capturedOriginalImage),
                element: img,
                source: 'COS拦截'
            };
            originalImageLocked = true;
            debugLog('✅ COS拦截原图加载完成', {
                width: img.naturalWidth,
                height: img.naturalHeight
            });
            showNotification(`使用COS拦截原图: ${img.naturalWidth}×${img.naturalHeight}`, 2000);

            // 如果启用了自动发送，则触发自动发送
            if (autoSendEnabled) {
                setTimeout(() => {
                    autoSendImageData(true).catch(error => {
                        console.error("自动发送失败:", error);
                    });
                }, 300);
            }

        };
        img.onerror = () => {
            debugLog('❌ COS拦截原图加载失败');
        };
        img.src = capturedOriginalImage;
        return;
    }

    // 优化2: 等待DOM加载完成
    if (document.readyState !== 'complete') {
        debugLog('⏳ 等待DOM加载完成...');
        await new Promise(resolve => {
            const checkReady = () => {
                if (document.readyState === 'complete') {
                    debugLog('✅ DOM加载完成');
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }

    debugLog('🏃 启动并行模式原图获取 (优化版)');
    showNotification('正在多渠道并行获取原图...', 1000);

    // 增加重试机制
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        debugLog(`🔄 第${attempt}次尝试并行获取原图`, {
            maxRetries,
            currentAttempt: attempt
        });

        const detectionPromises = [];

        // 方法1: DOM选择器并行检测（最快）
        const domPromise = createTimedPromise(
            'DOM选择器检测',
            () => findOriginalImageBySelectors(),
            800 // 增加到800ms超时
        );
        detectionPromises.push(domPromise);

        // 方法2: 已加载DOM图片检测（快）
        const loadedImagesPromise = createTimedPromise(
            '已加载图片检测',
            () => findLoadedOriginalImages(),
            1000 // 增加到1000ms超时
        );
        detectionPromises.push(loadedImagesPromise);

        // 方法3: 网络请求历史检测（中等）
        const networkPromise = createTimedPromise(
            '网络请求检测',
            () => findOriginalImageFromNetwork(),
            2000 // 增加到2s超时
        );
        detectionPromises.push(networkPromise);

        // 方法4: COS缓存检测（快）
        const cosPromise = createTimedPromise(
            'COS缓存检测',
            () => findOriginalImageFromCOS(),
            1500 // 增加到1.5s超时
        );
        detectionPromises.push(cosPromise);

        // 方法5: 延迟DOM重检（备选）
        const delayedDomPromise = createTimedPromise(
            '延迟DOM检测',
            () => new Promise(resolve => {
                setTimeout(() => {
                    findOriginalImageBySelectors().then(resolve).catch(resolve);
                }, 500); // 减少延迟时间
            }),
            2500 // 增加到2.5s超时
        );
        detectionPromises.push(delayedDomPromise);

        try {
            // Promise.allSettled 等待所有方法完成或超时
            const results = await Promise.allSettled(detectionPromises);

            debugLog(`🏁 第${attempt}次并行获取完成`, {
                总方法数: results.length,
                成功数: results.filter(r => r.status === 'fulfilled' && r.value).length,
                失败数: results.filter(r => r.status === 'rejected').length
            });

            // 分析结果，选择最佳原图
            const bestImage = selectBestOriginalImage(results);

            if (bestImage) {
                debugLog('🏆 并行获取成功', {
                    来源: bestImage.source,
                    尺寸: `${bestImage.width}x${bestImage.height}`,
                    URL: bestImage.src.substring(0, 50) + '...'
                });

                // 更新全局原图
                originalImage = bestImage;
                originalImageLocked = true;

                showNotification(`并行获取原图成功 (${bestImage.source}): ${bestImage.width}×${bestImage.height}`, 2000);

                return; // 成功后立即返回
            } else {
                debugLog(`❌ 第${attempt}次尝试未找到原图`);
                if (attempt < maxRetries) {
                    // 在重试前短暂等待
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

        } catch (error) {
            debugLog(`第${attempt}次并行获取出错`, error.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    // 所有重试都失败了
    debugLog(`❌ 所有${maxRetries}次并行方法都失败了`);
    showNotification('未能获取到原图，请稍后再试', 2000);
}

// 创建带超时的Promise
function createTimedPromise(name, promiseFactory, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            debugLog(`⏰ ${name} 超时 (${timeoutMs}ms)`);
            resolve(null); // 超时返回null而不是reject
        }, timeoutMs);

        Promise.resolve(promiseFactory())
            .then(result => {
                clearTimeout(timeoutId);
                debugLog(`✅ ${name} 完成`, result ? `${result.width}x${result.height}` : '无结果');
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                debugLog(`❌ ${name} 失败`, error.message);
                resolve(null); // 失败也返回null，不中断整体流程
            });
    });
}

// 通过DOM选择器查找原图
async function findOriginalImageBySelectors() {
    debugLog('开始DOM选择器查找原图');

    // 精确的DOM选择器（最高优先级）
    const preciseSelectorCandidates = [
        'div[data-v-92a52416].safe-image img[data-v-92a52416][src]',
        'div.safe-image img[data-v-92a52416][src]',
        'img[data-v-92a52416][src].img',
        'img[data-v-92a52416][src]',
        'div.safe-image img[src]',
        '.image-item img[src]'
    ];

    // COS原图选择器（支持多种格式）
    const cosImageSelectors = [
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".jpg"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".jpeg"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".png"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".webp"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".gif"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="/target/"][src*=".bmp"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".jpg"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".jpeg"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".png"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".webp"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".gif"]',
        'img[src*="cos.ap-guangzhou.myqcloud.com"][src*="dataset"][src*=".bmp"]',
        'img[src*="/target/"][src*=".jpg"]',
        'img[src*="/target/"][src*=".jpeg"]',
        'img[src*="/target/"][src*=".png"]',
        'img[src*="/target/"][src*=".webp"]',
        'img[src*="/target/"][src*=".gif"]',
        'img[src*="/target/"][src*=".bmp"]',
        'img[src*="/target/dataset/"][src*=".jpg"]',
        'img[src*="/target/dataset/"][src*=".jpeg"]',
        'img[src*="/target/dataset/"][src*=".png"]',
        'img[src*="/target/dataset/"][src*=".webp"]',
        'img[src*="/target/dataset/"][src*=".gif"]',
        'img[src*="/target/dataset/"][src*=".bmp"]',
        'img[src*="dataset/"][src*=".jpg"]',
        'img[src*="dataset/"][src*=".jpeg"]',
        'img[src*="dataset/"][src*=".png"]',
        'img[src*="dataset/"][src*=".webp"]',
        'img[src*="dataset/"][src*=".gif"]',
        'img[src*="dataset/"][src*=".bmp"]'
    ];

    // 合并选择器，精确DOM选择器优先
    const selectorCandidates = [
        ...preciseSelectorCandidates,
        ...cosImageSelectors
    ];

    // 并行检查所有选择器
    const selectorPromises = selectorCandidates.map(selector => {
        return new Promise(resolve => {
            try {
                const images = document.querySelectorAll(selector);
                if (images.length > 0) {
                    // 找到第一个符合条件的支持格式图片
                    const jpegImage = Array.from(images).find(img => isSupportedImageFormat(img.src) && img.complete);
                    if (jpegImage) {
                        resolve({
                            src: jpegImage.src,
                            width: jpegImage.naturalWidth,
                            height: jpegImage.naturalHeight,
                            name: extractFileNameFromUrl(jpegImage.src),
                            element: jpegImage,
                            source: `选择器-${selector}`
                        });
                    } else {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            } catch (error) {
                resolve(null);
            }
        });
    });

    const results = await Promise.allSettled(selectorPromises);
    const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);

    if (successfulResults.length > 0) {
        // 选择尺寸最大的图片
        const bestImage = successfulResults.reduce((best, current) => {
            const bestSize = best.width * best.height;
            const currentSize = current.width * current.height;
            return currentSize > bestSize ? current : best;
        });

        debugLog('DOM选择器找到原图', {
            src: bestImage.src.substring(0, 50) + '...',
            size: `${bestImage.width}x${bestImage.height}`
        });

        return bestImage;
    }

    return null;
}

// 查找已加载的原图
async function findLoadedOriginalImages() {
    debugLog('开始查找已加载的原图');

    const images = document.querySelectorAll('img[src]');
    const loadedImages = Array.from(images)
        .filter(img => img.complete && img.naturalWidth > 200 && img.naturalHeight > 200)
        .filter(img => isSupportedImageFormat(img.src))
        .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));

    if (loadedImages.length > 0) {
        const img = loadedImages[0];
        const result = {
            src: img.src,
            width: img.naturalWidth,
            height: img.naturalHeight,
            name: extractFileNameFromUrl(img.src),
            element: img,
            source: '已加载图片'
        };

        debugLog('找到已加载的原图', {
            src: result.src.substring(0, 50) + '...',
            size: `${result.width}x${result.height}`
        });

        return result;
    }

    return null;
}

// 从网络请求历史中查找原图
async function findOriginalImageFromNetwork() {
    debugLog('开始从网络请求历史查找原图');

    if (capturedImageRequests.size === 0) return null;

    const candidates = Array.from(capturedImageRequests.values())
        .filter(req => req.isOriginalCandidate)
        .sort((a, b) => b.timestamp - a.timestamp); // 按时间排序，最新的优先

    if (candidates.length > 0) {
        const req = candidates[0];
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({
                src: req.url,
                width: img.naturalWidth,
                height: img.naturalHeight,
                name: extractFileNameFromUrl(req.url),
                element: img,
                source: '网络请求历史'
            });
            img.onerror = () => resolve(null);
            img.src = req.url;
        });
    }

    return null;
}

// 从COS缓存中查找原图
async function findOriginalImageFromCOS() {
    debugLog('开始从COS缓存查找原图');

    if (capturedOriginalImage) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({
                src: capturedOriginalImage,
                width: img.naturalWidth,
                height: img.naturalHeight,
                name: extractFileNameFromUrl(capturedOriginalImage),
                element: img,
                source: 'COS缓存'
            });
            img.onerror = () => resolve(null);
            img.src = capturedOriginalImage;
        });
    }

    return null;
}

// 选择最佳原图
function selectBestOriginalImage(results) {
    const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);

    if (successfulResults.length === 0) return null;

    debugLog('并行结果分析', {
        成功结果: successfulResults.map(img => ({
            来源: img.source,
            尺寸: `${img.width}x${img.height}`,
            像素总数: img.width * img.height
        }))
    });

    // 选择策略：
    // 1. 优先选择DOM精确检测的结果（最可靠）
    // 2. 其次选择COS缓存的结果（质量高）
    // 3. 再次选择像素最多的图片（质量最高）
    // 4. 最后选择最新的结果（时效性最好）

    let bestImage = null;

    const domResult = successfulResults.find(img => img.source.includes('选择器-'));
    if (domResult) {
        debugLog('选择DOM检测结果');
        bestImage = domResult;
    } else {
        const cosResult = successfulResults.find(img => img.source.includes('COS'));
        if (cosResult) {
            debugLog('选择COS缓存结果');
            bestImage = cosResult;
        } else {
            // 按像素总数排序
            const sortedBySize = successfulResults.sort((a, b) =>
                (b.width * b.height) - (a.width * a.height)
            );

            debugLog('选择最大尺寸结果', {
                选中: {
                    来源: sortedBySize[0].source,
                    尺寸: `${sortedBySize[0].width}x${sortedBySize[0].height}`
                }
            });

            bestImage = sortedBySize[0];
        }
    }

    // 如果找到了最佳原图，检查是否应该触发自动发送
    if (bestImage && autoSendEnabled) {
        // 检查是否已经有原图锁定，避免重复处理
        if (!originalImageLocked) {
            setTimeout(() => {
                // 使用forceSend=true来绕过内部重复检查，因为我们已经在外部确保了唯一性
                autoSendImageData(true).catch(error => {
                    console.error("自动发送失败:", error);
                });
            }, 300); // 给一些时间确保状态完全设置
        }
    }

    return bestImage;
}

/**
 * 原有严格版本：仅允许 JPEG
 */
function recordImageAsOriginal(img) {
    // 如果原图已经被锁定，不允许在同一页面内更改
    if (originalImageLocked && originalImage) {
        debugLog('原图已在当前页面锁定，跳过更新', {
            existingOriginal: originalImage.src.substring(0, 50) + '...',
            attemptedNew: img.src ? img.src.substring(0, 50) + '...' : '无src',
            currentPage: currentPageUrl.substring(0, 50) + '...'
        });
        return;
    }
    
    // 验证图片格式：只接受支持的图片格式（JPEG, PNG, WebP, GIF, BMP）
    if (!img.src || !isSupportedImageFormat(img.src)) {
        debugLog('跳过不支持的图片格式', {
            src: img.src ? img.src.substring(0, 100) + '...' : '无src',
            reason: '不支持的图片格式'
        });
        return;
    }

    setOriginalImageCommon(img);
}

/**
 * 宽松版本：允许常见位图格式（用于 D 键下载后“标记为原图”的需求）
 */
function recordImageAsOriginalFlexible(img) {
    // 如果原图已经被锁定，不允许在同一页面内更改
    if (originalImageLocked && originalImage) {
        debugLog('原图已在当前页面锁定（宽松模式跳过）');
        return;
    }

    if (!img || !img.src) {
        debugLog('宽松模式：无有效图片可标记为原图');
        return;
    }
    const url = img.src.toLowerCase();
    const isRaster =
        /\.(jpe?g|png|webp|gif|bmp|tiff)(\?|#|$)/i.test(url) ||
        url.startsWith('data:image/') ||
        url.startsWith('blob:');

    if (!isRaster) {
        debugLog('宽松模式：非位图格式，跳过标记', url.substring(0, 100) + '...');
        return;
    }

    setOriginalImageCommon(img);
}

/**
 * 设置 originalImage 的公共实现
 */
function setOriginalImageCommon(img) {
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;

    originalImage = {
        src: img.src,
        width: width,
        height: height,
        name: extractFileNameFromUrl(img.src),
        element: img
    };

    // 锁定原图，防止在当前页面内被覆盖
    originalImageLocked = true;

    debugLog('成功记录原图并锁定到当前页面（通用）', {
        src: originalImage.src.substring(0, 50) + '...',
        width: originalImage.width,
        height: originalImage.height,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        locked: originalImageLocked,
        currentPage: currentPageUrl.substring(0, 50) + '...'
    });

    console.log('记录原图:', originalImage.src);
    showNotification(`已锁定原图: ${width}×${height}`, 2000);
}

// 强化的网络请求拦截和原图资源捕获系统

function observeNetworkUploads() {
    debugLog('启动强化的网络请求拦截系统');
    
    // 拦截 fetch 请求
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const request = args[0];
        const url = typeof request === 'string' ? request : request.url;
        
        debugLog('拦截到fetch请求', { url: url.substring(0, 100) + '...' });
        
        return originalFetch.apply(this, args).then(response => {
            handleNetworkResponse(url, response, 'fetch');
            return response;
        }).catch(error => {
            debugLog('fetch请求错误', { url: url.substring(0, 50) + '...', error: error.message });
            throw error;
        });
    };
    
    // 拦截 XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._interceptedUrl = url;
        this._interceptedMethod = method;
        debugLog('拦截到XMLHttpRequest.open', { 
            method, 
            url: url ? url.substring(0, 100) + '...' : 'unknown' 
        });
        
        return originalXHROpen.call(this, method, url, async, user, password);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;
        const url = xhr._interceptedUrl;
        const method = xhr._interceptedMethod;
        
        // 监听加载完成事件
        xhr.addEventListener('load', function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                handleNetworkResponse(url, xhr, 'xhr');
            }
        });
        
        debugLog('拦截到XMLHttpRequest.send', { 
            method, 
            url: url ? url.substring(0, 100) + '...' : 'unknown',
            hasData: !!data
        });
        
        return originalXHRSend.call(this, data);
    };
    
    // 新增：拦截Image对象的src设置
    interceptImageObjectCreation();

    // 新增：监听资源加载事件
    observeResourceLoading();
}

// 处理网络响应，捕获图片资源 - 增强后端检测
function handleNetworkResponse(url, response, type) {
    if (!url) return;
    
    // 更全面的图片请求检测
    const isImageByUrl = isImageUrl(url);
    const isImageByHeaders = hasImageHeaders(response);
    const isImageBySize = response && response.size && response.size > 1024; // 至少1KB
    
    // 检查响应状态
    const isSuccessResponse = !response.status || 
                             (response.status >= 200 && response.status < 300);
    
    // 后端API图片特征检测
    const lowerUrl = url.toLowerCase();
    const isPotentialBackendImage = (
        lowerUrl.includes('/api/') ||
        lowerUrl.includes('/upload/') ||
        lowerUrl.includes('/media/') ||
        lowerUrl.includes('/file/') ||
        lowerUrl.includes('/attachment/') ||
        lowerUrl.includes('/resource/')
    ) && isSuccessResponse;
    
    const isImageRequest = isImageByUrl || isImageByHeaders || 
                          (isPotentialBackendImage && isImageBySize);
    
    if (isImageRequest) {
        debugLog('检测到图片请求', { 
            url: url.substring(0, 100) + '...',
            type: type,
            status: response.status || 'unknown',
            detectionMethod: {
                byUrl: isImageByUrl,
                byHeaders: isImageByHeaders,
                byBackendPattern: isPotentialBackendImage,
                bySize: isImageBySize
            }
        });
        
        // 检查是否是服务器返回的修改图
        const isServerModifiedImage = isServerModifiedImageUrl(url);
        
        // 存储图片请求信息
        const imageInfo = {
            url: url,
            timestamp: Date.now(),
            type: type,
            response: response,
            isOriginalCandidate: isOriginalImageCandidate(url),
            isServerModifiedImage: isServerModifiedImage
        };
        
        capturedImageRequests.set(url, imageInfo);
        
        // 已移除：服务器修改图处理逻辑
        // if (isServerModifiedImage && isRevisionMode) {
        //     debugLog('检测到服务器修改图', {
        //         url: url.substring(0, 100) + '...',
        //         已移除：模式相关日志
        //     });
        //     
        //     // 已移除：返修模式专用日志
        //     revisionLog('服务器修改图检测', '发现服务器返回的修改图', {
        //         url: url,
        //         urlPreview: url.substring(0, 100) + '...',
        //         timestamp: new Date(imageInfo.timestamp).toISOString(),
        //         requestType: type,
        //         status: response.status || 'unknown',
        //         已移除：模式相关日志
        //         urlFeatures: {
        //             hasModifiedImageName: url.toLowerCase().includes('副本.jpg') || url.toLowerCase().includes('%e5%89%af%e6%9c%ac.jpg'),
        //             isFromCOSDomain: url.toLowerCase().includes('cos.ap-guangzhou.myqcloud.com'),
        //             hasTaskDetailPath: url.toLowerCase().includes('attachment/task-detail')
        //         }
        //     }, 'server_modified_image');
        //     
        //     processServerModifiedImage(imageInfo);
        // }
        
        // COS原图优先处理
        const isCOSOriginal = isCOSOriginalImage(url);
        
        // 如果这可能是原图，尝试使用它
        if ((imageInfo.isOriginalCandidate || isCOSOriginal) && (!originalImage || !originalImageLocked)) {
            debugLog('发现原图候选网络请求', {
                url: url.substring(0, 100) + '...',
                isCOSOriginal,
                isGeneralCandidate: imageInfo.isOriginalCandidate
            });
            
            // 已移除：返修模式专用日志
            // if (isRevisionMode) { ... }
            
            processNetworkOriginalImage(imageInfo);
        }
        
        // 检查是否是上传相关的请求
        if (url.includes('upload') || url.includes('image')) {
            debugLog('检测到可能的图片上传请求');
            setTimeout(() => {
                checkForNewImages();
            }, 2000);
        }
    }
}

// 判断URL是否是图片 - 增强后端检测
function isImageUrl(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // 图片文件扩展名（支持多种格式）
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const hasImageExt = imageExtensions.some(ext => lowerUrl.includes(ext));

    // 后端API图片路径关键词
    const backendImagePaths = [
        '/api/image', '/api/upload', '/api/file', '/api/media',
        '/upload/image', '/media/image', '/file/image',
        '/attachment/', '/resource/image', '/assets/image',
        '/static/image', '/public/image', '/storage/image'
    ];

    // 图片相关关键词（支持多种格式）
    const imageKeywords = [
        'image', 'img', 'picture', 'photo', 'pic', 'jpeg', 'jpg', 'png', 'webp', 'gif', 'bmp',
        'upload', 'media', 'attachment', 'file'
    ];
    
    // Content-Type检查（对于动态生成的图片URL）
    const mightBeImageApi = /\/(image|img|picture|photo|media|upload|file)[\/\?]/.test(lowerUrl);
    
    // 检查是否有后端图片路径
    const hasBackendImagePath = backendImagePaths.some(path => lowerUrl.includes(path));
    
    // 检查是否包含图片关键词
    const hasImageKeyword = imageKeywords.some(keyword => lowerUrl.includes(keyword));
    
    // 检查是否是Base64图片
    const isBase64Image = lowerUrl.startsWith('data:image/');
    
    // 检查是否是Blob URL
    const isBlobUrl = lowerUrl.startsWith('blob:');
    
    const result = hasImageExt || 
                   hasBackendImagePath || 
                   mightBeImageApi || 
                   hasImageKeyword || 
                   isBase64Image || 
                   isBlobUrl;
    
    if (result && !hasImageExt) {
        debugLog('检测到非扩展名图片URL', {
            url: url.substring(0, 100) + '...',
            hasBackendImagePath,
            mightBeImageApi,
            hasImageKeyword,
            isBase64Image,
            isBlobUrl
        });
    }
    
    return result;
}

// 检查响应头是否表明这是图片 - 增强后端响应检测
function hasImageHeaders(response) {
    try {
        if (!response) return false;
        
        let contentType = '';
        let contentDisposition = '';
        
        // 处理不同类型的响应对象
        if (response.headers && typeof response.headers.get === 'function') {
            // Fetch Response对象
            contentType = response.headers.get('content-type') || '';
            contentDisposition = response.headers.get('content-disposition') || '';
        } else if (response.getResponseHeader) {
            // XMLHttpRequest对象
            contentType = response.getResponseHeader('content-type') || '';
            contentDisposition = response.getResponseHeader('content-disposition') || '';
        } else if (typeof response === 'object' && response.status) {
            // 自定义响应对象
            contentType = response.contentType || '';
        }
        
        const lowerContentType = contentType.toLowerCase();
        const lowerDisposition = contentDisposition.toLowerCase();
        
        // 检查Content-Type
        const hasImageContentType = lowerContentType.startsWith('image/') ||
                                   lowerContentType.includes('jpeg');
        
        // 检查Content-Disposition中的文件名（只支持JPEG格式）
        const hasImageFilename = /\.(jpe?g)[";\s]/i.test(lowerDisposition);
        
        // 检查是否是二进制内容
        const isBinaryContent = lowerContentType.includes('application/octet-stream') ||
                               lowerContentType.includes('binary');
        
        const result = hasImageContentType || hasImageFilename || 
                      (isBinaryContent && lowerDisposition.includes('image'));
        
        if (result) {
            debugLog('检测到图片响应头', {
                contentType: contentType.substring(0, 50),
                contentDisposition: contentDisposition.substring(0, 50),
                hasImageContentType,
                hasImageFilename,
                isBinaryContent
            });
        }
        
        return result;
        
    } catch (error) {
        debugLog('检查响应头失败', error.message);
        return false;
    }
}

// 判断是否是原图候选 - 增强后端链接检测
function isOriginalImageCandidate(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // 后端API图片链接特征检测 - 增强COS路径识别
    const backendIndicators = [
        '/api/', '/upload/', '/image/', '/media/', '/file/',
        '/attachment/', '/resource/', '/assets/', '/static/',
        '/target/', '/target/dataset/', '/dataset/',
        '/origin/', '/source/', '/raw/'
    ];
    
    // 原图关键词
    const originalKeywords = [
        'original', 'source', 'master', 'raw', 'full', 'origin',
        '原图', '原始', '源图', 'src', 'orig',
        'high', 'hd', 'quality', 'best', 'max'
    ];
    
    // 文件名中的原图指示器
    const filenameIndicators = [
        'original', 'source', 'master', 'raw', 'full',
        'large', 'big', 'huge', 'xl', 'xxl', 'max'
    ];
    
    // 检查是否包含后端API路径
    const hasBackendPath = backendIndicators.some(indicator => 
        lowerUrl.includes(indicator)
    );
    
    // 检查原图关键词
    const hasOriginalKeyword = originalKeywords.some(keyword => 
        lowerUrl.includes(keyword)
    );
    
    // 检查文件名指示器（在URL路径的最后部分）
    const urlParts = lowerUrl.split('/');
    const fileName = urlParts[urlParts.length - 1] || '';
    const hasFilenameIndicator = filenameIndicators.some(indicator => 
        fileName.includes(indicator)
    );
    
    // 检查尺寸格式（如 1920x1080）
    const hasDimensions = /\d{3,4}[x×]\d{3,4}/.test(url);
    
    // 检查高质量指示器
    const hasQualityIndicator = /[\?&](quality|q)=([89]\d|100)/.test(lowerUrl) || // 高质量参数
                               /(high|hd|uhd|4k|8k)/i.test(lowerUrl);
    
    // 检查文件大小参数（通常原图会有更大的尺寸参数）
    const hasSizeParams = /[\?&](w|width|h|height)=([5-9]\d{2,}|\d{4,})/.test(lowerUrl);
    
    // 避免缩略图
    const isThumbnail = /(thumb|thumbnail|small|mini|tiny|preview|_s\.|_m\.|_xs\.|_sm\.)/i.test(lowerUrl);
    
    // 使用专门的COS原图检测
    const isCOSOriginal = isCOSOriginalImage(url);
    
    // 综合判断
    const isCandidate = (
        hasBackendPath || 
        hasOriginalKeyword || 
        hasFilenameIndicator ||
        hasDimensions ||
        hasQualityIndicator ||
        hasSizeParams ||
        isCOSOriginal
    ) && !isThumbnail;
    
    if (isCandidate) {
        debugLog('识别为原图候选', {
            url: url.substring(0, 100) + '...',
            hasBackendPath,
            hasOriginalKeyword,
            hasFilenameIndicator,
            hasDimensions,
            hasQualityIndicator,
            hasSizeParams,
            isCOSOriginal,
            isThumbnail
        });
    }
    
    return isCandidate;
}

// 判断是否是服务器返回的修改图 - 增强后端检测
function isServerModifiedImageUrl(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // COS域名修改图特征
    const hasModifiedImageName = lowerUrl.includes('%e5%89%af%e6%9c%ac.jpg') || // URL编码的'副本.jpg'
                                lowerUrl.includes('副本.jpg') || 
                                lowerUrl.includes('copy.jpg') ||
                                lowerUrl.includes('_copy.') ||
                                lowerUrl.includes('_modified.') ||
                                lowerUrl.includes('_edit.');
    
    const isFromCOSDomain = lowerUrl.includes('cos.ap-guangzhou.myqcloud.com');
    const hasTaskDetailPath = lowerUrl.includes('attachment/task-detail');
    
    // 通用后端修改图特征
    const backendModifiedIndicators = [
        '/modified/', '/edited/', '/processed/', '/converted/',
        '/thumbnail/', '/resized/', '/compressed/', '/optimized/',
        'modified_', 'edited_', 'processed_', 'converted_',
        'thumb_', 'small_', 'medium_', 'compressed_'
    ];
    
    // API路径中的修改图指示器
    const apiModifiedPaths = [
        '/api/image/modify', '/api/image/edit', '/api/image/process',
        '/api/media/transform', '/api/file/convert', '/api/upload/process'
    ];
    
    // 查询参数中的修改指示器
    const modifyParams = [
        'action=modify', 'action=edit', 'action=process',
        'type=modified', 'type=processed', 'mode=edit',
        'transform=', 'resize=', 'compress=', 'optimize='
    ];
    
    // 检查通用后端修改图特征
    const hasBackendModifiedPath = backendModifiedIndicators.some(indicator => 
        lowerUrl.includes(indicator)
    );
    
    const hasApiModifiedPath = apiModifiedPaths.some(path => 
        lowerUrl.includes(path)
    );
    
    const hasModifyParams = modifyParams.some(param => 
        lowerUrl.includes(param)
    );
    
    // COS特定检测
    const isCOSServerModified = hasModifiedImageName && isFromCOSDomain && hasTaskDetailPath;
    
    // 通用后端修改图检测
    const isGeneralServerModified = hasBackendModifiedPath || hasApiModifiedPath || hasModifyParams;
    
    const isServerModified = isCOSServerModified || isGeneralServerModified;
    
    if (isServerModified) {
        debugLog('识别到服务器修改图URL特征', {
            url: url.substring(0, 100) + '...',
            isCOSServerModified,
            isGeneralServerModified,
            hasBackendModifiedPath,
            hasApiModifiedPath,
            hasModifyParams,
            // COS特定
            hasModifiedImageName,
            isFromCOSDomain,
            hasTaskDetailPath
        });
    }
    
    return isServerModified;
}

// 处理从网络请求中获取的原图
async function processNetworkOriginalImage(imageInfo) {
    try {
        debugLog('处理网络原图候选', {
            url: imageInfo.url.substring(0, 50) + '...',
            timestamp: imageInfo.timestamp
        });
        
        // 创建Image对象来获取实际尺寸
        const img = new Image();
        
        img.onload = () => {
            debugLog('网络原图加载完成', {
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                url: imageInfo.url.substring(0, 50) + '...'
            });
            
            // 已移除：返修模式专用日志
            // if (isRevisionMode) { ... }
            
            // 如果这个图片比当前原图更合适，更新原图
            if (!originalImage || 
                (!originalImageLocked && 
                 img.naturalWidth * img.naturalHeight > 
                 (originalImage.width || 0) * (originalImage.height || 0))) {
                
                originalImageFromNetwork = {
                    src: imageInfo.url,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    name: extractFileNameFromUrl(imageInfo.url),
                    element: img,
                    fromNetwork: true,
                    captureTime: imageInfo.timestamp
                };
                
                // 更新全局原图引用
                originalImage = originalImageFromNetwork;
                originalImageLocked = true;
                
                debugLog('通过网络请求更新了原图', {
                    src: originalImage.src.substring(0, 50) + '...',
                    width: originalImage.width,
                    height: originalImage.height,
                    fromNetwork: true
                });
                
                // 已移除：返修模式专用日志
                // if (isRevisionMode) { ... }
                
                showNotification(`从网络请求获取原图: ${originalImage.width}×${originalImage.height}`, 2000);
            }
        };
        
        img.onerror = () => {
            debugLog('网络原图加载失败', imageInfo.url.substring(0, 50) + '...');
        };
        
        // 设置跨域属性并加载图片
        img.crossOrigin = 'anonymous';
        img.src = imageInfo.url;
        
    } catch (error) {
        debugLog('处理网络原图时出错', error.message);
    }
}

// 处理服务器返回的修改图
async function processServerModifiedImage(imageInfo) {
    try {
        debugLog('处理服务器修改图', {
            url: imageInfo.url.substring(0, 50) + '...',
            timestamp: imageInfo.timestamp,
            // 已移除：模式相关日志
        });
        
        // 已移除：返修模式专用日志和处理逻辑
        // revisionLog('检测到服务器修改图网络请求', { ... });
        // if (!isRevisionMode) { ... }
        
        // 创建Image对象来获取实际尺寸
        const img = new Image();
        
        img.onload = () => {
            debugLog('服务器修改图加载完成', {
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                url: imageInfo.url.substring(0, 50) + '...'
            });
            
            // 已移除：返修模式专用日志
            // 已移除：revisionLog调用
            
            // 存储服务器修改图信息
            serverReturnedModifiedImage = {
                src: imageInfo.url,
                width: img.naturalWidth,
                height: img.naturalHeight,
                name: extractFileNameFromUrl(imageInfo.url),
                element: img,
                fromServer: true,
                captureTime: imageInfo.timestamp
            };
            
            debugLog('已存储服务器修改图', {
                src: serverReturnedModifiedImage.src.substring(0, 50) + '...',
                width: serverReturnedModifiedImage.width,
                height: serverReturnedModifiedImage.height,
                fromServer: true
            });
            
            // 已移除：返修模式专用日志
            // 已移除：revisionLog调用
            
            showNotification(`检测到服务器修改图: ${serverReturnedModifiedImage.width}×${serverReturnedModifiedImage.height}`, 2000);
            
            // 在调试面板中显示信息
            if (debugMode && debugPanel) {
                updateDebugInfo();
            }
        };
        
        img.onerror = () => {
            debugLog('服务器修改图加载失败', imageInfo.url.substring(0, 50) + '...');
            
            // 已移除：返修模式专用日志
            // 已移除：revisionLog调用
        };
        
        // 设置跨域属性并加载图片
        img.crossOrigin = 'anonymous';
        img.src = imageInfo.url;
        
    } catch (error) {
        debugLog('处理服务器修改图时出错', error.message);
    }
}

// 拦截Image对象的创建和src设置
function interceptImageObjectCreation() {
    debugLog('启动Image对象拦截');
    
    // 拦截Image构造函数
    const originalImage = window.Image;
    window.Image = function(...args) {
        const img = new originalImage(...args);
        
        // 重写src属性的setter
        const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src') ||
                                     Object.getOwnPropertyDescriptor(img, 'src') ||
                                     { set: function(value) { this.setAttribute('src', value); }, configurable: true };
        
        if (originalSrcDescriptor.configurable !== false) {
            Object.defineProperty(img, 'src', {
                get: originalSrcDescriptor.get,
                set: function(value) {
                    debugLog('拦截到Image.src设置', value ? value.substring(0, 100) + '...' : 'empty');
                    
                    // 如果这可能是原图，记录它
                    if (value && isOriginalImageCandidate(value)) {
                        const imageInfo = {
                            url: value,
                            timestamp: Date.now(),
                            type: 'image-object',
                            isOriginalCandidate: true
                        };
                        capturedImageRequests.set(value, imageInfo);
                        
                        if (!originalImage || !originalImageLocked) {
                            processNetworkOriginalImage(imageInfo);
                        }
                    }
                    
                    return originalSrcDescriptor.set.call(this, value);
                },
                configurable: true
            });
        }
        
        return img;
    };
    
    // 保持原始构造函数的属性
    Object.setPrototypeOf(window.Image, originalImage);
    Object.setPrototypeOf(window.Image.prototype, originalImage.prototype);
}

// 监听资源加载事件
function observeResourceLoading() {
    debugLog('启动资源加载监听');
    
    // 监听所有资源的加载事件
    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.initiatorType === 'img' || entry.name.match(/\.(jpe?g|png|webp|gif|bmp)(\?|$)/i)) {
                debugLog('性能API检测到图片资源', {
                    name: entry.name.substring(0, 100) + '...',
                    size: entry.transferSize,
                    duration: entry.duration
                });
                
                // 如果这是原图候选，处理它
                if (isOriginalImageCandidate(entry.name)) {
                    const imageInfo = {
                        url: entry.name,
                        timestamp: Date.now(),
                        type: 'performance-api',
                        size: entry.transferSize,
                        isOriginalCandidate: true
                    };
                    
                    capturedImageRequests.set(entry.name, imageInfo);
                    
                    if (!originalImage || !originalImageLocked) {
                        processNetworkOriginalImage(imageInfo);
                    }
                }
            }
        }
    });
    
    try {
        observer.observe({ entryTypes: ['resource'] });
        debugLog('性能API资源监听已启动');
    } catch (error) {
        debugLog('性能API不可用', error.message);
    }
    
    // 监听网络面板的请求（如果可能）
    if (window.chrome && window.chrome.devtools) {
        debugLog('尝试启动开发者工具网络监听');
        // 注意：这在普通页面中不可用，只在devtools扩展中可用
    }
}

// 检查页面是否有新图片
function checkForNewImages() {
    const currentImages = document.querySelectorAll('img');
    const newImages = Array.from(currentImages).filter(img => {
        return !img._recorded && img.naturalWidth > 100 && img.naturalHeight > 100;
    });
    
    if (newImages.length > 0) {
        console.log('发现新图片:', newImages.length, '张');
        newImages.forEach(img => {
            img._recorded = true;
            // 注意：不在这里自动触发对比，对比只应该在用户上传图片时触发
            debugLog('标记新图片为已记录', {
                src: img.src ? img.src.substring(0, 50) + '...' : '无src',
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        });
    }
}

// 执行图片对比
function performImageComparison(newImage = null) {
    debugLog('开始执行图片对比', {
        hasOriginalImage: !!originalImage,
        hasUploadedImage: !!uploadedImage,
        hasNewImage: !!newImage,
        originalImageLocked: originalImageLocked,
        shouldAutoCompare: shouldAutoCompare,
        // 已移除：模式相关状态
        hasServerReturnedModifiedImage: !!serverReturnedModifiedImage
    });
    
    // 已移除：返修模式专用日志
    // 已移除：revisionLog调用
    
    // 如果没有原图，先尝试快速检测一次
    if (!originalImage) {
        debugLog('对比时未找到原图，尝试快速重新检测');
        recordOriginalImages();
        
        // 如果快速检测失败，提示用户按B键
        if (!originalImage) {
            debugLog('快速检测失败');
            showNotification('未找到原图，请按B键重新检测后再试', 3000);
            return;
        }
    }
    
    // 根据当前模式确定修改图来源
    let modifiedImage = null;
    let imageSource = '';
    
    if (uploadedImage) {
        // 优先使用用户上传的图片
        modifiedImage = uploadedImage;
        imageSource = '用户上传';
        debugLog('使用用户上传的修改图');
        
        // 已移除：返修模式专用日志
        // 已移除：revisionLog调用
    // 已移除：返修模式服务器修改图处理逻辑
    // } else if (isRevisionMode && serverReturnedModifiedImage) { ... }
    } else {
        // 没有可用的修改图
        debugLog('图片对比失败 - 缺少修改图', { 
            originalImage: originalImage ? '有' : '无', 
            uploadedImage: uploadedImage ? '有' : '无'
        });
        
        showNotification('请先上传图片再进行对比', 2000);
        return;
    }
    
    debugLog('图片对比条件满足，创建对比界面', {
        originalSrc: originalImage.src ? originalImage.src.substring(0, 50) + '...' : '无src',
        modifiedSrc: modifiedImage.src ? modifiedImage.src.substring(0, 50) + '...' : '无src',
        imageSource: imageSource,
        // 已移除：模式相关状态
    });
    
    // 已移除：返修模式专用日志
    // 已移除：revisionLog调用
    
    showNotification(`正在对比图片... (${imageSource})`, 1500);
    
    // 验证参数并创建对比界面
    debugLog('准备创建对比界面', {
        originalImage: originalImage ? {
            src: originalImage.src ? originalImage.src.substring(0, 50) + '...' : '无src',
            width: originalImage.width,
            height: originalImage.height,
            name: originalImage.name
        } : '无originalImage',
        modifiedImage: modifiedImage ? {
            src: modifiedImage.src ? modifiedImage.src.substring(0, 50) + '...' : '无src',
            width: modifiedImage.width,
            height: modifiedImage.height,
            name: modifiedImage.name
        } : '无modifiedImage'
    });
    
    if (!originalImage) {
        debugLog('原图为空，无法创建对比界面');
        showNotification('❌ 原图不可用，无法进行对比', 3000);
        return;
    }
    
    if (!modifiedImage) {
        debugLog('修改图为空，无法创建对比界面');
        showNotification('❌ 修改图不可用，无法进行对比', 3000);
        return;
    }
    
    // 创建对比界面
    createComparisonModal(originalImage, modifiedImage, newImage);
}

// 创建图片对比弹窗
function createComparisonModal(original, uploaded, newImage) {
    // 移除已存在的对比弹窗
    if (comparisonModal && comparisonModal.parentNode) {
        comparisonModal.parentNode.removeChild(comparisonModal);
    }
    
    // 创建弹窗容器
    comparisonModal = document.createElement('div');
    comparisonModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(5px);
    `;
    
    // 创建顶部工具栏（移动到右侧）
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
        position: fixed;
        top: 50%;
        right: 5px;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 16px 12px;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(15px);
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        z-index: 1000000;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
        max-height: 85vh;
        overflow-y: auto;
        width: 80px;
        box-sizing: border-box;
    `;
    
    // 创建标题
    const title = document.createElement('div');
    title.textContent = '对比';
    title.style.cssText = `
        margin: 0;
        color: rgba(255, 255, 255, 0.95);
        font-family: 'Microsoft YaHei', Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        text-align: center;
        line-height: 1.2;
        letter-spacing: 1px;
        padding: 8px 4px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        width: 100%;
        box-sizing: border-box;
    `;
    
    // 创建对比模式切换按钮组
    const modeButtons = document.createElement('div');
    modeButtons.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
        width: 100%;
        padding: 8px 0;
    `;
    
    // 当前对比模式
    let currentMode = 'side-by-side';
    
    // 创建模式按钮
    const createModeButton = (mode, text, icon) => {
        const button = document.createElement('button');
        
        // 创建按钮内容容器
        const buttonContent = document.createElement('div');
        buttonContent.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
        `;
        
        const iconElement = document.createElement('div');
        iconElement.textContent = icon;
        iconElement.style.cssText = `
            font-size: 16px;
            line-height: 1;
        `;
        
        const textElement = document.createElement('div');
        textElement.textContent = text;
        textElement.style.cssText = `
            font-size: 9px;
            line-height: 1;
            font-weight: 500;
            white-space: nowrap;
        `;
        
        buttonContent.appendChild(iconElement);
        buttonContent.appendChild(textElement);
        button.appendChild(buttonContent);
        
        button.style.cssText = `
            padding: 8px 6px;
            background: ${mode === currentMode ? 'rgba(33, 150, 243, 0.9)' : 'rgba(255, 255, 255, 0.15)'};
            color: white;
            border: 1px solid ${mode === currentMode ? 'rgba(33, 150, 243, 0.6)' : 'rgba(255, 255, 255, 0.25)'};
            border-radius: 12px;
            cursor: pointer;
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            width: 100%;
            box-sizing: border-box;
            min-height: 50px;
        `;
        
        button.addEventListener('mouseenter', () => {
            if (mode !== currentMode) {
                button.style.background = 'rgba(255, 255, 255, 0.25)';
                button.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                button.style.transform = 'scale(1.02)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (mode !== currentMode) {
                button.style.background = 'rgba(255, 255, 255, 0.15)';
                button.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                button.style.transform = 'scale(1)';
            }
        });
        
        button.addEventListener('click', () => {
            currentMode = mode;
            updateModeButtons();
            switchComparisonMode(mode);
        });
        
        return button;
    };
    
    const sideBySideBtn = createModeButton('side-by-side', '并排对比', '📊');
    const sliderBtn = createModeButton('slider', '滑动对比', '🔄');
    const blinkBtn = createModeButton('blink', '闪烁对比', '⚡');
    
    const updateModeButtons = () => {
        [sideBySideBtn, sliderBtn, blinkBtn].forEach(btn => {
            const textContent = btn.querySelector('div:last-child').textContent;
            const mode = textContent.includes('并排') ? 'side-by-side' : 
                        textContent.includes('滑动') ? 'slider' : 'blink';
            
            if (mode === currentMode) {
                btn.style.background = 'rgba(33, 150, 243, 0.9)';
                btn.style.borderColor = 'rgba(33, 150, 243, 0.6)';
                btn.style.transform = 'scale(1)';
            } else {
                btn.style.background = 'rgba(255, 255, 255, 0.15)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                btn.style.transform = 'scale(1)';
            }
        });
    };
    
    // 创建尺寸信息显示区域
    const dimensionsDisplay = document.createElement('div');
    dimensionsDisplay.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 8px 6px;
        margin: 8px 0;
        color: rgba(255, 255, 255, 0.9);
        font-size: 9px;
        line-height: 1.2;
        text-align: center;
        width: 100%;
        box-sizing: border-box;
    `;
    
    // 获取并设置尺寸信息
    const updateToolbarDimensions = () => {
        const origDimensions = (original && original.width && original.height) 
            ? `${original.width}×${original.height}` 
            : '加载中';
        const upDimensions = (uploaded && uploaded.width && uploaded.height) 
            ? `${uploaded.width}×${uploaded.height}` 
            : '加载中';
        
        // 判断尺寸关系
        let sizeStatus = '';
        if (original && uploaded && original.width && original.height && uploaded.width && uploaded.height) {
            if (original.width === uploaded.width && original.height === uploaded.height) {
                sizeStatus = '🟢';
            } else if (uploaded.width * uploaded.height > original.width * original.height) {
                sizeStatus = '🔴';
            } else {
                sizeStatus = '🟡';
            }
        }
        
        dimensionsDisplay.innerHTML = `
            <div style="margin-bottom: 2px;">📎 ${origDimensions}</div>
            <div style="margin-bottom: 2px;">🔄 ${upDimensions}</div>
            <div style="font-size: 8px; opacity: 0.8;">${sizeStatus}</div>
        `;
    };
    
    updateToolbarDimensions();
    
    // 创建关闭按钮
    const closeButton = document.createElement('button');
    
    const closeContent = document.createElement('div');
    closeContent.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    `;
    
    const closeIcon = document.createElement('div');
    closeIcon.textContent = '✖️';
    closeIcon.style.cssText = `
        font-size: 14px;
        line-height: 1;
    `;
    
    const closeText = document.createElement('div');
    closeText.textContent = '关闭';
    closeText.style.cssText = `
        font-size: 9px;
        line-height: 1;
        font-weight: 500;
    `;
    
    closeContent.appendChild(closeIcon);
    closeContent.appendChild(closeText);
    closeButton.appendChild(closeContent);
    
    closeButton.style.cssText = `
        padding: 8px 6px;
        background: rgba(244, 67, 54, 0.85);
        color: white;
        border: 1px solid rgba(244, 67, 54, 0.6);
        border-radius: 12px;
        cursor: pointer;
        font-family: 'Microsoft YaHei', Arial, sans-serif;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
        width: 100%;
        box-sizing: border-box;
        margin-top: 8px;
        min-height: 45px;
    `;
    
    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.background = 'rgba(244, 67, 54, 1)';
        closeButton.style.borderColor = 'rgba(244, 67, 54, 0.8)';
        closeButton.style.transform = 'scale(1.05)';
        closeButton.style.boxShadow = '0 4px 12px rgba(244, 67, 54, 0.4)';
    });
    
    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.background = 'rgba(244, 67, 54, 0.85)';
        closeButton.style.borderColor = 'rgba(244, 67, 54, 0.6)';
        closeButton.style.transform = 'scale(1)';
        closeButton.style.boxShadow = 'none';
    });
    
    closeButton.addEventListener('click', () => {
        closeComparisonModal();
    });
    
    // 组装工具栏（纵向排列）
    toolbar.appendChild(title);
    toolbar.appendChild(modeButtons);
    toolbar.appendChild(dimensionsDisplay);
    toolbar.appendChild(closeButton);
    
    modeButtons.appendChild(sideBySideBtn);
    modeButtons.appendChild(sliderBtn);
    modeButtons.appendChild(blinkBtn);
    
    // 创建主要对比区域容器
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = `
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0;
        overflow: hidden;
        width: 100%;
        height: 100%;
    `;
    
    // 创建图片对比区域
    const comparisonArea = document.createElement('div');
    comparisonArea.id = 'comparison-area';
    comparisonArea.style.cssText = `
        position: relative;
        width: calc(100% - 95px);
        height: 100%;
        max-width: 1400px;
        max-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
        overflow: hidden;
        margin-right: 5px;
    `;
    
    // 验证参数并创建图片区域
    debugLog('创建对比弹窗参数验证', {
        original: original ? {
            src: original.src ? original.src.substring(0, 50) + '...' : '无src',
            width: original.width,
            height: original.height,
            name: original.name
        } : '无original',
        uploaded: uploaded ? {
            src: uploaded.src ? uploaded.src.substring(0, 50) + '...' : '无src',
            width: uploaded.width,
            height: uploaded.height,
            name: uploaded.name
        } : '无uploaded'
    });
    
    // 创建简化的图片元素
    const createSimpleImage = (src, alt) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 4px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        return img;
    };
    
    // 创建原图和对比图
    const originalImg = createSimpleImage(original ? original.src : '', '原图');
    const uploadedImg = createSimpleImage(uploaded ? uploaded.src : '', '对比图');
    
    // 模式切换函数
    const switchComparisonMode = (mode) => {
        // 清空对比区域
        comparisonArea.innerHTML = '';
        
        if (mode === 'side-by-side') {
            // 并排对比模式
            comparisonArea.style.cssText = `
                position: relative;
                width: calc(100% - 95px);
                height: 100%;
                max-width: 1400px;
                max-height: 100vh;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 8px;
                padding: 15px;
                margin-right: 5px;
            `;
            
            const leftContainer = document.createElement('div');
            leftContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 12px;
                height: 100%;
            `;
            
            const rightContainer = document.createElement('div');
            rightContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 12px;
                height: 100%;
            `;
            
            const leftLabel = document.createElement('div');
            leftLabel.style.cssText = `
                color: white;
                font-size: 14px;
                margin-bottom: 10px;
                font-weight: 500;
                text-align: center;
                line-height: 1.3;
            `;
            
            const rightLabel = document.createElement('div');
            rightLabel.style.cssText = `
                color: white;
                font-size: 14px;
                margin-bottom: 10px;
                font-weight: 500;
                text-align: center;
                line-height: 1.3;
            `;
            
            // 获取图片尺寸并设置标签内容
            const getImageDimensions = (img, imageInfo, defaultName) => {
                if (imageInfo && imageInfo.width && imageInfo.height) {
                    return `${defaultName}\n${imageInfo.width} × ${imageInfo.height}px`;
                } else if (img && img.complete && img.naturalWidth > 0) {
                    return `${defaultName}\n${img.naturalWidth} × ${img.naturalHeight}px`;
                } else {
                    return `${defaultName}\n加载中...`;
                }
            };
            
            // 设置标签内容，包含尺寸信息
            leftLabel.innerHTML = getImageDimensions(originalImg, original, '原图').replace('\n', '<br>');
            rightLabel.innerHTML = getImageDimensions(uploadedImg, uploaded, '对比图').replace('\n', '<br>');
            
            // 克隆图片并添加加载事件监听器以更新尺寸信息
            const originalImgClone = originalImg.cloneNode();
            const uploadedImgClone = uploadedImg.cloneNode();
            
            // 为原图添加加载完成事件
            originalImgClone.addEventListener('load', () => {
                if (originalImgClone.naturalWidth > 0 && originalImgClone.naturalHeight > 0) {
                    leftLabel.innerHTML = `原图<br>${originalImgClone.naturalWidth} × ${originalImgClone.naturalHeight}px`;
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            // 为对比图添加加载完成事件
            uploadedImgClone.addEventListener('load', () => {
                if (uploadedImgClone.naturalWidth > 0 && uploadedImgClone.naturalHeight > 0) {
                    rightLabel.innerHTML = `对比图<br>${uploadedImgClone.naturalWidth} × ${uploadedImgClone.naturalHeight}px`;
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            leftContainer.appendChild(leftLabel);
            leftContainer.appendChild(originalImgClone);
            rightContainer.appendChild(rightLabel);
            rightContainer.appendChild(uploadedImgClone);
            
            // 将右侧容器添加到左侧位置，左侧容器添加到右侧位置
            comparisonArea.appendChild(rightContainer);
            comparisonArea.appendChild(leftContainer);
            
        } else if (mode === 'slider') {
            // 滑动对比模式
            comparisonArea.style.cssText = `
                position: relative;
                width: calc(100% - 95px);
                height: 100%;
                max-width: 1400px;
                max-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 8px;
                overflow: hidden;
                margin-right: 5px;
            `;
            
            const sliderContainer = document.createElement('div');
            sliderContainer.style.cssText = `
                position: relative;
                width: 90%;
                height: 90%;
                overflow: hidden;
                border-radius: 8px;
            `;
            
            // 创建尺寸信息显示区域
            const dimensionsInfo = document.createElement('div');
            dimensionsInfo.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                z-index: 15;
                line-height: 1.3;
                backdrop-filter: blur(5px);
            `;
            
            // 获取并显示尺寸信息
            const updateDimensionsInfo = () => {
                const origDimensions = (original && original.width && original.height) 
                    ? `${original.width} × ${original.height}px` 
                    : '加载中...';
                const upDimensions = (uploaded && uploaded.width && uploaded.height) 
                    ? `${uploaded.width} × ${uploaded.height}px` 
                    : '加载中...';
                
                dimensionsInfo.innerHTML = `
                    <div>📎 原图: ${origDimensions}</div>
                    <div>🔄 对比: ${upDimensions}</div>
                `;
            };
            
            updateDimensionsInfo();
            
            const baseImg = originalImg.cloneNode();
            baseImg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: contain;
            `;
            
            // 为原图添加加载事件监听器
            baseImg.addEventListener('load', () => {
                if (baseImg.naturalWidth > 0 && baseImg.naturalHeight > 0) {
                    updateDimensionsInfo();
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            const overlayImg = uploadedImg.cloneNode();
            overlayImg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: contain;
                clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
            `;
            
            // 为对比图添加加载事件监听器
            overlayImg.addEventListener('load', () => {
                if (overlayImg.naturalWidth > 0 && overlayImg.naturalHeight > 0) {
                    updateDimensionsInfo();
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            const slider = document.createElement('div');
            slider.style.cssText = `
                position: absolute;
                top: 0;
                left: 50%;
                width: 4px;
                height: 100%;
                background: #2196F3;
                cursor: ew-resize;
                z-index: 10;
                transform: translateX(-50%);
                box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
            `;
            
            const sliderHandle = document.createElement('div');
            sliderHandle.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                width: 20px;
                height: 20px;
                background: #2196F3;
                border: 2px solid white;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                cursor: ew-resize;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            `;
            
            slider.appendChild(sliderHandle);
            
            let isDragging = false;
            
            const updateSlider = (x) => {
                const rect = sliderContainer.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
                slider.style.left = percentage + '%';
                overlayImg.style.clipPath = `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`;
            };
            
            slider.addEventListener('mousedown', (e) => {
                isDragging = true;
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updateSlider(e.clientX);
                }
            });
            
            document.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            sliderContainer.appendChild(baseImg);
            sliderContainer.appendChild(overlayImg);
            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(dimensionsInfo);
            comparisonArea.appendChild(sliderContainer);
            
        } else if (mode === 'blink') {
            // 闪烁对比模式
            comparisonArea.style.cssText = `
                position: relative;
                width: calc(100% - 95px);
                height: 100%;
                max-width: 1400px;
                max-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 8px;
                margin-right: 5px;
            `;
            
            const blinkContainer = document.createElement('div');
            blinkContainer.style.cssText = `
                position: relative;
                width: 90%;
                height: 90%;
                display: flex;
                justify-content: center;
                align-items: center;
            `;
            
            // 创建尺寸信息显示区域
            const dimensionsInfo = document.createElement('div');
            dimensionsInfo.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                z-index: 15;
                line-height: 1.3;
                backdrop-filter: blur(5px);
            `;
            
            // 获取并显示尺寸信息
            const updateDimensionsInfo = () => {
                const origDimensions = (original && original.width && original.height) 
                    ? `${original.width} × ${original.height}px` 
                    : '加载中...';
                const upDimensions = (uploaded && uploaded.width && uploaded.height) 
                    ? `${uploaded.width} × ${uploaded.height}px` 
                    : '加载中...';
                
                dimensionsInfo.innerHTML = `
                    <div>📎 原图: ${origDimensions}</div>
                    <div>🔄 对比: ${upDimensions}</div>
                `;
            };
            
            updateDimensionsInfo();
            
            const img1 = originalImg.cloneNode();
            const img2 = uploadedImg.cloneNode();
            
            img1.style.cssText = `
                position: absolute;
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                transition: opacity 0.1s ease;
            `;
            
            img2.style.cssText = `
                position: absolute;
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                opacity: 0;
                transition: opacity 0.1s ease;
            `;
            
            // 为图片添加加载事件监听器
            img1.addEventListener('load', () => {
                if (img1.naturalWidth > 0 && img1.naturalHeight > 0) {
                    updateDimensionsInfo();
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            img2.addEventListener('load', () => {
                if (img2.naturalWidth > 0 && img2.naturalHeight > 0) {
                    updateDimensionsInfo();
                    updateToolbarDimensions(); // 更新工具栏尺寸信息
                }
            });
            
            let isShowingSecond = false;
            const blinkInterval = setInterval(() => {
                if (isShowingSecond) {
                    img1.style.opacity = '1';
                    img2.style.opacity = '0';
                } else {
                    img1.style.opacity = '0';
                    img2.style.opacity = '1';
                }
                isShowingSecond = !isShowingSecond;
            }, 800);
            
            // 保存interval以便清理
            comparisonArea.blinkInterval = blinkInterval;
            
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: absolute;
                top: 20px;
                left: 20px;
                color: white;
                background: rgba(0, 0, 0, 0.7);
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                z-index: 10;
            `;
            indicator.textContent = '自动切换中...';
            
            blinkContainer.appendChild(img1);
            blinkContainer.appendChild(img2);
            blinkContainer.appendChild(indicator);
            blinkContainer.appendChild(dimensionsInfo);
            comparisonArea.appendChild(blinkContainer);
        }
    };
    
    // 初始化为并排对比模式
    switchComparisonMode('side-by-side');
    
    // 创建底部区域容器
    const footerArea = document.createElement('div');
    footerArea.style.cssText = `
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 15px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 8px;
        padding: 20px;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    `;
    
    // 创建操作提示
    const hintText = document.createElement('div');
    hintText.innerHTML = `
        <span style="color: #666; font-size: 13px; display: flex; align-items: center; gap: 8px;">
            <span style="background: #e3f2fd; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #1976d2;">ESC</span>
            快速关闭
            <span style="color: #ddd; margin: 0 5px;">|</span>
            <span style="background: #f3e5f5; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #7b1fa2;">点击背景</span>
            关闭对话框
        </span>
    `;
    
    // 创建美化的关闭按钮
    const footerCloseButton = document.createElement('button');
    footerCloseButton.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">✖️</span>
            关闭对比
        </span>
    `;
    footerCloseButton.style.cssText = `
        padding: 12px 25px;
        background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
        color: white;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        font-size: 14px;
        font-family: Arial, sans-serif;
        font-weight: 500;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
        position: relative;
        overflow: hidden;
    `;
    
    // 按钮悬停效果
    footerCloseButton.addEventListener('mouseenter', () => {
        footerCloseButton.style.transform = 'translateY(-2px)';
        footerCloseButton.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.4)';
        footerCloseButton.style.background = 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)';
    });
    
    footerCloseButton.addEventListener('mouseleave', () => {
        footerCloseButton.style.transform = 'translateY(0)';
        footerCloseButton.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3)';
        footerCloseButton.style.background = 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)';
    });
    
    // 按钮点击效果
    footerCloseButton.addEventListener('mousedown', () => {
        footerCloseButton.style.transform = 'translateY(1px) scale(0.98)';
    });
    
    footerCloseButton.addEventListener('mouseup', () => {
        footerCloseButton.style.transform = 'translateY(-2px) scale(1)';
    });
    
    footerCloseButton.addEventListener('click', () => {
        closeComparisonModal();
    });
    
    // 添加模式切换按钮事件监听器
    // 按钮已在上面创建，直接获取引用
    
    const updateActiveButton = (activeBtn) => {
        [sideBySideBtn, sliderBtn, blinkBtn].forEach(btn => {
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.style.color = 'rgba(255, 255, 255, 0.8)';
        });
        activeBtn.style.background = '#2196F3';
        activeBtn.style.color = 'white';
    };
    
    sideBySideBtn.addEventListener('click', () => {
        // 清理之前的interval
        if (comparisonArea.blinkInterval) {
            clearInterval(comparisonArea.blinkInterval);
            comparisonArea.blinkInterval = null;
        }
        switchComparisonMode('side-by-side');
        updateActiveButton(sideBySideBtn);
    });
    
    sliderBtn.addEventListener('click', () => {
        // 清理之前的interval
        if (comparisonArea.blinkInterval) {
            clearInterval(comparisonArea.blinkInterval);
            comparisonArea.blinkInterval = null;
        }
        switchComparisonMode('slider');
        updateActiveButton(sliderBtn);
    });
    
    blinkBtn.addEventListener('click', () => {
        // 清理之前的interval
        if (comparisonArea.blinkInterval) {
            clearInterval(comparisonArea.blinkInterval);
            comparisonArea.blinkInterval = null;
        }
        switchComparisonMode('blink');
        updateActiveButton(blinkBtn);
    });
    
    // 设置初始活动按钮
    updateActiveButton(sideBySideBtn);
    
    // 组装弹窗（不包含工具栏和底部提示）
    mainContainer.appendChild(comparisonArea);
    comparisonModal.appendChild(mainContainer);
    
    // 将工具栏添加到页面（独立定位）
    document.body.appendChild(toolbar);
    
    // 点击背景关闭
    comparisonModal.addEventListener('click', (e) => {
        if (e.target === comparisonModal) {
            closeComparisonModal();
        }
    });
    
    // 添加ESC键关闭功能
    const handleEscKey = (e) => {
        if (e.key === 'Escape' && comparisonModal && comparisonModal.parentNode) {
            closeComparisonModal();
        }
    };
    // 保存到全局，方便清理
    window.currentHandleEscKey = handleEscKey;
    document.addEventListener('keydown', handleEscKey);
    
    // 添加到页面
    document.body.appendChild(comparisonModal);
    
    // 更新对比页面状态
    isComparisonModalOpen = true;
    debugLog('对比弹窗已打开，状态已更新');
    
    showNotification('图片对比界面已打开', 2000);
}

// 创建单个图片显示区域
function createImageArea(title, src, imageInfo) {
    debugLog('创建图片显示区域', {
        title: title,
        src: src ? src.substring(0, 50) + '...' : '无src',
        imageInfo: imageInfo ? {
            width: imageInfo.width,
            height: imageInfo.height,
            name: imageInfo.name
        } : '无imageInfo'
    });
    
    const area = document.createElement('div');
    area.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: transparent;
        padding: 10px;
    `;
    
    const titleElement = document.createElement('div');
    titleElement.textContent = title;
    titleElement.style.cssText = `
        color: white;
        font-size: 14px;
        margin-bottom: 10px;
        font-weight: 500;
        text-align: center;
    `;
    
    const img = document.createElement('img');
    
    // 添加错误处理
    img.onerror = function() {
        debugLog('图片加载失败', {
            src: src ? src.substring(0, 50) + '...' : '无src',
            title: title
        });
        
        // 显示错误信息
        const errorInfo = document.createElement('div');
        errorInfo.style.cssText = `
            color: #d32f2f;
            font-weight: bold;
            padding: 20px;
            background: #ffebee;
            border: 1px solid #ffcdd2;
            border-radius: 4px;
            margin: 10px 0;
        `;
        errorInfo.innerHTML = '❌ 图片加载失败<br/>请检查图片链接是否有效';
        
        // 替换图片元素
        img.style.display = 'none';
        area.appendChild(errorInfo);
    };
    
    // 设置图片源
    if (src) {
        img.src = src;
    } else {
        debugLog('图片源为空', { title: title });
        img.style.display = 'none';
        const noImageInfo = document.createElement('div');
        noImageInfo.style.cssText = `
            color: #f57c00;
            font-weight: bold;
            padding: 20px;
            background: #fff3e0;
            border: 1px solid #ffcc02;
            border-radius: 4px;
            margin: 10px 0;
        `;
        noImageInfo.innerHTML = '⚠️ 无图片源<br/>无法显示图片';
        area.appendChild(noImageInfo);
    }
    
    img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 4px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    
    const info = document.createElement('div');
    info.style.cssText = `
        margin-top: 10px;
        font-size: 12px;
        color: #666;
        font-family: Arial, sans-serif;
    `;
    
    // 显示图片信息（仅保留文件名和尺寸）
    let dimensions = '未知';
    let fileName = '未知';
    
    // 安全地获取图片信息
    if (imageInfo) {
        if (imageInfo.width && imageInfo.height) {
            dimensions = `${imageInfo.width} × ${imageInfo.height}px`;
        }
        if (imageInfo.name) {
            fileName = imageInfo.name;
        }
    }
    
    // 对于上传的图片，需要等待图片加载完成后获取真实尺寸
    if (src && src.startsWith('data:')) {
        // 这是base64图片（上传的图片），需要等待加载
        img.onload = () => {
            const realDimensions = `${img.naturalWidth} × ${img.naturalHeight}px`;
            const displayFileName = fileName !== '未知' ? fileName : '上传图片';
            
            info.innerHTML = `
                <div style="font-weight: bold; color: #333; margin-bottom: 8px;">📐 尺寸: ${realDimensions}</div>
                <div style="margin-bottom: 4px;">🏷️ 文件名: ${displayFileName}</div>
            `;
        };
        
        // 初始显示
        const displayFileName = fileName !== '未知' ? fileName : '上传图片';
        info.innerHTML = `
            <div style="font-weight: bold; color: #333; margin-bottom: 8px;">📐 尺寸: 加载中...</div>
            <div style="margin-bottom: 4px;">🏷️ 文件名: ${displayFileName}</div>
        `;
    } else {
        // 原图或其他图片，使用已有的尺寸信息
        const displayFileName = fileName !== '未知' ? fileName : '原图';
        
        info.innerHTML = `
            <div style="font-weight: bold; color: #333; margin-bottom: 8px;">📐 尺寸: ${dimensions}</div>
            <div style="margin-bottom: 4px;">🏷️ 文件名: ${displayFileName}</div>
        `;
    }
    
    area.appendChild(titleElement);
    area.appendChild(img);
    area.appendChild(info);
    
    return area;
}

// 创建对比信息区域
function createComparisonInfo(original, uploaded) {
    const infoArea = document.createElement('div');
    infoArea.style.cssText = `
        background: #f0f7ff;
        border: 1px solid #b3d9ff;
        border-radius: 6px;
        padding: 15px;
        margin-top: 15px;
    `;
    
    const title = document.createElement('h4');
    title.textContent = '对比分析';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #1976d2;
        font-family: Arial, sans-serif;
    `;
    
    const details = document.createElement('div');
    details.style.cssText = `
        font-size: 13px;
        color: #555;
        line-height: 1.6;
        font-family: Arial, sans-serif;
    `;
    
    // 分析对比结果
    let comparison = '';
    
    if (original.width && original.height && uploaded.src) {
        // 通过创建临时图片获取上传图片尺寸
        const tempImg = new Image();
        tempImg.onload = () => {
            const widthDiff = tempImg.width - original.width;
            const heightDiff = tempImg.height - original.height;
            const widthRatio = ((tempImg.width / original.width) * 100).toFixed(1);
            const heightRatio = ((tempImg.height / original.height) * 100).toFixed(1);
            const aspectRatioOrig = (original.width / original.height).toFixed(3);
            const aspectRatioUploaded = (tempImg.width / tempImg.height).toFixed(3);
            
            // Calculate compression efficiency
            const origPixels = original.width * original.height;
            const uploadedPixels = tempImg.width * tempImg.height;
            const pixelRatio = ((uploadedPixels / origPixels) * 100).toFixed(1);
            
            const sizeStatus = widthDiff === 0 && heightDiff === 0 ? 
                '🟢 尺寸完全一致' : 
                widthDiff > 0 || heightDiff > 0 ? '🔴 大于原图' : '🟡 小于原图';
            
            comparison = `
                <div style="background: #f8f9ff; padding: 15px; border-radius: 6px;">
                    <h5 style="margin: 0 0 12px 0; color: #1976d2;">📊 尺寸对比分析</h5>
                    <div style="margin-bottom: 8px;"><strong>原图:</strong> ${original.width} × ${original.height}px</div>
                    <div style="margin-bottom: 8px;"><strong>上传图:</strong> ${tempImg.width} × ${tempImg.height}px</div>
                    <div style="margin-bottom: 8px;"><strong>尺寸差异:</strong> ${widthDiff > 0 ? '+' : ''}${widthDiff}px × ${heightDiff > 0 ? '+' : ''}${heightDiff}px</div>
                    <div style="margin-bottom: 12px;"><strong>缩放比例:</strong> ${widthRatio}% × ${heightRatio}%</div>
                    
                    <div style="background: ${widthDiff === 0 && heightDiff === 0 ? '#e8f5e8' : '#fff3e0'}; padding: 12px; border-radius: 6px; border-left: 4px solid ${widthDiff === 0 && heightDiff === 0 ? '#4caf50' : '#ff9800'};">
                        <div style="font-weight: bold; margin-bottom: 5px;">${sizeStatus}</div>
                        ${widthDiff === 0 && heightDiff === 0 ? 
                            '<div style="color: #2e7d32;">完美匹配！图片尺寸完全一致。</div>' :
                            `<div style="color: #f57c00;">检测到尺寸差异。建议将图片${widthDiff > 0 || heightDiff > 0 ? '缩小' : '放大'}以匹配原图。</div>`
                        }
                    </div>
                </div>
            `;
            
            details.innerHTML = comparison;
        };
        tempImg.src = uploaded.src;
    } else {
        details.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <div style="font-size: 18px; margin-bottom: 10px;">⏳</div>
                <div>正在分析图片信息...</div>
            </div>
        `;
    }
    
    infoArea.appendChild(title);
    infoArea.appendChild(details);
    
    return infoArea;
}

// ============== 调试功能 ==============

// 调试日志函数
function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        time: timestamp,
        message: message,
        data: data
    };
    
    debugLogs.push(logEntry);
    
    // 限制日志数量
    if (debugLogs.length > 100) {
        debugLogs.shift();
    }
    
    // 输出到控制台
    console.log(`[调试 ${timestamp}] ${message}`, data || '');
    
    // 更新调试面板
    if (debugPanel && debugMode) {
        updateDebugPanel();
    }
}

// 已移除：返修模式专用日志函数
// function revisionLog() { ... }

// 打印返修模式图片状态的专用函数
// 已移除：返修模式图片状态打印函数
// function printRevisionModeStatus() { ... }

// 初始化调试面板
function initializeDebugPanel() {
    debugLog('初始化调试面板');
    
    // 创建调试面板
    debugPanel = document.createElement('div');
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        width: 350px;
        height: 200px;
        background: rgba(0, 0, 0, 0.9);
        color: #00ff00;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        z-index: 1000000;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 10px;
        overflow-y: auto;
        display: ${debugMode ? 'block' : 'none'};
    `;
    
    // 创建标题栏
    const header = document.createElement('div');
    header.style.cssText = `
        color: #ffff00;
        font-weight: bold;
        margin-bottom: 8px;
        border-bottom: 1px solid #333;
        padding-bottom: 4px;
    `;
    header.textContent = '🔍 图片对比调试面板 [Z键切换]';
    
    // 创建日志区域
    const logArea = document.createElement('div');
    logArea.id = 'debug-log-area';
    logArea.style.cssText = `
        height: calc(100% - 30px);
        overflow-y: auto;
        line-height: 1.3;
    `;
    
    debugPanel.appendChild(header);
    debugPanel.appendChild(logArea);
    document.body.appendChild(debugPanel);
    
    // 添加状态信息
    debugLog('页面URL', window.location.href);
    debugLog('页面图片数量', document.querySelectorAll('img').length);
    debugLog('文件输入数量', document.querySelectorAll('input[type="file"]').length);
}

// 更新调试面板
function updateDebugPanel() {
    if (!debugPanel) return;
    
    const logArea = debugPanel.querySelector('#debug-log-area');
    if (!logArea) return;
    
    // 显示最新的20条日志
    const recentLogs = debugLogs.slice(-20);
    logArea.innerHTML = recentLogs.map(log => {
        const dataStr = log.data ? ` | ${JSON.stringify(log.data).substring(0, 50)}...` : '';
        return `<div style="margin-bottom: 2px;">
            <span style="color: #888;">[${log.time}]</span> 
            <span style="color: #00ff00;">${log.message}</span>
            <span style="color: #888; font-size: 10px;">${dataStr}</span>
        </div>`;
    }).join('');
    
    // 自动滚动到底部
    logArea.scrollTop = logArea.scrollHeight;
    
    // 更新调试信息
    updateDebugInfo();
}

// 更新调试信息显示
function updateDebugInfo() {
    if (!debugPanel || !debugMode) return;
    
    let infoArea = debugPanel.querySelector('#debug-info-area');
    if (!infoArea) {
        infoArea = document.createElement('div');
        infoArea.id = 'debug-info-area';
        infoArea.style.cssText = `
            background: rgba(20, 20, 20, 0.9);
            border: 1px solid #444;
            border-radius: 4px;
            padding: 8px;
            margin: 8px 0;
            font-size: 10px;
            line-height: 1.4;
        `;
        
        // 插入到日志区域之前
        const logArea = debugPanel.querySelector('#debug-log-area');
        debugPanel.insertBefore(infoArea, logArea);
    }
    
    // 构建调试信息
    let infoHtml = '<div style="color: #ffff00; font-weight: bold; margin-bottom: 4px;">📊 图片状态信息</div>';
    
    // 原图信息
    if (originalImage) {
        infoHtml += `<div style="color: #4ade80;">✓ 原图: ${originalImage.src ? originalImage.src.substring(0, 50) + '...' : '已检测'}</div>`;
    } else {
        infoHtml += '<div style="color: #f87171;">✗ 原图: 未检测到</div>';
    }
    
    // 用户上传图片信息
    if (uploadedImage) {
        infoHtml += `<div style="color: #4ade80;">✓ 用户上传图: ${uploadedImage.name || '已上传'}</div>`;
    } else {
        infoHtml += '<div style="color: #f87171;">✗ 用户上传图: 无</div>';
    }
    
    // 已移除：返修模式专用信息区域
    // if (isRevisionMode) { ... }
    
    // 对比状态
    const canCompare = originalImage && uploadedImage;
    if (canCompare) {
        infoHtml += '<div style="color: #4ade80;">✓ 对比状态: 可进行对比</div>';
    } else {
        infoHtml += '<div style="color: #f87171;">✗ 对比状态: 条件不满足</div>';
    }
    
    infoArea.innerHTML = infoHtml;
}

// 切换调试模式
function toggleDebugMode() {
    debugMode = !debugMode;
    
    if (debugMode) {
        if (!debugPanel) {
            initializeDebugPanel();
        } else {
            debugPanel.style.display = 'block';
        }
        debugLog('调试模式已开启');
        showNotification('调试模式已开启 (Z键切换)', 2000);
    } else {
        if (debugPanel) {
            debugPanel.style.display = 'none';
        }
        console.log('调试模式已关闭');
        showNotification('调试模式已关闭 (Z键切换)', 2000);
    }
}

// 已移除：模式切换函数
// function toggleAnnotationMode() { ... }

// 已移除：模式状态显示器创建函数
// function createModeStatusIndicator() { ... }

// 已移除：拖拽功能函数
// function addDragListeners() { ... }

// 已移除：拖拽开始函数
// function startDrag() { ... }

// 已移除：拖拽过程函数
// function drag() { ... }

// 已移除：停止拖拽函数
// function stopDrag() { ... }

// 已移除：重置指示器位置函数
// function resetIndicatorPosition() { ... }

// 已移除：更新模式状态显示器函数
// function updateModeStatusIndicator() { ... }

// 已移除：模式状态显示函数
// function displayCurrentMode() { ... }

// 增强的图片上传监听和对比功能（带调试）
function initializeUploadMonitoring() {
    debugLog('开始初始化图片上传监听功能');
    
    try {
        // 监听文件输入元素的变化
        observeFileInputs();
        debugLog('文件输入监听已启动');
        
        // 监听网络请求中的图片上传
        observeNetworkUploads();
        debugLog('网络上传监听已启动');
        
        // 记录当前页面的原图
        recordOriginalImages();
        debugLog('原图记录完成');
        
        // 添加额外的上传检测方法
        addAlternativeUploadDetection();
        debugLog('替代上传检测已启动');
        
    } catch (error) {
        debugLog('初始化上传监听时发生错误', error.message);
        console.error('初始化上传监听失败:', error);
    }
}

// 增强的文件输入监听（带调试）
function observeFileInputs() {
    debugLog('开始监听文件输入元素');
    
    // 查找所有现有的文件输入元素
    const fileInputs = document.querySelectorAll('input[type="file"]');
    debugLog('发现文件输入元素', fileInputs.length);
    
    fileInputs.forEach((input, index) => {
        debugLog(`为文件输入元素 #${index} 添加监听器`, {
            id: input.id,
            name: input.name,
            accept: input.accept
        });
        addUploadListener(input);
    });
    
    // 使用 MutationObserver 监听动态添加的文件输入元素
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查新添加的元素是否是文件输入
                    if (node.tagName === 'INPUT' && node.type === 'file') {
                        debugLog('发现新的文件输入元素', node);
                        addUploadListener(node);
                    }
                    // 检查新添加的元素内部是否有文件输入
                    const inputs = node.querySelectorAll && node.querySelectorAll('input[type="file"]');
                    if (inputs && inputs.length > 0) {
                        debugLog('在新元素中发现文件输入', inputs.length);
                        inputs.forEach(input => addUploadListener(input));
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    debugLog('文件输入动态监听已启动');
}

// 增强的上传监听器（带调试）
function addUploadListener(input) {
    if (input._uploadListenerAdded) {
        debugLog('跳过重复添加监听器', input);
        return;
    }
    input._uploadListenerAdded = true;
    
    debugLog('为输入元素添加监听器', {
        tagName: input.tagName,
        type: input.type,
        id: input.id || '无ID',
        className: input.className || '无class',
        accept: input.accept || '无accept属性',
        multiple: input.multiple,
        name: input.name || '无name'
    });
    
    // 监听多个事件来捕获文件变化
    const events = ['change', 'input', 'blur'];
    
    events.forEach(eventType => {
        input.addEventListener(eventType, (event) => {
            debugLog(`检测到文件输入${eventType}事件`, {
                eventType: event.type,
                target: event.target,
                timeStamp: event.timeStamp
            });
            
            // 多种方式获取文件信息
            const files = event.target.files;
            const value = event.target.value;
            
            debugLog(`${eventType}事件的文件信息`, {
                'files对象': files,
                'files.length': files ? files.length : '无files属性',
                'input.value': value,
                'input.files': input.files,
                'input.files.length': input.files ? input.files.length : '无files属性'
            });
            
            // 如果files为空但value有值，尝试延迟获取
            if ((!files || files.length === 0) && value) {
                debugLog('files为空但value有值，尝试延迟获取', value);
                
                // 延迟多次尝试获取文件
                const delays = [0, 100, 300, 500, 1000];
                delays.forEach(delay => {
                    setTimeout(() => {
                        const retryFiles = input.files;
                        debugLog(`延迟${delay}ms后重新检查files`, {
                            'files.length': retryFiles ? retryFiles.length : '无files',
                            'input.value': input.value
                        });
                        
                        if (retryFiles && retryFiles.length > 0) {
                            debugLog(`延迟${delay}ms后成功获取到文件`);
                            handleFilesFound(retryFiles, input);
                        }
                    }, delay);
                });
            } else if (files && files.length > 0) {
                debugLog('直接获取到文件');
                handleFilesFound(files, input);
            } else {
                debugLog(`${eventType}事件：无文件数据`, {
                    hasFiles: !!files,
                    filesLength: files ? files.length : 'N/A',
                    hasValue: !!value,
                    valueContent: value ? value.substring(0, 100) : 'N/A'
                });
            }
        });
    });
    
    // 还可以监听其他事件
    input.addEventListener('focus', () => {
        debugLog('文件输入获得焦点');
    });
    
    input.addEventListener('click', () => {
        debugLog('文件输入被点击');
        
        // 在点击后也尝试获取现有文件
        setTimeout(() => {
            const currentFiles = input.files;
            debugLog('点击后检查现有文件', {
                'files.length': currentFiles ? currentFiles.length : '无files'
            });
        }, 100);
    });
    
    // 监听鼠标和键盘事件
    input.addEventListener('mouseup', () => {
        setTimeout(() => {
            debugLog('鼠标释放后检查文件', {
                'files.length': input.files ? input.files.length : '无files',
                'value': input.value
            });
        }, 50);
    });
    
    // 定期检查这个input是否有文件
    const checkInterval = setInterval(() => {
        if (input.files && input.files.length > 0) {
            debugLog('定期检查发现文件', {
                'files.length': input.files.length,
                timestamp: Date.now()
            });
            handleFilesFound(input.files, input);
            clearInterval(checkInterval);
        }
    }, 1000);
    
    // 5秒后停止定期检查
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 5000);
}

// 处理找到的文件
function handleFilesFound(files, input) {
    debugLog('开始处理找到的文件', {
        fileCount: files.length,
        files: Array.from(files).map(f => ({
            name: f.name,
            size: f.size,
            type: f.type,
            lastModified: f.lastModified
        }))
    });
    
    if (files && files.length > 0) {
        const file = files[0];
        debugLog('处理第一个文件', {
            name: file.name,
            type: file.type,
            size: file.size,
            isImage: file.type.startsWith('image/')
        });
        
        if (file.type.startsWith('image/')) {
            debugLog('确认为图片文件，开始处理上传');
            handleImageUpload(file, input);
        } else {
            debugLog('非图片文件，跳过处理', file.type);
        }
    } else {
        debugLog('files数组为空或未定义');
    }
}

// 添加替代的上传检测方法
function addAlternativeUploadDetection() {
    debugLog('启动替代上传检测方法');
    
    // 方法1: 监听所有表单提交
    document.addEventListener('submit', (event) => {
        debugLog('检测到表单提交', event.target);
        const formData = new FormData(event.target);
        let hasImages = false;
        
        for (let [key, value] of formData.entries()) {
            if (value instanceof File && value.type.startsWith('image/')) {
                debugLog('表单中发现图片文件', { key, file: value.name });
                hasImages = true;
            }
        }
        
        if (hasImages) {
            debugLog('表单包含图片，延迟检查新图片');
            setTimeout(() => checkForNewImages(), 1000);
        }
    });
    
    // 方法2: 监听拖拽上传
    document.addEventListener('drop', (event) => {
        debugLog('检测到文件拖拽', event);
        const files = event.dataTransfer ? event.dataTransfer.files : null;
        if (files && files.length > 0) {
            for (let file of files) {
                if (file.type.startsWith('image/')) {
                    debugLog('拖拽文件为图片', file.name);
                    handleImageUpload(file, null);
                    break;
                }
            }
        }
    });
    
    // 方法3: 定时检查页面图片变化
    setInterval(() => {
        const currentImageCount = document.querySelectorAll('img').length;
        if (currentImageCount !== (window._lastImageCount || 0)) {
            debugLog('图片数量发生变化', {
                before: window._lastImageCount || 0,
                after: currentImageCount
            });
            window._lastImageCount = currentImageCount;
            checkForNewImages();
        }
    }, 2000);
    
    // 方法4: 监听常见的第三方上传组件
    const commonUploadSelectors = [
        '.upload-area', '.upload-zone', '.file-upload', '.upload-container',
        '[class*="upload"]', '[class*="file"]', '[id*="upload"]', '[id*="file"]',
        'input[accept*="image"]', 'button[onclick*="upload"]', 'button[onclick*="file"]'
    ];
    
    commonUploadSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            debugLog(`发现可能的上传相关元素: ${selector}`, elements.length);
            elements.forEach((element, index) => {
                debugLog(`上传元素 #${index}`, {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id,
                    onclick: element.onclick ? element.onclick.toString().substring(0, 100) : '无'
                });
                
                // 为这些元素添加监听器
                element.addEventListener('click', () => {
                    debugLog(`上传相关元素被点击: ${selector}`);
                    setTimeout(() => {
                        // 检查是否有新的文件输入出现
                        const newInputs = document.querySelectorAll('input[type="file"]');
                        debugLog('点击后检查文件输入数量', newInputs.length);
                        newInputs.forEach(input => {
                            if (!input._uploadListenerAdded) {
                                addUploadListener(input);
                            }
                        });
                    }, 500);
                });
            });
        }
    });
    
    // 方法5: 监听DOM变化，特别关注新增的隐藏文件输入
    const uploadObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查隐藏的文件输入
                    const hiddenInputs = node.querySelectorAll ? node.querySelectorAll('input[type="file"][style*="display:none"], input[type="file"][style*="visibility:hidden"]') : [];
                    if (hiddenInputs.length > 0) {
                        debugLog('发现隐藏的文件输入', hiddenInputs.length);
                        hiddenInputs.forEach(input => addUploadListener(input));
                    }
                }
            });
        });
    });
    
    uploadObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });
    
    // 方法6: 检测可能的上传按钮文本
    const uploadButtonTexts = ['上传', '选择文件', '选择图片', 'upload', 'choose', 'select', '浏览', 'browse'];
    uploadButtonTexts.forEach(text => {
        const buttons = Array.from(document.querySelectorAll('button, a, div, span')).filter(el => 
            el.textContent.toLowerCase().includes(text.toLowerCase())
        );
        if (buttons.length > 0) {
            debugLog(`发现可能的上传按钮 (${text})`, buttons.length);
            buttons.forEach(button => {
                button.addEventListener('click', () => {
                    debugLog(`可能的上传按钮被点击: ${text}`);
                    // 延迟检查文件输入变化
                    setTimeout(() => {
                        checkForFileInputChanges();
                    }, 300);
                });
            });
        }
    });
    
    // 方法7: 拦截XMLHttpRequest上传
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(data) {
        debugLog('拦截到XMLHttpRequest', {
            url: this.responseURL || 'unknown',
            data: data ? (data.toString().substring(0, 100) + '...') : 'no data'
        });
        
        if (data instanceof FormData) {
            debugLog('检测到FormData上传');
            // 检查FormData中是否有文件
            try {
                for (let [key, value] of data.entries()) {
                    if (value instanceof File) {
                        debugLog('XMLHttpRequest中发现文件', {
                            key: key,
                            fileName: value.name,
                            fileType: value.type,
                            fileSize: value.size
                        });
                        
                        if (value.type.startsWith('image/')) {
                            debugLog('XMLHttpRequest上传的是图片文件');
                            handleImageUpload(value, null);
                        }
                    }
                }
            } catch (error) {
                debugLog('解析FormData时出错', error.message);
            }
        }
        
        return originalXHRSend.call(this, data);
    };
}

// 检查文件输入变化
function checkForFileInputChanges() {
    debugLog('检查文件输入变化');
    
    const allInputs = document.querySelectorAll('input[type="file"]');
    debugLog('当前文件输入总数', allInputs.length);
    
    allInputs.forEach((input, index) => {
        debugLog(`文件输入 #${index} 状态`, {
            hasFiles: input.files && input.files.length > 0,
            filesCount: input.files ? input.files.length : 0,
            value: input.value,
            id: input.id,
            name: input.name,
            style: input.style.cssText
        });
        
        if (input.files && input.files.length > 0) {
            debugLog(`文件输入 #${index} 有文件，开始处理`);
            handleFilesFound(input.files, input);
        }
    });
}

// 添加图片加载监听器
function addImageLoadListeners() {
    debugLog('添加图片加载监听器');
    
    // 为所有现有图片添加加载监听器
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
        debugLog(`为图片 #${index} 添加加载监听器`, {
            src: img.src ? img.src.substring(0, 50) + '...' : '无src',
            complete: img.complete
        });
        
        if (!img.complete) {
            img.addEventListener('load', () => {
                debugLog(`图片 #${index} 加载完成，检查是否需要更新原图`, {
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight
                });
                
                // 如果还没有原图，或者原图未锁定且这个图片更大，考虑更新原图
                if (!originalImage || (!originalImageLocked && 
                    img.naturalWidth * img.naturalHeight > 
                    originalImage.width * originalImage.height
                )) {
                    debugLog('发现更合适的原图，更新原图记录');
                    recordImageAsOriginal(img);
                }
            });
            
            img.addEventListener('error', () => {
                debugLog(`图片 #${index} 加载失败`);
            });
        } else if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            // 图片已经加载完成，检查是否需要更新原图
            if (!originalImage || (!originalImageLocked && 
                img.naturalWidth * img.naturalHeight > 
                (originalImage.width || 0) * (originalImage.height || 0)
            )) {
                debugLog(`发现已加载的更合适图片 #${index}，更新原图记录`);
                recordImageAsOriginal(img);
            }
        }
    });
    
    // 监听新添加的图片
    const imageObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'IMG') {
                        debugLog('检测到新添加的图片元素');
                        addSingleImageLoadListener(node);
                    }
                    
                    const newImages = node.querySelectorAll && node.querySelectorAll('img');
                    if (newImages && newImages.length > 0) {
                        debugLog('在新元素中发现图片', newImages.length);
                        newImages.forEach(img => addSingleImageLoadListener(img));
                    }
                }
            });
        });
    });
    
    imageObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 为单个图片添加加载监听器
function addSingleImageLoadListener(img) {
    debugLog('为新图片添加加载监听器', {
        src: img.src ? img.src.substring(0, 50) + '...' : '无src',
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
    });
    
    if (!img.complete && img.src) {
        img.addEventListener('load', () => {
            debugLog('新图片加载完成', {
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight
            });
            
            // 检查是否需要更新原图
            if (!originalImage || (!originalImageLocked && 
                img.naturalWidth * img.naturalHeight > 
                originalImage.width * originalImage.height
            )) {
                debugLog('新图片更合适作为原图，更新记录');
                recordImageAsOriginal(img);
            }
        });
        
        img.addEventListener('error', () => {
            debugLog('新图片加载失败');
        });
    } else if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        // 图片已经加载完成
        if (!originalImage || (!originalImageLocked && 
            img.naturalWidth * img.naturalHeight > 
            (originalImage.width || 0) * (originalImage.height || 0)
        )) {
            debugLog('新图片已加载且更合适，更新原图记录');
            recordImageAsOriginal(img);
        }
    }
}

// 初始化DOM内容变化监听（用于检测页面内容更新）
function initializeDOMContentObserver() {
    debugLog('初始化DOM内容变化监听');
    
    // 监听页面主要内容区域的变化
    const contentObserver = new MutationObserver((mutations) => {
        let hasSignificantChange = false;
        let hasNewImages = false;
        
        mutations.forEach((mutation) => {
            // 检查是否有新的节点被添加
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查是否添加了包含原图的容器
                        if (node.classList && (
                            node.classList.contains('safe-image') ||
                            node.classList.contains('image-item') ||
                            node.hasAttribute('data-v-92a52416')
                        )) {
                            debugLog('检测到原图相关容器被添加', {
                                className: node.className,
                                hasDataV: node.hasAttribute('data-v-92a52416')
                            });
                            hasSignificantChange = true;
                        }
                        
                        // 检查是否添加了图片元素
                        if (node.tagName === 'IMG' || node.querySelectorAll('img').length > 0) {
                            debugLog('检测到新图片元素被添加');
                            hasNewImages = true;
                        }
                        
                        // 检查是否有原图相关的选择器
                        const targetElements = node.querySelectorAll && node.querySelectorAll([
                            'div[data-v-92a52416].safe-image',
                            'div.safe-image img[data-v-92a52416]',
                            '.image-item img',
                            'img[data-v-92a52416]'
                        ].join(','));
                        
                        if (targetElements && targetElements.length > 0) {
                            debugLog('检测到原图相关元素被添加', targetElements.length);
                            hasSignificantChange = true;
                        }
                    }
                });
            }
        });
        
        // 如果检测到重要变化且当前没有锁定的原图，尝试重新检测
        if ((hasSignificantChange || hasNewImages) && !originalImageLocked) {
            debugLog('DOM发生重要变化，尝试重新检测原图', {
                hasSignificantChange,
                hasNewImages,
                originalImageLocked
            });
            
            // 延迟一点时间再检测，确保DOM完全更新
            const domChangeTimeoutId = setTimeout(() => {
                if (!originalImageLocked) {
                    debugLog('延迟后执行原图检测');
                    recordOriginalImages();
                }
                
                // 从待执行列表中移除
                const index = pendingComparisonTimeouts.indexOf(domChangeTimeoutId);
                if (index > -1) {
                    pendingComparisonTimeouts.splice(index, 1);
                }
            }, 1000);
            
            pendingComparisonTimeouts.push(domChangeTimeoutId);
        }
    });
    
    // 开始观察document.body的变化
    contentObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false, // 不监听属性变化，避免过多触发
        attributeOldValue: false
    });
    
    debugLog('DOM内容变化监听已启动');
}











// COS原图URL专门检测函数
function isCOSOriginalImage(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // 检查是否是腾讯COS域名
    const isCOSDomain = lowerUrl.includes('aidata-1258344706.cos.ap-guangzhou.myqcloud.com');
    
    if (!isCOSDomain) return false;
    
    // COS原图路径特征
    const cosOriginalPaths = [
        '/target/',
        '/target/dataset/',
        'dataset/'
    ];
    
    const hasCOSOriginalPath = cosOriginalPaths.some(path => lowerUrl.includes(path));
    
    // 检查文件扩展名（COS原图支持多种格式）
    const hasSupportedExt = /\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(url);
    
    // 检查URL参数（COS带签名参数）
    const hasSignParams = lowerUrl.includes('q-sign-algorithm') || 
                         lowerUrl.includes('?sign=') ||
                         lowerUrl.includes('&sign=');
    
    const result = hasCOSDomain && hasCOSOriginalPath && hasSupportedExt && hasSignParams;

    if (result) {
        debugLog('识别为COS原图 (支持多种格式)', {
            url: url.substring(0, 100) + '...',
            hasCOSOriginalPath,
            hasSupportedExt,
            hasSignParams
        });
    } else if (hasCOSDomain) {
        debugLog('识别为COS图片但不是原图', {
            url: url.substring(0, 100) + '...',
            hasCOSOriginalPath,
            hasSupportedExt,
            hasSignParams
        });
    }

    return result;
}

// 增强版原图候选判断（支持更多模式）
function isOriginalImageCandidate(url) {
    if (!url) return false;
    
    const originalIndicators = [
        'original', 'source', 'master', 'raw', 'full', 'high', 'hd',
        '原图', '原始', '源图', 'src', 'origin', 'orig',
        'large', 'big', 'huge', 'xl', 'xxl', 'max',
        'quality', 'best', 'highest'
    ];
    
    const lowerUrl = url.toLowerCase();
    
    // 检查关键词指示器
    const hasKeyword = originalIndicators.some(indicator => 
        lowerUrl.includes(indicator.toLowerCase())
    );
    
    // 检查尺寸格式（如 1920x1080, 800x600 等）
    const hasDimensions = /\d{3,4}[x×]\d{3,4}/.test(url);
    
    // 检查文件大小指示器
    const hasSizeIndicator = /_(large|big|huge|xl|xxl|max|full)(\.|_)/.test(lowerUrl);
    
    // 检查质量指示器
    const hasQualityIndicator = /(high|hd|quality|best|q\d+)/.test(lowerUrl);
    
    // 检查是否是缩略图（如果是，则不是原图）
    const isThumbnail = /(thumb|thumbnail|small|mini|tiny|preview|_s\.|_m\.)/.test(lowerUrl);
    
    // 检查文件路径中的原图指示
    const hasOriginalPath = /(\/original\/|\/full\/|\/source\/|\/raw\/|\/hd\/)/.test(lowerUrl);
    
    const isCandidate = (hasKeyword || hasDimensions || hasSizeIndicator || 
                        hasQualityIndicator || hasOriginalPath) && !isThumbnail;
    
    if (isCandidate) {
        debugLog('识别为原图候选', {
            url: url.substring(0, 100) + '...',
            hasKeyword,
            hasDimensions,
            hasSizeIndicator,
            hasQualityIndicator,
            hasOriginalPath,
            isThumbnail
        });
    }
    
    return isCandidate;
}

// 简化：N键重新检测原图（只使用COS原图和精确DOM选择器）
document.addEventListener('keydown', function(event) {
    if (!isInInputField(event.target) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        debugLog('手动重新检测原图 (N键)');
        showNotification('正在重新检测原图...', 1000);
        // 解锁原图，重新检测
        originalImageLocked = false;
        originalImage = null;
        recordOriginalImages();
    }
});









// 简化：P键强制重新检测原图（忽略锁定状态）
document.addEventListener('keydown', function(event) {
    if (!isInInputField(event.target) && event.key.toLowerCase() === 'p') {
        // 检查并关闭模态框
        if (checkAndCloseModalIfOpen('p')) {
            return; // 如果关闭了模态框，停止执行
        }
        
        event.preventDefault();
        debugLog('P键触发：智能尺寸检查 (与F2键功能相同)');
        checkImageDimensionsAndShowModal();
    }
});

// 移除：R键相关逻辑（模式切换、资源提取测试）

// 删除T键测试功能，合并到W键
// T键: 手动测试智能对比 - 已删除，请使用W键

// 智能图片对比 - 包含回退逻辑
function triggerSmartComparisonWithFallback() {
    debugLog('启动智能图片对比 (包含回退逻辑)');
    
    console.log('📊 图片对比状态检查:', {
        capturedOriginalImage,
        capturedModifiedImage,
        uploadedImage: uploadedImage ? uploadedImage.src : null,
        originalImage: !!originalImage,
        shouldAutoCompare,
        cosImageCache: cosImageCache.size
    });
    
    let comparisonPair = null;
    
    // 策略1: 使用COS拦截的图片（最优）
    if (capturedOriginalImage && capturedModifiedImage) {
        comparisonPair = {
            image1: { src: capturedOriginalImage, label: '原图' },
            image2: { src: capturedModifiedImage, label: '修改图' },
            mode: 'COS原图vs修改图'
        };
        debugLog('策略1: 使用COS拦截图片', comparisonPair);
        showNotification('🎯 使用COS拦截图片对比', 1000);
    }
    // 策略2: 原图 vs 用户上传图片
    else if (capturedOriginalImage && uploadedImage) {
        comparisonPair = {
            image1: { src: capturedOriginalImage, label: '原图' },
            image2: { src: uploadedImage.src, label: '上传图片' },
            mode: 'COS原图vs上传图'
        };
        debugLog('策略2: COS原图vs用户上传', comparisonPair);
        showNotification('📷 原图vs上传图对比', 1000);
    }
    // 策略3: 现有逻辑 - 原图 vs 上传图片
    else if (originalImage && uploadedImage) {
        comparisonPair = {
            image1: { src: originalImage.src, label: '页面原图' },
            image2: { src: uploadedImage.src, label: '上传图片' },
            mode: '页面原图vs上传图'
        };
        debugLog('策略3: 页面原图vs用户上传', comparisonPair);
        showNotification('📋 页面原图vs上传图对比', 1000);
    }
    // 策略4: 如果只有COS原图，与页面其他图片对比
    else if (capturedOriginalImage) {
        const pageImages = document.querySelectorAll('img');
        if (pageImages.length >= 2) {
            comparisonPair = {
                image1: { src: capturedOriginalImage, label: '原图' },
                image2: { src: pageImages[1].src, label: '页面图片' },
                mode: '原图vs页面图片'
            };
            debugLog('策略4: 原图vs页面图片', comparisonPair);
            showNotification('🔄 原图vs页面图片对比', 1000);
        }
    }
    // 策略5: 页面图片互相对比（回退）
    else {
        const pageImages = document.querySelectorAll('img');
        if (pageImages.length >= 2) {
            comparisonPair = {
                image1: { src: pageImages[0].src, label: '页面图片1' },
                image2: { src: pageImages[1].src, label: '页面图片2' },
                mode: '页面图片对比'
            };
            debugLog('策略5: 页面图片对比', comparisonPair);
            showNotification('🖼️ 页面图片对比', 1000);
        }
    }
    
    if (comparisonPair) {
        debugLog('执行图片对比', comparisonPair.mode);
        showSmartComparison(comparisonPair);
        shouldAutoCompare = false;
    } else {
        debugLog('无可用图片进行对比');
        showNotification('❌ 无可用图片进行对比', 2000);
    }
}

// 测试资源提取功能
async function testResourceExtraction() {
    if (typeof window.resourceExtractor === 'undefined') {
        console.error('❌ ResourceExtractor未加载');
        showNotification('资源提取器未加载', 2000);
        return;
    }
    
    try {
        console.log('🚀 开始测试资源提取...');
        const results = await window.resourceExtractor.extractAllResources();
        
        console.log('📊 资源提取结果:', results);
        
        const summary = results.summary;
        const message = `提取完成: ${summary.uniqueResources}个独特资源 (DOM:${summary.byMethod.DOM}, Performance:${summary.byMethod.Performance}, Cache:${summary.byMethod.Cache}, Network:${summary.byMethod.Network})`;
        
        showNotification(message, 3000);
        
        // 显示详细结果
        if (debugMode) {
            debugLog('资源提取详细结果', results);
        }
        
    } catch (error) {
        console.error('❌ 资源提取失败:', error);
        showNotification('资源提取失败: ' + error.message, 2000);
    }
}

// ============== COS图片拦截和智能对比系统 ==============

// 初始化COS图片监听器
function initializeCOSImageListener() {
    debugLog('初始化COS图片拦截监听器');
    
    // 监听来自background.js的COS图片拦截消息
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'COS_IMAGE_DETECTED') {
                handleCOSImageDetection(message.data);
            }
        });
        
        console.log('✅ COS图片拦截监听器已启动');
    } else {
        console.warn('⚠️ Chrome runtime不可用，无法监听COS图片');
    }
}

// 处理COS图片检测 - 简化版
function handleCOSImageDetection(data) {
    debugLog('COS图片检测', data);
    
    const { url, isOriginal, isModified, imageType, stage } = data;
    
    // 只处理请求完成阶段，避免重复处理
    if (stage !== 'completed') {
        return;
    }
    
    // 缓存图片信息
    cosImageCache.set(url, {
        ...data,
        timestamp: Date.now()
    });
    
    if (isOriginal) {
        console.log('📸 捕获到原图:', url);
        capturedOriginalImage = url;
        
        // 如果当前原图未锁定或为空，更新原图引用
        if (!originalImageLocked || !originalImage) {
            updateOriginalImageFromCOS(url);
        }
        
        debugLog('原图已捕获', { url, originalImageLocked });
    }
    
    if (isModified) {
        console.log('🔧 捕获到修改图:', url);
        capturedModifiedImage = url;
        
        debugLog('修改图已捕获', { url });
        
        // 如果用户正在对比模式，更新对比
        if (isComparisonModalOpen) {
            triggerSmartComparisonWithFallback();
        }
    }
    
    // 自动触发智能对比（如果需要且开关开启）
    if (shouldAutoCompare && autoCompareEnabled && capturedOriginalImage) {
        triggerSmartComparison();
    } else if (shouldAutoCompare && !autoCompareEnabled) {
        debugLog('跳过自动智能对比 - 自动对比功能已关闭');
        shouldAutoCompare = false; // 重置标记
    }
}

// 从COS更新原图引用 - 仅显示模式
async function updateOriginalImageFromCOS(imageUrl) {
    debugLog('从COS更新原图引用 (仅显示模式)', imageUrl);
    
    try {
        // 仅显示模式：直接创建img元素，无需代理
        const img = await createImageElementForDisplay(imageUrl);
        
        originalImage = img;
        originalImageLocked = true;
        debugLog('原图从COS加载成功 (仅显示)', {
            src: imageUrl,
            width: img.naturalWidth,
            height: img.naturalHeight
        });
        
        showNotification('✅ 原图已获取 (显示模式)', 2000);
        
    } catch (error) {
        debugLog('原图从COS加载失败', error);
        showNotification('❌ 原图加载失败: ' + error.message, 3000);
    }
}

// 使用CORS加载图片
function loadImageWithCORS(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            resolve(this);
        };
        
        img.onerror = function() {
            reject(new Error('CORS图片加载失败'));
        };
        
        // 设置较短的超时时间
        const timeout = setTimeout(() => {
            img.onload = img.onerror = null;
            reject(new Error('图片加载超时'));
        }, 5000);
        
        img.onload = function() {
            clearTimeout(timeout);
            resolve(this);
        };
        
        img.onerror = function() {
            clearTimeout(timeout);
            reject(new Error('CORS图片加载失败'));
        };
        
        img.src = imageUrl;
    });
}

// 通过background script代理获取图片
function fetchImageViaProxy(imageUrl) {
    return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            reject(new Error('Chrome runtime不可用'));
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'fetchCOSImage',
            url: imageUrl
        }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            if (response && response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response?.error || '代理获取失败'));
            }
        });
    });
}

// 从DataURL创建图片元素
function createImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = function() {
            resolve(this);
        };
        
        img.onerror = function() {
            reject(new Error('DataURL图片创建失败'));
        };
        
        img.src = dataUrl;
    });
}

// 智能对比逻辑 - 简化版
function triggerSmartComparison() {
    debugLog('触发智能对比');
    
    if (!capturedOriginalImage) {
        debugLog('无原图，跳过智能对比');
        showNotification('⏳ 等待原图加载...', 2000);
        return;
    }
    
    let comparisonPair = null;
    
    // 优先使用服务器修改图进行对比
    if (capturedModifiedImage) {
        comparisonPair = {
            image1: { src: capturedOriginalImage, label: '原图' },
            image2: { src: capturedModifiedImage, label: '修改图' },
            mode: '原图vs修改图对比'
        };
    } 
    // 如果没有修改图，使用用户上传的图片
    else if (uploadedImage) {
        comparisonPair = {
            image1: { src: capturedOriginalImage, label: '原图' },
            image2: { src: uploadedImage.src, label: '上传图片' },
            mode: '原图vs上传图对比'
        };
    } 
    // 都没有则提示等待
    else {
        debugLog('等待对比图片');
        showNotification('⏳ 等待对比图片...', 2000);
        return;
    }
    
    debugLog('启动智能对比', comparisonPair.mode);
    showNotification(`🔍 启动${comparisonPair.mode}`, 1000);
    showSmartComparison(comparisonPair);
    shouldAutoCompare = false; // 重置自动对比标志
}

// 显示智能对比弹窗 - 仅显示模式（无跨域问题）
async function showSmartComparison(comparisonPair) {
    debugLog('显示智能对比 (仅显示模式)', comparisonPair);
    
    try {
        // 仅显示模式：直接创建img元素，无需blob转换
        const img1 = await createImageElementForDisplay(comparisonPair.image1.src);
        const img2 = await createImageElementForDisplay(comparisonPair.image2.src);
        
        // 调用现有的对比函数
        createComparisonModal(img1, img2, img2);
        
        debugLog('智能对比弹窗已创建', {
            image1: comparisonPair.image1.label,
            image2: comparisonPair.image2.label,
            mode: comparisonPair.mode
        });
        
    } catch (error) {
        debugLog('智能对比失败', error);
        showNotification('❌ 图片对比失败: ' + error.message, 3000);
    }
}

// 为显示创建图片元素 - 无需跨域处理
function createImageElementForDisplay(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        // 设置较短的超时时间
        const timeout = setTimeout(() => {
            img.onload = img.onerror = null;
            reject(new Error('图片加载超时'));
        }, 8000);
        
        img.onload = function() {
            clearTimeout(timeout);
            debugLog('图片加载成功 (仅显示)', {
                src: imageUrl,
                width: this.naturalWidth,
                height: this.naturalHeight
            });
            
            // 创建一个包含必要属性的图片对象
            const imageObj = {
                src: this.src,
                width: this.naturalWidth,
                height: this.naturalHeight,
                name: extractFileNameFromUrl(this.src),
                element: this
            };
            
            resolve(imageObj);
        };
        
        img.onerror = function() {
            clearTimeout(timeout);
            reject(new Error('图片加载失败'));
        };
        
        // COS图片也可以正常显示，只是不能进行canvas操作
        img.src = imageUrl;
    });
}

// 在返修模式下更新对比
function updateComparisonInRevisionMode() {
    if (!isComparisonModalOpen || !comparisonModal) {
        return;
    }
    
    debugLog('返修模式：更新对比弹窗');
    
    if (capturedOriginalImage && capturedModifiedImage) {
        // 关闭当前对比弹窗
        if (comparisonModal.parentNode) {
            comparisonModal.parentNode.removeChild(comparisonModal);
        }
        
        // 显示新的对比
        triggerSmartComparison();
    }
}

// F2键功能：检查图片尺寸并显示标注界面
let dimensionCheckModal = null;
let isDimensionCheckModalOpen = false;
let lastDimensionCheckInfo = null; // 保存上次检查的图片信息，用于R键重新弹出

// F2键：智能尺寸检查 - 复用R键逻辑，如果不符合要求则自动跳过直到找到合适图片
async function checkImageDimensionsAndShowModal() {
    debugLog('F2键触发：智能尺寸检查');
    await autoSkipToValidImageWithRKeyLogic();
}

// 自动跳过到符合要求的图片，使用R键逻辑
async function autoSkipToValidImageWithRKeyLogic() {
    debugLog('开始智能跳过到符合要求的图片');
    
    let attempts = 0;
    const maxAttempts = 10; // 最多尝试10次
    
    while (attempts < maxAttempts) {
        attempts++;
        debugLog(`第${attempts}次尝试检查图片`);
        
        // 执行R键的逻辑：手动尺寸检查
        const checkResult = await manualDimensionCheck();
        
        if (checkResult === true) {
            // 找到符合要求的图片，R键逻辑已经显示了模态框
            debugLog('找到符合要求的图片，停止自动跳过');
            showNotification(`经过${attempts}次检查，找到符合要求的图片`, 2000);
            return;
        }
        
        // 图片不符合要求，执行跳过操作
        debugLog(`第${attempts}次图片不符合要求，执行跳过`);
        
        const skipButton = findButtonByText(['跳过', 'Skip', '下一个', 'Next', '继续', 'Continue']);
        if (skipButton) {
            clickButton(skipButton, '跳过');
            
            // 等待页面加载
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 重新检测原图
            originalImageLocked = false;
            originalImage = null;
            recordOriginalImages();
            
            // 等待原图检测完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!originalImage) {
                debugLog('跳过后未找到新的原图');
                showNotification('跳过后未找到新的原图，停止自动跳过', 2000);
                break;
            }
        } else {
            debugLog('未找到跳过按钮');
            showNotification('未找到跳过按钮，停止自动跳过', 2000);
            break;
        }
    }
    
    debugLog(`已尝试${attempts}次，未找到符合要求的图片`);
    showNotification(`已尝试${attempts}次，未找到符合要求的图片`, 3000);
}



// 自动提取页面指令文本
function extractInstructionText() {
    try {
        debugLog('开始提取页面指令文本');

        // 精确选择器：基于提供的示例
        const exactSelectors = [
            'div[data-v-2f9c5f73][name="instruction"]',
            'div[name="instruction"]',
            'div[data-v-2f9c5f73]'
        ];

        // 通用选择器：寻找可能包含指令的元素
        const generalSelectors = [
            '[name="instruction"]',
            '[class*="instruction"]',
            '[id*="instruction"]',
            'div[style*="font-size: 14px"]',
            '.instruction',
            '.task-instruction',
            '.prompt',
            '.description'
        ];

        // 合并所有选择器，精确选择器优先
        const allSelectors = [...exactSelectors, ...generalSelectors];

        let instructionText = '';

        // 按优先级尝试每个选择器
        for (const selector of allSelectors) {
            const elements = document.querySelectorAll(selector);
            debugLog(`尝试选择器: ${selector}`, { found: elements.length });

            if (elements.length > 0) {
                for (const element of elements) {
                    const text = element.textContent?.trim() || element.innerText?.trim() || '';

                    // 检查文本是否像指令（长度合理且包含中文或英文描述）
                    if (text.length > 5 && text.length < 500) {
                        // 检查是否包含指令性文字
                        const instructionKeywords = [
                            '添加', '更换', '修改', '改变', '调整', '设置', '变成', '换成',
                            '增加', '戴上', '画出', '增强', '模糊', '锐化', '美化', '优化',
                            '背景', '妆容', '发型', '服装', '表情', '姿势', '颜色', '风格',
                            '眼镜', '帽子', '衣服', '配饰', '灯光', '特效', '滤镜', '边框',
                            'add', 'change', 'modify', 'replace', 'adjust', 'set', 'make',
                            'increase', 'put on', 'draw', 'enhance', 'blur', 'sharpen',
                            'background', 'makeup', 'hairstyle', 'clothing', 'expression',
                            'glasses', 'hat', 'accessories', 'light', 'effect', 'filter'
                        ];

                        const containsInstruction = instructionKeywords.some(keyword =>
                            text.toLowerCase().includes(keyword.toLowerCase())
                        );

                        // 同时检查是否包含典型的指令动词和对象组合
                        const hasInstructionPattern =
                            (text.includes('添加') && (text.includes('眼镜') || text.includes('特效') || text.includes('背景'))) ||
                            (text.includes('增加') && text.includes('效果')) ||
                            (text.includes('戴上') && text.includes('眼镜')) ||
                            (text.includes('画出') && text.includes('图案')) ||
                            text.match(/(添加|增加|画出|添加).*[。！]$/) !== null;

                        if (containsInstruction || hasInstructionPattern || text.length > 20) {
                            // 如果文本看起来像指令或长度较长，我们接受它
                            instructionText = text;
                            debugLog('找到指令文本', {
                                selector: selector,
                                text: text.substring(0, 100) + '...',
                                element: element,
                                containsKeyword: containsInstruction,
                                hasPattern: hasInstructionPattern,
                                textLength: text.length
                            });
                            break;
                        } else {
                            debugLog('元素包含文本但不匹配指令关键词', {
                                selector: selector,
                                text: text.substring(0, 100) + '...',
                                element: element,
                                containsKeyword: containsInstruction,
                                hasPattern: hasInstructionPattern,
                                textLength: text.length
                            });
                        }
                    }
                }

                if (instructionText) break;
            }
        }

        // 如果精确方法没找到，尝试文本内容搜索
        if (!instructionText) {
            debugLog('精确选择器未找到，尝试文本内容搜索');

            const allDivs = document.querySelectorAll('div');
            for (const div of allDivs) {
                const text = div.textContent?.trim() || '';

                // 寻找包含"为她"、"将背景"等指令性开头的文本
                const instructionPatterns = [
                    /^为她.*[。！]$/, // 以"为她"开头的句子
                    /^将背景.*[。！]$/, // 以"将背景"开头的句子
                    /^添加.*[。！]$/, // 以"添加"开头的句子
                    /^修改.*[。！]$/, // 以"修改"开头的句子
                    /^换成.*[。！]$/, // 以"换成"开头的句子
                    /^给.*增加.*[。！]$/, // 以"给"开头，包含"增加"的句子
                    /^给.*戴上.*[。！]$/, // 以"给"开头，包含"戴上"的句子
                    /^给.*添加.*[。！]$/, // 以"给"开头，包含"添加"的句子
                    /^在.*增加.*[。！]$/, // 以"在"开头，包含"增加"的句子
                    /^在.*添加.*[。！]$/, // 以"在"开头，包含"添加"的句子
                    /^画出.*[。！]$/, // 以"画出"开头的句子
                    /^每人.*[。！]$/, // 包含"每人"的句子
                ];

                if (text.length > 10 && text.length < 300) {
                    const matchesPattern = instructionPatterns.some(pattern => pattern.test(text));
                    if (matchesPattern) {
                        instructionText = text;
                        debugLog('通过文本模式找到指令', {
                            text: text,
                            element: div
                        });
                        break;
                    }
                }
            }
        }

        if (instructionText) {
            debugLog('成功提取指令文本', {
                text: instructionText,
                length: instructionText.length
            });

            showNotification(`📝 已提取指令: ${instructionText.substring(0, 30)}...`, 2000);
            return instructionText;
        } else {
            debugLog('未找到指令文本');
            return '';
        }

    } catch (error) {
        debugLog('提取指令文本失败:', error);
        return '';
    }
}

// 显示尺寸检查模态框
function showDimensionCheckModal(imageInfo, isDimensionValid) {
    if (isDimensionCheckModalOpen) {
        return;
    }
    
    debugLog('显示尺寸检查模态框', { isDimensionValid });
    
    // 创建模态框容器
    dimensionCheckModal = document.createElement('div');
    dimensionCheckModal.className = 'dimension-check-modal';
    dimensionCheckModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        animation: fadeIn 0.2s ease-out;
    `;
    
    // 创建模态框内容
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        border-radius: 16px;
        padding: 32px;
        max-width: 580px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8);
        position: relative;
        transform: scale(0.95);
        animation: modalSlideIn 0.3s ease-out forwards;
    `;
    
    const statusColor = isDimensionValid ? '#059669' : '#dc2626';
    const statusBgColor = isDimensionValid ? '#ecfdf5' : '#fef2f2';
    const statusIcon = isDimensionValid ? '✓' : '✗';
    const statusText = isDimensionValid ? '尺寸符合要求' : '尺寸不符合要求';
    
    modalContent.innerHTML = `
        <button id="dimensionCheckCloseBtn" style="
            position: absolute;
            top: 16px;
            right: 16px;
            width: 32px;
            height: 32px;
            border: none;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: #6b7280;
            transition: all 0.2s ease;
        ">×</button>
        
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 12px 20px;
                background: ${statusBgColor};
                border: 2px solid ${statusColor};
                border-radius: 50px;
                font-size: 16px;
                font-weight: 600;
                color: ${statusColor};
            ">
                <span style="font-size: 18px;">${statusIcon}</span>
                ${statusText}
            </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 24px;">
            <img src="${imageInfo.src}" style="
                max-width: 100%; 
                max-height: 320px; 
                border-radius: 12px; 
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                border: 3px solid #ffffff;
            " />
        </div>
        
        <div style="
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 24px;
        ">
            <div style="display: flex; justify-content: space-around; margin-bottom: 16px;">
                <div style="text-align: center;">
                    <div style="color: #64748b; font-size: 13px; font-weight: 500; margin-bottom: 4px;">宽度</div>
                    <div style="
                        font-size: 24px; 
                        font-weight: 700; 
                        color: ${imageInfo.width % 8 === 0 ? '#059669' : '#dc2626'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                    ">
                        ${imageInfo.width}px
                        <span style="font-size: 16px;">${imageInfo.width % 8 === 0 ? '✓' : '✗'}</span>
                    </div>
                </div>
                <div style="width: 1px; background: #e2e8f0; margin: 0 16px;"></div>
                <div style="text-align: center;">
                    <div style="color: #64748b; font-size: 13px; font-weight: 500; margin-bottom: 4px;">高度</div>
                    <div style="
                        font-size: 24px; 
                        font-weight: 700; 
                        color: ${imageInfo.height % 8 === 0 ? '#059669' : '#dc2626'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                    ">
                        ${imageInfo.height}px
                        <span style="font-size: 16px;">${imageInfo.height % 8 === 0 ? '✓' : '✗'}</span>
                    </div>
                </div>
            </div>
            <div style="
                text-align: center;
                color: #64748b;
                font-size: 13px;
                font-weight: 500;
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.7);
                border-radius: 8px;
            ">
                要求：长宽都必须是8的倍数
            </div>
        </div>
        
        ${isDimensionValid ? `
        <div style="margin-bottom: 24px;">
            <label style="
                display: block; 
                margin-bottom: 12px; 
                color: #374151; 
                font-weight: 600;
                font-size: 14px;
            ">修改需求</label>
            <textarea id="dimensionCheckTextarea" placeholder="请描述对图片的修改需求..." style="
                width: 100%;
                height: 90px;
                padding: 16px;
                border: 2px solid #e2e8f0;
                border-radius: 12px;
                font-size: 14px;
                font-family: inherit;
                resize: vertical;
                box-sizing: border-box;
                background: #ffffff;
                transition: all 0.2s ease;
                outline: none;
            "></textarea>
        </div>
        ` : ''}
        
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 8px;">
            ${isDimensionValid ? `
            <button id="dimensionCheckSubmitBtn" style="
                padding: 14px 28px;
                border: none;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                border-radius: 12px;
                cursor: pointer;
                font-size: 15px;
                font-weight: 600;
                transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                min-width: 120px;
            ">提交需求</button>
            ` : ''}
        </div>
    `;
    
    // 添加CSS动画样式
    if (!document.querySelector('#dimension-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'dimension-modal-styles';
        styles.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes modalSlideIn {
                from { 
                    transform: scale(0.9) translateY(-20px);
                    opacity: 0;
                }
                to { 
                    transform: scale(1) translateY(0);
                    opacity: 1;
                }
            }
            
            .dimension-check-modal button:hover {
                transform: translateY(-1px);
            }
            
            .dimension-check-modal textarea:focus {
                border-color: #3b82f6 !important;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
            }
            
            .dimension-check-modal #dimensionCheckCloseBtn:hover {
                background: rgba(0, 0, 0, 0.15) !important;
            }
            
            .dimension-check-modal #dimensionCheckSubmitBtn:hover {
                transform: translateY(-1px) !important;
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4) !important;
            }
        `;
        document.head.appendChild(styles);
    }
    
    dimensionCheckModal.appendChild(modalContent);
    document.body.appendChild(dimensionCheckModal);
    isDimensionCheckModalOpen = true;

    // 先获取基础元素引用
    const closeBtn = modalContent.querySelector('#dimensionCheckCloseBtn');
    const submitBtn = modalContent.querySelector('#dimensionCheckSubmitBtn');
    const textarea = modalContent.querySelector('#dimensionCheckTextarea');

    // 创建唯一的事件处理器ID
    const modalId = Date.now();
    debugLog('创建模态框事件处理器', { modalId });

    // 绑定基础事件监听器（关闭功能）
    bindModalCloseEvents(modalId);

    // 绑定按钮事件
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDimensionCheckModal);
    }

    if (submitBtn) {
        const handleSubmit = () => {
            if (submitBtn.disabled) {
                debugLog('提交按钮已禁用，忽略点击');
                return;
            }

            const comment = textarea ? textarea.value.trim() : '';
            disableSubmitButton(submitBtn);
            submitDimensionCheck(comment);
        };

        submitBtn.addEventListener('click', handleSubmit);
    }

    // 自动提取并填入指令文本（仅当textarea为空且图片尺寸有效时）
    if (textarea && isDimensionValid && !textarea.value.trim()) {
        debugLog('尝试自动提取指令文本填入输入框');
        const instructionText = extractInstructionText();
        if (instructionText) {
            textarea.value = instructionText;
            debugLog('指令文本已自动填入输入框', {
                text: instructionText.substring(0, 50) + '...'
            });
            showNotification('已自动填入页面指令', 1500);

            // 添加高亮效果提示用户
            textarea.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
            textarea.style.border = '2px solid #f59e0b';

            // 3秒后恢复正常样式
            setTimeout(() => {
                textarea.style.background = '#ffffff';
                textarea.style.border = '2px solid #e2e8f0';
            }, 3000);
        }
    }

    // 检查是否有缓存需要恢复（在事件绑定后）
    if (cachedRunningHubResults && currentPageTaskInfo) {
        debugLog('在事件绑定后恢复缓存结果', {
            taskId: currentPageTaskInfo.taskId,
            status: currentPageTaskInfo.status
        });

        // 恢复任务状态显示
        updateDimensionModalProgress(
            `🆔 任务ID: ${currentPageTaskInfo.taskId}\n${currentPageTaskInfo.statusMessage || '✅ 任务已完成'}`
        );

        // 恢复结果显示
        renderRunningHubResultsInModal(cachedRunningHubResults);

        // 恢复按钮状态
        if (submitBtn) {
            enableSubmitButton(submitBtn, currentPageTaskInfo.status || 'success');
        }

        // 隐藏取消按钮
        hideRhCancelBtn();

        // 添加缓存相关UI
        addCacheIndicator();
        addClearCacheButton();

        showNotification('已恢复上次的生成结果', 2000);
    }

    if (!cachedRunningHubResults && window._rhPollingActive && window._rhTaskIdForCancel && !window._rhCancelRequested) {
        updateDimensionModalProgress(`🆔 任务ID: ${window._rhTaskIdForCancel}\n📊 状态: 正在执行中...`);
        showRhCancelBtn();

        // 设置提交按钮为进行中状态
        if (submitBtn) {
            disableSubmitButton(submitBtn);
        }
    }

    // 按钮悬停效果
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = '#f3f4f6';
        closeBtn.style.borderColor = '#9ca3af';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'white';
        closeBtn.style.borderColor = '#d1d5db';
    });
    
    if (submitBtn) {
        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.style.background = '#2563eb';
        });
        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.style.background = '#3b82f6';
        });
    }
    
    debugLog('尺寸检查模态框已显示');
}

// 绑定模态框关闭事件
function bindModalCloseEvents(modalId) {
    if (!dimensionCheckModal) return;

    debugLog('绑定模态框关闭事件', { modalId });

    // ESC键关闭
    const handleEscKey = (e) => {
        if (e.key === 'Escape' && isDimensionCheckModalOpen && dimensionCheckModal) {
            debugLog('ESC键触发关闭模态框', { modalId });
            e.preventDefault();
            e.stopPropagation();
            closeDimensionCheckModal();
        }
    };

    // 点击背景关闭
    const handleBackgroundClick = (e) => {
        if (e.target === dimensionCheckModal && isDimensionCheckModalOpen) {
            debugLog('背景点击触发关闭模态框', { modalId });
            e.preventDefault();
            e.stopPropagation();
            closeDimensionCheckModal();
        }
    };

    // 绑定事件
    document.addEventListener('keydown', handleEscKey, true); // 使用capture阶段
    dimensionCheckModal.addEventListener('click', handleBackgroundClick, true);

    // 保存事件处理函数以便清理
    dimensionCheckModal._handleEscKey = handleEscKey;
    dimensionCheckModal._handleBackgroundClick = handleBackgroundClick;
    dimensionCheckModal._modalId = modalId;

    debugLog('模态框关闭事件已绑定', { modalId });
}

// 禁用提交按钮
function disableSubmitButton(submitBtn) {
    if (!submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.6';
    submitBtn.style.cursor = 'not-allowed';
    submitBtn.style.pointerEvents = 'none';

    // 更新按钮文本和图标
    submitBtn.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span style="animation: spin 1s linear infinite;">⏳</span>
            处理中...
        </span>
    `;

    // 添加旋转动画
    if (!document.querySelector('#submit-button-styles')) {
        const styles = document.createElement('style');
        styles.id = 'submit-button-styles';
        styles.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styles);
    }

    debugLog('提交按钮已禁用');
}

// 启用提交按钮
function enableSubmitButton(submitBtn, status = 'ready') {
    if (!submitBtn) return;

    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
    submitBtn.style.pointerEvents = 'auto';

    // 根据状态设置不同的按钮文本和样式
    if (status === 'success') {
        submitBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>✅</span>
                任务已完成
            </span>
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
    } else if (status === 'failed') {
        submitBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>🔄</span>
                重新提交
            </span>
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
    } else if (status === 'canceled') {
        submitBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>🔄</span>
                重新提交
            </span>
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';

        // 为重新提交按钮添加事件监听器
        const handleResubmit = () => {
            if (submitBtn.disabled) {
                debugLog('提交按钮已禁用，忽略点击');
                return;
            }

            // 获取备注内容
            const modal = document.querySelector('.dimension-check-modal');
            const textarea = modal ? modal.querySelector('#dimensionCheckTextarea') : null;
            const comment = textarea ? textarea.value.trim() : '';

            // 禁用按钮并开始处理
            disableSubmitButton(submitBtn);
            submitDimensionCheck(comment);
        };

        // 添加事件监听器（避免重复添加）
        if (!submitBtn._resubmitHandler) {
            submitBtn._resubmitHandler = handleResubmit;
            submitBtn.addEventListener('click', handleResubmit);
        }
    } else {
        // ready状态 - 恢复原始样式
        submitBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>🚀</span>
                提交需求
            </span>
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    }

    debugLog('提交按钮已启用', { status });
}

// 缓存RunningHub结果
function cacheRunningHubResults(taskId, resultsData, taskInfo) {
    try {
        debugLog('缓存RunningHub结果', {
            taskId,
            hasResults: !!resultsData,
            taskInfo
        });

        cachedRunningHubResults = {
            ...resultsData,
            cachedAt: Date.now(),
            pageUrl: window.location.href
        };

        currentPageTaskInfo = {
            taskId,
            ...taskInfo,
            cachedAt: Date.now(),
            pageUrl: window.location.href
        };

        lastSuccessfulTaskId = taskId;

        // 在模态框中添加缓存提示
        if (isDimensionCheckModalOpen) {
            addCacheIndicator();
        }

        debugLog('RunningHub结果已缓存', {
            cachedResultsExists: !!cachedRunningHubResults,
            taskInfo: currentPageTaskInfo
        });

    } catch (error) {
        debugLog('缓存RunningHub结果失败:', error);
    }
}

// 清除RunningHub结果缓存
function clearRunningHubCache() {
    debugLog('清除RunningHub结果缓存');
    cachedRunningHubResults = null;
    currentPageTaskInfo = null;
    lastSuccessfulTaskId = null;
}

// 在模态框中添加缓存指示器
function addCacheIndicator() {
    if (!isDimensionCheckModalOpen || !dimensionCheckModal || !currentPageTaskInfo) return;

    // 检查是否已存在缓存指示器
    let indicator = dimensionCheckModal.querySelector('#cache-indicator');
    if (indicator) return;

    indicator = document.createElement('div');
    indicator.id = 'cache-indicator';
    indicator.style.cssText = `
        position: absolute;
        top: 16px;
        left: 16px;
        background: rgba(34, 197, 94, 0.9);
        color: white;
        padding: 6px 10px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: 500;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        z-index: 1001;
    `;

    const timeAgo = Math.round((Date.now() - currentPageTaskInfo.cachedAt) / 1000);
    indicator.innerHTML = `
        <span style="display: flex; align-items: center; gap: 4px;">
            <span>💾</span>
            <span>已缓存 ${timeAgo < 60 ? timeAgo + 's' : Math.round(timeAgo / 60) + 'm'}</span>
        </span>
    `;

    dimensionCheckModal.appendChild(indicator);
}

// 添加清除缓存按钮
function addClearCacheButton() {
    if (!isDimensionCheckModalOpen || !dimensionCheckModal) return;

    // 检查是否已存在清除按钮
    let clearBtn = dimensionCheckModal.querySelector('#clear-cache-btn');
    if (clearBtn) return;

    clearBtn = document.createElement('button');
    clearBtn.id = 'clear-cache-btn';
    clearBtn.innerHTML = `
        <span style="display: flex; align-items: center; gap: 4px;">
            <span>🗑️</span>
            <span>清除缓存</span>
        </span>
    `;
    clearBtn.style.cssText = `
        position: absolute;
        top: 16px;
        right: 60px;
        background: rgba(251, 113, 133, 0.9);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 10px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition: all 0.2s ease;
        z-index: 1001;
    `;

    clearBtn.addEventListener('mouseenter', () => {
        clearBtn.style.background = 'rgba(239, 68, 68, 0.9)';
        clearBtn.style.transform = 'scale(1.05)';
    });

    clearBtn.addEventListener('mouseleave', () => {
        clearBtn.style.background = 'rgba(251, 113, 133, 0.9)';
        clearBtn.style.transform = 'scale(1)';
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('确定要清除缓存的生成结果吗？\n清除后将无法再次查看之前的结果。')) {
            debugLog('用户手动清除缓存');
            clearRunningHubCache();

            // 移除结果显示区域
            const resultWrap = dimensionCheckModal.querySelector('#rh-result-wrap');
            if (resultWrap) {
                resultWrap.remove();
            }

            // 移除状态栏
            const statusBar = dimensionCheckModal.querySelector('#rh-status-bar');
            if (statusBar) {
                statusBar.remove();
            }

            // 移除缓存指示器和清除按钮
            const cacheIndicator = dimensionCheckModal.querySelector('#cache-indicator');
            if (cacheIndicator) {
                cacheIndicator.remove();
            }
            clearBtn.remove();

            // 重置提交按钮
            const submitBtn = dimensionCheckModal.querySelector('#dimensionCheckSubmitBtn');
            if (submitBtn) {
                enableSubmitButton(submitBtn, 'ready');
            }

            showNotification('缓存已清除，可以重新提交任务', 2000);
        }
    });

    dimensionCheckModal.appendChild(clearBtn);
}

// 关闭尺寸检查模态框
function closeDimensionCheckModal() {
    if (!isDimensionCheckModalOpen || !dimensionCheckModal) {
        debugLog('模态框已关闭或不存在，跳过关闭操作');
        return;
    }

    const modalId = dimensionCheckModal._modalId;
    debugLog('开始关闭尺寸检查模态框', {
        modalId,
        hasEscHandler: !!dimensionCheckModal._handleEscKey,
        hasBackgroundHandler: !!dimensionCheckModal._handleBackgroundClick
    });

    // 先设置状态为关闭，防止事件处理器继续触发
    isDimensionCheckModalOpen = false;

    // 移除ESC键监听器（使用capture参数匹配绑定时的参数）
    if (dimensionCheckModal._handleEscKey) {
        document.removeEventListener('keydown', dimensionCheckModal._handleEscKey, true);
        debugLog('ESC键监听器已移除（capture阶段）');
    }

    // 移除背景点击监听器（使用capture参数）
    if (dimensionCheckModal._handleBackgroundClick) {
        dimensionCheckModal.removeEventListener('click', dimensionCheckModal._handleBackgroundClick, true);
        debugLog('背景点击监听器已移除（capture阶段）');
    }

    // 移除模态框DOM元素
    if (dimensionCheckModal.parentNode) {
        dimensionCheckModal.parentNode.removeChild(dimensionCheckModal);
        debugLog('模态框DOM元素已移除');
    }

    // 完全重置状态
    dimensionCheckModal = null;

    debugLog('尺寸检查模态框已完全关闭并清理', { modalId });
}

// 提交尺寸检查结果
async function submitDimensionCheck(comment) {
    debugLog('提交尺寸检查结果', { comment });

    const submitBtn = document.querySelector('#dimensionCheckSubmitBtn');

    // 立即禁用按钮并显示进行中状态
    disableSubmitButton(submitBtn);

    // 清除之前的缓存和状态信息
    debugLog('重新提交时清除之前的缓存和状态');
    clearRunningHubCache();

    // 清除之前的轮询状态
    window._rhPollingActive = false;
    window._rhCancelRequested = false;
    window._rhTaskIdForCancel = null;
    window._rhApiKeyForCancel = null;

    // 隐藏取消按钮
    hideRhCancelBtn();

    // 清除之前的结果显示
    const resultWrap = dimensionCheckModal?.querySelector('#rh-result-wrap');
    if (resultWrap) {
        resultWrap.remove();
        debugLog('清除了之前的结果显示');
    }

    // 检查是否有原图
    if (!originalImage) {
        showNotification('未找到原图，无法上传', 3000);
        // 重新启用按钮
        enableSubmitButton(submitBtn, 'failed');
        return;
    }

    // 获取API Key
    let apiKey = localStorage.getItem('runninghub_api_key');
    if (!apiKey) {
        apiKey = prompt('请输入您的Running Hub API Key:');
        if (!apiKey) {
            showNotification('未提供API Key，取消上传', 2000);
            // 重新启用按钮
            enableSubmitButton(submitBtn, 'ready');
            return;
        }
        localStorage.setItem('runninghub_api_key', apiKey);
    }

    try {
        showNotification('正在上传图片到Running Hub...', 0);
        const imageFile = await convertImageToFile(originalImage);
        const uploadResult = await uploadToRunningHub(imageFile, apiKey, comment);

        // 解析上传API响应
        const uploadResponse = JSON.parse(uploadResult);
        if (uploadResponse.code === 0) {
            const imageFileName = uploadResponse.data.fileName;
            showNotification(`图片上传成功！正在创建AI应用任务...`, 2000);
            debugLog('Running Hub图片上传成功:', uploadResponse);

            // 图片上传成功后，调用AI应用API
            const taskResult = await createWorkflowTask(apiKey, comment || '1 girl in classroom', imageFileName);

            // 解析AI应用任务响应
            const taskResponse = JSON.parse(taskResult);
            if (taskResponse.code === 0) {
                const taskId = taskResponse.data.taskId;
                const taskStatus = taskResponse.data.taskStatus;
                showNotification(`AI应用任务创建成功！\n任务ID: ${taskId}\n状态: ${taskStatus}${comment ? '\n需求: ' + comment : ''}`, 5000);
                debugLog('AI应用任务创建成功:', taskResponse);

                // 开始轮询并展示结果
                updateDimensionModalProgress(`任务已创建\n🆔 任务ID: ${taskId}\n📊 状态: 正在执行中...`);

                // 显示取消按钮
                showRhCancelBtn();

                try {
                    const poll = await pollRunningHubTaskStatus(apiKey, taskId, (tick) => {
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n📊 状态: ${tick.status || 'RUNNING'}${tick.msg ? ' (' + tick.msg + ')' : ''}\n🔄 第${tick.pollCount || 0}次查询 - ${Math.round((tick.elapsed || 0) / 1000)}秒`);
                    });

                    debugLog('轮询完成', poll);

                    if (poll.final === 'SUCCESS') {
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n✅ 任务成功，正在获取结果...`);
                        try {
                            const outs = await fetchRunningHubTaskOutputs(apiKey, taskId);
                            renderRunningHubResultsInModal(outs);
                            updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n✅ 任务已完成 - 耗时${Math.round(poll.totalTime / 1000)}秒`);

                            // 缓存成功的结果
                            cacheRunningHubResults(taskId, outs, {
                                status: 'success',
                                statusMessage: `✅ 任务已完成 - 耗时${Math.round(poll.totalTime / 1000)}秒`,
                                comment: comment,
                                completedAt: new Date().toISOString()
                            });

                            hideRhCancelBtn();
                            // 任务成功完成，启用按钮为完成状态
                            enableSubmitButton(submitBtn, 'success');
                        } catch (e) {
                            debugLog('获取输出失败:', e);
                            updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n⚠️ 任务完成，但获取输出失败：${e.message}`);
                            // 获取输出失败，允许重新提交
                            enableSubmitButton(submitBtn, 'failed');
                        }
                    } else if (poll.final === 'FAILED') {
                        debugLog('任务失败', poll.raw);
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n❌ 任务失败 - ${poll.raw?.msg || '未知原因'}`);
                        hideRhCancelBtn();

                        // 如果有失败详情，显示给用户
                        if (poll.raw?.data?.failedReason) {
                            const failedReason = poll.raw.data.failedReason;
                            updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n❌ 失败原因：${failedReason.exception_message || failedReason.exception_type || '系统错误'}`);
                        }
                        // 任务失败，允许重新提交
                        enableSubmitButton(submitBtn, 'failed');
                    } else if (poll.final === 'ERROR') {
                        debugLog('任务出错', poll.raw);
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n❌ 任务出错 - ${poll.raw?.msg || '系统错误'}`);
                        hideRhCancelBtn();
                        // 任务出错，允许重新提交
                        enableSubmitButton(submitBtn, 'failed');
                    } else if (poll.final === 'CANCELED') {
                        debugLog('任务已取消', poll.raw);
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n🚫 任务已取消`);
                        hideRhCancelBtn();
                        // 任务被取消，允许重新提交
                        enableSubmitButton(submitBtn, 'canceled');
                    } else {
                        debugLog('未知的最终状态', poll);
                        updateDimensionModalProgress(`🆔 任务ID: ${taskId}\n❓ 任务结束：${poll.final}`);
                        hideRhCancelBtn();
                        // 未知状态，允许重新提交
                        enableSubmitButton(submitBtn, 'failed');
                    }
                } catch (e) {
                    debugLog('轮询过程失败:', e);
                    updateDimensionModalProgress('轮询失败：' + e.message);
                    hideRhCancelBtn();
                    // 轮询失败，允许重新提交
                    enableSubmitButton(submitBtn, 'failed');
                }
            } else {
                throw new Error('AI应用任务创建失败: ' + (taskResponse.msg || '未知错误'));
            }
        } else {
            throw new Error(uploadResponse.msg || '图片上传失败');
        }
    } catch (error) {
        debugLog('运行失败:', error);
        showNotification('运行失败: ' + error.message, 3000);
        // 运行失败，重新启用按钮
        enableSubmitButton(submitBtn, 'failed');
    }

    // 保留模态框查看结果
    // closeDimensionCheckModal();
}

// R键功能：手动触发图片尺寸检查
async function manualDimensionCheck() {
    debugLog('手动触发图片尺寸检查');

    // 首先检查是否有缓存的结果可以快速显示
    if (cachedRunningHubResults && currentPageTaskInfo) {
        debugLog('检测到缓存结果，询问用户是否查看', {
            taskId: currentPageTaskInfo.taskId,
            cachedAt: new Date(currentPageTaskInfo.cachedAt).toLocaleString()
        });

        const timeAgo = Math.round((Date.now() - currentPageTaskInfo.cachedAt) / 60000);
        const shouldViewCached = confirm(
            `检测到${timeAgo < 1 ? '刚才' : timeAgo + '分钟前'}的生成结果缓存\n` +
            `任务ID: ${currentPageTaskInfo.taskId}\n` +
            `需求: ${currentPageTaskInfo.comment || '无'}\n\n` +
            `是否查看缓存的结果？\n` +
            `点击"确定"查看缓存，点击"取消"重新检查图片`
        );

        if (shouldViewCached) {
            debugLog('用户选择查看缓存结果');
            // 直接显示模态框，缓存会自动恢复
            const imageInfoForModal = {
                src: originalImage?.src || 'cached_result',
                width: originalImage?.width || 0,
                height: originalImage?.height || 0,
                name: originalImage?.name || '缓存结果'
            };
            showDimensionCheckModal(imageInfoForModal, true);
            showNotification('已显示缓存的生成结果', 2000);
            return true;
        } else {
            debugLog('用户选择重新检查，清除缓存');
            clearRunningHubCache();
        }
    }

    try {
        // 获取当前原图
        if (!originalImage) {
            debugLog('未找到原图，尝试重新检测');
            recordOriginalImages();
            
            // 等待一下再检查
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!originalImage) {
                showNotification('❌ 未找到原图，请等待页面加载完成', 3000);
                return;
            }
        }
        
        // 创建新的Image对象来获取真实的图片尺寸
        const img = new Image();
        
        // 等待图片加载完成
        const loadPromise = new Promise((resolve, reject) => {
            img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                reject(new Error('图片加载失败'));
            };
        });
        
        // 设置超时
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('图片加载超时')), 5000);
        });
        
        img.src = originalImage.src;
        
        // 等待图片加载或超时
        const { width, height } = await Promise.race([loadPromise, timeoutPromise]);
        
        debugLog('手动检查图片尺寸', { width, height, src: originalImage.src });
        
        // 检查尺寸是否符合要求（长宽都是8的倍数）
        const isWidthValid = width % 8 === 0;
        const isHeightValid = height % 8 === 0;
        const isDimensionValid = isWidthValid && isHeightValid;
        
        debugLog('手动尺寸检查结果', {
            width,
            height,
            isWidthValid,
            isHeightValid,
            isDimensionValid
        });
        
        if (isDimensionValid) {
            // 尺寸符合要求，弹出模态框
            showNotification('✅ 图片尺寸符合要求，弹出模态框', 1500);
            
            // 保存检查信息
            lastDimensionCheckInfo = {
                imageInfo: {
                    src: originalImage.src,
                    width: width,
                    height: height,
                    name: originalImage.name || extractFileNameFromUrl(originalImage.src) || '原图'
                },
                isDimensionValid: true,
                width: width,
                height: height,
                timestamp: Date.now()
            };
            
            // 创建包含正确尺寸信息的图片对象
            const imageInfoForModal = {
                src: originalImage.src,
                width: width,
                height: height,
                name: originalImage.name || extractFileNameFromUrl(originalImage.src) || '原图'
            };
            
            // 显示模态框
            showDimensionCheckModal(imageInfoForModal, true);
            return true; // 返回true表示符合要求
            
        } else {
            // 尺寸不符合要求，系统提示
            const widthStatus = isWidthValid ? '✅' : '❌';
            const heightStatus = isHeightValid ? '✅' : '❌';
            
            showNotification(
                `❌ 图片尺寸不符合要求！\n` +
                `宽度: ${width}px ${widthStatus} (${isWidthValid ? '是' : '不是'}8的倍数)\n` +
                `高度: ${height}px ${heightStatus} (${isHeightValid ? '是' : '不是'}8的倍数)\n` +
                `要求: 长宽都必须是8的倍数`, 
                4000
            );
            
            debugLog('图片尺寸不符合要求', {
                width, height,
                widthRemainder: width % 8,
                heightRemainder: height % 8,
                isWidthValid, isHeightValid,
                src: originalImage.src
            });
            return false; // 返回false表示不符合要求
        }
        
    } catch (error) {
        debugLog('手动检查图片尺寸时出错', error);
        showNotification('❌ 检查图片尺寸时出错: ' + error.message, 3000);
        return false; // 出错时返回false
    }
}

// 验证图片并显示尺寸检查模态框
async function validateAndShowDimensionCheckModal(imageInfo, isDimensionValid) {
    debugLog('验证图片资源并显示模态框', {
        src: imageInfo.src ? imageInfo.src.substring(0, 50) + '...' : '无src'
    });
    
    try {
        // 创建一个新的图片对象来验证资源是否可用
        const testImg = new Image();
        
        // 设置超时时间
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('图片加载超时')), 5000);
        });
        
        // 图片加载Promise
        const loadPromise = new Promise((resolve, reject) => {
            testImg.onload = function() {
                debugLog('图片验证成功', {
                    naturalWidth: this.naturalWidth,
                    naturalHeight: this.naturalHeight,
                    expectedWidth: imageInfo.width,
                    expectedHeight: imageInfo.height
                });
                
                // 验证尺寸是否匹配
                if (this.naturalWidth === imageInfo.width && this.naturalHeight === imageInfo.height) {
                    resolve(true);
                } else {
                    debugLog('图片尺寸不匹配，可能是不同的图片', {
                        actual: `${this.naturalWidth}×${this.naturalHeight}`,
                        expected: `${imageInfo.width}×${imageInfo.height}`
                    });
                    resolve(false);
                }
            };
            
            testImg.onerror = function() {
                debugLog('图片加载失败');
                reject(new Error('图片加载失败'));
            };
        });
        
        // 开始加载图片
        testImg.src = imageInfo.src;
        
        // 等待加载完成或超时
        const isValid = await Promise.race([loadPromise, timeout]);
        
        if (isValid) {
            // 图片验证成功，显示模态框
            showDimensionCheckModal(imageInfo, isDimensionValid);
            showNotification('已重新弹出尺寸检查模态框', 1000);
        } else {
            // 图片尺寸不匹配，提示用户重新检查
            showNotification('保存的图片信息已过期，请重新按F2键检查', 3000);
            lastDimensionCheckInfo = null; // 清除无效信息
        }
        
    } catch (error) {
        debugLog('图片验证失败', error);
        
        // 图片加载失败，尝试使用当前原图
        if (originalImage && originalImage.src) {
            debugLog('图片验证失败，尝试使用当前原图');
            showNotification('原图片资源失效，使用当前原图重新检查...', 2000);
            
            // 重新执行F2键检查逻辑
            setTimeout(() => {
                checkImageDimensionsAndShowModal();
            }, 500);
        } else {
            showNotification('图片资源失效且未找到当前原图，请重新按F2键检查', 3000);
            lastDimensionCheckInfo = null; // 清除无效信息
        }
    }
}

// 将图片转换为文件对象 - 解决CORS问题版本
async function convertImageToFile(imageInfo) {
    debugLog('开始转换图片为文件', {
        type: typeof imageInfo,
        hasElement: !!(imageInfo && imageInfo.element),
        hasSrc: !!(imageInfo && imageInfo.src),
        isHTMLElement: imageInfo instanceof HTMLImageElement
    });

    try {
        const imageUrl = imageInfo.src || (imageInfo.element && imageInfo.element.src);
        if (!imageUrl) {
            throw new Error('无法获取图片URL');
        }

        debugLog('获取图片URL', imageUrl.substring(0, 100) + '...');

        // 检查是否是跨域图片
        const isCrossOrigin = !imageUrl.startsWith(window.location.origin) &&
                             !imageUrl.startsWith('data:') &&
                             !imageUrl.startsWith('blob:');

        if (isCrossOrigin) {
            debugLog('检测到跨域图片，使用background script代理获取');
            return await fetchImageViaBackgroundScript(imageUrl);
        } else {
            debugLog('同域图片，使用标准Canvas方法');
            return await convertViaCanvas(imageInfo);
        }

    } catch (error) {
        debugLog('convertImageToFile失败:', error);
        throw error;
    }
}

// 通过background script获取图片并转换为文件
async function fetchImageViaBackgroundScript(imageUrl) {
    return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            reject(new Error('Chrome runtime不可用'));
            return;
        }

        debugLog('向background script请求图片数据');

        chrome.runtime.sendMessage({
            action: 'fetchCOSImage',
            url: imageUrl
        }, (response) => {
            if (chrome.runtime.lastError) {
                debugLog('background script通信失败:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            if (response && response.success) {
                debugLog('background script返回成功', {
                    hasDataUrl: !!response.data.dataUrl,
                    type: response.data.type,
                    size: response.data.size
                });

                // 从background script返回的dataUrl直接创建文件
                try {
                    const dataUrl = response.data.dataUrl;
                    if (!dataUrl || !dataUrl.startsWith('data:')) {
                        throw new Error('无效的dataUrl格式');
                    }

                    // 解析dataUrl
                    const [header, base64Data] = dataUrl.split(',');
                    const mimeType = header.split(':')[1].split(';')[0];

                    // 转换base64为二进制数据
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);

                    // 创建blob和文件
                    const fileBlob = new Blob([byteArray], { type: mimeType });
                    const extension = mimeType.split('/')[1] || 'jpg';
                    const fileName = `image_${Date.now()}.${extension}`;
                    const file = new File([fileBlob], fileName, { type: mimeType });

                    debugLog('从dataUrl创建文件成功', {
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        originalSize: response.data.size
                    });

                    resolve(file);
                } catch (parseError) {
                    debugLog('dataUrl解析失败:', parseError);
                    reject(new Error('dataUrl解析失败: ' + parseError.message));
                }
            } else {
                debugLog('background script返回失败:', response);
                reject(new Error(response?.error || 'background script获取图片失败'));
            }
        });
    });
}

// 标准Canvas转换方法（用于同域图片）
async function convertViaCanvas(imageInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            let imgElement;

            // 获取图片元素
            if (imageInfo instanceof HTMLImageElement) {
                imgElement = imageInfo;
            } else if (imageInfo && imageInfo.element instanceof HTMLImageElement) {
                imgElement = imageInfo.element;
            } else if (imageInfo && imageInfo.src) {
                // 在页面中查找匹配的图片元素
                const allImages = document.querySelectorAll('img[src]');
                imgElement = Array.from(allImages).find(img => img.src === imageInfo.src);

                if (!imgElement) {
                    // 创建新的图片元素
                    imgElement = new Image();

                    await new Promise((loadResolve, loadReject) => {
                        const timeout = setTimeout(() => {
                            loadReject(new Error('图片加载超时'));
                        }, 8000);

                        imgElement.onload = () => {
                            clearTimeout(timeout);
                            loadResolve();
                        };

                        imgElement.onerror = () => {
                            clearTimeout(timeout);
                            loadReject(new Error('图片加载失败'));
                        };

                        imgElement.src = imageInfo.src;
                    });
                }
            } else {
                throw new Error('无效的图片参数');
            }

            // 验证图片元素
            if (!imgElement || !(imgElement instanceof HTMLImageElement)) {
                throw new Error('无效的图片元素');
            }

            const width = imgElement.naturalWidth || imgElement.width;
            const height = imgElement.naturalHeight || imgElement.height;

            if (!width || !height) {
                throw new Error('图片尺寸无效');
            }

            debugLog('开始Canvas转换（同域）', { width, height });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = width;
            canvas.height = height;

            // 绘制图片
            ctx.drawImage(imgElement, 0, 0);

            // 转换为blob
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], 'image.png', { type: 'image/png' });
                    debugLog('Canvas转换成功');
                    resolve(file);
                } else {
                    reject(new Error('Canvas转换为blob失败'));
                }
            }, 'image/png');

        } catch (error) {
            debugLog('Canvas转换失败:', error);
            reject(error);
        }
    });
}

// 上传到Running Hub API
async function uploadToRunningHub(imageFile, apiKey, comment) {
    const myHeaders = new Headers();
    myHeaders.append("Host", "www.runninghub.cn");
    
    const formdata = new FormData();
    formdata.append("apiKey", apiKey);
    formdata.append("file", imageFile, imageFile.name);
    formdata.append("fileType", "image");
    
    // 如果有备注，也添加到请求中
    if (comment) {
        formdata.append("description", comment);
    }
    
    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: formdata,
        redirect: 'follow'
    };
    
    const response = await fetch("https://www.runninghub.cn/task/openapi/upload", requestOptions);
    
    if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const result = await response.text();
    return result;
}

// ========== RunningHub 轮询与结果展示（最小增量） ==========

function updateDimensionModalProgress(text) {
    try {
        if (!isDimensionCheckModalOpen || !dimensionCheckModal) return;
        let bar = dimensionCheckModal.querySelector('#rh-status-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'rh-status-bar';
            bar.style.cssText = `
                margin-top: 12px;
                padding: 12px 15px;
                border-radius: 10px;
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 1px solid #e2e8f0;
                color: #334155;
                font-size: 13px;
                line-height: 1.5;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            `;
            const content = dimensionCheckModal.querySelector('div[style*="max-width: 580px"]');
            if (content) content.appendChild(bar);
            else dimensionCheckModal.appendChild(bar);
        }

        // 左侧状态文字区域
        let textEl = bar.querySelector('#rh-status-text');
        if (!textEl) {
            textEl = document.createElement('div');
            textEl.id = 'rh-status-text';
            textEl.style.cssText = `
                flex: 1;
                white-space: pre-line;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                background: rgba(255, 255, 255, 0.7);
                padding: 8px 10px;
                border-radius: 6px;
                border: 1px solid rgba(0, 0, 0, 0.1);
                font-size: 12px;
                line-height: 1.4;
            `;
            bar.appendChild(textEl);
        }

        // 格式化显示文本
        const formattedText = typeof text === 'string' ? text : JSON.stringify(text);
        textEl.textContent = formattedText;

        // 根据内容设置样式
        if (formattedText.includes('✅') || formattedText.includes('成功')) {
            textEl.style.background = 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
            textEl.style.borderColor = '#16a34a';
            textEl.style.color = '#166534';
        } else if (formattedText.includes('❌') || formattedText.includes('失败') || formattedText.includes('错误')) {
            textEl.style.background = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
            textEl.style.borderColor = '#dc2626';
            textEl.style.color = '#991b1b';
        } else if (formattedText.includes('🚫') || formattedText.includes('取消')) {
            textEl.style.background = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
            textEl.style.borderColor = '#d97706';
            textEl.style.color = '#92400e';
        } else {
            textEl.style.background = 'rgba(255, 255, 255, 0.7)';
            textEl.style.borderColor = 'rgba(0, 0, 0, 0.1)';
            textEl.style.color = '#334155';
        }

        // 右侧"取消任务"按钮
        let cancelBtn = bar.querySelector('#rh-cancel-btn');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'rh-cancel-btn';
            cancelBtn.textContent = '取消任务';
            cancelBtn.style.cssText = `
                padding: 8px 12px;
                background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                color: #b91c1c;
                border: 1px solid #fecaca;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            `;
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                cancelBtn.style.transform = 'translateY(-1px)';
                cancelBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                cancelBtn.style.transform = 'translateY(0)';
                cancelBtn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
            });
            cancelBtn.addEventListener('click', async () => {
                try {
                    if (!window._rhTaskIdForCancel || !window._rhApiKeyForCancel) {
                        updateDimensionModalProgress('未找到可取消的任务');
                        return;
                    }
                    if (window._rhCancelRequested) return;
                    window._rhCancelRequested = true;
                    cancelBtn.disabled = true;
                    cancelBtn.textContent = '取消中...';
                    cancelBtn.style.opacity = '0.6';
                    await cancelRunningHubTask(window._rhApiKeyForCancel, window._rhTaskIdForCancel);
                    updateDimensionModalProgress(`🆔 任务ID: ${window._rhTaskIdForCancel}\n🚫 任务已申请取消，请稍候更新状态...`);

                    // 取消任务后，重新启用提交按钮
                    const submitBtn = document.querySelector('#dimensionCheckSubmitBtn');
                    enableSubmitButton(submitBtn, 'canceled');
                } catch (e) {
                    updateDimensionModalProgress(`🆔 任务ID: ${window._rhTaskIdForCancel || 'unknown'}\n❌ 取消失败：${e.message}`);
                    cancelBtn.disabled = false;
                    cancelBtn.textContent = '取消任务';
                    cancelBtn.style.opacity = '1';
                    window._rhCancelRequested = false;
                }
            });
            bar.appendChild(cancelBtn);
        }
    } catch (_) {}
}

async function pollRunningHubTaskStatus(apiKey, taskId, onTick) {
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
            window._rhPollingActive = false;
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
        console.log(`\n======== RunningHub 任务状态轮询 #${pollCount} ========`);
        console.log(`🕐 时间: ${new Date().toLocaleTimeString()}`);
        console.log(`⏱️ 已耗时: ${Math.round((Date.now() - start) / 1000)}秒`);
        console.log(`🆔 任务ID: ${taskId}`);
        console.log(`📊 响应码: ${code}`);
        console.log(`📋 任务状态: ${status}`);
        console.log(`💬 消息: ${msg || '无'}`);
        console.log(`🔍 原始响应:`, data);

        // 状态分析
        const statusAnalysis = {
            'QUEUED': '🟡 任务排队中',
            'RUNNING': '🔵 任务执行中',
            'SUCCESS': '🟢 任务成功完成',
            'FAILED': '🔴 任务执行失败',
            'ERROR': '🔴 系统错误',
            'CANCELED': '🟠 任务已取消'
        };

        console.log(`📈 状态说明: ${statusAnalysis[status] || '❓ 未知状态'}`);

        if (status === 'FAILED' && data?.data?.failedReason) {
            console.log(`🚨 失败详情:`, data.data.failedReason);
        }

        console.log(`================================================\n`);

        if (typeof onTick === 'function') {
            onTick({ status, msg, pollCount, elapsed: Date.now() - start });
        }

        // 检查终止条件 - 任务完成、失败或出错
        if (code === 0 && ['SUCCESS', 'FAILED', 'ERROR', 'CANCELED'].includes(status)) {
            debugLog('任务终止条件满足，停止轮询', {
                finalStatus: status,
                pollCount,
                totalTime: Date.now() - start
            });

            // 打印轮询停止信息
            console.log(`\n🛑 ======== RunningHub 轮询已停止 ========`);
            console.log(`✅ 终止原因: 任务状态变为 ${status}`);
            console.log(`📊 总轮询次数: ${pollCount}`);
            console.log(`⏱️ 总耗时: ${Math.round((Date.now() - start) / 1000)}秒`);
            console.log(`🆔 任务ID: ${taskId}`);
            console.log(`📋 最终状态: ${statusAnalysis[status] || status}`);
            console.log(`==========================================\n`);

            try {
                const btn = document.querySelector('#rh-cancel-btn');
                if (btn) btn.style.display = 'none';
            } catch (_) {}

            window._rhPollingActive = false;
            return { final: status, raw: data, pollCount, totalTime: Date.now() - start };
        }

        // 检查超时
        if (Date.now() - start > maxWaitMs) {
            debugLog('轮询超时，强制停止', {
                pollCount,
                totalTime: Date.now() - start,
                lastStatus: status
            });

            // 打印超时停止信息
            console.log(`\n⏰ ======== RunningHub 轮询超时停止 ========`);
            console.log(`❌ 终止原因: 超时 (${Math.round(maxWaitMs / 1000)}秒)`);
            console.log(`📊 总轮询次数: ${pollCount}`);
            console.log(`📋 最后状态: ${status}`);
            console.log(`🆔 任务ID: ${taskId}`);
            console.log(`💡 建议: 任务可能仍在执行，请稍后手动查询`);
            console.log(`==========================================\n`);

            try {
                const btn = document.querySelector('#rh-cancel-btn');
                if (btn) btn.style.display = 'none';
            } catch (_) {}

            window._rhPollingActive = false;
            throw new Error(`轮询超时，任务仍未完成。最后状态: ${status}, 轮询${pollCount}次`);
        }

        // 等待下次轮询
        await new Promise(r => setTimeout(r, intervalMs));
    }
}

async function fetchRunningHubTaskOutputs(apiKey, taskId) {
    debugLog('开始获取任务输出', { apiKey: apiKey.substring(0, 10) + '...', taskId });

    const url = 'https://www.runninghub.cn/task/openapi/outputs';
    const headers = { 'Host': 'www.runninghub.cn', 'Content-Type': 'application/json' };
    const body = JSON.stringify({ apiKey, taskId });

    debugLog('发送输出查询请求', { url, body });

    const resp = await fetch(url, { method: 'POST', headers, body });

    if (!resp.ok) {
        const errorText = await resp.text();
        debugLog('输出查询HTTP错误', { status: resp.status, statusText: resp.statusText, errorText });
        throw new Error(`获取输出失败: HTTP ${resp.status} - ${errorText}`);
    }

    const result = await resp.json();
    debugLog('输出查询响应', result);

    // 详细打印输出查询结果
    console.log(`\n📥 ======== RunningHub 输出查询结果 ========`);
    console.log(`🕐 查询时间: ${new Date().toLocaleTimeString()}`);
    console.log(`🆔 任务ID: ${taskId}`);
    console.log(`📊 响应码: ${result.code}`);
    console.log(`💬 消息: ${result.msg || '无'}`);
    console.log(`📋 数据类型: ${typeof result.data}`);
    console.log(`📊 数据长度: ${Array.isArray(result.data) ? result.data.length : 'N/A'}`);
    console.log(`🔍 完整响应:`, result);

    if (Array.isArray(result.data) && result.data.length > 0) {
        console.log(`\n📸 ======== 输出项目详情 ========`);
        result.data.forEach((item, index) => {
            console.log(`📷 项目 #${index + 1}:`);
            console.log(`  🔗 fileUrl: ${item.fileUrl || '无'}`);
            console.log(`  📝 fileType: ${item.fileType || '无'}`);
            console.log(`  🔢 nodeId: ${item.nodeId || '无'}`);
            console.log(`  ⏱️ taskCostTime: ${item.taskCostTime || '无'}秒`);
            console.log(`  🔍 完整数据:`, item);
        });
        console.log(`=====================================`);
    } else {
        console.log(`⚠️ 无输出数据或数据为空`);
    }
    console.log(`==========================================\n`);

    // 详细记录API返回的结构
    debugLog('API输出结构分析', {
        code: result.code,
        msg: result.msg,
        hasData: !!result.data,
        dataType: typeof result.data,
        dataIsArray: Array.isArray(result.data),
        dataLength: Array.isArray(result.data) ? result.data.length : 'N/A',
        firstItem: Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null
    });

    return result;
}

async function cancelRunningHubTask(apiKey, taskId) {
    window._rhCancelRequested = true;
    const url = 'https://www.runninghub.cn/task/openapi/cancel';
    const headers = { 'Host': 'www.runninghub.cn', 'Content-Type': 'application/json' };
    const body = JSON.stringify({ apiKey, taskId });
    debugLog('发送取消任务请求', { taskId });
    const resp = await fetch(url, { method: 'POST', headers, body });
    if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        debugLog('取消任务HTTP错误', { status: resp.status, statusText: resp.statusText, body: t });
        throw new Error('取消失败: HTTP ' + resp.status);
    }
    const data = await resp.json().catch(() => ({}));
    debugLog('取消任务响应', data);
    if (data?.code !== 0) {
        throw new Error(data?.msg || '取消失败');
    }
    return data;
}

function renderRunningHubResultsInModal(outputsJson) {
    try {
        debugLog('开始渲染RunningHub结果', outputsJson);

        if (!isDimensionCheckModalOpen || !dimensionCheckModal) return;
        let wrap = dimensionCheckModal.querySelector('#rh-result-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'rh-result-wrap';
            wrap.style.cssText = `
                margin-top: 12px;
                padding: 12px;
                border-radius: 10px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
            `;
            const content = dimensionCheckModal.querySelector('div[style*="max-width: 580px"]');
            if (content) content.appendChild(wrap);
            else dimensionCheckModal.appendChild(wrap);
        }

        // 根据API文档，正确解析返回结果
        const outputs = outputsJson?.data || outputsJson?.outputs || outputsJson;
        const items = Array.isArray(outputs) ? outputs : (outputs?.outputs || []);

        debugLog('解析输出数据', {
            outputsJson,
            outputs,
            items: items ? items.length : 'null',
            itemsType: typeof items
        });

        wrap.innerHTML = '';

        if (!items || items.length === 0) {
            debugLog('无输出项目');
            wrap.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div style="font-size: 18px; margin-bottom: 10px;">📭</div>
                    <div>任务完成，但未返回可展示的输出。</div>
                    <div style="font-size: 12px; margin-top: 8px; color: #999;">
                        API返回: ${JSON.stringify(outputsJson).substring(0, 100)}...
                    </div>
                </div>
            `;
            return;
        }

        let hasRenderedContent = false;

        items.forEach((item, index) => {
            debugLog(`处理输出项目 #${index}`, item);

            // 根据API文档，正确的字段名是 fileUrl
            const fileUrl = item.fileUrl || item.url || item.imageUrl || item.value;
            const fileType = item.fileType || 'unknown';
            const nodeId = item.nodeId || 'unknown';
            const taskCostTime = item.taskCostTime || 0;
            const text = item.text || (typeof item.value === 'string' ? item.value : '');

            debugLog(`项目 #${index} 解析结果`, {
                fileUrl: fileUrl ? fileUrl.substring(0, 100) + '...' : 'no fileUrl',
                fileType,
                nodeId,
                taskCostTime,
                hasText: !!text
            });

            // 处理图片结果
            if (fileUrl && typeof fileUrl === 'string' && /(https?:\/\/|data:image)/i.test(fileUrl)) {
                debugLog(`渲染图片结果 #${index}`, fileUrl.substring(0, 50) + '...');

                const container = document.createElement('div');
                container.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 16px;
                    padding: 16px;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                `;

                // 图片信息标题
                const infoHeader = document.createElement('div');
                infoHeader.style.cssText = `
                    font-size: 14px;
                    font-weight: 600;
                    color: #374151;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;
                infoHeader.innerHTML = `
                    <span>🎨 生成结果 #${index + 1}</span>
                    <span style="font-size: 11px; color: #6b7280; font-weight: 400;">
                        ${fileType.toUpperCase()} • 节点${nodeId} • ${taskCostTime}s
                    </span>
                `;

                // 图片容器 - 添加点击查看大图功能和双向滚动支持
                const imgContainer = document.createElement('div');
                imgContainer.style.cssText = `
                    text-align: center;
                    cursor: pointer;
                    position: relative;
                    border-radius: 8px;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    max-height: 400px;
                    max-width: 100%;
                    border: 1px solid #e2e8f0;
                    background: #f9fafb;
                `;

                const img = document.createElement('img');
                img.src = fileUrl;
                img.alt = 'RunningHub生成结果';
                img.style.cssText = `
                    max-width: 100%;
                    max-height: 100%;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    border: none;
                    transition: all 0.2s ease;
                    display: block;
                `;

                // 添加悬停提示
                const hoverOverlay = document.createElement('div');
                hoverOverlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                `;
                hoverOverlay.innerHTML = '🔍 点击查看大图';

                // 悬停效果和滚动提示
                imgContainer.addEventListener('mouseenter', () => {
                    hoverOverlay.style.opacity = '1';
                    // 检查是否需要滚动并显示相应提示
                    const needsVerticalScroll = img.scrollHeight > imgContainer.clientHeight;
                    const needsHorizontalScroll = img.scrollWidth > imgContainer.clientWidth;

                    if (needsVerticalScroll || needsHorizontalScroll) {
                        if (needsVerticalScroll && needsHorizontalScroll) {
                            scrollIndicator.innerHTML = '↕️↔️ 双向滚动';
                        } else if (needsVerticalScroll) {
                            scrollIndicator.innerHTML = '↕️ 垂直滚动';
                        } else {
                            scrollIndicator.innerHTML = '↔️ 水平滚动';
                        }
                        scrollIndicator.style.opacity = '0.8';
                    }
                });

                imgContainer.addEventListener('mouseleave', () => {
                    hoverOverlay.style.opacity = '0';
                    scrollIndicator.style.opacity = '0';
                });

                // 移除滚轮提示与滚动处理，固定窗口内完整展示
                imgContainer.addEventListener('wheel', (e) => {
                    e.stopPropagation();
                });

                // 点击查看大图
                imgContainer.addEventListener('click', () => {
                    showImageLightbox(fileUrl, `生成结果 #${index + 1}`, {
                        fileType,
                        nodeId,
                        taskCostTime,
                        fileName: generateResultImageFileName(originalImage, fileType, index, '副本')
                    });
                });

                imgContainer.appendChild(img);
                imgContainer.appendChild(hoverOverlay);

                // 添加滚动指示器
                const scrollIndicator = document.createElement('div');
                scrollIndicator.style.cssText = `
                    position: absolute;
                    bottom: 8px;
                    right: 8px;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                    z-index: 10;
                `;
                scrollIndicator.innerHTML = '';
                imgContainer.appendChild(scrollIndicator);

                // 图片加载完成后，确保在固定窗口内完整展示
                img.addEventListener('load', () => {
                    scrollIndicator.style.display = 'none';
                });

                // 操作按钮区域
                const buttonContainer = document.createElement('div');
                buttonContainer.style.cssText = `
                    display: flex;
                    gap: 8px;
                    justify-content: center;
                    flex-wrap: wrap;
                `;

                // 查看大图按钮
                const viewBtn = document.createElement('button');
                viewBtn.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span>🔍</span>
                        查看大图
                    </span>
                `;
                viewBtn.style.cssText = `
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
                `;

                viewBtn.addEventListener('click', () => {
                    showImageLightbox(fileUrl, `生成结果 #${index + 1}`, {
                        fileType,
                        nodeId,
                        taskCostTime,
                        fileName: generateResultImageFileName(originalImage, fileType, index, '副本')
                    });
                });

                // 下载按钮 - 使用Chrome扩展下载
                const downloadBtn = document.createElement('button');
                downloadBtn.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span>📥</span>
                        下载并打开
                    </span>
                `;
                downloadBtn.style.cssText = `
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #059669 0%, #047857 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);
                `;

                downloadBtn.addEventListener('click', () => {
                    downloadImageToLocal(fileUrl, fileType, index, null, true); // 生成结果支持自动打开
                });

                // 上传图片按钮
                const uploadBtn = document.createElement('button');
                uploadBtn.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span>📤</span>
                        应用图片
                    </span>
                `;
                uploadBtn.style.cssText = `
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
                `;

                uploadBtn.addEventListener('click', () => {
                    uploadImageToAnnotationPlatform(fileUrl, fileType, index);
                });

                // 按钮悬停效果
                [viewBtn, downloadBtn, uploadBtn].forEach(btn => {
                    btn.addEventListener('mouseenter', () => {
                        btn.style.transform = 'translateY(-1px)';
                        if (btn === viewBtn) {
                            btn.style.boxShadow = '0 4px 8px rgba(99, 102, 241, 0.3)';
                        } else if (btn === downloadBtn) {
                            btn.style.boxShadow = '0 4px 8px rgba(5, 150, 105, 0.3)';
                        } else if (btn === uploadBtn) {
                            btn.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.3)';
                        }
                    });

                    btn.addEventListener('mouseleave', () => {
                        btn.style.transform = 'translateY(0)';
                        if (btn === viewBtn) {
                            btn.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.2)';
                        } else if (btn === downloadBtn) {
                            btn.style.boxShadow = '0 2px 4px rgba(5, 150, 105, 0.2)';
                        } else if (btn === uploadBtn) {
                            btn.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.2)';
                        }
                    });
                });

                buttonContainer.appendChild(viewBtn);
                buttonContainer.appendChild(downloadBtn);
                buttonContainer.appendChild(uploadBtn);

                container.appendChild(infoHeader);
                container.appendChild(imgContainer);
                container.appendChild(buttonContainer);
                wrap.appendChild(container);

                hasRenderedContent = true;
            }

            // 处理文本结果
            if (text && (!fileUrl || text !== fileUrl)) {
                debugLog(`渲染文本结果 #${index}`, text.substring(0, 50) + '...');

                const textContainer = document.createElement('div');
                textContainer.style.cssText = `
                    font-size: 13px;
                    color: #334155;
                    background: #f8fafc;
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 8px;
                    line-height: 1.4;
                `;
                textContainer.textContent = text;
                wrap.appendChild(textContainer);

                hasRenderedContent = true;
            }
        });

        if (!hasRenderedContent) {
            debugLog('未渲染任何内容');
            wrap.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div style="font-size: 18px; margin-bottom: 10px;">🤔</div>
                    <div>任务完成，但未找到可显示的结果。</div>
                    <div style="font-size: 12px; margin-top: 8px; color: #999;">
                        调试信息: ${JSON.stringify(outputsJson).substring(0, 200)}...
                    </div>
                </div>
            `;
        } else {
            debugLog('结果渲染完成', { itemCount: items.length });
        }

    } catch (e) {
        console.error('渲染结果失败:', e);
        debugLog('renderRunningHubResultsInModal失败:', e);
        updateDimensionModalProgress('渲染结果失败: ' + e.message);
    }
}

// 显示图片对比查看器（原图 vs 生成结果）
function showImageLightbox(resultImageUrl, title, metadata) {
    debugLog('显示图片对比查看器', {
        resultImageUrl: resultImageUrl.substring(0, 50) + '...',
        title,
        hasOriginalImage: !!originalImage
    });

    // 创建lightbox容器
    const lightbox = document.createElement('div');
    lightbox.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(10px);
        animation: fadeIn 0.3s ease;
    `;

    // 顶部信息栏
    const infoBar = document.createElement('div');
    infoBar.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 16px 24px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        max-width: 90%;
        z-index: 10;
    `;

    // 检查是否有原图可对比
    const hasOriginalImage = originalImage && originalImage.src;

    infoBar.innerHTML = `
        <div style="margin-bottom: 4px;">${title} ${hasOriginalImage ? '- 对比查看' : ''}</div>
        <div style="font-size: 12px; opacity: 0.8;">
            ${metadata.fileType?.toUpperCase() || 'IMAGE'} • 节点${metadata.nodeId} • 耗时${metadata.taskCostTime}s
        </div>
        ${hasOriginalImage ? '<div style="font-size: 11px; opacity: 0.6; margin-top: 4px;">左：原图 | 右：生成结果</div>' : ''}
    `;

    // 主要内容区域
    const mainContent = document.createElement('div');
    mainContent.style.cssText = `
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 80px 20px 100px 20px;
        gap: 20px;
    `;

    if (hasOriginalImage) {
        // 对比模式：显示原图和生成结果
        debugLog('创建对比查看模式');

        // 左侧：原图
        const originalContainer = createImageComparisonContainer(
            originalImage.src,
            '📸 原图',
            `${originalImage.width || '未知'} × ${originalImage.height || '未知'}px`,
            '#e3f2fd'
        );

        // 右侧：生成结果
        const resultContainer = createImageComparisonContainer(
            resultImageUrl,
            '🎨 生成结果',
            `${metadata.fileType?.toUpperCase() || 'IMAGE'} • 节点${metadata.nodeId}`,
            '#f3e5f5'
        );

        mainContent.appendChild(originalContainer);

        // 添加分隔线
        const separator = document.createElement('div');
        separator.style.cssText = `
            width: 2px;
            height: 80%;
            background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.3), transparent);
            border-radius: 1px;
        `;
        mainContent.appendChild(separator);

        mainContent.appendChild(resultContainer);

        // 添加同步滚动功能
        setTimeout(() => {
            // 获取两个图片容器的滚动元素（第二个子元素是imgWrapper）
            const originalImgWrapper = originalContainer.children[1];
            const resultImgWrapper = resultContainer.children[1];

            // 验证元素存在性
            if (originalImgWrapper && resultImgWrapper) {
                // 同步滚动事件
                let isSyncingScroll = false;

                // 创建防抖函数
                const debounceSync = (callback) => {
                    if (!isSyncingScroll) {
                        isSyncingScroll = true;
                        callback();
                        requestAnimationFrame(() => {
                            isSyncingScroll = false;
                        });
                    }
                };

                // 原图滚动同步到结果图
                originalImgWrapper.addEventListener('scroll', () => {
                    debounceSync(() => {
                        // 同步垂直滚动
                        const originalScrollTop = originalImgWrapper.scrollTop;
                        const originalScrollHeight = originalImgWrapper.scrollHeight;
                        const originalClientHeight = originalImgWrapper.clientHeight;

                        const resultScrollHeight = resultImgWrapper.scrollHeight;
                        const resultClientHeight = resultImgWrapper.clientHeight;

                        // 按比例同步滚动位置
                        const scrollRatio = originalScrollTop / (originalScrollHeight - originalClientHeight);
                        resultImgWrapper.scrollTop = scrollRatio * (resultScrollHeight - resultClientHeight);

                        // 同步水平滚动
                        const originalScrollLeft = originalImgWrapper.scrollLeft;
                        const originalScrollWidth = originalImgWrapper.scrollWidth;
                        const originalClientWidth = originalImgWrapper.clientWidth;

                        const resultScrollWidth = resultImgWrapper.scrollWidth;
                        const resultClientWidth = resultImgWrapper.clientWidth;

                        const scrollLeftRatio = originalScrollLeft / (originalScrollWidth - originalClientWidth);
                        resultImgWrapper.scrollLeft = scrollLeftRatio * (resultScrollWidth - resultClientWidth);
                    });
                });

                // 结果图滚动同步到原图
                resultImgWrapper.addEventListener('scroll', () => {
                    debounceSync(() => {
                        // 同步垂直滚动
                        const resultScrollTop = resultImgWrapper.scrollTop;
                        const resultScrollHeight = resultImgWrapper.scrollHeight;
                        const resultClientHeight = resultImgWrapper.clientHeight;

                        const originalScrollHeight = originalImgWrapper.scrollHeight;
                        const originalClientHeight = originalImgWrapper.clientHeight;

                        // 按比例同步滚动位置
                        const scrollRatio = resultScrollTop / (resultScrollHeight - resultClientHeight);
                        originalImgWrapper.scrollTop = scrollRatio * (originalScrollHeight - originalClientHeight);

                        // 同步水平滚动
                        const resultScrollLeft = resultImgWrapper.scrollLeft;
                        const resultScrollWidth = resultImgWrapper.scrollWidth;
                        const resultClientWidth = resultImgWrapper.clientWidth;

                        const originalScrollWidth = originalImgWrapper.scrollWidth;
                        const originalClientWidth = originalImgWrapper.clientWidth;

                        const scrollLeftRatio = resultScrollLeft / (resultScrollWidth - resultClientWidth);
                        originalImgWrapper.scrollLeft = scrollLeftRatio * (originalScrollWidth - originalClientWidth);
                    });
                });
            }
        }, 0);

    } else {
        // 单图模式：只显示生成结果 - 添加滚动支持
        debugLog('创建单图查看模式');

        const singleContainer = document.createElement('div');
        singleContainer.style.cssText = `
            max-width: 95%;
            max-height: 85vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            overflow: auto;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        `;

        const img = document.createElement('img');
        img.src = resultImageUrl;
        img.alt = title;
        img.style.cssText = `
            width: auto;
            height: auto;
            max-width: none;
            max-height: none;
            border-radius: 8px;
            min-width: 400px;
            min-height: 300px;
        `;

        singleContainer.appendChild(img);
        mainContent.appendChild(singleContainer);
    }

    // 底部操作栏
    const actionBar = document.createElement('div');
    actionBar.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 12px;
        z-index: 10;
    `;

    // 下载按钮
    const downloadBtn = document.createElement('button');
    downloadBtn.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span>📥</span>
            下载并打开
        </span>
    `;
    downloadBtn.style.cssText = `
        padding: 12px 20px;
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        color: white;
        border: none;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        backdrop-filter: blur(10px);
    `;

    downloadBtn.addEventListener('click', () => {
        downloadImageToLocal(resultImageUrl, metadata.fileType, 0, metadata.fileName, true); // 生成结果支持自动打开
        showNotification('开始下载生成结果...', 2000);
    });

    // 如果有原图，添加下载原图按钮
    if (hasOriginalImage) {
        const downloadOriginalBtn = document.createElement('button');
        downloadOriginalBtn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span>📸</span>
                下载原图
            </span>
        `;
        downloadOriginalBtn.style.cssText = `
            padding: 12px 20px;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            backdrop-filter: blur(10px);
        `;

        downloadOriginalBtn.addEventListener('click', () => {
            const originalFileName = generateResultImageFileName(originalImage, 'jpg', 0, '原图');
            downloadImageToLocal(originalImage.src, 'jpg', 0, originalFileName, false); // 原图不自动打开
            showNotification('开始下载原图...', 2000);
        });

        // 按钮悬停效果
        downloadOriginalBtn.addEventListener('mouseenter', () => {
            downloadOriginalBtn.style.transform = 'translateY(-2px)';
            downloadOriginalBtn.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
        });

        downloadOriginalBtn.addEventListener('mouseleave', () => {
            downloadOriginalBtn.style.transform = 'translateY(0)';
            downloadOriginalBtn.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
        });

        actionBar.appendChild(downloadOriginalBtn);
    }

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span>✖️</span>
            关闭
        </span>
    `;
    closeBtn.style.cssText = `
        padding: 12px 20px;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 25px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
    `;

    closeBtn.addEventListener('click', () => {
        lightbox.remove();
    });

    // 按钮悬停效果
    downloadBtn.addEventListener('mouseenter', () => {
        downloadBtn.style.transform = 'translateY(-2px)';
        downloadBtn.style.boxShadow = '0 6px 16px rgba(5, 150, 105, 0.4)';
    });

    downloadBtn.addEventListener('mouseleave', () => {
        downloadBtn.style.transform = 'translateY(0)';
        downloadBtn.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
    });

    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        closeBtn.style.transform = 'translateY(-2px)';
    });

    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        closeBtn.style.transform = 'translateY(0)';
    });

    actionBar.appendChild(downloadBtn);
    actionBar.appendChild(closeBtn);

    lightbox.appendChild(infoBar);
    lightbox.appendChild(mainContent);
    lightbox.appendChild(actionBar);

    // 点击背景关闭
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            lightbox.remove();
        }
    });

    // ESC键关闭
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            lightbox.remove();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);

    // 添加CSS动画
    if (!document.querySelector('#lightbox-styles')) {
        const styles = document.createElement('style');
        styles.id = 'lightbox-styles';
        styles.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(lightbox);
}

// 创建图片对比容器
function createImageComparisonContainer(imageUrl, label, info, accentColor) {
    const container = document.createElement('div');
    container.style.cssText = `
        flex: 1;
        max-width: 45%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    `;

    // 标签
    const labelElement = document.createElement('div');
    labelElement.style.cssText = `
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
    `;
    labelElement.textContent = label;

    // 图片容器 - 添加滚动支持
    const imgWrapper = document.createElement('div');
    imgWrapper.style.cssText = `
        position: relative;
        max-width: 100%;
        max-height: 70vh;
        border-radius: 12px;
        overflow: auto;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.3);
        border: 3px solid rgba(255, 255, 255, 0.1);
        background: ${accentColor || '#f8fafc'};
        display: flex;
        justify-content: center;
        align-items: flex-start;
    `;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = label;
    img.style.cssText = `
        width: auto;
        height: auto;
        max-width: none;
        max-height: none;
        border-radius: 8px;
        min-width: 300px;
        min-height: 200px;
    `;

    // 加载状态处理
    img.onload = () => {
        debugLog(`${label} 加载完成`, {
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
        });

        // 更新信息显示实际尺寸
        if (img.naturalWidth && img.naturalHeight) {
            infoElement.innerHTML = `
                <div>${info}</div>
                <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">
                    ${img.naturalWidth} × ${img.naturalHeight}px
                </div>
            `;
        }

        // 检查是否需要滚动并添加提示
        setTimeout(() => {
            const needsVerticalScroll = img.scrollHeight > imgWrapper.clientHeight;
            const needsHorizontalScroll = img.scrollWidth > imgWrapper.clientWidth;

            if (needsVerticalScroll || needsHorizontalScroll) {
                const scrollHint = document.createElement('div');
                scrollHint.style.cssText = `
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 500;
                    opacity: 1;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                    z-index: 10;
                `;

                if (needsVerticalScroll && needsHorizontalScroll) {
                    scrollHint.innerHTML = '↕️↔️ 滚动查看';
                } else if (needsVerticalScroll) {
                    scrollHint.innerHTML = '↕️ 滚动查看';
                } else {
                    scrollHint.innerHTML = '↔️ 滚动查看';
                }

                imgWrapper.appendChild(scrollHint);

                // 3秒后自动隐藏
                setTimeout(() => {
                    scrollHint.style.opacity = '0';
                }, 3000);
            }
        }, 100);
    };

    img.onerror = () => {
        debugLog(`${label} 加载失败`);
        imgWrapper.innerHTML = `
            <div style="color: #dc2626; text-align: center; padding: 20px;">
                <div style="font-size: 24px; margin-bottom: 8px;">❌</div>
                <div>图片加载失败</div>
            </div>
        `;
    };

    // 信息显示
    const infoElement = document.createElement('div');
    infoElement.style.cssText = `
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 8px 12px;
        border-radius: 15px;
        font-size: 11px;
        text-align: center;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        line-height: 1.3;
    `;
    infoElement.innerHTML = `
        <div>${info}</div>
        <div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">加载中...</div>
    `;

    imgWrapper.appendChild(img);
    container.appendChild(labelElement);
    container.appendChild(imgWrapper);
    container.appendChild(infoElement);

    return container;
}

// 上传生成结果图片到标注平台 - 直接上传结果图
async function uploadImageToAnnotationPlatform(imageUrl, fileType, index) {
    try {
        debugLog('开始直接上传生成结果到标注平台', {
            imageUrl: imageUrl.substring(0, 50) + '...',
            fileType,
            index
        });

        showNotification('正在获取生成结果图片...', 1000);

        // 获取图片数据
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`获取图片失败: HTTP ${response.status}`);
        }

        const blob = await response.blob();
        debugLog('图片数据获取成功', { size: blob.size, type: blob.type });

        // 创建File对象 - 使用智能文件名
        const fileName = generateResultImageFileName(originalImage, fileType, index, '副本');
        const file = new File([blob], fileName, { type: blob.type });

        showNotification('正在查找上传位置...', 1000);

        // 直接查找现有的文件输入框
        let fileInput = document.querySelector('input[type="file"]:not([style*="display: none"])');

        if (!fileInput) {
            // 查找所有文件输入框（包括隐藏的）
            const allFileInputs = document.querySelectorAll('input[type="file"]');
            if (allFileInputs.length > 0) {
                fileInput = allFileInputs[allFileInputs.length - 1]; // 使用最新的
                debugLog('使用隐藏的文件输入框');
            }
        }

        if (!fileInput) {
            // 如果还是没有，尝试触发A键功能
            debugLog('未找到文件输入框，尝试触发A键功能');
            showNotification('正在触发上传功能...', 1000);

            // 模拟A键按下
            const uploadButton = findButtonByText(['上传图片', '上传', 'Upload', '选择图片', '选择文件']);
            if (uploadButton) {
                uploadButton.click();

                // 等待文件输入框出现
                await new Promise(resolve => setTimeout(resolve, 1500));

                const newFileInputs = document.querySelectorAll('input[type="file"]');
                if (newFileInputs.length > 0) {
                    fileInput = newFileInputs[newFileInputs.length - 1];
                } else {
                    throw new Error('触发上传后仍未找到文件输入框');
                }
            } else {
                throw new Error('未找到上传按钮');
            }
        }

        debugLog('找到文件输入框，开始上传', {
            inputId: fileInput.id || '无ID',
            inputName: fileInput.name || '无name'
        });

        // 直接设置文件到输入框
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // 触发所有相关事件
        const events = ['change', 'input', 'blur'];
        events.forEach(eventType => {
            const event = new Event(eventType, { bubbles: true });
            fileInput.dispatchEvent(event);
        });

        debugLog('生成结果已直接上传到标注平台');
        showNotification(`✅ 生成结果已上传: ${file.name}`, 3000);

        // 检查上传是否成功（通过检测页面变化）
        setTimeout(() => {
            // 检查是否有预览显示
            const previewImages = document.querySelectorAll('img[src*="blob:"], img[src*="data:"]');
            if (previewImages.length > 0) {
                debugLog('检测到图片预览，上传成功');
                showNotification('📸 图片已成功上传到标注页面', 2000);
            } else {
                debugLog('未检测到图片预览，可能需要手动检查');
                showNotification('图片已上传，请检查页面显示', 2000);
            }
        }, 1500);

    } catch (error) {
        debugLog('直接上传生成结果失败:', error);
        showNotification('上传失败：' + error.message, 3000);
    }
}

// 生成RunningHub结果图的智能文件名
function generateResultImageFileName(originalImageInfo, fileType, index = 0, suffix = '副本') {
    try {
        let baseName = 'runninghub-result';

        // 尝试从原图获取文件名
        if (originalImageInfo && originalImageInfo.src) {
            const originalFileName = extractFileNameFromUrl(originalImageInfo.src);
            if (originalFileName && originalFileName !== '未知' && originalFileName !== '原图') {
                // 移除原始扩展名
                baseName = originalFileName.replace(/\.[^/.]+$/, '');
                debugLog('从原图提取文件名', { originalFileName, baseName });
            }
        }

        // 如果baseName仍是默认值，尝试其他方式
        if (baseName === 'runninghub-result') {
            if (originalImageInfo && originalImageInfo.name) {
                baseName = originalImageInfo.name.replace(/\.[^/.]+$/, '');
            } else if (originalImageInfo && originalImageInfo.element && originalImageInfo.element.alt) {
                baseName = originalImageInfo.element.alt.replace(/\.[^/.]+$/, '') || 'image';
            }
        }

        // 清理文件名，移除特殊字符
        baseName = baseName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();

        // 确保文件名不为空
        if (!baseName || baseName.length < 1) {
            baseName = 'image';
        }

        // 生成最终文件名
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const extension = fileType || 'png';

        let finalName;
        if (index > 0) {
            finalName = `${baseName}_${suffix}_${index + 1}_${timestamp}.${extension}`;
        } else {
            finalName = `${baseName}_${suffix}_${timestamp}.${extension}`;
        }

        debugLog('生成结果图文件名', {
            originalSrc: originalImageInfo?.src?.substring(0, 50) + '...',
            baseName,
            suffix,
            index,
            timestamp,
            extension,
            finalName
        });

        return finalName;

    } catch (error) {
        debugLog('生成文件名失败，使用默认名称:', error);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        return `runninghub-result-${timestamp}-${index + 1}.${fileType || 'png'}`;
    }
}

// 下载图片到本地 - 支持自动打开选项
function downloadImageToLocal(imageUrl, fileType, index, customFileName = null, autoOpen = true) {
    try {
        debugLog('开始下载图片到本地', {
            imageUrl: imageUrl.substring(0, 50) + '...',
            fileType,
            index,
            autoOpen
        });

        // 生成智能文件名
        const fileName = customFileName || generateResultImageFileName(originalImage, fileType, index, '副本');

        debugLog('生成的文件名', fileName);

        // 检查Chrome扩展API
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            debugLog('Chrome扩展API不可用，使用fetch下载方案');
            downloadViaFetch(imageUrl, fileName);
            return;
        }

        // 使用Chrome扩展的下载API - 支持自动打开控制
        debugLog('使用Chrome扩展下载API', { autoOpen });

        chrome.runtime.sendMessage({
            action: 'downloadImage',
            imageUrl: imageUrl,
            filename: fileName,
            pageUrl: window.location.href,
            autoOpen: autoOpen // 传递自动打开参数
        }, (response) => {
            if (chrome.runtime.lastError) {
                debugLog('Chrome下载失败，尝试备用方案:', chrome.runtime.lastError);
                // 如果Chrome下载失败，尝试fetch下载
                downloadViaFetch(imageUrl, fileName);
            } else if (response && response.success) {
                debugLog('Chrome下载请求发送成功:', response);
                const openText = autoOpen ? '（将自动打开）' : '';
                showNotification(`✅ 开始下载: ${fileName}${openText}`, 3000);
            } else {
                debugLog('Chrome下载被拒绝，尝试备用方案:', response);
                downloadViaFetch(imageUrl, fileName);
            }
        });

    } catch (error) {
        debugLog('下载图片失败:', error);
        showNotification('下载失败：' + error.message, 3000);
    }
}

// 创建模拟图片数据
// function createSampleImageAsBase64() {
//     // 创建一个简单的SVG图片作为模拟数据
//     const svgData = `
//         <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
//             <rect width="100%" height="100%" fill="#f0f0f0"/>
//             <circle cx="200" cy="150" r="80" fill="#4CAF50"/>
//             <text x="200" y="155" text-anchor="middle" font-family="Arial" font-size="24" fill="white">
//                 Sample Image
//             </text>
//             <text x="200" y="185" text-anchor="middle" font-family="Arial" font-size="16" fill="white">
//                 ${new Date().toLocaleTimeString()}
//             </text>
//         </svg>
//     `;

//     // 转换为base64
//     const svgBase64 = btoa(svgData);
//     return `data:image/svg+xml;base64,${svgBase64}`;
// }

// 添加一个测试函数来发送POST请求到Native Host
async function sendPostRequestToNativeHost() {
    try {
        console.log('准备发送POST请求到Native Host');
        // 获取当前原图和上传的图片
        let originalImageData = null;
        // 获取原图数据
        if (originalImage && originalImage.src) {
            try {
                originalImageData = await getImageAsBase64(originalImage.src);
                console.log('原图数据获取成功');
            } catch (error) {
                console.error('获取原图数据失败:', error);
                showNotification('❌ 获取原图数据失败: ' + error.message, 3000);
                return;
            }
        } else {
            // 如果没有原图，直接返回而不发送数据
            console.log('未找到原图，取消发送请求');
            showNotification('ℹ️ 未找到原图，取消发送请求', 3000);
            return;
        }

        annotatedImageData = originalImageData;

        // 获取标注指令文本
        const instructionText = extractInstructionText();
        const instructions = instructionText || "未正确匹配指令，人工核对";

        // 准备要发送的数据
        const imageData = {
            original_image: originalImageData,
            instructions: instructions,
            metadata: {
                source: "annotateflow-assistant",
                format: "base64",
                timestamp: Date.now(),
                page_url: window.location.href
            }
        };

        console.log('发送的数据:', imageData);

        // 发送POST请求到Native Host的HTTP服务器（使用新的Chrome数据端点）
        const response = await fetch('http://localhost:8888/api/chrome-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(imageData)
        });

        console.log('收到响应:', response);

        if (response.ok) {
            const result = await response.json();
            console.log('POST请求成功:', result);
            showNotification('✅ 图片数据发送成功', 3000);
        } else {
            console.error('POST请求失败:', response.status, response.statusText);
            showNotification('❌ 图片数据发送失败: ' + response.status, 3000);
        }
    } catch (error) {
        console.error('发送POST请求时出错:', error);
        showNotification('❌ 发送图片数据出错: ' + error.message, 3000);
    }
}



// 将图片URL转换为base64编码
async function getImageAsBase64(imageUrl) {
    return new Promise((resolve, reject) => {
        // 检查是否是跨域图片
        const isCrossOrigin = !imageUrl.startsWith(window.location.origin) &&
                             !imageUrl.startsWith('data:') &&
                             !imageUrl.startsWith('blob:');

        if (isCrossOrigin) {
            // 对于跨域图片，使用background script代理获取
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'fetchCOSImage',
                    url: imageUrl
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    if (response && response.success && response.data && response.data.dataUrl) {
                        resolve(response.data.dataUrl);
                    } else {
                        reject(new Error(response?.error || '获取图片数据失败'));
                    }
                });
            } else {
                reject(new Error('无法获取跨域图片数据'));
            }
        } else {
            // 对于同域图片，使用Canvas转换
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    canvas.width = this.naturalWidth;
                    canvas.height = this.naturalHeight;

                    ctx.drawImage(this, 0, 0);

                    const dataUrl = canvas.toDataURL('image/png');
                    resolve(dataUrl);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = function() {
                reject(new Error('图片加载失败'));
            };

            img.src = imageUrl;
        }
    });
}

// 通过fetch下载图片 - 备用方案
async function downloadViaFetch(imageUrl, fileName) {
    try {
        debugLog('使用fetch下载方案', { imageUrl: imageUrl.substring(0, 50) + '...', fileName });

        showNotification('正在获取图片数据...', 2000);

        // 获取图片数据
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        debugLog('图片数据获取成功', { size: blob.size, type: blob.type });

        // 创建下载链接
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';

        // 添加到DOM并触发下载
        document.body.appendChild(link);
        link.click();

        // 清理
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            debugLog('下载链接已清理');
        }, 100);

        showNotification(`✅ 下载完成: ${fileName}`, 3000);

    } catch (error) {
        debugLog('fetch下载失败:', error);
        showNotification('下载失败：' + error.message, 3000);
    }
}

// Running Hub AI应用配置缓存
let RUNNINGHUB_CONFIG = null;

// 加载Running Hub配置文件
async function loadRunningHubConfig() {
    if (RUNNINGHUB_CONFIG) {
        return RUNNINGHUB_CONFIG; // 如果已加载，直接返回缓存
    }
    
    try {
        const configUrl = chrome.runtime.getURL('runninghub-config.json');
        const response = await fetch(configUrl);
        
        if (!response.ok) {
            throw new Error(`配置文件加载失败: ${response.status}`);
        }
        
        RUNNINGHUB_CONFIG = await response.json();
        debugLog('Running Hub配置加载成功:', RUNNINGHUB_CONFIG);
        return RUNNINGHUB_CONFIG;
        
    } catch (error) {
        debugLog('配置文件加载失败，使用默认配置:', error);
        
        // 如果配置文件加载失败，使用默认配置
        RUNNINGHUB_CONFIG = {
            defaultWorkflow: {
                webappId: "1967790629851922434",
                nodeInfoList: [
                    {
                        nodeId: "189",
                        fieldName: "image",
                        fieldValue: "{IMAGE_FILE}",
                        description: "image"
                    },
                    {
                        nodeId: "191",
                        fieldName: "prompt",
                        fieldValue: "{PROMPT}",
                        description: "prompt"
                    }
                ]
            }
        };
        
        return RUNNINGHUB_CONFIG;
    }
}

// 从Native Host获取图片数据
async function getNativeHostImageData() {
    try {
        showNotification('正在获取Native Host图片数据...', 2000);
        debugLog('开始获取Native Host图片数据');

        let url = 'http://localhost:8888/api/external-data'
        
        // 向native host发送请求获取图片数据
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`获取图片数据失败: HTTP ${response.status}`);
        }

        const imageData = await response.json();
        debugLog('Native Host图片数据获取成功:', imageData);

        // 检查是否有图片数据
        if (!imageData.original_image && !imageData.modified_image) {
            showNotification('❌ 未找到图片数据', 3000);
            return null;
        }

        showNotification('✅ 图片数据获取成功！', 2000);
        return imageData;
    } catch (error) {
        console.error('获取Native Host图片数据失败:', error);
        debugLog(`获取Native Host图片数据失败: ${error.message}`);
        showNotification(`❌ 获取图片数据失败: ${error.message}`, 3000);
        return null;
    }
}

// 上传Native Host图片数据到标注平台（默认同时上传修改图和蒙版图）
async function uploadNativeHostImageToAnnotationPlatform() {
    try {
        // 获取native host中的图片数据，指定数据源为external_application以获取PS插件上传的数据
        const imageData = await getNativeHostImageData();
        if (!imageData) {
            return;
        }

        showNotification('正在处理图片数据...', 1000);

        // 收集要上传的图片
        const imagesToUpload = [];

        // 添加PS修改图（如果存在）
        if (imageData.modified_image) {
            imagesToUpload.push({
                data: imageData.modified_image,
                fileName: 'ps_modified_image.png',
                imageType: 'PS修改图',
                uploadTarget: 'ps'
            });
        }

        // 添加蒙版图（如果存在）
        if (imageData.mask_image) {
            imagesToUpload.push({
                data: imageData.mask_image,
                fileName: 'mask_image.png',
                imageType: '蒙版图',
                uploadTarget: 'mask'
            });
        }

        // 检查是否有图片需要上传
        if (imagesToUpload.length === 0) {
            showNotification('❌ 未找到可上传的图片', 3000);
            return;
        }

        // 顺序上传所有图片
        let successfulUploads = 0;
        for (let i = 0; i < imagesToUpload.length; i++) {
            const image = imagesToUpload[i];
            try {
                debugLog('开始上传图片', { index: i+1, total: imagesToUpload.length, imageType: image.imageType, target: image.uploadTarget });
                await uploadSingleImage(image.data, image.fileName, image.imageType, image.uploadTarget);
                successfulUploads++;
                debugLog('图片上传完成', { imageType: image.imageType });

                // 如果不是最后一张图片，等待更长时间再上传下一张，确保上传操作完全完成
                if (i < imagesToUpload.length - 1) {
                    debugLog('等待下一张图片上传');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (error) {
                console.error(`${image.imageType}上传失败:`, error);
                debugLog(`${image.imageType}上传失败: ${error.message}`);
                showNotification(`❌ ${image.imageType}上传失败: ${error.message}`, 3000);
                // 继续上传下一张图片，不中断整个流程
            }
        }

        // 显示最终结果
        if (successfulUploads > 0) {
            if (successfulUploads === imagesToUpload.length) {
                showNotification(`✅ 成功上传所有${successfulUploads}张图片！`, 3000);
            } else {
                showNotification(`✅ 成功上传${successfulUploads}张图片，${imagesToUpload.length - successfulUploads}张失败`, 3000);
            }
        } else {
            showNotification('❌ 所有图片上传失败', 3000);
        }

    } catch (error) {
        console.error('上传Native Host图片失败:', error);
        debugLog(`上传Native Host图片失败: ${error.message}`);
        showNotification(`❌ 上传失败: ${error.message}`, 3000);
    }
}

// 切换到指定的上传标签页
async function switchToUploadTab(tabType) {
    try {
        // 根据标签页类型查找并点击对应的标签页按钮
        debugLog('查找标签页切换按钮', { tabType });

        // 直接通过CSS选择器和精确文本内容查找标签页
        let tabButton = null;
        const tabElements = document.querySelectorAll('span.t-tabs__nav-item-text-wrapper');

        debugLog('找到标签页元素数量', { count: tabElements.length });

        if (tabType === 'ps') {
            // 查找PS后图片上传标签页
            for (const element of tabElements) {
                debugLog('检查标签页元素', { textContent: element.textContent });
                if (element.textContent && element.textContent.trim() === 'PS后图片上传') {
                    tabButton = element;
                    debugLog('找到PS后图片上传标签页');
                    break;
                }
            }
        } else if (tabType === 'mask') {
            // 查找蒙版图片上传标签页
            for (const element of tabElements) {
                debugLog('检查标签页元素', { textContent: element.textContent });
                if (element.textContent && element.textContent.trim() === '蒙版图片上传') {
                    tabButton = element;
                    debugLog('找到蒙版图片上传标签页');
                    break;
                }
            }
        }

        // 如果找到了标签页按钮，点击切换
        if (tabButton) {
            // 点击标签页按钮的父元素，因为通常父元素是可点击的
            const clickableElement = tabButton.closest('div') || tabButton;
            clickableElement.click();
            debugLog('已点击标签页按钮进行切换', { tabType });

            // 增加等待时间确保标签页切换完成
            await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
            // 如果没有找到标签页按钮，尝试使用文本查找方法
            debugLog('未通过CSS选择器找到标签页按钮，尝试文本查找方法', { tabType });

            // 定义不同标签页的按钮文本
            let tabButtonText = [];
            if (tabType === 'ps') {
                tabButtonText = ['PS后图片上传', 'PS后图片', 'PS修改图', '后处理图片', '处理后图片'];
            } else if (tabType === 'mask') {
                tabButtonText = ['蒙版图片上传', '蒙版图上传', '蒙版图片', '蒙版图', '蒙版', 'Mask图', '遮罩图'];
            }

            // 查找标签页按钮
            let fallbackTabButton = null;
            for (const buttonText of tabButtonText) {
                fallbackTabButton = findButtonByText([buttonText]);
                if (fallbackTabButton) {
                    debugLog('通过文本查找找到标签页按钮', { buttonText });
                    break;
                }
            }

            // 如果找到了标签页按钮，点击切换
            if (fallbackTabButton) {
                fallbackTabButton.click();
                debugLog('已点击标签页按钮进行切换', { tabType, method: 'fallback' });

                // 增加等待时间确保标签页切换完成
                await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
                // 如果没有找到标签页按钮
                debugLog('未找到标签页按钮', { tabType });
                showNotification(`⚠️ 未找到${tabType === 'ps' ? 'PS后图片' : '蒙版图片'}上传标签页`, 2000);
                // 即使没有找到标签页也等待一下，防止后续操作出现问题
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

    } catch (error) {
        console.error('切换标签页失败:', error);
        debugLog(`切换标签页失败: ${error.message}`);
        // 发生错误时也等待一下，防止后续操作出现问题
        await new Promise(resolve => setTimeout(resolve, 1000));
        throw error;
    }
}

// 上传单张图片的辅助函数
async function uploadSingleImage(base64Data, fileName, imageType, uploadTarget) {
    try {
        // 将base64数据转换为Blob
        const byteString = atob(base64Data.split(',')[1]);
        const mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });

        // 创建File对象
        const file = new File([blob], fileName, { type: mimeString });

        // 根据上传目标切换到对应的标签页
        debugLog('切换到指定上传标签页', { target: uploadTarget, imageType });

        if (uploadTarget === 'ps') {
            await switchToUploadTab('ps');
        } else if (uploadTarget === 'mask') {
            await switchToUploadTab('mask');
        }

        // 增加更长的等待时间确保标签页切换完全完成
        debugLog('等待标签页切换完全完成');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 查找文件输入框
        let fileInput = document.querySelector('input[type="file"]:not([style*="display: none"])');
        if (!fileInput) {
            // 查找所有文件输入框（包括隐藏的）
            const allFileInputs = document.querySelectorAll('input[type="file"]');
            if (allFileInputs.length > 0) {
                fileInput = allFileInputs[allFileInputs.length - 1]; // 使用最新的
                debugLog('使用隐藏的文件输入框');
            }
        }

        if (!fileInput) {
            // 如果还是没有，尝试触发A键功能
            debugLog('未找到文件输入框，尝试触发A键功能');
            showNotification('正在触发上传功能...', 1000);
            // 模拟A键按下
            const defaultUploadButton = findButtonByText(['上传图片', '上传', 'Upload', '选择图片', '选择文件']);
            if (defaultUploadButton) {
                defaultUploadButton.click();
                // 增加等待时间确保文件输入框出现
                debugLog('等待文件输入框出现');
                await new Promise(resolve => setTimeout(resolve, 2000));
                const newFileInputs = document.querySelectorAll('input[type="file"]');
                if (newFileInputs.length > 0) {
                    fileInput = newFileInputs[newFileInputs.length - 1];
                }
            }
        }

        if (fileInput) {
            // 创建DataTransfer对象来模拟文件选择
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;

            // 触发change事件
            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);

            debugLog('文件上传成功', { fileName, fileSize: file.size, target: uploadTarget, imageType });
            showNotification(`✅ ${imageType}上传成功！`, 2000);
        } else {
            showNotification('❌ 未找到上传位置', 3000);
        }
    } catch (error) {
        console.error('上传单张图片失败:', error);
        debugLog(`上传单张图片失败: ${error.message}`);
        showNotification(`❌ ${imageType}上传失败: ${error.message}`, 3000);
        throw error;
    }
}

// 创建Running Hub AI应用任务
async function createWorkflowTask(apiKey, prompt, imageFileName = null, workflowName = 'defaultWorkflow') {
    const myHeaders = new Headers();
    myHeaders.append("Host", "www.runninghub.cn");
    myHeaders.append("Content-Type", "application/json");

    // 加载配置文件
    const config = await loadRunningHubConfig();

    // 获取AI应用配置
    let appConfig;
    if (workflowName === 'defaultWorkflow') {
        appConfig = config.defaultWorkflow;
    } else {
        appConfig = config.workflows[workflowName] || config.defaultWorkflow;
    }

    if (!appConfig) {
        throw new Error(`未找到AI应用配置: ${workflowName}`);
    }

    // 深拷贝配置并替换占位符
    const nodeInfoList = JSON.parse(JSON.stringify(appConfig.nodeInfoList));
    nodeInfoList.forEach(node => {
        if (node.fieldValue === "{PROMPT}") {
            node.fieldValue = prompt;
        } else if (node.fieldValue === "{IMAGE_FILE}" && imageFileName) {
            node.fieldValue = imageFileName;
        }
    });

    const raw = JSON.stringify({
        "webappId": appConfig.webappId,
        "apiKey": apiKey,
        "nodeInfoList": nodeInfoList
    });

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow'
    };

    // 使用AI应用API端点
    const response = await fetch("https://www.runninghub.cn/task/openapi/ai-app/run", requestOptions);

    if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.text();
    return result;
}